// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useRepairCreationRequest } from "./useRepairCreationRequest";
import CreateRepairModal from "./CreateRepairModal";
import { repairService } from "../../services/repairService";
const context = vi.hoisted(() => ({ scope: { companyCode: "company-a", branchId: "branch-a" }, userProfile: { uid: "user-1" } }));
vi.mock("../retail/hooks/useRetailScope", () => ({ useRetailScope: () => context }));
vi.mock("../../services/repairService", () => ({ repairService: { create: vi.fn(), reconcileCreation: vi.fn(), revokeCreation: vi.fn() } }));
vi.mock("../customer-management/customerApi", () => ({ customerApi: { list: vi.fn(async () => ({ items: [] })) } }));
vi.mock("../partners/CollaboratorPicker", () => ({ default: () => null }));
const payload = { ticketCode: "SRV-frozen", ticketType: "service", customerId: "KH-1", customerName: "Customer", customerPhone: "0901234567", device: { name: "Phone", accessories: [] }, symptom: "Broken", receivedAt: "2026-09-30T01:00:00.000Z", coverage: { checkedAt: "2026-09-30T01:00:00.000Z" } };
const key = () => `repair-create-pending:v1:${JSON.stringify([context.scope.companyCode, context.scope.branchId, context.userProfile.uid])}`;
const done = vi.fn();
const hook = () => renderHook(() => useRepairCreationRequest(done));
beforeEach(() => {
  localStorage.clear(); vi.clearAllMocks(); vi.mocked(repairService.revokeCreation).mockReset(); vi.mocked(repairService.create).mockReset(); vi.mocked(repairService.reconcileCreation).mockReset();
  context.scope = { companyCode: "company-a", branchId: "branch-a" }; context.userProfile.uid = "user-1";
  Object.defineProperty(navigator, "locks", { configurable: true, value: { request: vi.fn(async (_key: string, _options: any, fn: any) => fn({ name: _key })) } });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it("persists before sending and blocks simultaneous submits", async () => {
  let finish!: (value: any) => void;
  vi.mocked(repairService.create).mockImplementationOnce(async () => { expect(JSON.parse(localStorage.getItem(key())!)).toEqual(payload); return new Promise(resolve => { finish = resolve; }); });
  const { result } = hook(); let first!: Promise<void>;
  await act(async () => { first = result.current.run(() => payload); await result.current.run(() => ({ ...payload, ticketCode: "other" })); });
  expect(repairService.create).toHaveBeenCalledTimes(1);
  await act(async () => { finish({ _id: "id", ticketCode: payload.ticketCode }); await first; });
  expect(done).toHaveBeenCalledOnce(); expect(localStorage.getItem(key())).toBeNull();
});
it("reopens an uncertain request with identical code, times and payload", async () => {
  vi.mocked(repairService.create).mockRejectedValueOnce(new Error("network"));
  const first = hook(); await act(() => first.result.current.run(() => payload)); first.unmount();
  vi.mocked(repairService.create).mockResolvedValueOnce({ _id: "id", ticketCode: payload.ticketCode } as any);
  const next = hook(); expect(next.result.current.pending).toEqual(payload);
  await act(() => next.result.current.run(() => ({ ...payload, ticketCode: "new" })));
  expect(vi.mocked(repairService.create).mock.calls[1]).toEqual(vi.mocked(repairService.create).mock.calls[0]);
  expect(done).toHaveBeenCalledOnce();
});
it.each(["not_found", "conflict"])("retains %s reconciliation outcomes", async status => {
  localStorage.setItem(key(), JSON.stringify(payload)); vi.mocked(repairService.reconcileCreation).mockResolvedValueOnce({ status, message: status });
  const { result } = hook(); await act(() => result.current.run(undefined, true));
  expect(localStorage.getItem(key())).not.toBeNull(); expect(done).not.toHaveBeenCalled(); expect(repairService.create).not.toHaveBeenCalled();
});
it("completes read-only reconciliation without posting", async () => {
  localStorage.setItem(key(), JSON.stringify(payload)); vi.mocked(repairService.reconcileCreation).mockResolvedValueOnce({ status: "completed", ticketId: "id", message: "ok" });
  const { result } = hook(); await act(() => result.current.run(undefined, true));
  expect(localStorage.getItem(key())).toBeNull(); expect(done).toHaveBeenCalledOnce(); expect(repairService.create).not.toHaveBeenCalled();
});
it("adopts another tab's stored request without overwriting or submitting", async () => {
  const { result } = hook(); localStorage.setItem(key(), JSON.stringify(payload));
  await act(() => result.current.run(() => ({ ...payload, ticketCode: "new" })));
  expect(result.current.pending).toEqual(payload); expect(repairService.create).not.toHaveBeenCalled();
});
it.each(["corrupt", "quota", "lock"])("blocks submission when %s protection fails", async failure => {
  if (failure === "corrupt") localStorage.setItem(key(), "null");
  if (failure === "quota") vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
  if (failure === "lock") vi.mocked(navigator.locks.request).mockImplementationOnce((async (_key: any, _opts: any, fn: any) => fn(null)) as any);
  const { result } = hook(); await act(() => result.current.run(() => payload));
  expect(repairService.create).not.toHaveBeenCalled(); expect(result.current.error).toBeTruthy();
});
it.each(["branch", "operator", "unmount"])("ignores a late success after %s change", async change => {
  let finish!: (value: any) => void;
  vi.mocked(repairService.create).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const view = hook(); let running!: Promise<void>; await act(async () => { running = view.result.current.run(() => payload); });
  if (change === "unmount") view.unmount();
  else { if (change === "branch") context.scope = { ...context.scope, branchId: "branch-b" }; else context.userProfile.uid = "other"; view.rerender(); }
  await act(async () => { finish({ _id: "id", ticketCode: payload.ticketCode }); await running; }); expect(done).not.toHaveBeenCalled();
  expect(vi.mocked(repairService.create).mock.calls[0][1]).toEqual({ companyCode: "company-a", branchId: "branch-a" });
});
it("preserves a replacement stored while a response was in flight", async () => {
  let finish!: (value: any) => void; vi.mocked(repairService.create).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const { result } = hook(); let running!: Promise<void>; await act(async () => { running = result.current.run(() => payload); });
  const replacement = JSON.stringify({ ...payload, ticketCode: "other" }); localStorage.setItem(key(), replacement);
  await act(async () => { finish({ _id: "id", ticketCode: payload.ticketCode }); await running; });
  expect(localStorage.getItem(key())).toBe(replacement); expect(done).not.toHaveBeenCalled();
});
it("requires a matching success response before clearing storage", async () => {
  vi.mocked(repairService.create).mockResolvedValueOnce({ _id: "other", ticketCode: "wrong" } as any);
  const { result } = hook(); await act(() => result.current.run(() => payload));
  expect(localStorage.getItem(key())).not.toBeNull(); expect(done).not.toHaveBeenCalled();
});
it("isolates stored requests by operator", () => {
  localStorage.setItem(key(), JSON.stringify(payload)); context.userProfile.uid = "other";
  expect(hook().result.current.pending).toBeNull();
});
it("freezes modal content after sending and reopens the saved request", async () => {
  vi.mocked(repairService.create).mockRejectedValueOnce(new Error("network"));
  const props = { prefill: { ticketType: "service" as const, productName: "Phone", customerName: "Customer", customerPhone: "0901234567" }, onClose: vi.fn(), onCreated: done };
  const view = render(<CreateRepairModal {...props} />);
  fireEvent.change(screen.getByPlaceholderText(/Rơi nước không lên nguồn/), { target: { value: "Broken" } });
  fireEvent.submit(screen.getByRole("button", { name: "Tạo phiếu sửa chữa dịch vụ" }).closest("form")!);
  await screen.findByRole("alert"); expect(screen.queryByRole("textbox")).toBeNull();
  const saved = JSON.parse(localStorage.getItem(key())!); expect(saved.ticketCode).toMatch(/^SRV-[0-9a-f-]{36}$/);
  view.unmount(); render(<CreateRepairModal {...props} prefill={{ ...props.prefill, productName: "Different" }} />);
  expect(screen.getByText(/Yêu cầu tạo phiếu đang chờ:/).textContent).toContain(saved.ticketCode);
  fireEvent.click(screen.getByRole("button", { name: "Thử lại yêu cầu tạo phiếu" }));
  await waitFor(() => expect(repairService.create).toHaveBeenCalledTimes(2));
  expect(vi.mocked(repairService.create).mock.calls[1][0]).toEqual(saved);
});

it("unlocks input only after confirmed revocation", async () => {
  localStorage.setItem(key(), JSON.stringify(payload)); vi.spyOn(window, "confirm").mockReturnValue(true);
  vi.mocked(repairService.revokeCreation).mockResolvedValueOnce({ status: "revoked", message: "ok" });
  const { result } = hook(); await act(() => result.current.run(undefined, "revoke"));
  expect(result.current.pending).toBeNull(); expect(localStorage.getItem(key())).toBeNull(); expect(done).not.toHaveBeenCalled();
  const next = { ...payload, ticketCode: "replacement" }; vi.mocked(repairService.create).mockResolvedValueOnce({ _id: "id", ticketCode: next.ticketCode } as any);
  await act(() => result.current.run(() => next)); expect(repairService.create).toHaveBeenCalledWith(next, context.scope);
});
it("recovers a lost revocation reply through read-only reconciliation", async () => {
  localStorage.setItem(key(), JSON.stringify(payload)); vi.spyOn(window, "confirm").mockReturnValue(true);
  vi.mocked(repairService.revokeCreation).mockRejectedValueOnce(new Error("lost reply"));
  const first = hook(); await act(() => first.result.current.run(undefined, "revoke")); expect(localStorage.getItem(key())).not.toBeNull(); first.unmount();
  vi.mocked(repairService.reconcileCreation).mockResolvedValueOnce({ status: "revoked", message: "ok" });
  const next = hook(); await act(() => next.result.current.run(undefined, true)); expect(next.result.current.pending).toBeNull(); expect(localStorage.getItem(key())).toBeNull(); expect(done).not.toHaveBeenCalled();
});
it.each(["not_found", "conflict"])("retains saved creation on unverified revoke %s", async status => {
  localStorage.setItem(key(), JSON.stringify(payload)); vi.spyOn(window, "confirm").mockReturnValue(true); vi.mocked(repairService.revokeCreation).mockResolvedValueOnce({ status, message: status });
  const { result } = hook(); await act(() => result.current.run(undefined, "revoke")); expect(localStorage.getItem(key())).not.toBeNull(); expect(result.current.pending).toEqual(payload);
});
it("treats already-created revocation as completion without another create", async () => {
  localStorage.setItem(key(), JSON.stringify(payload)); vi.spyOn(window, "confirm").mockReturnValue(true); vi.mocked(repairService.revokeCreation).mockResolvedValueOnce({ status: "completed", ticketId: "id", message: "ok" });
  const { result } = hook(); await act(() => result.current.run(undefined, "revoke")); expect(done).toHaveBeenCalledOnce(); expect(repairService.create).not.toHaveBeenCalled();
});
it("does not revoke if the operator cancels confirmation", async () => {
  localStorage.setItem(key(), JSON.stringify(payload)); vi.spyOn(window, "confirm").mockReturnValue(false);
  const { result } = hook(); await act(() => result.current.run(undefined, "revoke")); expect(repairService.revokeCreation).not.toHaveBeenCalled(); expect(localStorage.getItem(key())).not.toBeNull();
});
