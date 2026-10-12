/* eslint-disable @typescript-eslint/no-explicit-any -- TikTok product/token payloads vary by market and API version. */
import { randomBytes } from "node:crypto";
import { decryptSecret, encryptSecret, hashOpaque } from "../../security/crypto";
import { ProductVariantModel } from "../../model/product-variant.model";
import { ProductPriceModel } from "../../model/product-price.model";
import { InventoryBalanceModel } from "../../model/inventory-balance.model";
import { WarehouseModel } from "../../model/warehouse.model";
import { ProductCatalogModel } from "../../model/product-catalog.model";
import { ProductCatalogBrandModel, ProductCatalogCategoryModel, UnitOfMeasureModel } from "../../model/product-catalog-resource.model";
import { runInTransaction } from "../../config/database";
import { ensureDefaultWarehouse } from "../../modules/inventory/warehouse/warehouse.service";
import { TikTokShopConnectionModel } from "./tiktok-shop-connection.model";
import { TikTokShopOAuthStateModel } from "./tiktok-shop-oauth-state.model";
import { TikTokShopProductModel } from "./tiktok-shop-product.model";
import { callTikTokShopApi, exchangeTikTokShopCode, getTikTokShopConfig, refreshTikTokShopToken } from "./tiktok-shop.client";

const normalizeCompany = (value: unknown) => {
  const companyCode = String(value || "").trim().toUpperCase();
  if (!companyCode) throw Object.assign(new Error("Tài khoản chưa được gắn với công ty."), { statusCode: 400 });
  return companyCode;
};

const tokenExpiry = (value: unknown, fallbackSeconds: number) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return new Date(Date.now() + fallbackSeconds * 1000);
  // TikTok deployments have returned both a duration and an absolute Unix timestamp
  // under fields ending in `_expire_in`, so accept both representations.
  return new Date(number > 100_000_000 ? number * 1000 : Date.now() + number * 1000);
};

const tokenExpiresAt = (data: any) => tokenExpiry(data.access_token_expire_time ?? data.access_token_expire_in ?? data.access_token_expires_in, 24 * 60 * 60);
const refreshExpiresAt = (data: any) => tokenExpiry(data.refresh_token_expire_time ?? data.refresh_token_expire_in ?? data.refresh_token_expires_in, 30 * 24 * 60 * 60);

function publicConnection(connection: any) {
  return {
    id: String(connection._id),
    openId: connection.openId,
    shops: connection.shops || [],
    scopes: connection.scopes || [],
    connectedAt: connection.connectedAt,
    sync: {
      at: connection.lastProductSyncAt,
      status: connection.lastProductSyncStatus,
      error: connection.lastProductSyncError || "",
      stats: connection.lastProductSyncStats || { total: 0, matched: 0, unmatched: 0 },
    },
  };
}

function normalizedShops(data: any) {
  const shops = Array.isArray(data?.shops) ? data.shops : [];
  return shops.map((shop: any) => ({
    cipher: String(shop.cipher || shop.shop_cipher || ""),
    id: String(shop.id || shop.shop_id || ""),
    code: String(shop.code || shop.shop_code || ""),
    name: String(shop.name || shop.shop_name || shop.code || shop.shop_code || "TikTok Shop"),
    region: String(shop.region || shop.region_code || ""),
  })).filter((shop: any) => shop.cipher);
}

async function connectionsWithSecrets(companyCode: string) {
  return TikTokShopConnectionModel.find({ companyCode }).select("+accessTokenEncrypted +refreshTokenEncrypted");
}

async function validAccessToken(connection: any) {
  if (new Date(connection.accessTokenExpiresAt).getTime() > Date.now() + 10 * 60 * 1000) {
    return decryptSecret(connection.accessTokenEncrypted);
  }
  const currentRefreshToken = decryptSecret(connection.refreshTokenEncrypted);
  const data: any = await refreshTikTokShopToken(currentRefreshToken);
  if (!data.access_token) throw new Error("TikTok Shop không trả về access token mới.");
  connection.accessTokenEncrypted = encryptSecret(String(data.access_token));
  connection.refreshTokenEncrypted = encryptSecret(String(data.refresh_token || currentRefreshToken));
  connection.accessTokenExpiresAt = tokenExpiresAt(data);
  connection.refreshTokenExpiresAt = refreshExpiresAt(data);
  connection.scopes = Array.isArray(data.granted_scopes) ? data.granted_scopes : connection.scopes;
  await connection.save();
  return String(data.access_token);
}

function firstString(...values: unknown[]) {
  for (const value of values) if (typeof value === "string" && value.trim()) return value.trim();
  return "";
}

function quantityFromSku(sku: any) {
  if (Number.isFinite(Number(sku?.inventory?.quantity))) return Number(sku.inventory.quantity);
  if (Array.isArray(sku?.inventory)) return sku.inventory.reduce((sum: number, row: any) => sum + Number(row?.quantity || 0), 0);
  if (Array.isArray(sku?.inventory?.warehouse_inventory)) return sku.inventory.warehouse_inventory.reduce((sum: number, row: any) => sum + Number(row?.quantity || 0), 0);
  return 0;
}

function inventoryFromSku(sku: any) {
  const rows = Array.isArray(sku?.inventory)
    ? sku.inventory
    : Array.isArray(sku?.inventory?.warehouse_inventory) ? sku.inventory.warehouse_inventory : [];
  return rows.map((row: any) => ({
    warehouseId: firstString(row?.warehouse_id, row?.warehouseId),
    quantity: Math.max(0, Math.trunc(Number(row?.quantity || 0))),
  })).filter((row: any) => row.warehouseId);
}

export function allocateTikTokInventory(totalInput: number, currentRows: Array<{ warehouseId: string; quantity: number }>) {
  const total = Math.max(0, Math.trunc(totalInput));
  if (!currentRows.length) throw new Error("SKU TikTok chưa có kho hàng; hãy cấu hình kho trên Seller Center rồi đồng bộ danh mục lại.");
  if (currentRows.length === 1) return [{ warehouse_id: currentRows[0].warehouseId, quantity: total }];
  const currentTotal = currentRows.reduce((sum, row) => sum + Math.max(0, Number(row.quantity || 0)), 0);
  let assigned = 0;
  return currentRows.map((row, index) => {
    const quantity = index === currentRows.length - 1
      ? total - assigned
      : currentTotal > 0 ? Math.floor(total * Math.max(0, Number(row.quantity || 0)) / currentTotal) : (index === 0 ? total : 0);
    assigned += quantity;
    return { warehouse_id: row.warehouseId, quantity };
  });
}

async function localValues(companyCode: string, variantIds: string[], branchId?: string) {
  const [warehouses, balances, prices] = await Promise.all([
    WarehouseModel.find({ companyCode, isActive: true, kind: { $in: ["selling", "central", "other"] } }).select("_id").lean(),
    InventoryBalanceModel.find({ companyCode, variantId: { $in: variantIds } }).select("variantId warehouseId quantity reservedQuantity").lean(),
    ProductPriceModel.find({ companyCode, variantId: { $in: variantIds }, status: "active", ...(branchId ? { branchId } : {}) }).select("variantId sellingPrice").lean(),
  ]);
  const sellableWarehouseIds = new Set(warehouses.map((row: any) => String(row._id)));
  const stockByVariant = new Map<string, number>();
  for (const row of balances as any[]) {
    if (!sellableWarehouseIds.has(String(row.warehouseId))) continue;
    const variantId = String(row.variantId || "");
    stockByVariant.set(variantId, (stockByVariant.get(variantId) || 0) + Math.max(0, Number(row.quantity || 0) - Number(row.reservedQuantity || 0)));
  }
  const pricesByVariant = new Map<string, Set<number>>();
  for (const row of prices as any[]) {
    const set = pricesByVariant.get(String(row.variantId)) || new Set<number>();
    set.add(Number(row.sellingPrice));
    pricesByVariant.set(String(row.variantId), set);
  }
  return { stockByVariant, pricesByVariant };
}

function parseImage(product: any) {
  const image = product?.main_images?.[0] || product?.images?.[0];
  return firstString(image?.thumb_urls?.[0], image?.urls?.[0], image?.url);
}

async function pushOperationalData(companyCode: string, target?: { variantId?: string; sku?: string; branchId?: string }) {
  const filter: any = { companyCode, skus: { $elemMatch: { localVariantId: { $nin: ["", null] } } } };
  if (target?.variantId) filter["skus.localVariantId"] = target.variantId;
  else if (target?.sku) filter["skus.sellerSku"] = String(target.sku).trim().toUpperCase();
  const products: any[] = await TikTokShopProductModel.find(filter);
  const variantIds = [...new Set(products.flatMap((product) => product.skus.map((sku: any) => String(sku.localVariantId || "")).filter(Boolean)))];
  if (!variantIds.length) return { products: 0, skus: 0, updated: 0, skipped: 0, failed: 0, errors: [] as string[] };

  const { stockByVariant, pricesByVariant } = await localValues(companyCode, variantIds, target?.branchId);
  const connections = await connectionsWithSecrets(companyCode);
  const connectionById = new Map(connections.map((connection: any) => [String(connection._id), connection]));
  const tokenByConnection = new Map<string, string>();
  const result = { products: products.length, skus: 0, updated: 0, skipped: 0, failed: 0, errors: [] as string[] };

  for (const product of products) {
    const linkedSkus = product.skus.filter((sku: any) => sku.localVariantId && (!target?.variantId || sku.localVariantId === target.variantId) && (!target?.sku || String(sku.sellerSku).toUpperCase() === String(target.sku).toUpperCase()));
    result.skus += linkedSkus.length;
    const connection: any = connectionById.get(String(product.connectionId));
    const errors: string[] = [];
    try {
      if (!connection) throw new Error("Kết nối TikTok Shop của sản phẩm không còn tồn tại.");
      let accessToken = tokenByConnection.get(String(connection._id));
      if (!accessToken) {
        accessToken = await validAccessToken(connection);
        tokenByConnection.set(String(connection._id), accessToken);
      }
      const inventorySkus: any[] = [];
      const priceSkus: any[] = [];
      for (const sku of linkedSkus) {
        const variantId = String(sku.localVariantId);
        inventorySkus.push({ id: sku.skuId, inventory: allocateTikTokInventory(stockByVariant.get(variantId) || 0, sku.inventory || []) });
        const prices = pricesByVariant.get(variantId);
        if (!prices?.size) {
          result.skipped += 1;
        } else if (prices.size > 1) {
          errors.push(`SKU ${sku.sellerSku}: giá bán giữa các chi nhánh không đồng nhất.`);
        } else {
          priceSkus.push({ id: sku.skuId, price: { amount: String([...prices][0]), currency: sku.currency || "VND" } });
        }
      }
      if (inventorySkus.length) {
        const data: any = await callTikTokShopApi({
          path: `/product/202309/products/${encodeURIComponent(product.tiktokProductId)}/inventory/update`, method: "POST", accessToken,
          query: { shop_cipher: product.shopCipher }, body: { skus: inventorySkus },
        });
        if (Array.isArray(data?.errors) && data.errors.length) throw new Error(data.errors.map((row: any) => row?.message || row?.code).join("; "));
      }
      if (priceSkus.length) {
        await callTikTokShopApi({
          path: `/product/202309/products/${encodeURIComponent(product.tiktokProductId)}/prices/update`, method: "POST", accessToken,
          query: { shop_cipher: product.shopCipher }, body: { skus: priceSkus },
        });
      }
      if (errors.length) throw new Error(errors.join(" "));
      for (const sku of linkedSkus) {
        const variantId = String(sku.localVariantId);
        sku.inventoryQuantity = stockByVariant.get(variantId) || 0;
        const price = pricesByVariant.get(variantId);
        if (price?.size === 1) sku.priceAmount = String([...price][0]);
      }
      product.lastOutboundSyncAt = new Date();
      product.lastOutboundSyncStatus = "success";
      product.lastOutboundSyncError = "";
      await product.save();
      result.updated += linkedSkus.length;
    } catch (error: any) {
      const message = `${product.title}: ${String(error?.message || "Đồng bộ thất bại")}`.slice(0, 500);
      product.lastOutboundSyncAt = new Date();
      product.lastOutboundSyncStatus = "failed";
      product.lastOutboundSyncError = message;
      await product.save();
      result.failed += linkedSkus.length;
      result.errors.push(message);
    }
  }
  return result;
}

const TIKTOK_CATEGORY_CODE = "CAT-TIKTOK-SHOP";
const DEFAULT_UNIT_CODE = "UOM-CAI";

async function ensureTikTokImportMasters(companyCode: string, actor: string, session?: any) {
  await ProductCatalogCategoryModel.findOneAndUpdate(
    { companyCode, code: TIKTOK_CATEGORY_CODE },
    { $set: { name: "Sản phẩm TikTok Shop", normalizedName: "sản phẩm tiktok shop", defaultTrackingMode: "quantity", status: "active", updatedBy: actor }, $setOnInsert: { companyCode, code: TIKTOK_CATEGORY_CODE, description: "Sản phẩm được nhập từ TikTok Shop", createdBy: actor } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true, ...(session ? { session } : {}) },
  );
  await UnitOfMeasureModel.findOneAndUpdate(
    { companyCode, code: DEFAULT_UNIT_CODE },
    { $set: { status: "active", updatedBy: actor }, $setOnInsert: { companyCode, code: DEFAULT_UNIT_CODE, name: "Cái", symbol: "cái", category: "count", decimalPlaces: 0, createdBy: actor } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true, ...(session ? { session } : {}) },
  );
}

function importedSkuCode(sku: any) {
  return (firstString(sku.sellerSku, sku.seller_sku) || `TT-${firstString(sku.skuId, sku.id, sku.sku_id)}`).trim().toUpperCase().slice(0, 100);
}

function variantDisplayName(sku: any, fallback: string) {
  const attributes = Array.isArray(sku?.sales_attributes) ? sku.sales_attributes : [];
  const values = attributes.map((row: any) => firstString(row.value_name, row.name)).filter(Boolean);
  return (values.join(" / ") || fallback).slice(0, 200);
}

function imageUrls(images: any) {
  if (!Array.isArray(images)) return [];
  return [...new Set(images.map((image: any) => [
    ...(Array.isArray(image?.urls) ? image.urls : []),
    image?.url,
    ...(Array.isArray(image?.thumb_urls) ? image.thumb_urls : []),
  ].map((value: unknown) => String(value || "").trim()).find((value: string) => /^https?:\/\//i.test(value)) || "").filter(Boolean))];
}

function skuOptionValues(sku: any) {
  const attributes = Array.isArray(sku?.sales_attributes) ? sku.sales_attributes : [];
  return attributes.map((row: any, index: number) => ({
    code: (`TT-${firstString(row.id, row.name) || `OPTION-${index + 1}`}`).replace(/[^A-Z0-9_-]/gi, "-").toUpperCase().slice(0, 100),
    value: firstString(row.value_name, row.name, row.value_id),
  })).filter((row: any) => row.value);
}

function skuImageUrls(sku: any) {
  const attributes = Array.isArray(sku?.sales_attributes) ? sku.sales_attributes : [];
  return imageUrls(attributes.flatMap((row: any) => [row.sku_img, row.image, ...(Array.isArray(row.supplementary_sku_images) ? row.supplementary_sku_images : [])]).filter(Boolean));
}

function tikTokProductAttributes(detail: any) {
  const attributes = Array.isArray(detail?.product_attributes) ? detail.product_attributes : [];
  return attributes.map((attribute: any, index: number) => {
    const values = Array.isArray(attribute?.values) ? attribute.values.map((value: any) => firstString(value?.name, value?.value_name, value?.value)).filter(Boolean) : [];
    const name = firstString(attribute?.name, attribute?.local_name, attribute?.attribute_name);
    const value = firstString(attribute?.value_name, attribute?.value) || values.join(", ");
    const codePart = firstString(attribute?.id, attribute?.attribute_id, name) || `OPTION-${index + 1}`;
    const code = (`TT-ATTR-${codePart}`).replace(/[^A-Z0-9_-]/gi, "-").toUpperCase().slice(0, 100);
    return { code, name, value };
  }).filter((attribute: any) => attribute.value);
}

function productAttributeValue(attributes: Array<{ name: string; value: string }>, labels: string[]) {
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("vi-VN");
  const row = attributes.find((attribute) => {
    const name = normalize(attribute.name);
    return labels.some((label) => name.includes(normalize(label)));
  });
  return row?.value || "";
}

function tikTokCategory(detail: any) {
  const category = detail?.category || {};
  const id = firstString(category.id, detail?.category_id);
  return {
    code: id ? `TT-CAT-${id}`.toUpperCase().slice(0, 100) : TIKTOK_CATEGORY_CODE,
    name: (firstString(category.local_name, category.name, detail?.category_name, detail?.local_name) || (id ? `TikTok Shop category ${id}` : "Sản phẩm TikTok Shop")).slice(0, 300),
  };
}

function tikTokBrand(detail: any) {
  const brand = detail?.brand || {};
  const id = firstString(brand.id, detail?.brand_id);
  const name = firstString(brand.name, brand.brand_name);
  return id && name ? { code: `TT-BRAND-${id}`.toUpperCase().slice(0, 100), name: name.slice(0, 300) } : null;
}

function dimensionInMillimeters(value: unknown, unit: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return undefined;
  const normalizedUnit = String(unit || "").toUpperCase();
  if (normalizedUnit === "CM") return number * 10;
  if (normalizedUnit === "M") return number * 1000;
  if (normalizedUnit === "INCH" || normalizedUnit === "IN") return number * 25.4;
  return number;
}

function weightInGrams(value: unknown, unit: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return undefined;
  const normalizedUnit = String(unit || "").toUpperCase();
  if (normalizedUnit === "KG") return number * 1000;
  if (normalizedUnit === "LB") return number * 453.59237;
  if (normalizedUnit === "OZ") return number * 28.349523125;
  return number;
}

export const TikTokShopService = {
  async status(companyCodeInput: unknown) {
    const companyCode = normalizeCompany(companyCodeInput);
    const connections = await TikTokShopConnectionModel.find({ companyCode }).sort({ connectedAt: 1 }).lean();
    return {
      connected: connections.length > 0,
      connections: connections.map(publicConnection),
      shops: connections.flatMap((connection: any) => connection.shops || []),
    };
  },

  async createAuthorizationUrl(companyCodeInput: unknown, userId: string) {
    const companyCode = normalizeCompany(companyCodeInput);
    const rawState = randomBytes(32).toString("base64url");
    await TikTokShopOAuthStateModel.create({ stateHash: hashOpaque(rawState), companyCode, userId, expiresAt: new Date(Date.now() + 10 * 60 * 1000) });
    const config = getTikTokShopConfig();
    const url = new URL(config.authorizationUrl);
    url.searchParams.set("service_id", config.serviceId);
    url.searchParams.set("state", rawState);
    return url.toString();
  },

  async completeAuthorization(state: string, authCode: string) {
    const stateDoc = await TikTokShopOAuthStateModel.findOneAndUpdate(
      { stateHash: hashOpaque(state), expiresAt: { $gt: new Date() }, consumedAt: null },
      { $set: { consumedAt: new Date() } },
      { returnDocument: "after" },
    );
    if (!stateDoc) throw Object.assign(new Error("Yêu cầu kết nối TikTok Shop không hợp lệ hoặc đã hết hạn."), { statusCode: 400 });
    const data: any = await exchangeTikTokShopCode(authCode);
    if (!data.access_token || !data.refresh_token) throw new Error("TikTok Shop không trả về đầy đủ access token và refresh token.");
    const openId = String(data.open_id || "").trim();
    if (!openId) throw new Error("TikTok Shop không trả về định danh seller (open_id).");
    const shopsData = await callTikTokShopApi({ path: "/authorization/202309/shops", accessToken: String(data.access_token) });
    const shops = normalizedShops(shopsData);
    if (!shops.length) throw new Error("Tài khoản TikTok Shop chưa cấp quyền cho shop nào.");
    const connection = await TikTokShopConnectionModel.findOneAndUpdate(
      { companyCode: stateDoc.companyCode, openId },
      { $set: {
        openId,
        accessTokenEncrypted: encryptSecret(String(data.access_token)),
        refreshTokenEncrypted: encryptSecret(String(data.refresh_token)),
        accessTokenExpiresAt: tokenExpiresAt(data),
        refreshTokenExpiresAt: refreshExpiresAt(data),
        scopes: Array.isArray(data.granted_scopes) ? data.granted_scopes.map(String) : [],
        shops,
        connectedBy: stateDoc.userId,
        connectedAt: new Date(),
      } },
      { upsert: true, returnDocument: "after", runValidators: true },
    );
    return publicConnection(connection?.toObject());
  },

  async disconnect(companyCodeInput: unknown, connectionId: string) {
    const companyCode = normalizeCompany(companyCodeInput);
    const connection = await TikTokShopConnectionModel.findOne({ _id: connectionId, companyCode }).lean();
    if (!connection) throw Object.assign(new Error("Không tìm thấy kết nối seller TikTok Shop."), { statusCode: 404 });
    const shopCiphers = (connection.shops || []).map((shop: any) => shop.cipher).filter(Boolean);
    await Promise.all([
      TikTokShopConnectionModel.deleteOne({ _id: connectionId, companyCode }),
      TikTokShopProductModel.deleteMany({ companyCode, connectionId, ...(shopCiphers.length ? { shopCipher: { $in: shopCiphers } } : {}) }),
    ]);
  },

  async listProducts(companyCodeInput: unknown, query: Record<string, unknown>) {
    const companyCode = normalizeCompany(companyCodeInput);
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 50));
    const filter: any = { companyCode };
    if (String(query.q || "").trim()) {
      const q = String(query.q).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [{ title: new RegExp(q, "i") }, { "skus.sellerSku": new RegExp(q, "i") }];
    }
    const [items, total] = await Promise.all([
      TikTokShopProductModel.find(filter).sort({ tiktokUpdateTime: -1, updatedAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
      TikTokShopProductModel.countDocuments(filter),
    ]);
    return { items, total, page, pageSize };
  },

  async importProductsToInventory(companyCodeInput: unknown, branchIdInput: unknown, actorInput: unknown) {
    const companyCode = normalizeCompany(companyCodeInput);
    const branchId = String(branchIdInput || "").trim();
    const actor = String(actorInput || "").trim();
    if (!branchId) throw Object.assign(new Error("Cần chọn chi nhánh nhận sản phẩm và tồn kho từ TikTok Shop."), { statusCode: 400 });
    if (!actor) throw Object.assign(new Error("Không xác định được người thực hiện nhập dữ liệu."), { statusCode: 401 });

    await this.syncProducts(companyCode);
    const products: any[] = await TikTokShopProductModel.find({ companyCode }).sort({ createdAt: 1 });
    const connections = await connectionsWithSecrets(companyCode);
    const connectionById = new Map(connections.map((connection: any) => [String(connection._id), connection]));
    const tokenByConnection = new Map<string, string>();
    const stats = { products: products.length, createdProducts: 0, createdVariants: 0, linkedExisting: 0, importedPrices: 0, importedStock: 0, failed: 0, errors: [] as string[] };

    for (const channelProduct of products) {
      try {
        const connection: any = connectionById.get(String(channelProduct.connectionId));
        if (!connection) throw new Error("Kết nối seller không còn tồn tại.");
        let accessToken = tokenByConnection.get(String(connection._id));
        if (!accessToken) {
          accessToken = await validAccessToken(connection);
          tokenByConnection.set(String(connection._id), accessToken);
        }
        const detailData: any = await callTikTokShopApi({
          path: `/product/202309/products/${encodeURIComponent(channelProduct.tiktokProductId)}`,
          accessToken,
          query: { shop_cipher: channelProduct.shopCipher },
        });
        const detail = detailData?.product || detailData || {};
        const detailSkus = Array.isArray(detail.skus) ? detail.skus : [];
        const detailById = new Map(detailSkus.map((sku: any) => [firstString(sku.id, sku.sku_id), sku]));
        const sourceSkus = channelProduct.skus.map((cachedSku: any) => {
          const fullSku: any = detailById.get(String(cachedSku.skuId)) || {};
          const price = fullSku.price || {};
          const inventory = inventoryFromSku(fullSku).length ? inventoryFromSku(fullSku) : (cachedSku.inventory || []);
          return {
            ...fullSku,
            skuId: cachedSku.skuId,
            sellerSku: firstString(fullSku.seller_sku, cachedSku.sellerSku),
            code: importedSkuCode({ ...fullSku, ...cachedSku }),
            priceAmount: firstString(price.amount, price.tax_exclusive_price, price.sale_price, cachedSku.priceAmount),
            currency: firstString(price.currency, cachedSku.currency) || "VND",
            inventory,
            inventoryQuantity: inventory.length ? inventory.reduce((sum: number, row: any) => sum + Number(row.quantity || 0), 0) : Number(cachedSku.inventoryQuantity || 0),
          };
        }).filter((sku: any) => sku.skuId && sku.code);
        if (!sourceSkus.length) throw new Error("Sản phẩm không có SKU hợp lệ để nhập.");

        const imported = { createdProducts: 0, createdVariants: 0, linkedExisting: 0, importedPrices: 0, importedStock: 0 };
        await runInTransaction(async (session) => {
          Object.assign(imported, { createdProducts: 0, createdVariants: 0, linkedExisting: 0, importedPrices: 0, importedStock: 0 });
          await ensureTikTokImportMasters(companyCode, actor, session);
          const warehouse: any = await ensureDefaultWarehouse(companyCode, branchId, session);
          if (!warehouse) throw new Error("Không thể xác định kho mặc định của chi nhánh.");

          const existingVariants: any[] = await ProductVariantModel.find({ companyCode, sku: { $in: sourceSkus.map((sku: any) => sku.code) } }).session(session || null).lean();
          const productIds = [...new Set(existingVariants.map((variant: any) => String(variant.productId)))];
          if (productIds.length > 1) throw new Error("Các SKU TikTok đang thuộc nhiều sản phẩm nội bộ khác nhau; cần xử lý liên kết thủ công.");

          const productCode = `TT-${channelProduct.tiktokProductId}`.toUpperCase().slice(0, 100);
          const category = tikTokCategory(detail);
          const brand = tikTokBrand(detail);
          await ProductCatalogCategoryModel.findOneAndUpdate(
            { companyCode, code: category.code },
            { $set: { name: category.name, normalizedName: category.name.toLocaleLowerCase("vi-VN"), defaultTrackingMode: "quantity", status: "active", updatedBy: actor }, $setOnInsert: { companyCode, code: category.code, description: "Danh mục được đồng bộ từ TikTok Shop", createdBy: actor } },
            { upsert: true, returnDocument: "after", setDefaultsOnInsert: true, session },
          );
          if (brand) {
            await ProductCatalogBrandModel.findOneAndUpdate(
              { companyCode, code: brand.code },
              { $set: { name: brand.name, normalizedName: brand.name.toLocaleLowerCase("vi-VN"), status: "active", updatedBy: actor }, $setOnInsert: { companyCode, code: brand.code, description: "Thương hiệu được đồng bộ từ TikTok Shop", createdBy: actor } },
              { upsert: true, returnDocument: "after", setDefaultsOnInsert: true, session },
            );
          }
          let localProduct: any = productIds.length
            ? await ProductCatalogModel.findOne({ _id: productIds[0], companyCode }).session(session || null)
            : await ProductCatalogModel.findOne({ companyCode, productCode }).session(session || null);
          const description = firstString(detail.description).slice(0, 20_000);
          const title = (firstString(detail.title, channelProduct.title) || `TikTok product ${channelProduct.tiktokProductId}`).slice(0, 300);
          const mainMediaUrls = [...new Set([
            ...imageUrls([...(Array.isArray(detail.main_images) ? detail.main_images : []), ...(Array.isArray(detail.images) ? detail.images : [])]),
            ...(Array.isArray(channelProduct.imageUrls) ? channelProduct.imageUrls : []),
            channelProduct.imageUrl,
          ].filter((url: string) => /^https?:\/\//i.test(url)))];
          const productAttributes = tikTokProductAttributes(detail);
          const manufacturer = firstString(detail?.manufacturer?.name, detail?.manufacturer_name, productAttributeValue(productAttributes, ["manufacturer", "nhà sản xuất"]));
          const countryOfOrigin = firstString(detail?.country_of_origin, productAttributeValue(productAttributes, ["country of origin", "country of manufacture", "xuất xứ", "nước sản xuất"]));
          if (!localProduct) {
            const [created] = await ProductCatalogModel.create([{
              companyCode, productCode, name: title, normalizedName: title.toLocaleLowerCase("vi-VN"), productType: "physical",
              categoryCode: category.code, brandCode: brand?.code, baseUnitCode: DEFAULT_UNIT_CODE,
              shortDescription: description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500),
              description, manufacturer: manufacturer || undefined, countryOfOrigin: countryOfOrigin || undefined,
              attributes: productAttributes.map(({ code, value }) => ({ code, value })),
              searchKeywords: ["TikTok Shop", String(channelProduct.tiktokProductId), firstString(detail.category_id)].filter(Boolean),
              status: "active", mediaIds: mainMediaUrls, documentIds: [], createdBy: actor, updatedBy: actor,
            }], { session });
            localProduct = created;
            imported.createdProducts += 1;
          } else if (localProduct.productCode === productCode) {
            localProduct.name = title;
            localProduct.normalizedName = title.toLocaleLowerCase("vi-VN");
            localProduct.categoryCode = category.code;
            localProduct.brandCode = brand?.code;
            localProduct.shortDescription = description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500);
            localProduct.description = description;
            if (manufacturer) localProduct.manufacturer = manufacturer;
            if (countryOfOrigin) localProduct.countryOfOrigin = countryOfOrigin;
            if (productAttributes.length) localProduct.attributes = productAttributes.map(({ code, value }) => ({ code, value }));
            if (mainMediaUrls.length) localProduct.mediaIds = mainMediaUrls;
            localProduct.updatedBy = actor;
            await localProduct.save({ session });
          }

          const variantBySku = new Map(existingVariants.map((variant: any) => [String(variant.sku).toUpperCase(), variant]));
          const packageDimensions = detail.package_dimensions || {};
          const packageWeight = detail.package_weight || {};
          for (const sourceSku of sourceSkus) {
            const skuDimensions = sourceSku.sku_dimensions || sourceSku.package_dimensions || packageDimensions;
            const skuWeight = sourceSku.sku_weight || sourceSku.package_weight || packageWeight;
            let variant: any = variantBySku.get(sourceSku.code);
            const isNew = !variant;
            if (!variant) {
              const optionValues = skuOptionValues(sourceSku);
              const variantMediaUrls = skuImageUrls(sourceSku);
              const [createdVariant] = await ProductVariantModel.create([{
                companyCode, productId: String(localProduct._id), sku: sourceSku.code,
                displayName: variantDisplayName(sourceSku, sourceSku.code), unitCode: DEFAULT_UNIT_CODE, trackingMode: "quantity",
                weightGrams: weightInGrams(skuWeight.value, skuWeight.unit),
                lengthMm: dimensionInMillimeters(skuDimensions.length, skuDimensions.unit),
                widthMm: dimensionInMillimeters(skuDimensions.width, skuDimensions.unit),
                heightMm: dimensionInMillimeters(skuDimensions.height, skuDimensions.unit),
                optionValues, attributes: [], mediaIds: variantMediaUrls, status: "active", createdBy: actor, updatedBy: actor,
              }], { session });
              variant = createdVariant;
              variantBySku.set(sourceSku.code, variant);
              imported.createdVariants += 1;
            } else {
              imported.linkedExisting += 1;
              if (localProduct.productCode === productCode) {
                const optionValues = skuOptionValues(sourceSku);
                const variantMediaUrls = skuImageUrls(sourceSku);
                variant.displayName = variantDisplayName(sourceSku, sourceSku.code);
                if (optionValues.length) variant.optionValues = optionValues;
                if (variantMediaUrls.length) variant.mediaIds = variantMediaUrls;
                variant.weightGrams = weightInGrams(skuWeight.value, skuWeight.unit);
                variant.lengthMm = dimensionInMillimeters(skuDimensions.length, skuDimensions.unit);
                variant.widthMm = dimensionInMillimeters(skuDimensions.width, skuDimensions.unit);
                variant.heightMm = dimensionInMillimeters(skuDimensions.height, skuDimensions.unit);
                variant.updatedBy = actor;
                await ProductVariantModel.updateOne({ _id: variant._id, companyCode }, { $set: {
                  displayName: variant.displayName, optionValues: variant.optionValues, mediaIds: variant.mediaIds,
                  weightGrams: variant.weightGrams, lengthMm: variant.lengthMm, widthMm: variant.widthMm, heightMm: variant.heightMm, updatedBy: actor,
                } }, { session, runValidators: true });
              }
            }

            if (isNew) {
              const price = Number(sourceSku.priceAmount);
              if (sourceSku.currency === "VND" && Number.isFinite(price) && price >= 0) {
                await ProductPriceModel.findOneAndUpdate(
                  { companyCode, branchId, variantId: String(variant._id) },
                  { $set: { productId: String(localProduct._id), sku: sourceSku.code, sellingPrice: Math.round(price), costPrice: 0, status: "active", updatedBy: actor }, $setOnInsert: { companyCode, branchId, variantId: String(variant._id), createdBy: actor } },
                  { upsert: true, returnDocument: "after", runValidators: true, session },
                );
                imported.importedPrices += 1;
              }
              await InventoryBalanceModel.findOneAndUpdate(
                { companyCode, warehouseId: String(warehouse._id), productId: String(localProduct._id), variantId: String(variant._id) },
                { $setOnInsert: { companyCode, branchId, warehouseId: String(warehouse._id), productId: String(localProduct._id), variantId: String(variant._id), sku: sourceSku.code, quantity: Math.max(0, Math.trunc(sourceSku.inventoryQuantity)), reservedQuantity: 0, minStock: 0, averageCost: 0, version: 0 } },
                { upsert: true, returnDocument: "after", setDefaultsOnInsert: true, session },
              );
              imported.importedStock += Math.max(0, Math.trunc(sourceSku.inventoryQuantity));
            }

            const cachedSku = channelProduct.skus.find((row: any) => String(row.skuId) === String(sourceSku.skuId));
            if (cachedSku) {
              cachedSku.localProductId = String(localProduct._id);
              cachedSku.localVariantId = String(variant._id);
            }
          }
          await channelProduct.save({ session });
        });
        stats.createdProducts += imported.createdProducts;
        stats.createdVariants += imported.createdVariants;
        stats.linkedExisting += imported.linkedExisting;
        stats.importedPrices += imported.importedPrices;
        stats.importedStock += imported.importedStock;
      } catch (error: any) {
        stats.failed += 1;
        stats.errors.push(`${channelProduct.title}: ${String(error?.message || "Nhập dữ liệu thất bại")}`.slice(0, 500));
      }
    }
    return stats;
  },

  async syncInventoryAndPrices(companyCodeInput: unknown, target?: { variantId?: string; sku?: string; branchId?: string }, throwOnFailure = false) {
    const companyCode = normalizeCompany(companyCodeInput);
    const missingWarehouseSnapshot = await TikTokShopProductModel.exists({
      companyCode,
      skus: { $elemMatch: { localVariantId: { $nin: ["", null] }, "inventory.0": { $exists: false } } },
    });
    // Records imported before outbound sync was introduced do not contain TikTok
    // warehouse IDs. Refresh once so automatic updates work without migration.
    if (missingWarehouseSnapshot) await this.syncProducts(companyCode);
    const result = await pushOperationalData(companyCode, target);
    if (throwOnFailure && result.failed) throw new Error(result.errors.join("; ") || "Không thể đồng bộ giá và tồn kho lên TikTok Shop.");
    return result;
  },

  async syncProducts(companyCodeInput: unknown) {
    const companyCode = normalizeCompany(companyCodeInput);
    const connections = await connectionsWithSecrets(companyCode);
    if (!connections.length) throw Object.assign(new Error("Doanh nghiệp chưa kết nối TikTok Shop."), { statusCode: 409 });
    const aggregate = { total: 0, matched: 0, unmatched: 0, connections: connections.length };
    for (const connection of connections) {
      try {
      const accessToken = await validAccessToken(connection);
      const seenAt = new Date();
      let total = 0;
      let matched = 0;
      for (const shop of connection.shops as any[]) {
        let pageToken = "";
        let fullyTraversed = false;
        for (let page = 0; page < 50; page += 1) {
          const data: any = await callTikTokShopApi({
            path: "/product/202309/products/search",
            method: "POST",
            accessToken,
            query: { shop_cipher: shop.cipher, page_size: 100, page_token: pageToken || undefined },
            body: { status: "ALL", locale: "vi-VN", include_live_quick_products: false },
          });
          const products = Array.isArray(data?.products) ? data.products : [];
          const sellerSkus = products.flatMap((product: any) => (Array.isArray(product.skus) ? product.skus : [])).map((sku: any) => firstString(sku.seller_sku, sku.sellerSku)).filter(Boolean);
          const localVariants = sellerSkus.length ? await ProductVariantModel.find({ companyCode, sku: { $in: sellerSkus.map((sku: string) => sku.toUpperCase()) } }).select("_id productId sku").lean() : [];
          const variantBySku = new Map(localVariants.map((variant: any) => [String(variant.sku).toUpperCase(), variant]));
          for (const product of products) {
            const productId = firstString(product.id, product.product_id);
            if (!productId) continue;
            let productMatched = false;
            const skus = (Array.isArray(product.skus) ? product.skus : []).map((sku: any) => {
              const sellerSku = firstString(sku.seller_sku, sku.sellerSku);
              const local = variantBySku.get(sellerSku.toUpperCase());
              if (local) productMatched = true;
              const price = sku.price || sku.sales_price || {};
              return {
                skuId: firstString(sku.id, sku.sku_id), sellerSku,
                priceAmount: firstString(price.amount, price.tax_exclusive_price, sku.price_amount),
                currency: firstString(price.currency, sku.currency),
                inventoryQuantity: quantityFromSku(sku),
                inventory: inventoryFromSku(sku),
                localProductId: local ? String(local.productId) : "",
                localVariantId: local ? String(local._id) : "",
              };
            });
            if (productMatched) matched += 1;
            await TikTokShopProductModel.updateOne(
              { companyCode, connectionId: String(connection._id), shopCipher: shop.cipher, tiktokProductId: productId },
              { $set: {
                shopName: shop.name, title: firstString(product.title, product.product_name) || `TikTok product ${productId}`,
                status: firstString(product.status), imageUrl: parseImage(product),
                imageUrls: imageUrls([...(Array.isArray(product.main_images) ? product.main_images : []), ...(Array.isArray(product.images) ? product.images : [])]), skus,
                tiktokCreateTime: product.create_time ? new Date(Number(product.create_time) * 1000) : null,
                tiktokUpdateTime: product.update_time ? new Date(Number(product.update_time) * 1000) : null,
                lastSeenAt: seenAt,
              }, $setOnInsert: { companyCode, connectionId: String(connection._id), shopCipher: shop.cipher, tiktokProductId: productId } },
              { upsert: true, runValidators: true },
            );
            total += 1;
          }
          pageToken = String(data?.next_page_token || "");
          if (!pageToken || products.length === 0) { fullyTraversed = true; break; }
        }
        if (fullyTraversed) await TikTokShopProductModel.deleteMany({ companyCode, connectionId: String(connection._id), shopCipher: shop.cipher, lastSeenAt: { $lt: seenAt } });
      }
      const stats = { total, matched, unmatched: Math.max(0, total - matched) };
      connection.lastProductSyncAt = seenAt;
      connection.lastProductSyncStatus = "success";
      connection.lastProductSyncError = "";
      connection.lastProductSyncStats = stats;
      await connection.save();
      aggregate.total += stats.total;
      aggregate.matched += stats.matched;
      aggregate.unmatched += stats.unmatched;
    } catch (error: any) {
      connection.lastProductSyncAt = new Date();
      connection.lastProductSyncStatus = "failed";
      connection.lastProductSyncError = String(error?.message || "Đồng bộ thất bại").slice(0, 500);
      await connection.save();
      throw error;
    }
    }
    return aggregate;
  },
};
