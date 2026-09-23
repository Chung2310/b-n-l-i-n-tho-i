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
