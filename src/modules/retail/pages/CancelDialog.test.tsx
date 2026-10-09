// @vitest-environment jsdom
import React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import PendingCancellations from "../components/orders/PendingCancellations";
import { CancelDialog } from "./RetailOrdersPageV2";
import { retailOrdersApi } from "../api/retailOrders.api";
import { retailShiftsApi } from "../api/retailShifts.api";
import type { RetailOrder } from "../types";
const context = vi.hoisted(() => ({ branchId: "B" }));
vi.mock("../hooks/useRetailScope", () => ({ useRetailScope: () => ({ scope: { companyCode: "A", branchId: context.branchId }, userProfile: { uid: "u1" } }) }));
vi.mock("../api/retailOrders.api", () => ({ retailOrdersApi: { cancel: vi.fn(), reconcileCancellation: vi.fn(), revokeCancellation: vi.fn() } }));
vi.mock("../api/retailShifts.api", () => ({ retailShiftsApi: { list: vi.fn() } }));
const cashSessionId = "0123456789abcdef01234567";
const order = { _id: "o1", status: "completed", paidAmount: 400, refundedAmount: 0, version: 1 } as RetailOrder;
beforeEach(() => { vi.resetAllMocks(); vi.mocked(retailShiftsApi.list).mockResolvedValue({ items: [{ _id: cashSessionId, cashierName: "Test cashier", businessDate: "2026-10-09", status: "open" } as any], total: 1, page: 1, limit: 100 }); sessionStorage.clear(); localStorage.clear(); Object.defineProperty(navigator, "locks", { configurable: true, value: { request: vi.fn(async (_key, _options, work) => work({ name: _key })) } }); context.branchId = "B"; });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const chooseOpenCashSession = async () => { const picker = await screen.findByRole("combobox", { name: /Phi.n thu/ }); await screen.findByRole("option", { name: /Test cashier/ }); await userEvent.selectOptions(picker, cashSessionId); };

it("keeps cancellation reason, refund, version and key through a lost response and remount", async () => {
  const done = vi.fn();
  vi.mocked(retailOrdersApi.cancel).mockRejectedValueOnce(new Error("network"));
  const view = render(<CancelDialog order={order} onClose={vi.fn()} done={done} />);
  await userEvent.type(screen.getByLabelText("Lý do hủy"), "Unused");
  await chooseOpenCashSession();
  await userEvent.click(screen.getByRole("button", { name: "Xác nhận hủy đơn" }));
  await screen.findByRole("button", { name: "Thử lại yêu cầu hủy cũ" });
  expect((screen.getByLabelText("Lý do hủy") as HTMLTextAreaElement).disabled).toBe(true);
  const sent = vi.mocked(retailOrdersApi.cancel).mock.calls[0];
  view.unmount();
  render(<CancelDialog order={{ ...order, paidAmount: 500, version: 2 }} onClose={vi.fn()} done={done} />);
  vi.mocked(retailOrdersApi.cancel).mockResolvedValueOnce(order);
  await userEvent.click(screen.getByRole("button", { name: "Thử lại yêu cầu hủy cũ" }));
  await waitFor(() => expect(done).toHaveBeenCalledOnce());
  expect(vi.mocked(retailOrdersApi.cancel).mock.calls[1]).toEqual(sent);
  expect(sent[2]).toMatchObject({ expectedVersion: 1, refunds: [{ method: "cash", amount: 400 }], idempotencyKey: expect.any(String) });
  expect(sessionStorage.length).toBe(0);
});

it("coalesces clicks and ignores a late cancellation after scope changes", async () => {
  let resolve!: (value: RetailOrder) => void;
  vi.mocked(retailOrdersApi.cancel).mockReturnValue(new Promise((done) => { resolve = done; }));
  const done = vi.fn();
  const view = render(<CancelDialog order={order} onClose={vi.fn()} done={done} />);
  await userEvent.type(screen.getByLabelText("Lý do hủy"), "Unused");
  await chooseOpenCashSession();
  await userEvent.dblClick(screen.getByRole("button", { name: "Xác nhận hủy đơn" }));
  expect(retailOrdersApi.cancel).toHaveBeenCalledTimes(1);
  context.branchId = "OTHER";
  view.rerender(<CancelDialog order={order} onClose={vi.fn()} done={done} />);
  await act(async () => { resolve(order); });
  expect(done).not.toHaveBeenCalled();
});

it("does not cancel if the request cannot be persisted", async () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
  render(<CancelDialog order={order} onClose={vi.fn()} done={vi.fn()} />);
  await userEvent.type(screen.getByLabelText("Lý do hủy"), "Unused");
  await chooseOpenCashSession();
  await userEvent.click(screen.getByRole("button", { name: "Xác nhận hủy đơn" }));
  expect(retailOrdersApi.cancel).not.toHaveBeenCalled();
  expect(await screen.findByRole("alert")).toBeTruthy();
});

const key = 'retail-cancellation-pending:v1:' + JSON.stringify(['A', 'B', 'u1', 'o1']);
const saved = { reason: 'Unused', refunds: [{ method: 'transfer', amount: 100, reference: 'REF' }], idempotencyKey: 'old-key', expectedVersion: 1 };
it('migrates legacy data before replay and recovers after session storage is gone', async () => {
  sessionStorage.setItem(key, JSON.stringify(saved));
  vi.mocked(retailOrdersApi.cancel).mockImplementation(async () => {
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual(saved);
    expect(sessionStorage.getItem(key)).toBeNull();
    throw new Error('network');
  });
  const view = render(<CancelDialog order={order} onClose={vi.fn()} done={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: 'Thử lại yêu cầu hủy cũ' }));
  view.unmount(); sessionStorage.clear();
  render(<CancelDialog order={{ ...order, status: 'cancelled', version: 2, refundedAmount: 400 }} onClose={vi.fn()} done={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: 'Thử lại yêu cầu hủy cũ' }));
  expect(vi.mocked(retailOrdersApi.cancel).mock.calls.map(call => call[2])).toEqual([saved, saved]);
});
it('supports saved cancellation without a refund', async () => {
  const noRefund = { ...saved, refunds: [] };
  localStorage.setItem(key, JSON.stringify(noRefund));
  vi.mocked(retailOrdersApi.cancel).mockResolvedValue(order);
  render(<CancelDialog order={order} onClose={vi.fn()} done={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: 'Thử lại yêu cầu hủy cũ' }));
  expect(vi.mocked(retailOrdersApi.cancel).mock.calls[0][2]).toEqual(noRefund);
  expect(localStorage.getItem(key)).toBeNull();
});
it.each(['null', '', '{}', JSON.stringify({ ...saved, expectedVersion: -1 }), JSON.stringify({ ...saved, refunds: [{ method: 'cash', amount: -1 }] })])('blocks damaged saved cancellation: %s', async raw => {
  localStorage.setItem(key, raw);
  render(<CancelDialog order={order} onClose={vi.fn()} done={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: 'Xác nhận hủy đơn' }));
  expect(retailOrdersApi.cancel).not.toHaveBeenCalled();
  expect(localStorage.getItem(key)).toBe(raw);
});
it('preserves conflicting shared and legacy requests', async () => {
  localStorage.setItem(key, JSON.stringify(saved));
  const legacy = JSON.stringify({ ...saved, idempotencyKey: 'other-key' });
  sessionStorage.setItem(key, legacy);
  render(<CancelDialog order={order} onClose={vi.fn()} done={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: 'Xác nhận hủy đơn' }));
  expect(retailOrdersApi.cancel).not.toHaveBeenCalled();
  expect(sessionStorage.getItem(key)).toBe(legacy);
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual(saved);
});
it('adopts another tab request and requires an explicit retry', async () => {
  render(<CancelDialog order={order} onClose={vi.fn()} done={vi.fn()} />);
  await userEvent.type(screen.getByLabelText('Lý do hủy'), 'New reason');
  localStorage.setItem(key, JSON.stringify(saved));
  await userEvent.click(screen.getByRole('button', { name: 'Xác nhận hủy đơn' }));
  expect(retailOrdersApi.cancel).not.toHaveBeenCalled();
  expect((screen.getByLabelText('Lý do hủy') as HTMLTextAreaElement).value).toBe(saved.reason);
  vi.mocked(retailOrdersApi.cancel).mockResolvedValue(order);
  await userEvent.click(screen.getByRole('button', { name: 'Thử lại yêu cầu hủy cũ' }));
  expect(vi.mocked(retailOrdersApi.cancel).mock.calls[0][2]).toEqual(saved);
});
it.each([false, true])('blocks sending without an available browser lock (%s)', async missing => {
  Object.defineProperty(navigator, 'locks', { configurable: true, value: missing ? undefined : { request: async (_key: string, _options: unknown, work: (lock: null) => Promise<void>) => work(null) } });
  render(<CancelDialog order={order} onClose={vi.fn()} done={vi.fn()} />);
  await userEvent.type(screen.getByLabelText('Lý do hủy'), 'Unused');
  await userEvent.click(screen.getByRole('button', { name: 'Xác nhận hủy đơn' }));
  expect(retailOrdersApi.cancel).not.toHaveBeenCalled();
  expect(localStorage.length).toBe(0);
});
it('does not remove a different request after a late success', async () => {
  let resolve!: (value: RetailOrder) => void;
  vi.mocked(retailOrdersApi.cancel).mockReturnValue(new Promise(done => { resolve = done; }));
  const done = vi.fn();
  render(<CancelDialog order={order} onClose={vi.fn()} done={done} />);
  await userEvent.type(screen.getByLabelText('Lý do hủy'), 'Unused');
  await userEvent.click(screen.getByRole('button', { name: 'Xác nhận hủy đơn' }));
  localStorage.setItem(key, JSON.stringify(saved));
  await act(async () => { resolve(order); });
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual(saved);
  expect(done).not.toHaveBeenCalled();
});
it('keeps legacy data if migration cannot persist the shared copy', async () => {
  sessionStorage.setItem(key, JSON.stringify(saved));
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  render(<CancelDialog order={order} onClose={vi.fn()} done={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: 'Thử lại yêu cầu hủy cũ' }));
  expect(JSON.parse(sessionStorage.getItem(key)!)).toEqual(saved);
  expect(retailOrdersApi.cancel).not.toHaveBeenCalled();
});
it('does not create another cancellation on a cancelled order', async () => {
  render(<CancelDialog order={{ ...order, status: 'cancelled' }} onClose={vi.fn()} done={vi.fn()} />);
  expect((screen.getByLabelText('Lý do hủy') as HTMLTextAreaElement).disabled).toBe(true);
  await userEvent.click(screen.getByRole('button', { name: 'Xác nhận hủy đơn' }));
  expect(retailOrdersApi.cancel).not.toHaveBeenCalled();
});

it('reconciles a saved cancellation without posting another cancellation', async () => {
  localStorage.setItem(key, JSON.stringify(saved));
  vi.mocked(retailOrdersApi.reconcileCancellation).mockResolvedValue({ status: 'completed', message: 'verified', order });
  const done = vi.fn();
  render(<CancelDialog order={order} onClose={vi.fn()} done={done} />);
  await userEvent.click(screen.getByRole('button', { name: 'Đối chiếu yêu cầu hủy' }));
  expect(retailOrdersApi.cancel).not.toHaveBeenCalled();
  expect(localStorage.getItem(key)).toBeNull();
  expect(done).toHaveBeenCalledWith(order);
});
it.each(['not_found', 'processing', 'conflict'] as const)('preserves cancellation after %s reconciliation', async status => {
  localStorage.setItem(key, JSON.stringify(saved));
  vi.mocked(retailOrdersApi.reconcileCancellation).mockResolvedValue({ status, message: 'Keep request' });
  render(<CancelDialog order={order} onClose={vi.fn()} done={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: 'Đối chiếu yêu cầu hủy' }));
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual(saved);
  expect(retailOrdersApi.cancel).not.toHaveBeenCalled();
});
it('recovers a deleted draft from the independent pending list', async () => {
  localStorage.setItem(key, JSON.stringify({ ...saved, refunds: [] }));
  const otherKey = 'retail-cancellation-pending:v1:' + JSON.stringify(['A', 'OTHER', 'u1', 'other']);
  localStorage.setItem(otherKey, JSON.stringify(saved));
  const onResolved = vi.fn();
  vi.mocked(retailOrdersApi.reconcileCancellation).mockResolvedValue({ status: 'completed', message: 'verified', order: { ...order, status: 'cancelled' } });
  render(<PendingCancellations onResolved={onResolved} />);
  expect(screen.getAllByRole('button', { name: 'Đối chiếu yêu cầu hủy' })).toHaveLength(1);
  await userEvent.click(screen.getByRole('button', { name: 'Đối chiếu yêu cầu hủy' }));
  expect(localStorage.getItem(key)).toBeNull();
  expect(localStorage.getItem(otherKey)).not.toBeNull();
  expect(onResolved).toHaveBeenCalledOnce();
  expect(retailOrdersApi.cancel).not.toHaveBeenCalled();
});

it('preserves the independent recovery request after a network failure or mismatched order', async () => {
  localStorage.setItem(key, JSON.stringify(saved));
  vi.mocked(retailOrdersApi.reconcileCancellation).mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ status: 'completed', message: '', order: { ...order, _id: 'other' } });
  const onResolved = vi.fn();
  render(<PendingCancellations onResolved={onResolved} />);
  await userEvent.click(screen.getByRole('button', { name: 'Đối chiếu yêu cầu hủy' }));
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual(saved);
  await userEvent.click(screen.getByRole('button', { name: 'Đối chiếu yêu cầu hủy' }));
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual(saved);
  expect(onResolved).not.toHaveBeenCalled();
});
it('suppresses independent recovery callback after unmount', async () => {
  localStorage.setItem(key, JSON.stringify(saved));
  let resolve!: (value: { status: 'completed'; message: string; order: RetailOrder }) => void;
  vi.mocked(retailOrdersApi.reconcileCancellation).mockReturnValue(new Promise(done => { resolve = done; }));
  const onResolved = vi.fn();
  const view = render(<PendingCancellations onResolved={onResolved} />);
  await userEvent.click(screen.getByRole('button', { name: 'Đối chiếu yêu cầu hủy' }));
  view.unmount();
  await act(async () => { resolve({ status: 'completed', message: '', order }); });
  expect(onResolved).not.toHaveBeenCalled();
});
it('keeps corrupt pending records instead of discarding them from storage', () => {
  localStorage.setItem(key, 'null');
  render(<PendingCancellations onResolved={vi.fn()} />);
  expect(screen.getByRole('alert')).toBeTruthy();
  expect(localStorage.getItem(key)).toBe('null');
  expect(retailOrdersApi.reconcileCancellation).not.toHaveBeenCalled();
});

it('recovers a lost revocation response through read-only reconciliation', async () => {
  localStorage.setItem(key, JSON.stringify(saved));
  vi.mocked(retailOrdersApi.revokeCancellation).mockRejectedValueOnce(new Error('network'));
  vi.mocked(retailOrdersApi.reconcileCancellation).mockResolvedValue({ status: 'revoked', message: 'revoked' });
  const onClose = vi.fn();
  render(<CancelDialog order={order} onClose={onClose} done={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: 'Thu hồi yêu cầu chưa ghi nhận' }));
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual(saved);
  await userEvent.click(screen.getByRole('button', { name: 'Đối chiếu yêu cầu hủy' }));
  expect(localStorage.getItem(key)).toBeNull();
  expect(onClose).toHaveBeenCalledOnce();
  expect(retailOrdersApi.cancel).not.toHaveBeenCalled();
});
it('resolves conflicting cancellation candidates separately in the independent list', async () => {
  localStorage.setItem(key, JSON.stringify(saved));
  const legacy = { ...saved, idempotencyKey: 'legacy-key' };
  sessionStorage.setItem(key, JSON.stringify(legacy));
  vi.mocked(retailOrdersApi.revokeCancellation).mockResolvedValue({ status: 'revoked', message: 'revoked' });
  render(<PendingCancellations onResolved={vi.fn()} />);
  expect(screen.getAllByRole('button', { name: 'Thu hồi yêu cầu chưa ghi nhận' })).toHaveLength(2);
  await userEvent.click(screen.getAllByRole('button', { name: 'Thu hồi yêu cầu chưa ghi nhận' })[1]);
  expect(sessionStorage.getItem(key)).toBeNull();
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual(saved);
  expect(vi.mocked(retailOrdersApi.revokeCancellation).mock.calls[0][2]).toEqual(legacy);
  await userEvent.click(screen.getByRole('button', { name: 'Thu hồi yêu cầu chưa ghi nhận' }));
  expect(localStorage.getItem(key)).toBeNull();
});
it('keeps both conflicting records after a rejected revocation', async () => {
  localStorage.setItem(key, JSON.stringify(saved));
  const legacy = JSON.stringify({ ...saved, idempotencyKey: 'legacy-key' });
  sessionStorage.setItem(key, legacy);
  vi.mocked(retailOrdersApi.revokeCancellation).mockRejectedValue(new Error('Already completed'));
  render(<PendingCancellations onResolved={vi.fn()} />);
  await userEvent.click(screen.getAllByRole('button', { name: 'Thu hồi yêu cầu chưa ghi nhận' })[0]);
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual(saved);
  expect(sessionStorage.getItem(key)).toBe(legacy);
});
