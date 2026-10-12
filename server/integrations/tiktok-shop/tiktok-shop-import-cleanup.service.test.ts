import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { InventoryBalanceModel } from "../../model/inventory-balance.model";
import { InventoryCountModel } from "../../model/inventory-count.model";
import { GoodsReceiptModel } from "../../model/goods-receipt.model";
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
import { cleanupTikTokImportedProducts, TIKTOK_IMPORT_CLEANUP_CONFIRM_PHRASE } from "./tiktok-shop-import-cleanup.service";

const companyCode = "TIKTOK-CLEANUP-TEST";
const tiktokProductId = "1737931716139910732";
const inventoryModels: any[] = [
  InventoryBalanceModel, InventoryCountModel, GoodsReceiptModel, InventoryLedgerEntryModel,
  ProductCatalogLegacyMappingModel, ProductCatalogModel, ProductPriceModel, ProductVariantModel,
  StockLogModel, RetailAfterSaleModel, RetailOrderModel, SerialUnitModel, InventoryTransferModel,
  RepairPartModel, TikTokShopProductModel,
];
let replica: MongoMemoryReplSet;
let originalAllowlist: string | undefined;

async function seedImportedProduct(id = tiktokProductId) {
  const productId = new mongoose.Types.ObjectId().toString();
  const variantId = new mongoose.Types.ObjectId().toString();
  const sku = `SELLER-${id.slice(-4)}`.toUpperCase();
  await ProductCatalogModel.create({
    _id: productId, companyCode, productCode: `TT-${id}`, name: "TikTok test product", normalizedName: "tiktok test product",
    productType: "physical", categoryCode: "CAT-TIKTOK-SHOP", baseUnitCode: "UOM-CAI", status: "active", mediaIds: [], documentIds: [],
    createdBy: "test", updatedBy: "test",
  });
  await ProductVariantModel.create({
    _id: variantId, companyCode, productId, sku, unitCode: "UOM-CAI", trackingMode: "quantity", status: "active", createdBy: "test", updatedBy: "test",
  });
  await TikTokShopProductModel.create({
    companyCode, connectionId: "connection-test", shopCipher: "cipher-test", tiktokProductId: id,
    title: "TikTok test product", lastSeenAt: new Date(), skus: [{ skuId: `SKU-${id}`, sellerSku: sku, localProductId: productId, localVariantId: variantId }],
  });
  await InventoryBalanceModel.create({ companyCode, branchId: "branch-test", warehouseId: "warehouse-test", productId, variantId, sku, quantity: 3, reservedQuantity: 0, averageCost: 0, version: 0 });
  await ProductPriceModel.create({ companyCode, branchId: "branch-test", productId, variantId, sku, sellingPrice: 100, costPrice: 0, status: "active", createdBy: "test", updatedBy: "test" });
  return { productId, variantId, sku };
}

beforeAll(async () => {
  originalAllowlist = process.env.TIKTOK_IMPORT_CLEANUP_COMPANY_CODES;
  process.env.TIKTOK_IMPORT_CLEANUP_COMPANY_CODES = companyCode;
  replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replica.getUri());
  await Promise.all(inventoryModels.map((model) => model.init()));
}, 120000);

beforeEach(async () => {
  await Promise.all(inventoryModels.map((model) => model.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  await replica?.stop();
  if (originalAllowlist === undefined) delete process.env.TIKTOK_IMPORT_CLEANUP_COMPANY_CODES;
  else process.env.TIKTOK_IMPORT_CLEANUP_COMPANY_CODES = originalAllowlist;
});

describe("TikTok imported product cleanup", () => {
  it("dry-runs, then atomically removes only the selected import and clears TikTok's local links", async () => {
    const target = await seedImportedProduct();
    const unrelated = await seedImportedProduct("1737931716139910999");

    const preview = await cleanupTikTokImportedProducts({ companyCode, tiktokProductIds: [tiktokProductId], dryRun: true });
    expect(preview).toMatchObject({ dryRun: true, deleted: false, productCount: 1, variantCount: 1, balanceCount: 1, balanceQuantity: 3, priceCount: 1 });
    expect(await ProductCatalogModel.countDocuments({ _id: target.productId })).toBe(1);

    const result = await cleanupTikTokImportedProducts({ companyCode, tiktokProductIds: [tiktokProductId], dryRun: false, confirm: TIKTOK_IMPORT_CLEANUP_CONFIRM_PHRASE });
    expect(result).toMatchObject({ dryRun: false, deleted: true, removedBalanceCount: 1, removedPriceCount: 1 });
    expect(await ProductCatalogModel.countDocuments({ _id: target.productId })).toBe(0);
    expect(await ProductVariantModel.countDocuments({ _id: target.variantId })).toBe(0);
    expect(await InventoryBalanceModel.countDocuments({ variantId: target.variantId })).toBe(0);
    expect(await ProductPriceModel.countDocuments({ variantId: target.variantId })).toBe(0);
    expect(await ProductCatalogModel.countDocuments({ _id: unrelated.productId })).toBe(1);
    expect(await InventoryBalanceModel.countDocuments({ variantId: unrelated.variantId })).toBe(1);
    expect(await TikTokShopProductModel.findOne({ companyCode, tiktokProductId }).lean()).toMatchObject({
      skus: [{ localProductId: "", localVariantId: "" }],
    });
  }, 30000);

  it("blocks without changing anything when inventory ledger history exists", async () => {
    const target = await seedImportedProduct();
    await InventoryLedgerEntryModel.create({
      companyCode, branchId: "branch-test", warehouseId: "warehouse-test", productId: target.productId, variantId: target.variantId,
      sku: target.sku, productName: "TikTok test product", direction: "in", purpose: "opening", quantity: 3,
      quantityDelta: 3, unitCost: 0, sourceType: "test", sourceId: "test-source", sourceLine: 0,
      idempotencyKey: "test-ledger", operatorName: "test",
    });

    await expect(cleanupTikTokImportedProducts({ companyCode, tiktokProductIds: [tiktokProductId], dryRun: false, confirm: TIKTOK_IMPORT_CLEANUP_CONFIRM_PHRASE }))
      .rejects.toMatchObject({ statusCode: 409, code: "TIKTOK_IMPORT_CLEANUP_BLOCKED" });
    expect(await ProductCatalogModel.countDocuments({ _id: target.productId })).toBe(1);
    expect(await InventoryBalanceModel.countDocuments({ variantId: target.variantId })).toBe(1);
    expect(await InventoryLedgerEntryModel.countDocuments({ variantId: target.variantId })).toBe(1);
  }, 30000);
});
