/* eslint-disable @typescript-eslint/no-explicit-any -- Express middleware interop and external API errors are dynamically shaped. */
import { Router } from "express";
import type { NextFunction, Response } from "express";
import { requireAuth, requirePermission, type AuthenticatedRequest } from "../../middleware/auth";
import { TikTokShopService } from "./tiktok-shop.service";
import { cleanupTikTokImportedProducts } from "./tiktok-shop-import-cleanup.service";
import "./tiktok-shop.consumer";

export const tikTokShopRouter = Router();
const read = [requireAuth as any, requirePermission(["settings:manage", "inventory:read"]) as any];
const manage = [requireAuth as any, requirePermission("settings:manage") as any];
const cleanup = [...manage, requirePermission("inventory:manage") as any];
const company = (req: AuthenticatedRequest) => req.user?.companyCode;
const actor = (req: AuthenticatedRequest) => String(req.user?.id || "");
const branch = (req: AuthenticatedRequest) => String(req.body?.branchId || req.user?.branchId || "");

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
  try { res.json({ data: await TikTokShopService.syncInventoryAndPrices(company(req)) }); } catch (error) { next(error); }
});
tikTokShopRouter.get("/products", ...read, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { res.json({ data: await TikTokShopService.listProducts(company(req), req.query as any) }); } catch (error) { next(error); }
});
tikTokShopRouter.delete("/connections/:id", ...manage, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { await TikTokShopService.disconnect(company(req), req.params.id); res.json({ data: { disconnected: true } }); } catch (error) { next(error); }
});
