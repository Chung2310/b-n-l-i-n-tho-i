// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const service = vi.hoisted(() => ({ getReconciliation: vi.fn(), publishReconciliation: vi.fn(), replyReconciliation: vi.fn() }));
vi.mock("../../../services/payrollService", () => ({ payrollService: service }));
import { PayrollReconciliationPanel } from "./PayrollReconciliationPanel";
afterEach(() => { cleanup(); vi.resetAllMocks(); });
describe("accounting provisional publication", () => {
  it("publishes the version just loaded and refreshes the parent workflow version", async () => {
    service.getReconciliation.mockResolvedValue({ runVersion: 7, runStatus: "draft", employeeCount: 1, items: [] });
    service.publishReconciliation.mockResolvedValue({ employeeCount: 1 });
    const changed = vi.fn();
    render(<PayrollReconciliationPanel runId="r" runVersion={4} canManage onChanged={changed} onEdit={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Phát hành bảng lương tạm tính" }));
    await waitFor(() => expect(service.publishReconciliation).toHaveBeenCalledWith("r", 7));
    await waitFor(() => expect(changed).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole("button", { name: "Tải lại phản hồi nhân viên" }));
    await waitFor(() => expect(changed).toHaveBeenCalledTimes(2));
  });
  it("does not allow a read-only accountant to publish", async () => {
    service.getReconciliation.mockResolvedValue({ runVersion: 7, runStatus: "draft", employeeCount: 1, items: [] });
    render(<PayrollReconciliationPanel runId="r" runVersion={4} canManage={false} onChanged={vi.fn()} onEdit={vi.fn()} />);
    await screen.findByText(/Đã xác nhận: 0\/1/);
    expect(screen.queryByRole("button", { name: "Phát hành bảng lương tạm tính" })).toBeNull();
  });
});
