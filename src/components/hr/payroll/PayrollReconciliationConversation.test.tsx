// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PayrollReconciliationConversation } from "./PayrollReconciliationConversation";
import { PAYROLL_RECONCILIATION_FIELDS, type PayrollReconciliation } from "../../../shared/payrollReconciliation";
afterEach(cleanup);
const record = (): PayrollReconciliation => ({
  runId: "r", employeeId: "e1", employeeName: "An", periodKey: "2026-09", version: 1, runStatus: "draft",
  snapshot: { checksum: "abc", values: Object.fromEntries(PAYROLL_RECONCILIATION_FIELDS.map(field => [field.key, 0])) as any, publishedAt: "2026-09-15T01:00:00Z", publishedBy: "kt" },
  publications: [], issues: [], confirmations: [],
});
describe("provisional payroll conversations", () => {
  it("lets an employee complain directly on the commission row", async () => {
    const action = vi.fn(async () => undefined);
    render(<PayrollReconciliationConversation record={record()} onAction={action} />);
    fireEvent.click(screen.getByRole("button", { name: "Khiếu nại Hoa hồng" }));
    fireEvent.change(screen.getByLabelText("Nội dung trao đổi"), { target: { value: "Thiếu hoa hồng đơn 123" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi phản hồi" }));
    await waitFor(() => expect(action).toHaveBeenCalledWith({ action: "dispute", field: "commission", body: "Thiếu hoa hồng đơn 123" }));
  });
  it("disables acknowledgement while a newer version awaits publication", () => {
    render(<PayrollReconciliationConversation record={{ ...record(), stale: true }} onAction={vi.fn()} />);
    expect((screen.getByRole("button", { name: "Xác nhận bảng lương" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("shows the full exchange and requires a resolution message from accounting", async () => {
    const item = record();
    item.issues = [{ id: "i", field: "workedMinutes", status: "open", snapshotChecksum: "abc", messages: [{ id: "m", authorId: "e1", authorName: "An", role: "employee", action: "question", body: "Thiếu công ngày 10", at: "2026-09-15T01:00:00Z" }] }];
    const action = vi.fn(async () => undefined);
    render(<PayrollReconciliationConversation record={item} staff onAction={action} />);
    expect(screen.getByText("Thiếu công ngày 10")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Xác nhận bảng lương" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Giải quyết khiếu nại" }));
    expect((screen.getByRole("button", { name: "Gửi phản hồi" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Kết quả giải quyết"), { target: { value: "Đã bổ sung ngày công" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi phản hồi" }));
    await waitFor(() => expect(action).toHaveBeenCalledWith({ action: "resolve", issueId: "i", body: "Đã bổ sung ngày công" }));
  });
  it("keeps closed-period conversations read-only", () => {
    render(<PayrollReconciliationConversation record={{ ...record(), runStatus: "closed" }} onAction={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Xác nhận bảng lương" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Khiếu nại Hoa hồng" })).toBeNull();
  });
});
