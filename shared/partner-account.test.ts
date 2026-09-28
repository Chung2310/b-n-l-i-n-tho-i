import { describe, expect, it } from "vitest";
import { internalAccounts, isPartnerAccount } from "./partner-account";

describe("partner account classification", () => {
  it("recognizes provisioned accounts even if internal permissions are accidentally assigned", () => {
    expect(isPartnerAccount({ accountType: "partner", permissions: ["*", "partner:manage"] })).toBe(true);
  });
  it("recognizes legacy collaborator and dealer accounts without changing internal administrators", () => {
    expect(isPartnerAccount({ role: "user", permissions: ["partner-self:read"] })).toBe(true);
    expect(isPartnerAccount({ role: "user", permissions: ["partner-self:manage", "inventory:read"] })).toBe(true);
    expect(isPartnerAccount({ role: "admin", permissions: ["partner-self:read"] })).toBe(false);
    expect(isPartnerAccount({ role: "user", permissions: ["partner:manage", "partner-self:read"] })).toBe(false);
  });
  it("omits both new and legacy portal accounts from organizational employees", () => {
    const employee = { role: "user", permissions: ["people:read"] };
    expect(internalAccounts([employee, { accountType: "partner" }, { role: "user", permissions: ["partner-self:read"] }])).toEqual([employee]);
  });
});
