/* eslint-disable @typescript-eslint/no-explicit-any -- TikTok product/token payloads vary by market and API version. */
import { randomBytes } from "node:crypto";
import { decryptSecret, encryptSecret, hashOpaque } from "../../security/crypto";
import { ProductVariantModel } from "../../model/product-variant.model";
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

function parseImage(product: any) {
  const image = product?.main_images?.[0] || product?.images?.[0];
  return firstString(image?.thumb_urls?.[0], image?.urls?.[0], image?.url);
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
                localProductId: local ? String(local.productId) : "",
                localVariantId: local ? String(local._id) : "",
              };
            });
            if (productMatched) matched += 1;
            await TikTokShopProductModel.updateOne(
              { companyCode, connectionId: String(connection._id), shopCipher: shop.cipher, tiktokProductId: productId },
              { $set: {
                shopName: shop.name, title: firstString(product.title, product.product_name) || `TikTok product ${productId}`,
                status: firstString(product.status), imageUrl: parseImage(product), skus,
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
