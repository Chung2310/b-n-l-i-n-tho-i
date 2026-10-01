// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useAfterSaleRequest } from "./useAfterSaleRequest";
import { retailAfterSalesApi } from "../api/retailAfterSales.api";
import { ApiClientError } from "../../../services/apiClientError";

vi.mock("../api/retailAfterSales.api", () => ({ retailAfterSalesApi: { create: vi.fn(), reconcile: vi.fn(), revoke: vi.fn() } }));
const scope = { companyCode: "A", branchId: "B" };
const input = { type: "return" as const, orderId: "o1", items: [{ orderLineIndex: 0, quantity: 1, condition: "good" as const }], paymentMethod: "cash" as const, reason: "Unused" };
const setup = () => renderHook(() => useAfterSaleRequest(scope, "u1", "o1"));
beforeEach(() => { sessionStorage.clear(); localStorage.clear(); Object.defineProperty(navigator, "locks", { configurable: true, value: { request: vi.fn(async (_key, _options, work) => work({ name: _key })) } }); vi.resetAllMocks(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("keeps the complete original request after a lost response and modal remount", async () => {
  vi.mocked(retailAfterSalesApi.create).mockRejectedValueOnce(new Error("network"));
  const first = setup();
  await act(async () => { await expect(first.result.current.send(input)).rejects.toThrow("network"); });
  const sent = vi.mocked(retailAfterSalesApi.create).mock.calls[0][1];
  first.unmount();
  const retry = setup();
  expect(retry.result.current.pending).toEqual(sent);
  vi.mocked(retailAfterSalesApi.create).mockResolvedValueOnce({ _id: "as1" } as any);
  await act(async () => { await retry.result.current.send({ ...input, reason: "Changed", items: [] }); });
  expect(vi.mocked(retailAfterSalesApi.create).mock.calls[1][1]).toEqual(sent);
  expect(sessionStorage.length).toBe(0);
});

it("coalesces immediate duplicate clicks and blocks sending again after success", async () => {
  let resolve!: (value: any) => void;
  vi.mocked(retailAfterSalesApi.create).mockReturnValue(new Promise((done) => { resolve = done; }));
  const hook = setup();
  let first!: Promise<unknown>;
  act(() => { first = hook.result.current.send(input); void hook.result.current.send(input); });
  expect(retailAfterSalesApi.create).toHaveBeenCalledTimes(1);
  await act(async () => { resolve({ _id: "as1" }); await first; });
  await act(async () => { await hook.result.current.send(input); });
  expect(retailAfterSalesApi.create).toHaveBeenCalledTimes(1);
});

it("allows editing after an initial explicit validation rejection", async () => {
  vi.mocked(retailAfterSalesApi.create).mockRejectedValueOnce(new ApiClientError({ status: 400, code: "AFTER_SALE_INVALID", message: "Invalid" }));
  const hook = setup();
  await act(async () => { await expect(hook.result.current.send(input)).rejects.toThrow("Invalid"); });
  expect(hook.result.current.pending).toBeNull();
  expect(sessionStorage.length).toBe(0);
});

it("does not discard an uncertain request after a subsequent validation or conflict error", async () => {
  vi.mocked(retailAfterSalesApi.create).mockRejectedValueOnce(new Error("network"))
    .mockRejectedValueOnce(new ApiClientError({ status: 400, code: "AFTER_SALE_INVALID", message: "Invalid" }))
    .mockRejectedValueOnce(new ApiClientError({ status: 409, code: "AFTER_SALE_IDEMPOTENCY_CONFLICT", message: "Conflict" }));
  const hook = setup();
  for (let i = 0; i < 3; i++) await act(async () => { await expect(hook.result.current.send(input)).rejects.toThrow(); });
  expect(hook.result.current.pending).toBeTruthy();
  expect(new Set(vi.mocked(retailAfterSalesApi.create).mock.calls.map((call) => call[1].idempotencyKey)).size).toBe(1);
});

it("isolates pending data by company, branch, operator and order", async () => {
  vi.mocked(retailAfterSalesApi.create).mockRejectedValue(new Error("network"));
  const hook = setup();
  await act(async () => { await expect(hook.result.current.send(input)).rejects.toThrow(); });
  for (const [companyCode, branchId, actor, order] of [["X", "B", "u1", "o1"], ["A", "X", "u1", "o1"], ["A", "B", "u2", "o1"], ["A", "B", "u1", "o2"]]) {
    const other = renderHook(() => useAfterSaleRequest({ companyCode, branchId }, actor, order));
    expect(other.result.current.pending).toBeNull();
  }
  await act(async () => { await expect(hook.result.current.send({ ...input, type: "buyback" })).rejects.toThrow("nghiệp vụ khác"); });
  expect(retailAfterSalesApi.create).toHaveBeenCalledTimes(1);
});

it("blocks stale scope and suppresses a late success after branch changes", async () => {
  let resolve!: (value: any) => void;
  vi.mocked(retailAfterSalesApi.create).mockReturnValue(new Promise((done) => { resolve = done; }));
  const hook = renderHook(({ branchId }) => useAfterSaleRequest({ ...scope, branchId }, "u1", "o1"), { initialProps: { branchId: "B" } });
  let sending!: Promise<unknown>;
  act(() => { sending = hook.result.current.send(input); });
  hook.rerender({ branchId: "OTHER" });
  await act(async () => { resolve({ _id: "as1" }); expect(await sending).toBeUndefined(); });
  expect(hook.result.current.scopeChanged).toBe(true);
  expect(retailAfterSalesApi.create).toHaveBeenCalledTimes(1);
});

it("does not send when the pending request cannot be persisted", async () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Quota"); });
  const hook = setup();
  await act(async () => { await hook.result.current.send(input); });
  expect(retailAfterSalesApi.create).not.toHaveBeenCalled();
  expect(hook.result.current.storageError).toContain("Chưa gửi");
});

it("fails closed on unreadable saved requests", () => {
  sessionStorage.setItem('retail-after-sale-pending:v1:["A","B","u1","o1"]', "broken");
  const hook = setup();
  expect(hook.result.current.storageError).toContain("đối chiếu");
  expect(retailAfterSalesApi.create).not.toHaveBeenCalled();
});

const key = 'retail-after-sale-pending:v1:' + JSON.stringify(['A', 'B', 'u1', 'o1']);
const saved = { ...input, idempotencyKey: 'old-key' };
it('migrates the legacy request before send and survives closing the session', async () => {
  sessionStorage.setItem(key, JSON.stringify(saved));
  vi.mocked(retailAfterSalesApi.create).mockImplementation(async () => {
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual(saved);
    expect(sessionStorage.getItem(key)).toBeNull();
    throw new Error('network');
  });
  const first = setup();
  await act(async () => { await expect(first.result.current.send(input)).rejects.toThrow(); });
  first.unmount(); sessionStorage.clear();
  const next = setup();
  expect(next.result.current.pending).toEqual(saved);
});
it('adopts another tab request without sending the stale form', async () => {
  const hook = setup();
  localStorage.setItem(key, JSON.stringify(saved));
  await act(async () => { await expect(hook.result.current.send(input)).rejects.toThrow('tab khác'); });
  expect(retailAfterSalesApi.create).not.toHaveBeenCalled();
  expect(hook.result.current.pending).toEqual(saved);
  vi.mocked(retailAfterSalesApi.create).mockResolvedValue({ _id: 'as1' } as any);
  await act(async () => { await hook.result.current.send(input); });
  expect(vi.mocked(retailAfterSalesApi.create).mock.calls[0][1]).toEqual(saved);
});
it.each(['null', '', '{}', JSON.stringify({ ...saved, items: [] }), JSON.stringify({ ...saved, items: [{ orderLineIndex: -1, quantity: 1, condition: 'good' }] })])('blocks corrupt saved request: %s', raw => {
  localStorage.setItem(key, raw);
  const hook = setup();
  expect(hook.result.current.storageError).toBeTruthy();
  expect(localStorage.getItem(key)).toBe(raw);
});
it('keeps conflicting shared and legacy records', () => {
  localStorage.setItem(key, JSON.stringify(saved));
  const legacy = JSON.stringify({ ...saved, reason: 'other' });
  sessionStorage.setItem(key, legacy);
  expect(setup().result.current.candidates).toHaveLength(2);
  expect(sessionStorage.getItem(key)).toBe(legacy);
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual(saved);
});
it.each([false, true])('blocks without an available browser lock (%s)', async missing => {
  Object.defineProperty(navigator, 'locks', { configurable: true, value: missing ? undefined : { request: async (_key: string, _options: unknown, work: (lock: null) => Promise<void>) => work(null) } });
  const hook = setup();
  await act(async () => { await expect(hook.result.current.send(input)).rejects.toThrow(); });
  expect(retailAfterSalesApi.create).not.toHaveBeenCalled();
  expect(localStorage.length).toBe(0);
});
it('does not remove a different request on late success', async () => {
  let resolve!: (value: any) => void;
  vi.mocked(retailAfterSalesApi.create).mockReturnValue(new Promise(done => { resolve = done; }));
  const hook = setup(); let sending!: Promise<unknown>;
  act(() => { sending = hook.result.current.send(input); });
  localStorage.setItem(key, JSON.stringify(saved));
  await act(async () => { resolve({ _id: 'as1' }); await expect(sending).rejects.toThrow(); });
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual(saved);
});
it('preserves buyback amounts, notes, references and tracked codes exactly', async () => {
  const buyback = { ...saved, type: 'buyback' as const, paymentReference: 'BANK', items: [{ orderLineIndex: 0, quantity: 1, condition: 'fair' as const, unitAmount: 123, note: 'scratch', serialNumbers: ['SN1'], internalBarcodes: [] }] };
  localStorage.setItem(key, JSON.stringify(buyback));
  vi.mocked(retailAfterSalesApi.create).mockResolvedValue({ _id: 'as1' } as any);
  const hook = setup();
  await act(async () => { await hook.result.current.send({ ...input, type: 'buyback' }); });
  expect(vi.mocked(retailAfterSalesApi.create).mock.calls[0][1]).toEqual(buyback);
});

it('clears only a server-verified matching document without posting again', async () => {
  localStorage.setItem(key, JSON.stringify(saved));
  vi.mocked(retailAfterSalesApi.reconcile).mockResolvedValue({ status: 'completed', message: 'verified', document: { _id: 'as1', code: 'TH1', orderId: 'o1', type: 'return' } });
  const hook = setup();
  await act(async () => { expect(await hook.result.current.reconcile()).toMatchObject({ _id: 'as1' }); });
  expect(retailAfterSalesApi.create).not.toHaveBeenCalled();
  expect(localStorage.getItem(key)).toBeNull();
});
it.each(['not_found', 'conflict'] as const)('keeps the saved request after %s reconciliation', async status => {
  localStorage.setItem(key, JSON.stringify(saved));
  vi.mocked(retailAfterSalesApi.reconcile).mockResolvedValue({ status, message: 'Keep request' });
  const hook = setup();
  await act(async () => { await expect(hook.result.current.reconcile()).rejects.toThrow('Keep request'); });
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual(saved);
});
it('keeps the request after a network error or mismatched server document', async () => {
  localStorage.setItem(key, JSON.stringify(saved));
  vi.mocked(retailAfterSalesApi.reconcile).mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ status: 'completed', message: '', document: { _id: 'as1', code: 'TH1', orderId: 'other', type: 'return' } });
  const hook = setup();
  for (let i = 0; i < 2; i++) await act(async () => { await expect(hook.result.current.reconcile()).rejects.toThrow(); });
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual(saved);
});

it('recovers a lost revocation response through reconciliation', async () => {
  localStorage.setItem(key, JSON.stringify(saved));
  vi.mocked(retailAfterSalesApi.revoke).mockRejectedValue(new Error('network'));
  vi.mocked(retailAfterSalesApi.reconcile).mockResolvedValue({ status: 'revoked', message: 'revoked' });
  const hook = setup();
  await act(async () => { await expect(hook.result.current.reconcile(true)).rejects.toThrow('network'); });
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual(saved);
  await act(async () => { expect(await hook.result.current.reconcile()).toEqual({ revoked: true }); });
  expect(localStorage.getItem(key)).toBeNull();
  expect(retailAfterSalesApi.create).not.toHaveBeenCalled();
});
it('resolves conflicting candidates separately without replacing either payload', async () => {
  localStorage.setItem(key, JSON.stringify(saved));
  const legacy = { ...saved, idempotencyKey: 'legacy' };
  sessionStorage.setItem(key, JSON.stringify(legacy));
  vi.mocked(retailAfterSalesApi.revoke).mockResolvedValue({ status: 'revoked', message: 'revoked' });
  const hook = setup();
  await act(async () => { await expect(hook.result.current.send(input)).rejects.toThrow('hai bản'); });
  act(() => { hook.result.current.selectCandidate(1); });
  await act(async () => { expect(await hook.result.current.reconcile(true)).toBeUndefined(); });
  expect(sessionStorage.getItem(key)).toBeNull();
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual(saved);
  expect(vi.mocked(retailAfterSalesApi.revoke).mock.calls[0][1]).toEqual(legacy);
  await act(async () => { expect(await hook.result.current.reconcile(true)).toEqual({ revoked: true }); });
  expect(localStorage.getItem(key)).toBeNull();
});
it('preserves both candidates when revocation is rejected', async () => {
  localStorage.setItem(key, JSON.stringify(saved));
  const legacy = JSON.stringify({ ...saved, idempotencyKey: 'legacy' });
  sessionStorage.setItem(key, legacy);
  vi.mocked(retailAfterSalesApi.revoke).mockRejectedValue(new Error('Already posted'));
  const hook = setup();
  await act(async () => { await expect(hook.result.current.reconcile(true)).rejects.toThrow(); });
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual(saved);
  expect(sessionStorage.getItem(key)).toBe(legacy);
});

it('preserves the original version after a lost response despite changed form data', async () => {
  vi.mocked(retailAfterSalesApi.create).mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ _id: 'as1' } as any);
  const first = setup();
  await act(async () => { await expect(first.result.current.send({ ...input, expectedVersion: 3 })).rejects.toThrow(); });
  first.unmount();
  const next = setup();
  await act(async () => { await next.result.current.send({ ...input, expectedVersion: 4 }); });
  expect(vi.mocked(retailAfterSalesApi.create).mock.calls.map(call => call[1].expectedVersion)).toEqual([3, 3]);
});
it('does not attach a new version when replaying a legacy saved request', async () => {
  localStorage.setItem(key, JSON.stringify(saved));
  vi.mocked(retailAfterSalesApi.create).mockResolvedValue({ _id: 'as1' } as any);
  const hook = setup();
  await act(async () => { await hook.result.current.send({ ...input, expectedVersion: 9 }); });
  expect(vi.mocked(retailAfterSalesApi.create).mock.calls[0][1]).not.toHaveProperty('expectedVersion');
});
