import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import type { Response } from "express";
import { UserModel } from "../model/user.model";
import { getEffectivePermissions, requireAuth } from "./auth";
import { RolePermissionModel } from "../model/role-permission.model";
import { getJwtAccessSecret } from "../config/env";

function makeResponse() {
  return {
    statusCode: 200,
    body: undefined as any,
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
  };
}

function invoke(token: string, activeSessionId: string) {
  vi.spyOn(UserModel, "findById").mockReturnValue({
    select: () => ({
      lean: async () => ({ branchId: "branch-1", activeSessionId, displayName: "Nguyễn An" }),
    }),
  } as any);
  const req = { headers: { authorization: `Bearer ${token}` }, method: "GET", originalUrl: "/api/v1/auth/me" } as any;
  const res = makeResponse();
  let passed = false;
  return requireAuth(req, res as unknown as Response, () => { passed = true; }).then(() => ({ req, res, passed }));
}

describe("requireAuth regular active session", () => {
  it("keeps partner accounts out of internal APIs while allowing their own portal", async () => {
    process.env.JWT_ACCESS_SECRET ||= "test-access-secret-at-least-32-characters";
    const token = jwt.sign({ id: "partner", role: "user", sid: "session" }, getJwtAccessSecret());
    vi.spyOn(UserModel, "findById").mockReturnValue({ select: () => ({ lean: async () => ({ role: "user", accountType: "partner", activeSessionId: "session" }) }) } as any);
    for (const [path, expected] of [["/api/v1/auth/users", 403], ["/api/v1/partners/", 403], ["/api/v1/auth/me", 200], ["/api/v1/partners/me/statement?period=2026-09", 200]] as const) {
      const res = makeResponse();
      let passed = false;
      await requireAuth({ headers: { authorization: `Bearer ${token}` }, method: "GET", originalUrl: path } as any, res as unknown as Response, () => { passed = true; });
      assert.equal(res.statusCode, expected);
      assert.equal(passed, expected === 200);
    }
  });
  it("does not inherit the internal user role permissions for new or legacy partner accounts", async () => {
    const rolePermissions = vi.spyOn(RolePermissionModel, "findOne");
    for (const profile of [{ role: "user", permissions: ["partner-self:read"] }, { role: "user", accountType: "partner", permissions: ["*"] }]) {
      vi.spyOn(UserModel, "findById").mockReturnValue({ select: () => ({ lean: async () => profile }) } as any);
      assert.deepEqual(await getEffectivePermissions("partner", "user", "ACME"), new Set(["partner-self:read"]));
    }
    assert.equal(rolePermissions.mock.calls.length, 0);
  });
  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET ||= "test-access-secret-at-least-32-characters";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects a valid access token whose regular session was replaced", async () => {
    const token = jwt.sign({ id: "user-1", email: "user@example.com", role: "user", companyCode: "ACME", sid: "old-session" }, getJwtAccessSecret(), { expiresIn: "15m" });
    const result = await invoke(token, "new-session");

    assert.equal(result.passed, false);
    assert.equal(result.res.statusCode, 401);
    assert.equal(result.res.body?.code, "SESSION_REPLACED");
  });

  it("accepts a regular access token with the current session", async () => {
    const token = jwt.sign({ id: "user-1", email: "user@example.com", role: "user", companyCode: "ACME", sid: "current-session" }, getJwtAccessSecret(), { expiresIn: "15m" });
    const result = await invoke(token, "current-session");

    assert.equal(result.passed, true);
    assert.equal(result.req.user.sessionId, "current-session");
    assert.equal(result.req.user.displayName, "Nguyễn An");
  });
});
