// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import RepairRefundForm from "./RepairRefundForm";
import { apiFetch } from "../shared/lib/apiFetch";
const context = vi.hoisted(() => ({ scope: { companyCode: "C", branchId: "B" }, userProfile: { uid: "user" } }));
vi.mock("../retail/hooks/useRetailScope", () => ({ useRetailScope: () => context }));
vi.mock("../shared/lib/apiFetch", () => ({ apiFetch: vi.fn() }));
const ticket = { status: "delivered", _id: "r1", companyCode: "C", branchId: "B", ticketCode: "R1", totalAmount: 800, paidAmount: 800, laborFee: 500, partRevenue: 500, commissionRefunds: [{ amount: 200, laborAmount: 100, key: "old" }] };
const done = vi.fn();
const show = () => render(<RepairRefundForm ticket={ticket} onChanged={done} />);
const fill = () => {
  fireEvent.click(screen.getByRole("button", { name: /Hoàn toàn bộ/ }));
  fireEvent.change(screen.getByPlaceholderText(/Khách hoàn trả/), { target: { value: "Refund" } });
  fireEvent.change(screen.getByPlaceholderText(/Mã phiếu trong Finance/), { target: { value: "PC1" } });
};
const submit = () => screen.getByRole("button", { name: /Ghi nhận.*hoàn tiền|Đang xử lý hoàn tiền|Thử lại khoản hoàn cũ/ });
beforeEach(() => { localStorage.clear(); Object.defineProperty(navigator, "locks", { configurable: true, value: { request: vi.fn(async (_key: string, _options: any, callback: any) => callback({ name: _key })) } }); context.userProfile.uid = "user"; vi.clearAllMocks(); vi.mocked(apiFetch).mockReset(); context.scope.branchId = "B"; vi.spyOn(window, "confirm").mockReturnValue(true); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it("uses the remaining discounted allocation and submits a fixed branch scope once", async () => {
  let finish!: (value: any) => void;
  vi.mocked(apiFetch).mockReturnValue(new Promise(resolve => { finish = resolve; }));
  show(); fill(); fireEvent.click(submit()); fireEvent.click(submit());
  expect(apiFetch).toHaveBeenCalledTimes(1);
  const options = vi.mocked(apiFetch).mock.calls[0][1]!;
  expect(options.params).toEqual({ companyCode: "C", branchId: "B" });
  expect(JSON.parse(String(options.body))).toMatchObject({ amount: 600, laborAmount: 300, reference: "PC1" });
  await act(async () => finish({ success: true })); expect(done).toHaveBeenCalledTimes(1);
});
it("keeps the request key after an uncertain response and subsequent input edits", async () => {
  vi.mocked(apiFetch).mockRejectedValue(new Error("network"));
  show(); fill(); fireEvent.click(submit()); await screen.findByRole("alert");
  const first = JSON.parse(String(vi.mocked(apiFetch).mock.calls[0][1]!.body));
  fireEvent.change(screen.getByPlaceholderText(/Khách hoàn trả/), { target: { value: "Corrected" } });
  fireEvent.click(submit()); await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2));
  expect(JSON.parse(String(vi.mocked(apiFetch).mock.calls[1][1]!.body))).toEqual(first);
});
it("ignores late completion after a scope change and blocks another submission", async () => {
  let finish!: (value: any) => void;
  vi.mocked(apiFetch).mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const view = show(); fill(); fireEvent.click(submit());
  context.scope.branchId = "OTHER"; view.rerender(<RepairRefundForm ticket={ticket} onChanged={done} />);
  await act(async () => finish({ success: true })); expect(done).not.toHaveBeenCalled();
  expect((submit() as HTMLButtonElement).disabled).toBe(true);
});
it("ignores completion after the dialog closes", async () => {
  let finish!: (value: any) => void;
  vi.mocked(apiFetch).mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const view = show(); fill(); fireEvent.click(submit()); view.unmount();
  await act(async () => finish({ success: true })); expect(done).not.toHaveBeenCalled();
});

const storageKey = 'repair-refund-pending:v1:' + JSON.stringify(['C', 'B', 'user', 'r1']);
const pending = { amount: 600, laborAmount: 300, reference: "PC1", reason: "Refund", idempotencyKey: "pending-key" };
it("persists before sending and replays the exact request after closing and reopening", async () => {
  vi.mocked(apiFetch).mockImplementation(async (_url, options) => {
    expect(JSON.parse(localStorage.getItem(storageKey)!)).toEqual(JSON.parse(String(options?.body)));
    throw new Error("network");
  });
  const view = show(); fill(); fireEvent.click(submit()); await screen.findByRole("alert");
  const first = vi.mocked(apiFetch).mock.calls[0]; view.unmount();
  show(); fireEvent.click(submit()); await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2));
  expect(vi.mocked(apiFetch).mock.calls[1]).toEqual(first);
  expect((screen.getByPlaceholderText(/Mã phiếu trong Finance/) as HTMLInputElement).disabled).toBe(true);
});
it("recovers another tab's request before sending a different draft", async () => {
  show(); fill(); localStorage.setItem(storageKey, JSON.stringify(pending));
  fireEvent.click(submit()); await screen.findByRole("status");
  expect(apiFetch).not.toHaveBeenCalled();
  expect(JSON.parse(localStorage.getItem(storageKey)!)).toEqual(pending);
  vi.mocked(apiFetch).mockResolvedValue({ success: true });
  fireEvent.click(submit()); await waitFor(() => expect(done).toHaveBeenCalledOnce());
  expect(JSON.parse(String(vi.mocked(apiFetch).mock.calls[0][1]?.body))).toEqual(pending);
});
it.each(["not_found", "conflict"])("retains the request when reconciliation returns %s", async status => {
  localStorage.setItem(storageKey, JSON.stringify(pending));
  vi.mocked(apiFetch).mockResolvedValue({ success: true, data: { status, message: "Keep original" } });
  show(); fireEvent.click(screen.getByRole("button", { name: "Đối chiếu khoản hoàn" }));
  await screen.findByText("Keep original"); expect(done).not.toHaveBeenCalled();
  expect(JSON.parse(localStorage.getItem(storageKey)!)).toEqual(pending);
  expect(vi.mocked(apiFetch).mock.calls[0][0]).toBe("/repair/tickets/r1/refunds/reconcile");
});
it("clears only the matched request after verified completion without submitting another refund", async () => {
  localStorage.setItem(storageKey, JSON.stringify(pending));
  vi.mocked(apiFetch).mockResolvedValue({ success: true, data: { status: "completed" } });
  show(); fireEvent.click(screen.getByRole("button", { name: "Đối chiếu khoản hoàn" }));
  await waitFor(() => expect(done).toHaveBeenCalledOnce());
  expect(localStorage.getItem(storageKey)).toBeNull(); expect(apiFetch).toHaveBeenCalledTimes(1);
  expect(vi.mocked(apiFetch).mock.calls[0][0]).toContain("/reconcile");
});
it("never deletes a different request written while a response was in flight", async () => {
  localStorage.setItem(storageKey, JSON.stringify(pending));
  let finish!: (value: any) => void;
  vi.mocked(apiFetch).mockReturnValue(new Promise(resolve => { finish = resolve; }));
  show(); fireEvent.click(submit());
  const different = { ...pending, idempotencyKey: "other-key" };
  localStorage.setItem(storageKey, JSON.stringify(different));
  await act(async () => finish({ success: true }));
  expect(JSON.parse(localStorage.getItem(storageKey)!)).toEqual(different); expect(done).not.toHaveBeenCalled();
});
it("blocks unavailable locks and an active lock in another tab", async () => {
  const view = show(); fill();
  vi.mocked(navigator.locks.request).mockImplementation(async (_key: any, _options: any, callback: any) => callback(null));
  fireEvent.click(submit()); await screen.findByRole("alert"); expect(apiFetch).not.toHaveBeenCalled();
  view.unmount(); Object.defineProperty(navigator, "locks", { configurable: true, value: undefined });
  show(); fill(); fireEvent.click(submit()); await screen.findByRole("alert"); expect(apiFetch).not.toHaveBeenCalled();
});
it("blocks corrupt storage and write failures before making a request", async () => {
  localStorage.setItem(storageKey, "null"); const view = show();
  expect((submit() as HTMLButtonElement).disabled).toBe(true); view.unmount(); localStorage.clear();
  show(); fill(); vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
  fireEvent.click(submit()); await screen.findByRole("alert"); expect(apiFetch).not.toHaveBeenCalled();
});
it("isolates pending requests by operator", () => {
  localStorage.setItem(storageKey, JSON.stringify(pending)); context.userProfile.uid = "other";
  show(); expect(screen.queryByRole("button", { name: "Đối chiếu khoản hoàn" })).toBeNull();
  expect(localStorage.getItem(storageKey)).not.toBeNull();
});

it("unlocks corrected input only after the server durably revokes the pending key", async () => {
  localStorage.setItem(storageKey, JSON.stringify(pending));
  let finish!: (value: any) => void;
  vi.mocked(apiFetch).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  show(); fireEvent.click(screen.getByRole("button", { name: "Hủy yêu cầu đang chờ" }));
  expect(vi.mocked(apiFetch).mock.calls[0][0]).toBe("/repair/tickets/r1/refunds/revoke");
  expect(JSON.parse(String(vi.mocked(apiFetch).mock.calls[0][1]?.body))).toEqual(pending);
  expect(localStorage.getItem(storageKey)).not.toBeNull();
  expect((screen.getByPlaceholderText(/Mã phiếu trong Finance/) as HTMLInputElement).disabled).toBe(true);
  await act(async () => finish({ success: true, data: { status: "revoked" } }));
  expect(localStorage.getItem(storageKey)).toBeNull(); expect(done).not.toHaveBeenCalled();
  expect((screen.getByPlaceholderText(/Mã phiếu trong Finance/) as HTMLInputElement).disabled).toBe(false);
  vi.mocked(apiFetch).mockResolvedValueOnce({ success: true }); fill(); fireEvent.click(submit());
  await waitFor(() => expect(done).toHaveBeenCalledOnce());
  expect(JSON.parse(String(vi.mocked(apiFetch).mock.calls[1][1]?.body)).idempotencyKey).not.toBe(pending.idempotencyKey);
});
it("retains uncertain revocation and resolves it after reopening using read-only reconciliation", async () => {
  localStorage.setItem(storageKey, JSON.stringify(pending));
  vi.mocked(apiFetch).mockRejectedValueOnce(new Error("lost revocation response"));
  const view = show(); fireEvent.click(screen.getByRole("button", { name: "Hủy yêu cầu đang chờ" }));
  await screen.findByRole("alert"); expect(JSON.parse(localStorage.getItem(storageKey)!)).toEqual(pending);
  view.unmount(); vi.mocked(apiFetch).mockResolvedValueOnce({ success: true, data: { status: "revoked" } });
  show(); fireEvent.click(screen.getByRole("button", { name: "Đối chiếu khoản hoàn" }));
  await waitFor(() => expect(localStorage.getItem(storageKey)).toBeNull());
  expect(done).not.toHaveBeenCalled(); expect(vi.mocked(apiFetch).mock.calls[1][0]).toContain("/reconcile");
});
it.each(["conflict", "not_found"])("never discards pending input on an unconfirmed revocation: %s", async status => {
  localStorage.setItem(storageKey, JSON.stringify(pending));
  vi.mocked(apiFetch).mockResolvedValue({ success: true, data: { status, message: "Keep request" } });
  show(); fireEvent.click(screen.getByRole("button", { name: "Hủy yêu cầu đang chờ" }));
  await screen.findByText("Keep request"); expect(localStorage.getItem(storageKey)).not.toBeNull();
  expect((screen.getByPlaceholderText(/Mã phiếu trong Finance/) as HTMLInputElement).disabled).toBe(true);
});
it("recognizes an already completed refund returned by revocation without unlocking another request", async () => {
  localStorage.setItem(storageKey, JSON.stringify(pending));
  vi.mocked(apiFetch).mockResolvedValue({ success: true, data: { status: "completed" } });
  show(); fireEvent.click(screen.getByRole("button", { name: "Hủy yêu cầu đang chờ" }));
  await waitFor(() => expect(done).toHaveBeenCalledOnce());
  expect(localStorage.getItem(storageKey)).toBeNull();
  expect((submit() as HTMLButtonElement).disabled).toBe(true);
});
it("keeps the request if the user declines revocation", () => {
  localStorage.setItem(storageKey, JSON.stringify(pending)); vi.mocked(window.confirm).mockReturnValue(false);
  show(); fireEvent.click(screen.getByRole("button", { name: "Hủy yêu cầu đang chờ" }));
  expect(apiFetch).not.toHaveBeenCalled(); expect(localStorage.getItem(storageKey)).not.toBeNull();
});
it("keeps recovery available after ticket status changes but hides new refunds", async () => {
  const changed = { ...ticket, status: "returned" };
  const view = render(<RepairRefundForm ticket={changed} onChanged={done} />);
  expect(screen.queryByRole("button", { name: /Ghi nhận/ })).toBeNull(); view.unmount();
  localStorage.setItem(storageKey, JSON.stringify(pending));
  vi.mocked(apiFetch).mockResolvedValue({ success: true, data: { status: "revoked" } });
  render(<RepairRefundForm ticket={changed} onChanged={done} />);
  fireEvent.click(screen.getByRole("button", { name: "Hủy yêu cầu đang chờ" }));
  await waitFor(() => expect(localStorage.getItem(storageKey)).toBeNull());
  expect(screen.queryByRole("button", { name: /Ghi nhận/ })).toBeNull();
});
