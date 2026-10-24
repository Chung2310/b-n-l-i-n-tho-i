import { beforeEach, expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({ findOne: vi.fn(), lean: vi.fn() }));
vi.mock("../../model/branch.model", () => ({ BranchModel: { findOne: mocks.findOne } }));
import { customerScopeFilter, customerScopeFromRequest } from "./customer-branch-scope";
import { buildCustomerListFilter } from "./customer.service";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findOne.mockReturnValue({ select: () => ({ lean: mocks.lean }) });
});
test("CN2 list and search exclude unassigned MAIN customers", () => {
  const filter = buildCustomerListFilter({ companyCode: "IGEN", branchId: "cn2" }, { q: "Vũ" });
  expect(filter.branchId).toBe("cn2");
  expect(filter.companyCode).toBe("IGEN");
  expect(filter.$or).toHaveLength(5);
  expect(filter.$and).toBeUndefined();
});
test("MAIN includes legacy customers without replacing the search condition", () => {
  const scope = { companyCode: "IGEN", branchId: "main", includeLegacy: true };
  const filter = buildCustomerListFilter(scope, { q: "Vũ" });
  expect(filter.$and).toEqual([{ $or: [{ branchId: "main" }, { branchId: null }, { branchId: "" }] }]);
  expect(filter.$or).toHaveLength(5);
  expect(customerScopeFilter(scope)).not.toHaveProperty("includeLegacy");
});
test("admin uses selected authenticated branch, not an aggregate company scope", async () => {
  mocks.lean.mockResolvedValue({ code: "CN2" });
  const scope = await customerScopeFromRequest({ user: { role: "admin", companyCode: "IGEN", branchId: "cn2" }, query: {} } as any);
  expect(scope).toEqual({ companyCode: "IGEN", branchId: "cn2", includeLegacy: false });
  expect(mocks.findOne).toHaveBeenCalledWith({ _id: "cn2", companyCode: "IGEN", isActive: true });
});
test("only the database MAIN branch can see legacy records", async () => {
  mocks.lean.mockResolvedValue({ code: "MAIN" });
  expect(await customerScopeFromRequest({ user: { role: "admin", companyCode: "IGEN", branchId: "main" }, query: {} } as any)).toHaveProperty("includeLegacy", true);
});
test("missing, foreign and mismatched branches cannot fall back to company data", async () => {
  await expect(customerScopeFromRequest({ user: { role: "admin", companyCode: "IGEN" }, query: {} } as any)).rejects.toThrow();
  await expect(customerScopeFromRequest({ user: { role: "user", companyCode: "IGEN", branchId: "cn2" }, query: { branchId: "main" } } as any)).rejects.toThrow();
  mocks.lean.mockResolvedValue(null);
  await expect(customerScopeFromRequest({ user: { role: "admin", companyCode: "IGEN", branchId: "foreign" }, query: {} } as any)).rejects.toThrow();
});
