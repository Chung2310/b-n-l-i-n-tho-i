// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const service = vi.hoisted(() => ({ getMyReconciliation: vi.fn(), actMyReconciliation: vi.fn() }));
vi.mock("../../../services/payrollService", () => ({ payrollService: service }));
import { EmployeePayrollReconciliation } from "./EmployeePayrollReconciliation";
import { PAYROLL_RECONCILIATION_FIELDS } from "../../../shared/payrollReconciliation";
afterEach(() => { cleanup(); vi.resetAllMocks(); });
describe("employee account payroll reconciliation", () => {
  it("confirms the published version through the self-service endpoint", async () => {
    service.getMyReconciliation.mockResolvedValue([{
      runId: "r", employeeId: "e", employeeName: "An", version: 3, periodKey: "2026-09", runStatus: "draft",
      issues: [], publications: [], confirmations: [], snapshot: { checksum: "abc", publishedAt: "2026-09-15T00:00:00Z", values: Object.fromEntries(PAYROLL_RECONCILIATION_FIELDS.map(field => [field.key, 0])) },
    }]);
    service.actMyReconciliation.mockResolvedValue({});
    render(<EmployeePayrollReconciliation />);
    fireEvent.click(await screen.findByRole("button", { name: "Xác nhận bảng lương" }));
    await waitFor(() => expect(service.actMyReconciliation).toHaveBeenCalledWith("r", { action: "confirm", expectedVersion: 3 }));
    await waitFor(() => expect(service.getMyReconciliation).toHaveBeenCalledTimes(2));
  });
});
