/* eslint-disable @typescript-eslint/no-explicit-any -- Express middleware interop and external API errors are dynamically shaped. */
import { Router } from "express";
import type { NextFunction, Response } from "express";
import { randomUUID } from "node:crypto";
import { requireAuth, requirePermission, type AuthenticatedRequest } from "../../middleware/auth";
import { TikTokShopService } from "./tiktok-shop.service";
import { cleanupTikTokImportedProducts } from "./tiktok-shop-import-cleanup.service";
import { TikTokShopConnectionModel } from "./tiktok-shop-connection.model";
import { callTikTokShopApi } from "./tiktok-shop.client";
import { getTikTokShopOrderBranch, validTikTokShopAccessToken } from "./tiktok-shop.service";
import { publishDomainEvent } from "../shared/event-bus";
import { DomainEventModel } from "../shared/domain-event.model";
import { RetailOrderModel } from "../../modules/retail/models/retail-order.model";
import "./tiktok-shop.consumer";

export const tikTokShopRouter = Router();
const read = [requireAuth as any, requirePermission(["settings:manage", "inventory:read"]) as any];
const manage = [requireAuth as any, requirePermission("settings:manage") as any];
const orderManage = [requireAuth as any, requirePermission(["settings:manage", "retail:manage"]) as any];
const cleanup = [...manage, requirePermission("inventory:manage") as any];
const company = (req: AuthenticatedRequest) => req.user?.companyCode;
const actor = (req: AuthenticatedRequest) => String(req.user?.id || "");
const branch = (req: AuthenticatedRequest) => String(req.body?.branchId || req.user?.branchId || "");
const missingTikTokOrderScope = (error: any) => String(error?.apiCode || "") === "105005"
  || /access token does not include any scope required/i.test(String(error?.message || ""));
const tikTokOrderScopeHelp = "TikTok chưa cấp quyền đọc đơn hàng (Order Information, seller.order.info). Vào TikTok Shop Partner Center > App & Service > ứng dụng > Manage API, bật quyền Order Information; sau đó vào Cài đặt > TikTok Shop, chọn Ủy quyền lại seller và chấp nhận quyền mới rồi đồng bộ lại.";

tikTokShopRouter.get("/status", ...read, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { res.json({ data: await TikTokShopService.status(company(req)) }); } catch (error) { next(error); }
});
tikTokShopRouter.get("/order-branches", ...manage, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { res.json({ data: await TikTokShopService.activeBranches(company(req)) }); } catch (error) { next(error); }
});
tikTokShopRouter.get("/order-branch", ...manage, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { res.json({ data: await TikTokShopService.orderBranch(company(req)) }); } catch (error) { next(error); }
});
tikTokShopRouter.patch("/order-branch", ...manage, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { res.json({ data: await TikTokShopService.setDefaultOrderBranch(company(req), req.body?.branchId) }); } catch (error) { next(error); }
});
tikTokShopRouter.get("/catalog-products", ...manage, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { res.json({ data: await TikTokShopService.listPublishableProducts(company(req)) }); } catch (error) { next(error); }
});
tikTokShopRouter.get("/listing/categories", ...manage, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { res.json({ data: await TikTokShopService.listingCategories(company(req), req.query.connectionId, req.query.shopCipher) }); } catch (error) { next(error); }
});
tikTokShopRouter.get("/listing/warehouses", ...manage, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { res.json({ data: await TikTokShopService.listingWarehouses(company(req), req.query.connectionId, req.query.shopCipher) }); } catch (error) { next(error); }
});
tikTokShopRouter.get("/listing/categories/:categoryId/attributes", ...manage, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { res.json({ data: await TikTokShopService.listingAttributes(company(req), req.query.connectionId, req.query.shopCipher, req.params.categoryId) }); } catch (error) { next(error); }
});
tikTokShopRouter.post("/listing/products", ...manage, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { res.json({ data: await TikTokShopService.publishCatalogProduct(company(req), req.body) }); } catch (error) { next(error); }
});
tikTokShopRouter.get("/auth-url", ...manage, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { res.json({ data: { authUrl: await TikTokShopService.createAuthorizationUrl(company(req), actor(req)) } }); } catch (error) { next(error); }
});
tikTokShopRouter.get("/callback", async (req: AuthenticatedRequest, res: Response) => {
  const send = (ok: boolean, message: string) => {
    const safeJson = (value: string) => JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
    return res.status(ok ? 200 : 400).type("html").send(`<!doctype html><html lang="vi"><meta charset="utf-8"><title>TikTok Shop</title><body style="font-family:sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#f8fafc"><div style="padding:32px;border:1px solid #e2e8f0;border-radius:16px;background:white;max-width:480px;text-align:center"><h2>${ok ? "Kết nối thành công" : "Kết nối thất bại"}</h2><p>${message.replace(/[<>&"']/g, "")}</p></div><script>if(window.opener)window.opener.postMessage({type:${safeJson(ok ? "TIKTOK_SHOP_CONNECTED" : "TIKTOK_SHOP_FAILED")},error:${safeJson(ok ? "" : message)}},window.location.origin);setTimeout(()=>window.close(),1500)</script></body></html>`);
  };
  try {
    const authCode = String(req.query.code || req.query.auth_code || "");
    const state = String(req.query.state || "");
    const denied = String(req.query.error || req.query.error_description || "");
    if (denied) return send(false, denied);
    if (!authCode || !state) return send(false, "TikTok Shop không trả về code hoặc state hợp lệ.");
    await TikTokShopService.completeAuthorization(state, authCode);
    return send(true, "Shop đã được liên kết. Bạn có thể đóng cửa sổ này.");
  } catch (error: any) { return send(false, error?.message || "Không thể hoàn tất kết nối TikTok Shop."); }
});
tikTokShopRouter.post("/sync-products", ...manage, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { res.json({ data: await TikTokShopService.syncProducts(company(req)) }); } catch (error) { next(error); }
});
tikTokShopRouter.post("/sync-orders", ...orderManage, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const companyCode = String(company(req) || "").trim().toUpperCase();
    const branchId = await getTikTokShopOrderBranch(companyCode);
    if (!branchId) throw Object.assign(new Error("Hãy chọn chi nhánh mặc định nhận đơn TikTok Shop trước khi đồng bộ."), { statusCode: 400 });
    const connections: any[] = await TikTokShopConnectionModel.find({ companyCode }).select("+accessTokenEncrypted +refreshTokenEncrypted");
    if (!connections.length) throw Object.assign(new Error("Chưa có tài khoản seller TikTok Shop được kết nối."), { statusCode: 400 });

    const batchId = randomUUID();
    const errors: string[] = [];
    const seenOrders = new Set<string>();
    let shopsScanned = 0;
    let queued = 0;
    for (const connection of connections) {
      let accessToken: string;
      try {
        accessToken = await validTikTokShopAccessToken(connection);
      } catch (error: any) {
        errors.push(`${connection.openId}: ${String(error?.message || "Không lấy được quyền truy cập TikTok Shop.").slice(0, 240)}`);
        continue;
      }
      for (const shop of connection.shops || []) {
        if (!shop.cipher) continue;
        try {
          let pageToken = "";
          const visitedTokens = new Set<string>();
          do {
            const data: any = await callTikTokShopApi({
              path: "/order/202309/orders/search",
              method: "POST",
              accessToken,
              query: { shop_cipher: String(shop.cipher), page_size: 100, sort_field: "create_time", sort_order: "ASC", page_token: pageToken || undefined },
              body: { order_status: "AWAITING_SHIPMENT" },
            });
            const orders = Array.isArray(data?.orders) ? data.orders : [];
            for (const order of orders) {
              const orderId = String(order.order_id || order.id || "").trim();
              const orderStatus = String(order.order_status || order.status || "").trim().toUpperCase();
              if (!orderId || orderStatus !== "AWAITING_SHIPMENT") continue;
              const orderKey = `${shop.cipher}:${orderId}`;
              if (seenOrders.has(orderKey)) continue;
              seenOrders.add(orderKey);
              const eventTimestamp = Number(order.update_time || order.create_time) || Math.floor(Date.now() / 1000);
              await publishDomainEvent({
                eventId: `tiktok-shop-backfill:${batchId}:${randomUUID()}`,
                eventType: "tiktok.order.status.changed",
                companyCode,
                branchId,
                aggregateType: "TikTokShopOrderBackfill",
                aggregateId: batchId,
                occurredAt: new Date(eventTimestamp * 1000),
                actorId: actor(req),
                actorName: String(req.user?.displayName || req.user?.email || "Người dùng"),
                payload: {
                  notificationId: `backfill:${batchId}:${shop.cipher}:${orderId}`,
                  sellerOpenId: String(connection.openId),
                  shopId: String(shop.id || ""),
                  shopCipher: String(shop.cipher),
                  orderId,
                  orderStatus,
                  eventTimestamp,
                },
              });
              queued += 1;
            }
            shopsScanned += pageToken ? 0 : 1;
            const nextPageToken = String(data?.next_page_token || "");
            if (!nextPageToken || visitedTokens.has(nextPageToken)) break;
            visitedTokens.add(nextPageToken);
            pageToken = nextPageToken;
          } while (pageToken);
        } catch (error: any) {
          const message = missingTikTokOrderScope(error)
            ? tikTokOrderScopeHelp
            : String(error?.message || "Không thể lấy danh sách đơn TikTok Shop.").slice(0, 240);
          errors.push(`${shop.name || shop.id || shop.cipher}: ${message}`);
        }
      }
    }

    res.json({ data: { batchId, shopsScanned, queued, errors } });
  } catch (error) { next(error); }
});
tikTokShopRouter.get("/sync-orders/:batchId", ...orderManage, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const batchId = String(req.params.batchId || "").trim();
    const events: any[] = await DomainEventModel.find({
      companyCode: String(company(req) || "").trim().toUpperCase(),
      aggregateType: "TikTokShopOrderBackfill",
      aggregateId: batchId,
    }).select("payload deliveries").lean();
    const ordersByShop = new Map<string, Set<string>>();
    const deliveryStatuses = events.map((event) => {
      const shopCipher = String(event.payload?.shopCipher || "");
      const orderId = String(event.payload?.orderId || "");
      if (shopCipher && orderId) {
        const orderIds = ordersByShop.get(shopCipher) || new Set<string>();
        orderIds.add(orderId);
        ordersByShop.set(shopCipher, orderIds);
      }
      return (event.deliveries || []).find((delivery: any) => delivery.consumer === "tiktok-shop.order-sync")?.status || "pending";
    });
    const orderFilters = [...ordersByShop].map(([shopCipher, orderIds]) => ({ externalShopCipher: shopCipher, externalOrderId: { $in: [...orderIds] } }));
    const invoicesCreated = orderFilters.length
      ? await RetailOrderModel.countDocuments({ companyCode: String(company(req) || "").trim().toUpperCase(), salesChannel: "tiktok-shop", $or: orderFilters })
      : 0;
    res.json({ data: {
      batchId,
      total: events.length,
      processed: deliveryStatuses.filter((status) => ["done", "failed", "skipped"].includes(status)).length,
      pending: deliveryStatuses.filter((status) => ["pending", "processing"].includes(status)).length,
      failed: deliveryStatuses.filter((status) => status === "failed").length,
      invoicesCreated,
      errors: events.flatMap((event) => (event.deliveries || [])
        .filter((delivery: any) => delivery.consumer === "tiktok-shop.order-sync" && delivery.status === "failed" && delivery.lastError)
        .map((delivery: any) => String(delivery.lastError).slice(0, 240))).slice(0, 5),
    } });
  } catch (error) { next(error); }
});
tikTokShopRouter.post("/import-products", ...manage, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { res.json({ data: await TikTokShopService.importProductsToInventory(company(req), branch(req), actor(req)) }); } catch (error) { next(error); }
});
tikTokShopRouter.post("/cleanup-imported-products", ...cleanup, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    res.json({ data: await cleanupTikTokImportedProducts({
      companyCode: company(req),
      tiktokProductIds: req.body?.tiktokProductIds,
      dryRun: req.body?.dryRun,
      confirm: req.body?.confirm,
    }) });
  } catch (problem: any) {
    return res.status(Number(problem?.statusCode) || 500).json({
      success: false,
      ...(problem?.code ? { code: problem.code } : {}),
      message: problem?.message || "Không thể dọn sản phẩm TikTok đã nhập.",
      ...(problem?.references ? { references: problem.references } : {}),
    });
  }
});
tikTokShopRouter.post("/sync-inventory-prices", ...manage, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { res.json({ data: await TikTokShopService.syncInventoryAndPrices(company(req), { branchId: branch(req) || undefined }) }); } catch (error) { next(error); }
});
tikTokShopRouter.get("/products", ...read, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { res.json({ data: await TikTokShopService.listProducts(company(req), req.query as any) }); } catch (error) { next(error); }
});
tikTokShopRouter.delete("/connections/:id", ...manage, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { await TikTokShopService.disconnect(company(req), req.params.id); res.json({ data: { disconnected: true } }); } catch (error) { next(error); }
});
