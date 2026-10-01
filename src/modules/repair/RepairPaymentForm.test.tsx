// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import RepairPaymentForm from "./RepairPaymentForm";
import { repairService } from "../../services/repairService";
import { ApiClientError } from "../../services/apiClientError";
const context = vi.hoisted(() => ({ scope: { companyCode: "company-a", branchId: "branch-a" }, userProfile: { uid: "user-1" } }));
vi.mock("../retail/hooks/useRetailScope", () => ({ useRetailScope: () => context }));
vi.mock("../../services/repairService", () => ({ repairService: { pay: vi.fn(), reconcilePayment: vi.fn(), revokePayment: vi.fn() } }));
const ticket: any = { _id: "repair-1", status: "done", totalAmount: 1000, paidAmount: 0, dueAmount: 1000 };
const done = vi.fn(), lock = vi.fn();
const key = () => 'repair-payment-pending:v1:' + JSON.stringify([context.scope.companyCode, context.scope.branchId, context.userProfile.uid, ticket._id]);
const show = (value = ticket) => render(<RepairPaymentForm ticket={value} onComplete={done} onPendingChange={lock} />);
beforeEach(() => { sessionStorage.clear(); localStorage.clear(); Object.defineProperty(navigator, "locks", { configurable: true, value: { request: vi.fn(async (_key: string, _options: any, callback: any) => callback({ name: _key })) } }); vi.mocked(repairService.revokePayment).mockReset(); vi.mocked(repairService.reconcilePayment).mockReset(); vi.clearAllMocks(); vi.mocked(repairService.pay).mockReset(); context.scope.branchId = "branch-a"; context.userProfile.uid = "user-1"; });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const enter = async () => { const user = userEvent.setup(); await user.type(screen.getByRole("textbox"), "300"); return user; };
it("persists before sending, blocks double submission, and completes once", async () => {
  let finish!: (value: any) => void;
  vi.mocked(repairService.pay).mockImplementationOnce(async () => { expect(JSON.parse(localStorage.getItem(key())!).amount).toBe(300); return new Promise(resolve => { finish = resolve; }); });
  show(); const user = await enter(); await user.dblClick(screen.getByRole("button", { name: "Ghi nhận thanh toán" }));
  expect(repairService.pay).toHaveBeenCalledTimes(1);
  expect(lock).toHaveBeenLastCalledWith(true);
  await act(async () => finish({})); expect(done).toHaveBeenCalledTimes(1); expect(localStorage.getItem(key())).toBeNull();
});
it("reopens an uncertain payment with its exact old snapshot even after delivery", async () => {
  vi.mocked(repairService.pay).mockRejectedValueOnce(new Error("network"));
  const view = show(); const user = await enter(); await user.click(screen.getByRole("button", { name: "Ghi nhận thanh toán" }));
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("network"));
  const first = vi.mocked(repairService.pay).mock.calls[0]; view.unmount();
  vi.mocked(repairService.pay).mockResolvedValueOnce({} as any);
  show({ ...ticket, status: "delivered", paidAmount: 1000, dueAmount: 0 });
  await user.click(screen.getByRole("button", { name: "Thử lại khoản thu cũ" }));
  expect(vi.mocked(repairService.pay).mock.calls[1]).toEqual(first); expect(done).toHaveBeenCalledTimes(1);
});
it("does not apply a late response after branch change", async () => {
  let finish!: (value: any) => void;
  vi.mocked(repairService.pay).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const view = show(); const user = await enter(); await user.click(screen.getByRole("button", { name: "Ghi nhận thanh toán" }));
  context.scope = { ...context.scope, branchId: "branch-b" }; view.rerender(<RepairPaymentForm ticket={ticket} onComplete={done} onPendingChange={lock} />);
  await act(async () => finish({})); expect(done).not.toHaveBeenCalled();
  expect(vi.mocked(repairService.pay).mock.calls[0][3]).toMatchObject({ branchId: "branch-a" });
});
it("does not apply a response after the dialog unmounts", async () => {
  let finish!: (value: any) => void; vi.mocked(repairService.pay).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const view = show(); const user = await enter(); await user.click(screen.getByRole("button", { name: "Ghi nhận thanh toán" }));
  view.unmount(); await act(async () => finish({})); expect(done).not.toHaveBeenCalled();
});
it("blocks sending if request persistence fails", async () => {
  show(); const user = await enter(); vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
  await user.click(screen.getByRole("button", { name: "Ghi nhận thanh toán" }));
  expect(repairService.pay).not.toHaveBeenCalled(); expect(screen.getByRole("alert")).toBeTruthy(); expect(lock).toHaveBeenLastCalledWith(true);
});
it("blocks corrupt pending data instead of replacing its key", () => {
  for (const raw of ['{"amount":300}', 'null', 'false', '']) {
    sessionStorage.setItem(key(), raw); const view = show();
    expect(screen.getByRole("alert")).toBeTruthy(); expect((screen.getByRole("button", { name: "Ghi nhận thanh toán" }) as HTMLButtonElement).disabled).toBe(true);
    expect(repairService.pay).not.toHaveBeenCalled(); view.unmount();
  }
});
it("keeps pending requests isolated between operators", async () => {
  vi.mocked(repairService.pay).mockRejectedValueOnce(new Error("network")); const view = show(); const user = await enter();
  await user.click(screen.getByRole("button", { name: "Ghi nhận thanh toán" })); await screen.findByRole("alert");
  const originalKey = key(); view.unmount(); context.userProfile.uid = "other"; const otherView = show();
  expect(screen.queryByRole("button", { name: "Thử lại khoản thu cũ" })).toBeNull(); expect(localStorage.getItem(originalKey)).not.toBeNull();
  otherView.unmount(); context.userProfile.uid = "user-1"; show(); expect(screen.getByRole("button", { name: "Thử lại khoản thu cũ" })).toBeTruthy();
});
it("only discards an initial explicit validation rejection", async () => {
  vi.mocked(repairService.pay).mockRejectedValueOnce(new ApiClientError({ status: 400, code: "REPAIR_PAYMENT_INVALID", message: "invalid" }));
  show(); const user = await enter(); await user.click(screen.getByRole("button", { name: "Ghi nhận thanh toán" }));
  await screen.findByRole("alert"); expect(localStorage.getItem(key())).toBeNull();
  vi.mocked(repairService.pay).mockRejectedValueOnce(new Error("uncertain")); await user.click(screen.getByRole("button", { name: "Ghi nhận thanh toán" }));
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("uncertain"));
  const pending = localStorage.getItem(key());
  vi.mocked(repairService.pay).mockRejectedValueOnce(new ApiClientError({ status: 400, code: "REPAIR_PAYMENT_INVALID", message: "invalid" }));
  await user.click(screen.getByRole("button", { name: "Thử lại khoản thu cũ" }));
  expect(localStorage.getItem(key())).toBe(pending);
});

const request = { amount: 300, idempotencyKey: "legacy-key", expectedPaidAmount: 0, expectedTotalAmount: 1000 };
it("migrates a legacy tab request without changing its key or balance snapshot", async () => {
  sessionStorage.setItem(key(), JSON.stringify(request)); const view = show();
  await waitFor(() => expect(sessionStorage.getItem(key())).toBeNull());
  expect(JSON.parse(localStorage.getItem(key())!)).toEqual(request); expect(repairService.pay).not.toHaveBeenCalled();
  view.unmount(); sessionStorage.clear();
  vi.mocked(repairService.pay).mockResolvedValueOnce({} as any); show();
  fireEvent.click(screen.getByRole("button", { name: "Thử lại khoản thu cũ" }));
  await waitFor(() => expect(done).toHaveBeenCalledOnce());
  expect(vi.mocked(repairService.pay).mock.calls[0]).toEqual([ticket._id, 300, { idempotencyKey: "legacy-key", expectedPaidAmount: 0, expectedTotalAmount: 1000 }, context.scope]);
});
it("preserves both records when the old tab conflicts with shared storage", () => {
  sessionStorage.setItem(key(), JSON.stringify(request));
  localStorage.setItem(key(), JSON.stringify({ ...request, idempotencyKey: "different" }));
  show(); expect(screen.getByRole("alert")).toBeTruthy(); expect(repairService.pay).not.toHaveBeenCalled();
  expect(JSON.parse(sessionStorage.getItem(key())!)).toEqual(request);
  expect(JSON.parse(localStorage.getItem(key())!).idempotencyKey).toBe("different");
});
it("preserves legacy storage when migration cannot persist", async () => {
  sessionStorage.setItem(key(), JSON.stringify(request));
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
  show(); await screen.findByRole("alert"); expect(sessionStorage.getItem(key())).not.toBeNull();
  expect(repairService.pay).not.toHaveBeenCalled(); expect(lock).toHaveBeenLastCalledWith(true);
});
it("adopts a request created in another tab instead of sending the current draft", async () => {
  show(); await enter(); localStorage.setItem(key(), JSON.stringify(request));
  fireEvent.click(screen.getByRole("button", { name: "Ghi nhận thanh toán" }));
  await screen.findByRole("status"); expect(repairService.pay).not.toHaveBeenCalled();
  expect(JSON.parse(localStorage.getItem(key())!)).toEqual(request);
});
it.each(["not_found", "conflict"])("retains pending payment when reconciliation returns %s", async status => {
  localStorage.setItem(key(), JSON.stringify(request));
  vi.mocked(repairService.reconcilePayment).mockResolvedValue({ status, message: "Retain request" });
  show(); fireEvent.click(screen.getByRole("button", { name: "Đối chiếu khoản thu" }));
  await screen.findByText("Retain request"); expect(done).not.toHaveBeenCalled();
  expect(JSON.parse(localStorage.getItem(key())!)).toEqual(request); expect(repairService.pay).not.toHaveBeenCalled();
});
it("clears verified completion without recording another payment", async () => {
  localStorage.setItem(key(), JSON.stringify(request));
  vi.mocked(repairService.reconcilePayment).mockResolvedValue({ status: "completed", message: "Done" });
  show({ ...ticket, status: "delivered", dueAmount: 0, paidAmount: 1000 });
  fireEvent.click(screen.getByRole("button", { name: "Đối chiếu khoản thu" }));
  await waitFor(() => expect(done).toHaveBeenCalledOnce());
  expect(localStorage.getItem(key())).toBeNull(); expect(repairService.pay).not.toHaveBeenCalled();
});
it("does not erase a different record written during an in-flight response", async () => {
  let finish!: (value: any) => void;
  vi.mocked(repairService.pay).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  show(); const user = await enter(); await user.click(screen.getByRole("button", { name: "Ghi nhận thanh toán" }));
  localStorage.setItem(key(), JSON.stringify(request));
  await act(async () => finish({})); expect(done).not.toHaveBeenCalled();
  expect(JSON.parse(localStorage.getItem(key())!)).toEqual(request);
});
it("refuses a contested browser lock before persisting or sending", async () => {
  show(); await enter();
  vi.mocked(navigator.locks.request).mockImplementation(async (_key: any, _options: any, callback: any) => callback(null));
  fireEvent.click(screen.getByRole("button", { name: "Ghi nhận thanh toán" }));
  await screen.findByRole("alert"); expect(repairService.pay).not.toHaveBeenCalled(); expect(localStorage.getItem(key())).toBeNull();
});
it("fails closed when shared storage is corrupt or browser locks are unavailable", async () => {
  localStorage.setItem(key(), "null"); const view = show();
  expect((screen.getByRole("button", { name: "Ghi nhận thanh toán" }) as HTMLButtonElement).disabled).toBe(true);
  view.unmount(); localStorage.clear(); Object.defineProperty(navigator, "locks", { configurable: true, value: undefined });
  show(); await enter(); fireEvent.click(screen.getByRole("button", { name: "Ghi nhận thanh toán" }));
  await screen.findByRole("alert"); expect(repairService.pay).not.toHaveBeenCalled();
});

it("only unlocks a cancelled payment after durable server revocation", async () => {
  localStorage.setItem(key(), JSON.stringify(request)); vi.spyOn(window, "confirm").mockReturnValue(true);
  vi.mocked(repairService.revokePayment).mockResolvedValueOnce({ status: "revoked", message: "revoked" });
  show(); fireEvent.click(screen.getByRole("button", { name: "Hủy khoản thu đang chờ" }));
  await waitFor(() => expect(localStorage.getItem(key())).toBeNull());
  expect(screen.getByRole("textbox")).toBeTruthy(); expect(done).not.toHaveBeenCalled(); expect(repairService.pay).not.toHaveBeenCalled();
});
it("recovers a lost revocation response through read-only reconciliation", async () => {
  localStorage.setItem(key(), JSON.stringify(request)); vi.spyOn(window, "confirm").mockReturnValue(true);
  vi.mocked(repairService.revokePayment).mockRejectedValueOnce(new Error("lost reply"));
  const view = show(); fireEvent.click(screen.getByRole("button", { name: "Hủy khoản thu đang chờ" }));
  await screen.findByRole("alert"); expect(localStorage.getItem(key())).not.toBeNull(); view.unmount();
  vi.mocked(repairService.reconcilePayment).mockResolvedValueOnce({ status: "revoked", message: "revoked" });
  show(); fireEvent.click(screen.getByRole("button", { name: "Đối chiếu khoản thu" }));
  await waitFor(() => expect(localStorage.getItem(key())).toBeNull()); expect(screen.getByRole("textbox")).toBeTruthy();
});
it.each(["not_found", "conflict"])("retains a pending request on unverified revoke outcome %s", async status => {
  localStorage.setItem(key(), JSON.stringify(request)); vi.spyOn(window, "confirm").mockReturnValue(true);
  vi.mocked(repairService.revokePayment).mockResolvedValueOnce({ status, message: status });
  show(); fireEvent.click(screen.getByRole("button", { name: "Hủy khoản thu đang chờ" }));
  await screen.findByRole("status"); expect(localStorage.getItem(key())).not.toBeNull(); expect(done).not.toHaveBeenCalled();
});
it("resolves conflicting stores independently without submitting either payment", async () => {
  const other = { ...request, idempotencyKey: "other-key" };
  localStorage.setItem(key(), JSON.stringify(request)); sessionStorage.setItem(key(), JSON.stringify(other));
  vi.spyOn(window, "confirm").mockReturnValue(true);
  vi.mocked(repairService.reconcilePayment).mockResolvedValueOnce({ status: "completed", message: "completed" });
  vi.mocked(repairService.revokePayment).mockResolvedValueOnce({ status: "revoked", message: "revoked" });
  show(); fireEvent.click(screen.getByRole("button", { name: "Đối chiếu bản 1" }));
  await waitFor(() => expect(localStorage.getItem(key())).toBeNull());
  expect(JSON.parse(sessionStorage.getItem(key())!)).toEqual(other); expect(done).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Hủy bản 1" }));
  await waitFor(() => expect(done).toHaveBeenCalledOnce()); expect(sessionStorage.getItem(key())).toBeNull();
  expect(repairService.revokePayment).toHaveBeenCalledWith(ticket._id, other, context.scope); expect(repairService.pay).not.toHaveBeenCalled();
});
it("retains same-key conflicting payloads until each is verified", async () => {
  localStorage.setItem(key(), JSON.stringify(request)); sessionStorage.setItem(key(), JSON.stringify({ ...request, amount: 301 }));
  vi.mocked(repairService.reconcilePayment).mockResolvedValueOnce({ status: "conflict", message: "conflict" });
  show(); fireEvent.click(screen.getByRole("button", { name: "Đối chiếu bản 2" }));
  await screen.findByRole("status"); expect(localStorage.getItem(key())).not.toBeNull(); expect(sessionStorage.getItem(key())).not.toBeNull(); expect(done).not.toHaveBeenCalled();
});
it("does not delete a replacement record while resolving a conflicting request", async () => {
  localStorage.setItem(key(), JSON.stringify(request)); sessionStorage.setItem(key(), JSON.stringify({ ...request, idempotencyKey: "legacy-other" }));
  let finish!: (value: any) => void;
  vi.mocked(repairService.reconcilePayment).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  show(); fireEvent.click(screen.getByRole("button", { name: "Đối chiếu bản 1" }));
  await waitFor(() => expect(repairService.reconcilePayment).toHaveBeenCalledOnce());
  const replacement = JSON.stringify({ ...request, idempotencyKey: "replacement" }); localStorage.setItem(key(), replacement);
  await act(async () => finish({ status: "completed", message: "completed" }));
  expect(localStorage.getItem(key())).toBe(replacement); expect(done).not.toHaveBeenCalled();
});

it("treats revocation of a posted payment as completion without another post", async () => {
  localStorage.setItem(key(), JSON.stringify(request)); vi.spyOn(window, "confirm").mockReturnValue(true);
  vi.mocked(repairService.revokePayment).mockResolvedValueOnce({ status: "completed", message: "completed" });
  show(); fireEvent.click(screen.getByRole("button", { name: "Hủy khoản thu đang chờ" }));
  await waitFor(() => expect(done).toHaveBeenCalledOnce()); expect(localStorage.getItem(key())).toBeNull(); expect(repairService.pay).not.toHaveBeenCalled();
});
it("ignores conflict-resolution callbacks after scope changes", async () => {
  const originalKey = key(); localStorage.setItem(originalKey, JSON.stringify(request)); sessionStorage.setItem(originalKey, JSON.stringify({ ...request, idempotencyKey: "other" }));
  let finish!: (value: any) => void;
  vi.mocked(repairService.reconcilePayment).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const view = show(); fireEvent.click(screen.getByRole("button", { name: "Đối chiếu bản 1" }));
  await waitFor(() => expect(repairService.reconcilePayment).toHaveBeenCalledOnce());
  context.scope = { ...context.scope, branchId: "branch-b" }; view.rerender(<RepairPaymentForm ticket={ticket} onComplete={done} onPendingChange={lock} />);
  await act(async () => finish({ status: "completed", message: "completed" }));
  expect(done).not.toHaveBeenCalled(); expect((screen.getByRole("button", { name: "Hủy bản 2" }) as HTMLButtonElement).disabled).toBe(true);
  expect(repairService.reconcilePayment).toHaveBeenCalledWith(ticket._id, request, { companyCode: "company-a", branchId: "branch-a" });
});
