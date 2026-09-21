import { describe, expect, it } from "vitest";
import { resolveBulletinRole } from "./dashboard-bulletin";
import { resolveDashboardModuleAccess } from "./dashboard-module-access";

describe("bulletin role and authorization", () => {
  it("keeps manager precedence and recognizes Vietnamese technician profiles", () => {
    expect(resolveBulletinRole("manager", "Kỹ thuật viên")).toBe("manager");
    expect(resolveBulletinRole("user", "Kỹ thuật viên")).toBe("technical");
    expect(resolveBulletinRole("technician")).toBe("technical");
    expect(resolveBulletinRole("user", "Nhân viên bán hàng")).toBe("sales");
  });
  it("requires both module availability and read permission", () => {
    expect(resolveDashboardModuleAccess({ role: "user", enabledModules: ["repair"], permissions: new Set(["repair:read", "retail:read"]) }).retail).toBe(false);
    expect(resolveDashboardModuleAccess({ role: "user", enabledModules: ["repair"], permissions: new Set() }).repair).toBe(false);
    expect(resolveDashboardModuleAccess({ role: "user", enabledModules: ["repair"], permissions: new Set(["repair:read"]) }).repair).toBe(true);
  });
});
