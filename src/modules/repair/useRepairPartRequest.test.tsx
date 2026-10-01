// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useRepairPartRequest, type PartRequest } from "./useRepairPartRequest";
import { repairService } from "../../services/repairService";
const context = vi.hoisted(() => ({ scope: { companyCode: "C", branchId: "B" }, userProfile: { uid: "user" } }));
vi.mock("../retail/hooks/useRetailScope", () => ({ useRetailScope: () => context }));
vi.mock("../../services/repairService", () => ({ repairService: { issuePart: vi.fn(), returnPart: vi.fn(), reconcilePart: vi.fn(), revokePartRequest: vi.fn() } }));
const issue: PartRequest = { kind: "issue", input: { productId: "p", sku: "P", productName: "Part", quantity: 1, unitCost: 100, unitPrice: 200, idempotencyKey: "stable" } };
const returned: PartRequest = { kind: "return", partId: "part", reason: "unused" };
const key = () => 'repair-part-pending:v1:' + JSON.stringify([context.scope.companyCode, context.scope.branchId, context.userProfile.uid, "ticket"]);
const done = vi.fn(), hook = () => renderHook(() => useRepairPartRequest("ticket", done));
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); context.scope = { companyCode: "C", branchId: "B" }; context.userProfile.uid = "user"; vi.mocked(repairService.revokePartRequest).mockReset(); vi.mocked(repairService.issuePart).mockReset(); vi.mocked(repairService.returnPart).mockReset(); vi.mocked(repairService.reconcilePart).mockReset(); Object.defineProperty(navigator, "locks", { configurable: true, value: { request: vi.fn(async (_key: string, _opts: any, fn: any) => fn({})) } }); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it.each([issue, returned])("persists and retries exact $kind requests after reopening", async request => {
  const api = request.kind === "issue" ? repairService.issuePart : repairService.returnPart;
  vi.mocked(api).mockRejectedValueOnce(new Error("lost reply"));
  const first = hook(); await act(() => first.result.current.run(() => request)); expect(JSON.parse(localStorage.getItem(key())!)).toEqual(request); first.unmount();
  vi.mocked(repairService.reconcilePart).mockResolvedValueOnce({ status: "completed", partId: "part", message: "ok" });
  const next = hook(); await act(() => next.result.current.run());
  expect(vi.mocked(api).mock.calls[1]).toEqual(vi.mocked(api).mock.calls[0]); expect(localStorage.getItem(key())).toBeNull(); expect(done).toHaveBeenCalledOnce();
});
it.each(["not_found", "conflict"])("keeps a request on %s after API success", async status => {
  vi.mocked(repairService.reconcilePart).mockResolvedValueOnce({ status, message: status });
  const { result } = hook(); await act(() => result.current.run(() => issue)); expect(localStorage.getItem(key())).not.toBeNull(); expect(done).not.toHaveBeenCalled();
});
it("reconciles without reposting", async () => {
  localStorage.setItem(key(), JSON.stringify(returned)); vi.mocked(repairService.reconcilePart).mockResolvedValueOnce({ status: "completed", partId: "part", message: "ok" });
  const { result } = hook(); await act(() => result.current.run(undefined, true)); expect(repairService.returnPart).not.toHaveBeenCalled(); expect(done).toHaveBeenCalledOnce();
});
it("adopts another tab's request and does not overwrite with a draft", async () => {
  const { result } = hook(); localStorage.setItem(key(), JSON.stringify(returned)); await act(() => result.current.run(() => issue)); expect(result.current.pending).toEqual(returned); expect(repairService.issuePart).not.toHaveBeenCalled();
});
it.each(["corrupt", "quota", "lock"])("does not send when %s protection fails", async failure => {
  if (failure === "corrupt") localStorage.setItem(key(), "null");
  if (failure === "quota") vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
  if (failure === "lock") vi.mocked(navigator.locks.request).mockImplementationOnce((async (_k: any, _o: any, fn: any) => fn(null)) as any);
  const { result } = hook(); await act(() => result.current.run(() => issue)); expect(repairService.issuePart).not.toHaveBeenCalled(); expect(result.current.error).toBeTruthy();
});
it("blocks duplicate sends and ignores a late callback after branch change", async () => {
  let finish!: (v: any) => void; vi.mocked(repairService.issuePart).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  vi.mocked(repairService.reconcilePart).mockResolvedValueOnce({ status: "completed", partId: "part", message: "ok" });
  const view = hook(); let running!: Promise<void>; await act(async () => { running = view.result.current.run(() => issue); await view.result.current.run(() => issue); });
  expect(repairService.issuePart).toHaveBeenCalledOnce(); context.scope = { ...context.scope, branchId: "other" }; view.rerender();
  await act(async () => { finish({}); await running; }); expect(done).not.toHaveBeenCalled(); expect(vi.mocked(repairService.reconcilePart).mock.calls[0][2]).toEqual({ companyCode: "C", branchId: "B" });
});
it("preserves a newer stored request while the old reply arrives", async () => {
  let finish!: (v: any) => void; vi.mocked(repairService.reconcilePart).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const { result } = hook(); let running!: Promise<void>; await act(async () => { running = result.current.run(() => issue); }); localStorage.setItem(key(), JSON.stringify(returned));
  await act(async () => { finish({ status: "completed", partId: "part", message: "ok" }); await running; }); expect(JSON.parse(localStorage.getItem(key())!)).toEqual(returned); expect(done).not.toHaveBeenCalled();
});

it.each([issue, returned])("unlocks $kind only after confirmed revocation", async request => {
  localStorage.setItem(key(), JSON.stringify(request)); vi.spyOn(window, "confirm").mockReturnValue(true);
  vi.mocked(repairService.revokePartRequest).mockResolvedValueOnce({ status: "revoked", message: "ok" });
  const { result } = hook(); await act(() => result.current.run(undefined, "revoke"));
  expect(localStorage.getItem(key())).toBeNull(); expect(result.current.pending).toBeNull(); expect(done).not.toHaveBeenCalled(); expect(repairService.issuePart).not.toHaveBeenCalled(); expect(repairService.returnPart).not.toHaveBeenCalled();
});
it("recovers a lost revocation reply through read-only reconciliation", async () => {
  localStorage.setItem(key(), JSON.stringify(returned)); vi.spyOn(window, "confirm").mockReturnValue(true);
  vi.mocked(repairService.revokePartRequest).mockRejectedValueOnce(new Error("lost reply"));
  const first = hook(); await act(() => first.result.current.run(undefined, "revoke")); expect(localStorage.getItem(key())).not.toBeNull(); first.unmount();
  vi.mocked(repairService.reconcilePart).mockResolvedValueOnce({ status: "revoked", message: "ok" });
  const next = hook(); await act(() => next.result.current.run(undefined, true)); expect(next.result.current.pending).toBeNull(); expect(done).not.toHaveBeenCalled();
});
it.each(["not_found", "conflict"])("preserves pending request when revocation is %s", async status => {
  localStorage.setItem(key(), JSON.stringify(issue)); vi.spyOn(window, "confirm").mockReturnValue(true);
  vi.mocked(repairService.revokePartRequest).mockResolvedValueOnce({ status, message: status });
  const { result } = hook(); await act(() => result.current.run(undefined, "revoke")); expect(localStorage.getItem(key())).not.toBeNull(); expect(result.current.pending).toEqual(issue);
});
it("completes an already-posted request without reversing stock", async () => {
  localStorage.setItem(key(), JSON.stringify(issue)); vi.spyOn(window, "confirm").mockReturnValue(true);
  vi.mocked(repairService.revokePartRequest).mockResolvedValueOnce({ status: "completed", partId: "part", message: "ok" });
  const { result } = hook(); await act(() => result.current.run(undefined, "revoke")); expect(done).toHaveBeenCalledOnce(); expect(repairService.issuePart).not.toHaveBeenCalled(); expect(repairService.returnPart).not.toHaveBeenCalled();
});
it("preserves a keyed return across retry and sends its key", async () => {
  const request = { ...returned, idempotencyKey: "return-key" };
  localStorage.setItem(key(), JSON.stringify(request)); vi.mocked(repairService.returnPart).mockRejectedValueOnce(new Error("lost"));
  const { result } = hook(); await act(() => result.current.run());
  expect(repairService.returnPart).toHaveBeenCalledWith("ticket", "part", "unused", context.scope, "return-key"); expect(JSON.parse(localStorage.getItem(key())!)).toEqual(request);
});
