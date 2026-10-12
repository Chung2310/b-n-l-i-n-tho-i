import { inInventoryTransaction } from "../../modules/inventory/inventory-transaction";
import { InventoryCountModel } from "../../model/inventory-count.model";
import { GoodsReceiptModel } from "../../model/goods-receipt.model";
import { InventoryBalanceModel } from "../../model/inventory-balance.model";
import { InventoryLedgerEntryModel } from "../../model/inventory-ledger-entry.model";
import { ProductCatalogLegacyMappingModel } from "../../model/product-catalog-legacy-mapping.model";
import { ProductCatalogModel } from "../../model/product-catalog.model";
import { ProductPriceModel } from "../../model/product-price.model";
import { ProductVariantModel } from "../../model/product-variant.model";
import { StockLogModel } from "../../model/stock-log.model";
import { RetailAfterSaleModel } from "../../modules/retail/models/retail-after-sale.model";
import { RetailOrderModel } from "../../modules/retail/models/retail-order.model";
import { SerialUnitModel } from "../../modules/inventory/serials/serial-unit.model";
import { InventoryTransferModel } from "../../modules/inventory/transfers/transfer.model";
import { RepairPartModel } from "../../modules/repair/repair-part.model";
import { TikTokShopProductModel } from "./tiktok-shop-product.model";

const CONFIRM_PHRASE = "DELETE_IMPORTED_TIKTOK_PRODUCTS";
const MAX_PRODUCTS_PER_REQUEST = 50;

function cleanupError(message: string, statusCode = 400, code?: string) {
  return Object.assign(new Error(message), { statusCode, ...(code ? { code } : {}) });
}

function normalizeCompany(value: unknown) {
  const companyCode = String(value || "").trim().toUpperCase();
  if (!companyCode) throw cleanupError("Tài khoản chưa được gắn với công ty.", 400);
  return companyCode;
}

function normalizeTikTokProductIds(value: unknown) {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_PRODUCTS_PER_REQUEST) {
    throw cleanupError(`Cần truyền từ 1 đến ${MAX_PRODUCTS_PER_REQUEST} mã sản phẩm TikTok.`);
  }
  const ids = value.map((item) => String(item || "").trim());
  if (ids.some((id) => !/^\d{1,64}$/.test(id))) throw cleanupError("Mã sản phẩm TikTok không hợp lệ.");
  if (new Set(ids).size !== ids.length) throw cleanupError("Danh sách mã sản phẩm TikTok không được trùng.");
  return ids;
}

function assertCompanyEnabled(companyCode: string) {
  const allowed = new Set(String(process.env.TIKTOK_IMPORT_CLEANUP_COMPANY_CODES || "")
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean));
  if (!allowed.has(companyCode)) {
    throw cleanupError("API dọn sản phẩm TikTok chưa được bật cho công ty này.", 403, "TIKTOK_IMPORT_CLEANUP_DISABLED");
  }
}

function importedSkuCode(sku: any) {
  const sellerSku = String(sku?.sellerSku || "").trim();
  const skuId = String(sku?.skuId || "").trim();
  return (sellerSku || (skuId ? `TT-${skuId}` : "")).toUpperCase().slice(0, 100);
}

function withSession(query: any, session: any) {
  return query.session(session);
}

/**
 * Removes only explicitly selected TikTok-imported catalog products and their
 * untouched stock baselines. Historical inventory/business documents are never
 * deleted; any such reference blocks the entire request before it writes.
 */
export async function cleanupTikTokImportedProducts(input: {
  companyCode: unknown;
  tiktokProductIds: unknown;
  dryRun?: boolean;
  confirm?: unknown;
}) {
  const companyCode = normalizeCompany(input.companyCode);
  assertCompanyEnabled(companyCode);
  const tiktokProductIds = normalizeTikTokProductIds(input.tiktokProductIds);
  if (input.dryRun !== undefined && typeof input.dryRun !== "boolean") throw cleanupError("dryRun phải là true hoặc false.");
  const dryRun = input.dryRun !== false;
  const confirm = String(input.confirm || "").trim();
  if (!dryRun && confirm !== CONFIRM_PHRASE) {
    throw cleanupError(`Để xác nhận xóa, truyền confirm="${CONFIRM_PHRASE}".`);
  }

  return inInventoryTransaction(async (session) => {
    const productCodes = tiktokProductIds.map((id) => `TT-${id}`.toUpperCase());
    const channelProducts = await withSession(TikTokShopProductModel.find({ companyCode, tiktokProductId: { $in: tiktokProductIds } }), session).lean();
    const products = await withSession(ProductCatalogModel.find({ companyCode, productCode: { $in: productCodes } }), session).lean();
    const channelIds = new Set(channelProducts.map((item: any) => String(item.tiktokProductId)));
    const productByCode = new Map<string, any>(products.map((item: any) => [String(item.productCode).toUpperCase(), item] as [string, any]));
    const missing = tiktokProductIds.filter((id) => !channelIds.has(id) || !productByCode.has(`TT-${id}`.toUpperCase()));
    if (missing.length) {
      throw cleanupError(`Không tìm thấy đủ sản phẩm TikTok đã nhập trong công ty này: ${missing.join(", ")}.`, 404, "TIKTOK_IMPORT_NOT_FOUND");
    }

    const productIds = tiktokProductIds.map((id) => String(productByCode.get(`TT-${id}`.toUpperCase())!._id));
    const variants = await withSession(ProductVariantModel.find({ companyCode, productId: { $in: productIds } }), session).lean();
    const variantIds = variants.map((variant: any) => String(variant._id));
    if (!variantIds.length) throw cleanupError("Sản phẩm TikTok không còn SKU nội bộ để dọn.", 409, "TIKTOK_IMPORT_VARIANTS_MISSING");

    const variantIdsByProduct = new Map<string, Set<string>>();
    for (const variant of variants as any[]) {
      const key = String(variant.productId);
      const set = variantIdsByProduct.get(key) || new Set<string>();
      set.add(String(variant._id));
      variantIdsByProduct.set(key, set);
    }
    for (const id of tiktokProductIds) {
      const product: any = productByCode.get(`TT-${id}`.toUpperCase());
      const productId = String(product._id);
      const sourceRows = channelProducts.filter((row: any) => String(row.tiktokProductId) === id);
      const importedSkus = new Set(sourceRows.flatMap((row: any) => (row.skus || []).map(importedSkuCode).filter(Boolean)));
      const productVariants = variants.filter((variant: any) => String(variant.productId) === productId);
      if (!importedSkus.size || productVariants.some((variant: any) => !importedSkus.has(String(variant.sku || "").trim().toUpperCase()))) {
        throw cleanupError(`SKU của sản phẩm ${id} không khớp đầy đủ với dữ liệu TikTok đã đồng bộ; không xóa để tránh đụng dữ liệu liên kết thủ công.`, 409, "TIKTOK_IMPORT_SKU_MISMATCH");
      }
      const targetVariantIds = variantIdsByProduct.get(productId) || new Set<string>();
      for (const source of sourceRows as any[]) {
        for (const sku of source.skus || []) {
          if (sku.localProductId && String(sku.localProductId) !== productId) {
            throw cleanupError(`Liên kết TikTok ${id} đang trỏ tới sản phẩm Retail khác; không xóa.`, 409, "TIKTOK_IMPORT_LINK_MISMATCH");
          }
          if (sku.localVariantId && !targetVariantIds.has(String(sku.localVariantId))) {
            throw cleanupError(`Liên kết SKU TikTok ${id} đang trỏ tới biến thể Retail khác; không xóa.`, 409, "TIKTOK_IMPORT_LINK_MISMATCH");
          }
        }
      }
    }

    const idRefs = { companyCode, $or: [{ productId: { $in: productIds } }, { variantId: { $in: variantIds } }] };
    const balances = await withSession(InventoryBalanceModel.find(idRefs), session).lean();
    const ledger = await withSession(InventoryLedgerEntryModel.countDocuments(idRefs), session);
    const receipts = await withSession(GoodsReceiptModel.countDocuments({ companyCode, items: { $elemMatch: { $or: [{ productId: { $in: productIds } }, { variantId: { $in: variantIds } }] } } }), session);
    const transfers = await withSession(InventoryTransferModel.countDocuments({ companyCode, "items.variantId": { $in: variantIds } }), session);
    const stockCounts = await withSession(InventoryCountModel.countDocuments({ companyCode, items: { $elemMatch: { $or: [{ productId: { $in: productIds } }, { variantId: { $in: variantIds } }] } } }), session);
    const stockLogs = await withSession(StockLogModel.countDocuments({ companyCode, items: { $elemMatch: { $or: [{ productId: { $in: productIds } }, { variantId: { $in: variantIds } }] } } }), session);
    const retailOrders = await withSession(RetailOrderModel.countDocuments({ companyCode, items: { $elemMatch: { $or: [{ productId: { $in: productIds } }, { variantId: { $in: variantIds } }] } } }), session);
    const afterSales = await withSession(RetailAfterSaleModel.countDocuments({ companyCode, items: { $elemMatch: { $or: [{ productId: { $in: productIds } }, { variantId: { $in: variantIds } }] } } }), session);
    const serialUnits = await withSession(SerialUnitModel.countDocuments({ companyCode, $or: [{ productId: { $in: productIds } }, { variantId: { $in: variantIds } }] }), session);
    const repairParts = await withSession(RepairPartModel.countDocuments({ companyCode, $or: [{ productId: { $in: productIds } }, { variantId: { $in: variantIds } }] }), session);
    const legacyMappings = await withSession(ProductCatalogLegacyMappingModel.countDocuments({ companyCode, $or: [{ productId: { $in: productIds } }, { variantId: { $in: variantIds } }] }), session);
    const references = { ledger, receipts, transfers, stockCounts, stockLogs, retailOrders, afterSales, serialUnits, repairParts, legacyMappings };
    if (Object.values(references).some((count) => count > 0)) {
      throw Object.assign(cleanupError("Có lịch sử hoặc chứng từ đang tham chiếu sản phẩm. Không có dữ liệu nào bị xóa; hãy giữ nguyên các chứng từ đó.", 409, "TIKTOK_IMPORT_CLEANUP_BLOCKED"), { references });
    }
    if ((balances as any[]).some((balance) => Number(balance.reservedQuantity || 0) !== 0 || Number(balance.averageCost || 0) !== 0)) {
      throw cleanupError("Tồn kho có số lượng đang giữ hoặc giá vốn khác 0; không xóa để bảo toàn dữ liệu kho.", 409, "TIKTOK_IMPORT_BALANCE_NOT_CLEAN");
    }

    const balanceQuantity = (balances as any[]).reduce((sum, balance) => sum + Number(balance.quantity || 0), 0);
    const prices = await withSession(ProductPriceModel.find({ companyCode, variantId: { $in: variantIds } }), session).lean();
    const summary = {
      tiktokProductIds,
      products: products.map((product: any) => ({ id: String(product._id), productCode: product.productCode, name: product.name })),
      productIds,
      productCount: productIds.length,
      variantCount: variantIds.length,
      balanceCount: balances.length,
      balanceQuantity,
      priceCount: prices.length,
      references,
      dryRun,
    };
    if (dryRun) return { ...summary, deleted: false };

    const channelUpdate = await TikTokShopProductModel.updateMany(
      { companyCode, tiktokProductId: { $in: tiktokProductIds } },
      { $set: { "skus.$[].localProductId": "", "skus.$[].localVariantId": "" } },
      { session },
    );
    if (channelUpdate.matchedCount !== channelProducts.length) {
      throw cleanupError("Danh sách sản phẩm TikTok vừa thay đổi; hãy chạy dry-run lại.", 409, "TIKTOK_IMPORT_CLEANUP_STALE");
    }
    const balanceDelete = await InventoryBalanceModel.deleteMany(idRefs, { session });
    const priceDelete = await ProductPriceModel.deleteMany({ companyCode, variantId: { $in: variantIds } }, { session });
    const variantDelete = await ProductVariantModel.deleteMany({ companyCode, productId: { $in: productIds } }, { session });
    const productDelete = await ProductCatalogModel.deleteMany({ companyCode, _id: { $in: productIds } }, { session });
    if (variantDelete.deletedCount !== variantIds.length || productDelete.deletedCount !== productIds.length || balanceDelete.deletedCount !== balances.length || priceDelete.deletedCount !== prices.length) {
      throw cleanupError("Dữ liệu vừa thay đổi trong lúc dọn; transaction đã được hủy, không xóa phần còn lại.", 409, "TIKTOK_IMPORT_CLEANUP_STALE");
    }
    return { ...summary, deleted: true, removedBalanceCount: balanceDelete.deletedCount, removedPriceCount: priceDelete.deletedCount };
  });
}

export const TIKTOK_IMPORT_CLEANUP_CONFIRM_PHRASE = CONFIRM_PHRASE;
