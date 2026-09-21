import { beforeEach, describe, expect, it, vi } from "vitest";
const calls = vi.hoisted(() => ({ mine: vi.fn(), action: vi.fn(), list: vi.fn(), publish: vi.fn(), staff: vi.fn() }));
vi.mock("../service/payroll-reconciliation.service", () => ({
  listMyPayrollReconciliation: calls.mine, actMyPayrollReconciliation: calls.action,
  listPayrollReconciliation: calls.list, publishPayrollReconciliation: calls.publish, actPayrollReconciliation: calls.staff,
}));
import { payrollReconciliationController as controller } from "./payroll-reconciliation.controller";
const response = () => { const res: any = { json: vi.fn() }; res.status = vi.fn(() => res); return res; };
beforeEach(() => vi.resetAllMocks());
describe("reconciliation account boundaries", () => {
  it("derives employee identity and company only from the authenticated user", async () => {
    await controller.employeeAction({ user: { id: "self", companyCode: "ACME", displayName: "An" }, params: { id: "run", employeeId: "victim" }, body: { employeeId: "victim", companyCode: "OTHER", branchId: "other", role: "staff", expectedVersion: 3, action: "confirm" } } as any, response());
    expect(calls.action).toHaveBeenCalledWith("ACME", "self", "run", "An", 3, expect.objectContaining({ action: "confirm" }));
    await controller.mine({ user: { id: "self", companyCode: "ACME" }, query: { employeeId: "victim" } } as any, response());
    expect(calls.mine).toHaveBeenCalledWith("ACME", "self");
  });
  it("requires a staff branch and never trusts scope from the body", async () => {
    const res = response();
    await controller.publish({ user: { id: "a", companyCode: "ACME" }, params: { id: "r" }, body: { branchId: "victim" } } as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(calls.publish).not.toHaveBeenCalled();
  });
});
