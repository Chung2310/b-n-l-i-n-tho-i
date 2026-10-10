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
    localProductId?: string;
    localVariantId?: string;
  }>;
}

const unwrap = <T,>(response: { data: T }) => response.data;

export const tiktokShopApi = {
  status: () => apiFetch<{ data: TikTokShopStatus }>("/integrations/tiktok-shop/status").then(unwrap),
  authorizationUrl: () => apiFetch<{ data: { authUrl: string } }>("/integrations/tiktok-shop/auth-url").then(unwrap),
  syncProducts: () => apiFetch<{ data: { total: number; matched: number; unmatched: number; connections: number } }>("/integrations/tiktok-shop/sync-products", { method: "POST" }).then(unwrap),
  products: () => apiFetch<{ data: { items: TikTokShopProduct[]; total: number } }>("/integrations/tiktok-shop/products", { params: { pageSize: 100 } }).then(unwrap),
  disconnect: (connectionId: string) => apiFetch<{ data: { disconnected: boolean } }>(`/integrations/tiktok-shop/connections/${encodeURIComponent(connectionId)}`, { method: "DELETE" }).then(unwrap),
};
