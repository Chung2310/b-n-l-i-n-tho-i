import { apiFetch } from "../modules/shared/lib/apiFetch";

export interface TikTokShopStatus {
  connected: boolean;
  connections: TikTokShopConnection[];
  shops: Array<{ cipher: string; id?: string; code?: string; name: string; region?: string }>;
}

export interface TikTokShopConnection {
  id: string;
  openId: string;
  shops: TikTokShopStatus["shops"];
  scopes: string[];
  connectedAt?: string;
  sync: {
    at?: string;
    status: "never" | "success" | "failed";
    error?: string;
    stats: { total: number; matched: number; unmatched: number };
  };
}

export interface TikTokShopProduct {
  _id: string;
  shopName: string;
  tiktokProductId: string;
  title: string;
  status: string;
  imageUrl?: string;
  skus: Array<{
    skuId: string;
    sellerSku: string;
    priceAmount: string;
    currency: string;
    inventoryQuantity: number;
    inventory?: Array<{ warehouseId: string; quantity: number }>;
    localProductId?: string;
    localVariantId?: string;
  }>;
  lastOutboundSyncAt?: string;
  lastOutboundSyncStatus?: "never" | "success" | "failed";
  lastOutboundSyncError?: string;
}

const unwrap = <T,>(response: { data: T }) => response.data;

export const tiktokShopApi = {
  status: () => apiFetch<{ data: TikTokShopStatus }>("/integrations/tiktok-shop/status").then(unwrap),
  authorizationUrl: () => apiFetch<{ data: { authUrl: string } }>("/integrations/tiktok-shop/auth-url").then(unwrap),
  syncProducts: () => apiFetch<{ data: { total: number; matched: number; unmatched: number; connections: number } }>("/integrations/tiktok-shop/sync-products", { method: "POST" }).then(unwrap),
  importProducts: () => apiFetch<{ data: { products: number; createdProducts: number; createdVariants: number; linkedExisting: number; importedPrices: number; importedStock: number; failed: number; errors: string[] } }>("/integrations/tiktok-shop/import-products", { method: "POST" }).then(unwrap),
  syncInventoryAndPrices: () => apiFetch<{ data: { products: number; skus: number; updated: number; skipped: number; failed: number; errors: string[] } }>("/integrations/tiktok-shop/sync-inventory-prices", { method: "POST" }).then(unwrap),
  products: () => apiFetch<{ data: { items: TikTokShopProduct[]; total: number } }>("/integrations/tiktok-shop/products", { params: { pageSize: 100 } }).then(unwrap),
  disconnect: (connectionId: string) => apiFetch<{ data: { disconnected: boolean } }>(`/integrations/tiktok-shop/connections/${encodeURIComponent(connectionId)}`, { method: "DELETE" }).then(unwrap),
};
