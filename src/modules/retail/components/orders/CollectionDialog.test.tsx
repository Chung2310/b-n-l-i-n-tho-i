// @vitest-environment jsdom
import React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import CollectionDialog from "./CollectionDialog";
import { retailOrdersApi } from "../../api/retailOrders.api";
import { retailShiftsApi } from "../../api/retailShifts.api";
import type { RetailOrder } from "../../types";
const context = vi.hoisted(() => ({ branchId: "B" }));
vi.mock("../../hooks/useRetailScope", () => ({ useRetailScope: () => ({ scope: { companyCode: "A", branchId: context.branchId }, userProfile: { uid: "u1" } }) }));
vi.mock("../../api/retailOrders.api", () => ({ retailOrdersApi: { collect: vi.fn(), reconcileCollection: vi.fn(), revokeCollection: vi.fn() } }));
vi.mock("../../api/retailShifts.api", () => ({ retailShiftsApi: { list: vi.fn() } }));
const cashSessionId = "0123456789abcdef01234567";
const order = { _id: "o1", customerId: "c1", dueAmount: 400, version: 3, status: "confirmed" } as RetailOrder;
beforeEach(() => { vi.resetAllMocks(); vi.mocked(retailShiftsApi.list).mockResolvedValue({ items: [{ _id: cashSessionId, cashierName: "Test cashier", businessDate: "2026-10-09", status: "open" } as any], total: 1, page: 1, limit: 100 }); context.branchId = "B"; sessionStorage.clear(); localStorage.clear(); Object.defineProperty(navigator, "locks", { configurable: true, value: { request: vi.fn(async (_key, _options, work) => work({ name: _key })) } }); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const chooseOpenCashSession = async () => { const picker = await screen.findByRole("combobox", { name: /Phi.n thu/ }); await screen.findByRole("option", { name: /Test cashier/ }); await userEvent.selectOptions(picker, cashSessionId); };

it("reopens with the same key, version and payments after a lost response", async () => {
  const done = vi.fn();
  vi.mocked(retailOrdersApi.collect).mockRejectedValueOnce(new Error("network"));
  const view = render(<CollectionDialog order={order} close={vi.fn()} done={done} />);
  await chooseOpenCashSession();
  await userEvent.click(screen.getByRole("button", { name: "Xác nhận thanh toán" }));
  await screen.findByRole("button", { name: "Thử lại khoản thu cũ" });
  const sent = vi.mocked(retailOrdersApi.collect).mock.calls[0];
  view.unmount();
  render(<CollectionDialog order={{ ...order, version: 4, dueAmount: 300 }} close={vi.fn()} done={done} />);
  vi.mocked(retailOrdersApi.collect).mockResolvedValueOnce(order);
  await userEvent.click(screen.getByRole("button", { name: "Thử lại khoản thu cũ" }));
  await waitFor(() => expect(done).toHaveBeenCalledOnce());
  expect(vi.mocked(retailOrdersApi.collect).mock.calls[1]).toEqual(sent);
  expect(sent[3]).toMatchObject({ expectedVersion: 3, idempotencyKey: expect.any(String) });
  expect(sessionStorage.length).toBe(0);
  expect(localStorage.length).toBe(0);
});

it("blocks duplicate clicks and ignores late success after a branch change", async () => {
  let resolve!: (value: RetailOrder) => void;
  vi.mocked(retailOrdersApi.collect).mockReturnValue(new Promise((done) => { resolve = done; }));
  const done = vi.fn();
  const view = render(<CollectionDialog order={order} close={vi.fn()} done={done} />);
  await chooseOpenCashSession();
  await userEvent.dblClick(screen.getByRole("button", { name: "Xác nhận thanh toán" }));
  expect(retailOrdersApi.collect).toHaveBeenCalledTimes(1);
  context.branchId = "OTHER";
  view.rerender(<CollectionDialog order={order} close={vi.fn()} done={done} />);
  await act(async () => { resolve(order); });
  expect(done).not.toHaveBeenCalled();
});

it("does not send if browser storage is unavailable", async () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
  render(<CollectionDialog order={order} close={vi.fn()} done={vi.fn()} />);
  await chooseOpenCashSession();
  await userEvent.click(screen.getByRole("button", { name: "Xác nhận thanh toán" }));
  expect(retailOrdersApi.collect).not.toHaveBeenCalled();
  expect(await screen.findByRole("alert")).toBeTruthy();
});

const key = 'retail-collection-pending:v1:' + JSON.stringify(['A', 'B', 'u1', 'o1']);
const saved = { payments: [{ method: 'cash', amount: 100 }], idempotencyKey: 'old-key', expectedVersion: 2 };

it('migrates the legacy tab request before sending and retains it across closed sessions', async () => {
  sessionStorage.setItem(key, JSON.stringify(saved));
  vi.mocked(retailOrdersApi.collect).mockImplementation(async () => {
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual(saved);
    expect(sessionStorage.getItem(key)).toBeNull();
    throw new Error('network');
  });
  const view = render(<CollectionDialog order={order} close={vi.fn()} done={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: 'Thử lại khoản thu cũ' }));
  view.unmount();
  sessionStorage.clear();
  render(<CollectionDialog order={{ ...order, status: 'completed', dueAmount: 0 }} close={vi.fn()} done={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: 'Thử lại khoản thu cũ' }));
  expect(retailOrdersApi.collect).toHaveBeenCalledTimes(2);
  expect(vi.mocked(retailOrdersApi.collect).mock.calls[1][3]).toEqual({ idempotencyKey: 'old-key', expectedVersion: 2 });
});

it.each(['null', '', '{}', JSON.stringify({ ...saved, expectedVersion: -1 }), JSON.stringify({ ...saved, payments: [{ method: 'cash', amount: -1 }] })])('blocks corrupt saved data: %s', async raw => {
  localStorage.setItem(key, raw);
  render(<CollectionDialog order={order} close={vi.fn()} done={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: 'Thử lại khoản thu cũ' }));
  expect(retailOrdersApi.collect).not.toHaveBeenCalled();
  expect(localStorage.getItem(key)).toBe(raw);
});

it('preserves conflicting legacy and shared requests', async () => {
  localStorage.setItem(key, JSON.stringify(saved));
  const legacy = JSON.stringify({ ...saved, idempotencyKey: 'another-key' });
  sessionStorage.setItem(key, legacy);
  render(<CollectionDialog order={order} close={vi.fn()} done={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: 'Thử lại khoản thu cũ' }));
  expect(retailOrdersApi.collect).not.toHaveBeenCalled();
  expect(sessionStorage.getItem(key)).toBe(legacy);
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual(saved);
});

it('adopts another tab request without submitting from a stale form', async () => {
  render(<CollectionDialog order={order} close={vi.fn()} done={vi.fn()} />);
  localStorage.setItem(key, JSON.stringify(saved));
  await userEvent.click(screen.getByRole('button', { name: 'Xác nhận thanh toán' }));
  expect(retailOrdersApi.collect).not.toHaveBeenCalled();
  vi.mocked(retailOrdersApi.collect).mockResolvedValue(order);
  await userEvent.click(screen.getByRole('button', { name: 'Thử lại khoản thu cũ' }));
  expect(vi.mocked(retailOrdersApi.collect).mock.calls[0][2]).toEqual(saved.payments);
});

it.each([false, true])('does not send without an available browser lock (%s)', async missing => {
  Object.defineProperty(navigator, 'locks', { configurable: true, value: missing ? undefined : { request: async (_key: string, _options: unknown, work: (lock: null) => Promise<void>) => work(null) } });
  render(<CollectionDialog order={order} close={vi.fn()} done={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: 'Xác nhận thanh toán' }));
  expect(retailOrdersApi.collect).not.toHaveBeenCalled();
  expect(localStorage.length).toBe(0);
});

it('never removes a different request after a late success', async () => {
  let resolve!: (value: RetailOrder) => void;
  vi.mocked(retailOrdersApi.collect).mockReturnValue(new Promise(done => { resolve = done; }));
  const done = vi.fn();
  render(<CollectionDialog order={order} close={vi.fn()} done={done} />);
  await userEvent.click(screen.getByRole('button', { name: 'Xác nhận thanh toán' }));
  localStorage.setItem(key, JSON.stringify(saved));
  await act(async () => { resolve(order); });
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual(saved);
  expect(done).not.toHaveBeenCalled();
});

it('does not open a new payment form for a completed order', () => {
  render(<CollectionDialog order={{ ...order, status: 'completed', dueAmount: 0 }} close={vi.fn()} done={vi.fn()} />);
  expect(screen.queryByRole('button', { name: 'Xác nhận thanh toán' })).toBeNull();
  expect(retailOrdersApi.collect).not.toHaveBeenCalled();
});

it('clears a verified collection without posting another payment', async () => {
  localStorage.setItem(key, JSON.stringify(saved));
  vi.mocked(retailOrdersApi.reconcileCollection).mockResolvedValue({ status: 'completed', message: 'verified', order });
  const done = vi.fn();
  render(<CollectionDialog order={order} close={vi.fn()} done={done} />);
  await userEvent.click(screen.getByRole('button', { name: 'Đối chiếu khoản thu' }));
  expect(retailOrdersApi.collect).not.toHaveBeenCalled();
  expect(retailOrdersApi.reconcileCollection).toHaveBeenCalledWith({ companyCode: 'A', branchId: 'B' }, 'o1', saved);
  expect(done).toHaveBeenCalledWith(order);
  expect(localStorage.getItem(key)).toBeNull();
});
it.each(['not_found', 'processing', 'conflict'] as const)('retains the exact request after %s reconciliation', async status => {
  localStorage.setItem(key, JSON.stringify(saved));
  vi.mocked(retailOrdersApi.reconcileCollection).mockResolvedValue({ status, message: 'Keep request' });
  render(<CollectionDialog order={order} close={vi.fn()} done={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: 'Đối chiếu khoản thu' }));
  expect(retailOrdersApi.collect).not.toHaveBeenCalled();
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual(saved);
  expect(screen.getByRole('alert').textContent).toBe('Keep request');
});
it('retains the request when reconciliation fails or returns another order', async () => {
  localStorage.setItem(key, JSON.stringify(saved));
  vi.mocked(retailOrdersApi.reconcileCollection).mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ status: 'completed', message: '', order: { ...order, _id: 'other' } });
  const done = vi.fn();
  render(<CollectionDialog order={order} close={vi.fn()} done={done} />);
  await userEvent.click(screen.getByRole('button', { name: 'Đối chiếu khoản thu' }));
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual(saved);
  await userEvent.click(screen.getByRole('button', { name: 'Đối chiếu khoản thu' }));
  expect(done).not.toHaveBeenCalled();
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual(saved);
});

it('clears only after confirmed revocation and never posts a collection', async () => {
  localStorage.setItem(key, JSON.stringify(saved));
  vi.mocked(retailOrdersApi.revokeCollection).mockResolvedValue({ status: 'revoked', message: 'revoked' });
  const close = vi.fn();
  render(<CollectionDialog order={order} close={close} done={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: 'Hủy yêu cầu chưa ghi nhận' }));
  expect(retailOrdersApi.revokeCollection).toHaveBeenCalledWith({ companyCode: 'A', branchId: 'B' }, 'o1', saved);
  expect(retailOrdersApi.collect).not.toHaveBeenCalled();
  expect(localStorage.getItem(key)).toBeNull();
  expect(close).toHaveBeenCalledOnce();
});
it('retains a request after a lost revocation response and recovers via reconciliation', async () => {
  localStorage.setItem(key, JSON.stringify(saved));
  vi.mocked(retailOrdersApi.revokeCollection).mockRejectedValue(new Error('network'));
  vi.mocked(retailOrdersApi.reconcileCollection).mockResolvedValue({ status: 'revoked', message: 'revoked' });
  render(<CollectionDialog order={order} close={vi.fn()} done={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: 'Hủy yêu cầu chưa ghi nhận' }));
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual(saved);
  await userEvent.click(screen.getByRole('button', { name: 'Đối chiếu khoản thu' }));
  expect(localStorage.getItem(key)).toBeNull();
});
it('resolves conflicting requests individually without deleting the other candidate', async () => {
  const legacy = { ...saved, idempotencyKey: 'legacy-key' };
  localStorage.setItem(key, JSON.stringify(saved));
  sessionStorage.setItem(key, JSON.stringify(legacy));
  vi.mocked(retailOrdersApi.revokeCollection).mockResolvedValue({ status: 'revoked', message: 'revoked' });
  const close = vi.fn();
  render(<CollectionDialog order={order} close={close} done={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: 'Thử lại khoản thu cũ' }));
  expect(retailOrdersApi.collect).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Yêu cầu 2' }));
  await userEvent.click(screen.getByRole('button', { name: 'Hủy yêu cầu chưa ghi nhận' }));
  expect(sessionStorage.getItem(key)).toBeNull();
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual(saved);
  expect(close).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Hủy yêu cầu chưa ghi nhận' }));
  expect(localStorage.getItem(key)).toBeNull();
  expect(close).toHaveBeenCalledOnce();
});
it('preserves conflicting requests when the server rejects revocation', async () => {
  localStorage.setItem(key, JSON.stringify(saved));
  const legacy = JSON.stringify({ ...saved, idempotencyKey: 'legacy-key' });
  sessionStorage.setItem(key, legacy);
  vi.mocked(retailOrdersApi.revokeCollection).mockRejectedValue(new Error('Already collected'));
  render(<CollectionDialog order={order} close={vi.fn()} done={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: 'Hủy yêu cầu chưa ghi nhận' }));
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual(saved);
  expect(sessionStorage.getItem(key)).toBe(legacy);
});

it('ignores late revocation callbacks after changing branch', async () => {
  localStorage.setItem(key, JSON.stringify(saved));
  let resolve!: (value: { status: 'revoked'; message: string }) => void;
  vi.mocked(retailOrdersApi.revokeCollection).mockReturnValue(new Promise(done => { resolve = done; }));
  const close = vi.fn();
  const view = render(<CollectionDialog order={order} close={close} done={vi.fn()} />);
  await userEvent.dblClick(screen.getByRole('button', { name: 'Hủy yêu cầu chưa ghi nhận' }));
  expect(retailOrdersApi.revokeCollection).toHaveBeenCalledOnce();
  context.branchId = 'OTHER';
  view.rerender(<CollectionDialog order={order} close={close} done={vi.fn()} />);
  await act(async () => { resolve({ status: 'revoked', message: 'revoked' }); });
  expect(close).not.toHaveBeenCalled();
});
it('keeps the unresolved candidate after verifying the other collection', async () => {
  localStorage.setItem(key, JSON.stringify(saved));
  const legacy = { ...saved, idempotencyKey: 'legacy-key' };
  sessionStorage.setItem(key, JSON.stringify(legacy));
  vi.mocked(retailOrdersApi.reconcileCollection).mockResolvedValue({ status: 'completed', message: 'verified', order });
  const done = vi.fn();
  render(<CollectionDialog order={order} close={vi.fn()} done={done} />);
  await userEvent.click(screen.getByRole('button', { name: 'Đối chiếu khoản thu' }));
  expect(localStorage.getItem(key)).toBeNull();
  expect(JSON.parse(sessionStorage.getItem(key)!)).toEqual(legacy);
  expect(done).not.toHaveBeenCalled();
  expect(retailOrdersApi.collect).not.toHaveBeenCalled();
});
