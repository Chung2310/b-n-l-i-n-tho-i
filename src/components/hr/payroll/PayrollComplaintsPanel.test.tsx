// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const service = vi.hoisted(() => ({ getReconciliation: vi.fn(), replyReconciliation: vi.fn(), publishReconciliation: vi.fn() }));
vi.mock("../../../services/payrollService", () => ({ payrollService: service }));
import { PayrollComplaintsPanel } from "./PayrollComplaintsPanel";
import { PAYROLL_RECONCILIATION_FIELDS, type PayrollReconciliation } from "../../../shared/payrollReconciliation";
const record = (): PayrollReconciliation => ({
  runId: "r1", employeeId: "e1", employeeName: "Nguyễn An", periodKey: "2026-09", version: 3, runStatus: "draft",
  snapshot: { checksum: "c1", values: Object.fromEntries(PAYROLL_RECONCILIATION_FIELDS.map(field => [field.key, 0])) as any, publishedAt: "2026-09-15T01:00:00Z", publishedBy: "kt" },
  publications: [], confirmations: [], issues: [
    { id: "i1", field: "commission", status: "open", snapshotChecksum: "c1", messages: [{ id: "m1", authorId: "e1", authorName: "An", role: "employee", action: "question", body: "Thiếu hoa hồng đơn 123", at: "2026-09-15T02:00:00Z" }] },
    { id: "i2", field: "workedMinutes", status: "resolved", snapshotChecksum: "c1", messages: [{ id: "m2", authorId: "e1", authorName: "An", role: "employee", action: "question", body: "Thiếu giờ công ngày 10", at: "2026-09-15T01:00:00Z" }] },
  ],
});
const status = (item = record()) => ({ runVersion: 7, runStatus: item.runStatus, employeeCount: 1, items: [item] });
const props = () => ({ runId: "r1", runVersion: 7, canManage: true, onChanged: vi.fn(), onEdit: vi.fn() });
beforeEach(() => { service.getReconciliation.mockResolvedValue(status()); });
afterEach(() => { cleanup(); vi.resetAllMocks(); });
describe("payroll complaint inbox", () => {
  it("lists open requests and filters by status and employee/content", async () => {
    render(<PayrollComplaintsPanel {...props()} />);
    await screen.findByText("Thiếu hoa hồng đơn 123");
    expect(screen.queryByText("Thiếu giờ công ngày 10")).toBeNull();
    fireEvent.change(screen.getByLabelText("Trạng thái khiếu nại"), { target: { value: "all" } });
    expect(screen.getByText("Thiếu giờ công ngày 10")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Tìm khiếu nại"), { target: { value: "đơn 123" } });
    expect(screen.queryByText("Thiếu giờ công ngày 10")).toBeNull();
  });
  it("shows only the selected conversation, links to salary editing and resolves with the current version", async () => {
    const input = props();
    render(<PayrollComplaintsPanel {...input} />);
    fireEvent.click(await screen.findByRole("button", { name: "Xem khiếu nại Nguyễn An - Hoa hồng" }));
    expect(screen.queryByText("Thiếu giờ công ngày 10")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Sửa trên bảng lương" }));
    expect(input.onEdit).toHaveBeenCalledWith("e1", "commission");
    fireEvent.click(screen.getByRole("button", { name: "Giải quyết khiếu nại" }));
    expect((screen.getByRole("button", { name: "Gửi phản hồi" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Kết quả giải quyết"), { target: { value: "Đã bổ sung hoa hồng" } });
    const updated = record(); updated.version = 4; updated.issues[0].status = "resolved";
    updated.issues[0].messages.push({ id: "m3", authorId: "kt", authorName: "Kế toán", role: "staff", action: "resolve", body: "Đã bổ sung hoa hồng", at: "2026-09-15T03:00:00Z" });
    service.getReconciliation.mockResolvedValue(status(updated));
    fireEvent.click(screen.getByRole("button", { name: "Gửi phản hồi" }));
    await waitFor(() => expect(service.replyReconciliation).toHaveBeenCalledWith("r1", "e1", { action: "resolve", issueId: "i1", body: "Đã bổ sung hoa hồng", expectedVersion: 3 }));
    await waitFor(() => expect(input.onChanged).toHaveBeenCalledOnce());
    expect(await screen.findByText("Đã bổ sung hoa hồng")).toBeTruthy();
  });
  it.each([{ canManage: false, runStatus: "draft" }, { canManage: true, runStatus: "closed" }])("keeps conversations read-only for %j", async ({ canManage, runStatus }) => {
    service.getReconciliation.mockResolvedValue(status({ ...record(), runStatus }));
    render(<PayrollComplaintsPanel {...props()} canManage={canManage} />);
    fireEvent.click(await screen.findByRole("button", { name: "Xem khiếu nại Nguyễn An - Hoa hồng" }));
    expect(screen.queryByRole("button", { name: "Trả lời" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Giải quyết khiếu nại" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sửa trên bảng lương" })).toBeNull();
  });
  it("blocks republishing unsaved amounts", async () => {
    render(<PayrollComplaintsPanel {...props()} hasUnsavedChanges />);
    const button = await screen.findByRole("button", { name: "Cập nhật bản gửi nhân viên" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button);
    expect(service.publishReconciliation).not.toHaveBeenCalled();
  });
  it("retains the exchange and displays conflicts instead of reporting success", async () => {
    service.replyReconciliation.mockRejectedValue(new Error("Nội dung đối soát vừa thay đổi"));
    const input = props(); render(<PayrollComplaintsPanel {...input} />);
    fireEvent.click(await screen.findByRole("button", { name: "Xem khiếu nại Nguyễn An - Hoa hồng" }));
    fireEvent.click(screen.getByRole("button", { name: "Trả lời" }));
    fireEvent.change(screen.getByLabelText("Nội dung trao đổi"), { target: { value: "Đang kiểm tra" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi phản hồi" }));
    expect((await screen.findByRole("alert")).textContent).toContain("vừa thay đổi");
    expect(input.onChanged).not.toHaveBeenCalled();
  });
});
