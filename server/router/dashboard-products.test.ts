import express from "express";
import { afterEach, expect, it, vi } from "vitest";
const calls = vi.hoisted(() => ({ summary: vi.fn() }));
vi.mock("../controller/dashboard.controller", () => ({ dashboardController: { getSummary: vi.fn(), getActionItems: vi.fn() } }));
vi.mock("../modules/retail/controllers/retail-report.controller", () => ({ retailReportController: { summary: calls.summary } }));
vi.mock("../middleware/auth", () => ({
 requireAuth: (req: any, res: any, next: any) => {
   if (!req.headers.authorization) return res.sendStatus(401);
   req.user = { id: "test-user" };
   next();
 },
 requirePermission: (permission: string | string[]) => (req: any, res: any, next: any) => {
   if (!req.user) return res.sendStatus(401);
   const granted = String(req.headers["x-test-permissions"] || "").split(",");
   const required = Array.isArray(permission) ? permission : [permission];
   if (!required.some(p => granted.includes(p))) return res.sendStatus(403);
   next();
 },
}));
import { dashboardRouter } from "./dashboard.router";
afterEach(() => vi.clearAllMocks());
it("authenticates before permission guards and preserves retail permissions", async () => {
 calls.summary.mockImplementation((req, res) => res.json({ success: true, user: req.user.id, data: { products: [] } }));
 const app = express();
 app.use("/dashboard", dashboardRouter);
 const server = app.listen(0, "127.0.0.1");
 await new Promise<void>(resolve => server.once("listening", resolve));
 const address = server.address() as import("net").AddressInfo;
 const url = `http://127.0.0.1:${address.port}/dashboard/best-selling-products`;
 try {
   expect((await fetch(url)).status).toBe(401);
   expect((await fetch(url, { headers: { Authorization: "test", "x-test-permissions": "dashboard:read" } })).status).toBe(403);
   expect(calls.summary).not.toHaveBeenCalled();
   const response = await fetch(url, { headers: { Authorization: "test", "x-test-permissions": "dashboard:read,retail:manage" } });
   expect(response.status).toBe(200);
   expect((await response.json()).user).toBe("test-user");
   expect(calls.summary).toHaveBeenCalledOnce();
 } finally {
   await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
 }
});
