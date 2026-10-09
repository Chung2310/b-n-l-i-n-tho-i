import assert from "node:assert/strict";
import { after, before, beforeEach, afterEach, mock, test } from "node:test";
import express from "express";
import jwt from "jsonwebtoken";
import type { Server } from "node:http";
import { retailRouter } from "./router";
import { UserModel } from "../../model/user.model";
import { CompanyModel } from "../../model/company.model";
import { RolePermissionModel } from "../../model/role-permission.model";
import { clearModuleCache } from "../../middleware/require-module";
import { RetailProductService } from "./services/retail-product.service";
import { RetailOrderService } from "./services/retail-order.service";
import { CashierShiftService } from "./services/cashier-shift.service";

let server: Server;
let origin: string;
const previousSecret = process.env.JWT_ACCESS_SECRET;
const secret = "retail-router-test-secret-only";
const actor = { id: "u1", role: "admin", email: "test@example.com", companyCode: "ACME", sid: "s1" };
let enabledModules = ["retail"];
let permissions = ["retail:manage"];
const token = (payload = actor) => jwt.sign(payload, secret, { expiresIn: "5m" });

before(async () => {
  process.env.JWT_ACCESS_SECRET = secret;
  const app = express();
  app.use(express.json());
  app.use("/api/v1", retailRouter);
  app.get("/api/v1/unrelated", (_req, res) => res.json({ ok: true }));
  server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
  });
  const address = server.address() as { port: number };
  origin = `http://127.0.0.1:${address.port}/api/v1`;
});
after(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  if (previousSecret === undefined) delete process.env.JWT_ACCESS_SECRET;
  else process.env.JWT_ACCESS_SECRET = previousSecret;
});
beforeEach(() => {
  clearModuleCache();
  enabledModules = ["retail"];
  permissions = ["retail:manage"];
  mock.method(UserModel, "findById", () => ({ select: () => ({ lean: async () => ({ branchId: "b1", activeSessionId: "s1", displayName: "Cashier", permissions: [] }) }) }) as any);
  mock.method(CompanyModel, "findOne", () => ({ select: () => ({ lean: async () => ({ enabledModules, businessType: "general" }) }) }) as any);
  mock.method(RolePermissionModel, "findOne", () => ({ lean: async () => ({ permissions }) }) as any);
  mock.method(RetailProductService, "search", async (scope) => {
    assert.deepEqual(scope, { companyCode: "ACME", branchId: "b1" });
    return { items: [], total: 0, page: 1, limit: 20 } as any;
  });
});
afterEach(() => { mock.restoreAll(); clearModuleCache(); });

const products = (accessToken?: string) => fetch(`${origin}/retail/orders/products`, {
  headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
});

test("valid retail login reaches products without a false session-expired response", async () => {
  const response = await products(token());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).success, true);
});
test("missing and invalid tokens still return 401", async () => {
  assert.equal((await products()).status, 401);
  assert.equal((await products("invalid-token")).status, 401);
});
test("a replaced login session is still rejected", async () => {
  const response = await products(token({ ...actor, sid: "old-session" }));
  assert.equal(response.status, 401);
  assert.equal((await response.json()).code, "SESSION_REPLACED");
});
test("retail module access is checked after authentication", async () => {
  enabledModules = [];
  assert.equal((await products(token())).status, 403);
});
test("authenticated users still need retail permission", async () => {
  permissions = [];
  assert.equal((await products(token())).status, 403);
});
test("retail guards do not intercept other API routes", async () => {
  assert.equal((await fetch(`${origin}/unrelated`)).status, 200);
});

const cashierRequest = (path: string, method = "GET", body?: any) => fetch(`${origin}/retail${path}`, {
  method, headers: { Authorization: `Bearer ${token({ ...actor, role: "pos_cashier" })}`, "Content-Type": "application/json" },
  ...(body ? { body: JSON.stringify(body) } : {}),
});

test("POS-only cashier can select products without receiving cost prices", async () => {
  permissions = ["pos:manage"];
  mock.method(RetailProductService, "search", async () => ({ items: [{ _id: "p1", price: 100, costPrice: 70 }], total: 1 }) as any);
  const response = await cashierRequest("/orders/products");
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).data.items, [{ _id: "p1", price: 100 }]);
});

test("cashier cannot use list query parameters to read other cashiers' orders", async () => {
  permissions = ["pos:manage"];
  mock.method(RetailOrderService, "list", async (_scope, query) => {
    assert.equal(query.heldOnly, true);
    assert.equal(query.ownerId, "u1");
    return { items: [], total: 0, page: 1, limit: 20 };
  });
  assert.equal((await cashierRequest("/orders?heldOnly=false&ownerId=another-cashier")).status, 200);
});

test("cashier quote and draft responses omit total and line costs", async () => {
  permissions = ["pos:manage"];
  const item = { productId: "p1", unitPrice: 100, unitCost: 70 };
  mock.method(RetailOrderService, "quote", async () => ({ lines: [item], grandTotal: 100, totalCost: 70 }) as any);
  mock.method(RetailOrderService, "createDraft", async () => ({ _id: "o1", items: [item], totalCost: 70 }) as any);
  mock.method(RetailOrderService, "updateDraft", async () => ({ _id: "o1", items: [item], totalCost: 70 }) as any);
  for (const [path, method, lines] of [["/orders/quote", "POST", "lines"], ["/orders", "POST", "items"], ["/orders/o1", "PATCH", "items"]]) {
    const response = await cashierRequest(path, method, {});
    assert.ok(response.ok);
    const data = (await response.json()).data;
    assert.equal("totalCost" in data, false);
    assert.equal("unitCost" in data[lines][0], false);
  }
});

test("cashier confirmation requires an open session, but completed replays remain recoverable", async () => {
  permissions = ["pos:manage"];
  let replay = false;
  mock.method(RetailOrderService, "idempotency", async () => ({ status: replay ? "completed" : "not_found" }) as any);
  const operational = mock.method(CashierShiftService, "operational", async () => ({ _id: "s1" }) as any);
  const confirm = mock.method(RetailOrderService, "confirm", async () => ({ order: { items: [{ unitCost: 70 }], totalCost: 70 }, invoice: {} }) as any);
  assert.equal((await cashierRequest("/orders/o1/confirm", "POST", { idempotencyKey: "k1" })).status, 409);
  assert.equal(confirm.mock.callCount(), 0);
  const request = { idempotencyKey: "k1", posSessionId: "s1" };
  const response = await cashierRequest("/orders/o1/confirm?terminalId=t1", "POST", request);
  assert.equal(response.status, 200);
  const data = (await response.json()).data;
  assert.equal("totalCost" in data.order, false);
  assert.equal("unitCost" in data.order.items[0], false);
  assert.equal(operational.mock.calls[0].arguments[3], "t1");
  assert.equal(operational.mock.calls[0].arguments[4], "s1");
  replay = true;
  assert.equal((await cashierRequest("/orders/o1/confirm", "POST", request)).status, 200);
  assert.equal(operational.mock.callCount(), 1);
});

test("POS-only cashier cannot collect unrelated debts or manage shift history", async () => {
  permissions = ["pos:manage"];
  for (const path of ["/orders/o1/payments", "/orders/o1/payments/reconcile", "/orders/o1/payments/revoke", "/shifts/s1/reconcile"]) {
    assert.equal((await cashierRequest(path, "POST", {})).status, 403);
  }
  assert.equal((await cashierRequest("/shifts")).status, 403);
});
