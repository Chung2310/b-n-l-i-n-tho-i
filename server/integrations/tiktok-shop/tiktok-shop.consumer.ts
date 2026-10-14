import { registerDomainConsumer } from "../shared/event-bus";
import { syncTikTokShopOrderStatusChange } from "./tiktok-shop-order.service";
import { TikTokShopService } from "./tiktok-shop.service";

async function syncChangedSku(event: any) {
  await TikTokShopService.syncInventoryAndPrices(event.companyCode, {
    variantId: String(event.payload?.variantId || "") || undefined,
    sku: String(event.payload?.sku || "") || undefined,
    branchId: String(event.branchId || "") || undefined,
  }, true);
}

for (const eventType of ["inventory.stock.changed", "inventory.price.changed"] as const) {
  try {
    registerDomainConsumer(eventType, "tiktok-shop.product-sync", syncChangedSku);
  } catch (error) {
    if (!String((error as Error)?.message || "").includes("đã được đăng ký")) throw error;
  }
}

try {
  registerDomainConsumer("tiktok.order.status.changed", "tiktok-shop.order-sync", async (event) => {
    await syncTikTokShopOrderStatusChange(event);
  });
} catch (error) {
  if (!String((error as Error)?.message || "").includes("đã được đăng ký")) throw error;
}
