// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AfterSalesForm } from "./RetailOrdersPageV2";
import { retailAfterSalesApi } from "../api/retailAfterSales.api";
import { retailShiftsApi } from "../api/retailShifts.api";
import type { RetailOrder } from "../types";
vi.mock("../hooks/useRetailScope", () => ({ useRetailScope: () => ({ scope: { companyCode: "A", branchId: "B" }, userProfile: { uid: "u1" } }) }));
vi.mock("../api/retailAfterSales.api", () => ({ retailAfterSalesApi: { create: vi.fn(), reconcile: vi.fn(), revoke: vi.fn() } }));
vi.mock("../api/retailShifts.api", () => ({ retailShiftsApi: { list: vi.fn() } }));
vi.mock("../../../pages/Toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const cashSessionId = "0123456789abcdef01234567";
const order = { _id: "o1", version: 3, orderCode: "DH1", subtotal: 400, grandTotal: 400, items: [{ productName: "Phone", sku: "PHONE", quantity: 2, lineTotal: 400 }] } as RetailOrder;
beforeEach(() => { vi.resetAllMocks(); vi.mocked(retailShiftsApi.list).mockResolvedValue({ items: [{ _id: cashSessionId, cashierName: "Test cashier", businessDate: "2026-10-09", status: "open" } as any], total: 1, page: 1, limit: 100 }); sessionStorage.clear(); localStorage.clear(); Object.defineProperty(navigator, "locks", { configurable: true, value: { request: vi.fn(async (_key, _options, work) => work({ name: _key })) } }); });
afterEach(cleanup);
const chooseOpenCashSession = async () => { const picker = await screen.findByRole("combobox", { name: /Phi.n thu/ }); await screen.findByRole("option", { name: /Test cashier/ }); await userEvent.selectOptions(picker, cashSessionId); };

it.each(["return", "buyback"] as const)("freezes %s fields and retries the saved request after reopening", async (type) => {
  const user = userEvent.setup(), done = vi.fn();
  vi.mocked(retailAfterSalesApi.create).mockRejectedValueOnce(new Error("network"));
  const view = render(<AfterSalesForm order={order} type={type} close={vi.fn()} done={done} />);
  await chooseOpenCashSession();
  await user.click(screen.getByRole("checkbox"));
  await user.type(screen.getByPlaceholderText("Nhập lý do đổi trả/thu mua..."), "Unused");
  await user.click(screen.getByRole("button", { name: "Xác nhận" }));
  await screen.findByRole("button", { name: "Thử lại yêu cầu cũ" });
  const sent = vi.mocked(retailAfterSalesApi.create).mock.calls[0][1];
  expect(sent.expectedVersion).toBe(3);
  await user.type(screen.getByPlaceholderText("Nhập lý do đổi trả/thu mua..."), "Changed");
  expect((screen.getByPlaceholderText("Nhập lý do đổi trả/thu mua...") as HTMLInputElement).value).toBe("Unused");
  view.unmount();
  render(<AfterSalesForm order={order} type={type} close={vi.fn()} done={done} />);
  vi.mocked(retailAfterSalesApi.create).mockResolvedValueOnce({ _id: "as1", code: "TH1" } as any);
  await user.click(screen.getByRole("button", { name: "Thử lại yêu cầu cũ" }));
  await waitFor(() => expect(done).toHaveBeenCalledTimes(1));
  expect(vi.mocked(retailAfterSalesApi.create).mock.calls[1][1]).toEqual(sent);
});

it('replays a saved request even when all items have already been processed', async () => {
  const saved = { type: 'buyback', orderId: 'o1', idempotencyKey: 'old-key', reason: 'Old request', paymentMethod: 'transfer', paymentReference: 'BANK', items: [{ orderLineIndex: 0, quantity: 2, unitAmount: 123, condition: 'fair', note: 'scratch' }] };
  localStorage.setItem('retail-after-sale-pending:v1:["A","B","u1","o1"]', JSON.stringify(saved));
  vi.mocked(retailAfterSalesApi.create).mockResolvedValue({ _id: 'as1', code: 'TH1' } as any);
  const done = vi.fn();
  render(<AfterSalesForm order={{ ...order, afterSaleSummary: { processedQuantity: 2, totalQuantity: 2 } } as RetailOrder} type='buyback' close={vi.fn()} done={done} />);
  expect(screen.getByText(/scratch/)).toBeTruthy();
  await userEvent.click(screen.getByRole('button', { name: 'Thử lại yêu cầu cũ' }));
  expect(vi.mocked(retailAfterSalesApi.create).mock.calls[0][1]).toEqual(saved);
  expect(done).toHaveBeenCalledOnce();
});
it('blocks new requests when all items have already been processed', async () => {
  render(<AfterSalesForm order={{ ...order, afterSaleSummary: { processedQuantity: 2, totalQuantity: 2 } } as RetailOrder} type='return' close={vi.fn()} done={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));
  expect(retailAfterSalesApi.create).not.toHaveBeenCalled();
  expect(screen.getByText(/Toàn bộ hàng đã được xử lý/)).toBeTruthy();
});

it('offers read-only reconciliation separately from retry', async () => {
  const saved = { type: 'return', orderId: 'o1', idempotencyKey: 'old-key', reason: 'Unused', paymentMethod: 'cash', items: [{ orderLineIndex: 0, quantity: 1, condition: 'good' }] };
  localStorage.setItem('retail-after-sale-pending:v1:["A","B","u1","o1"]', JSON.stringify(saved));
  vi.mocked(retailAfterSalesApi.reconcile).mockResolvedValue({ status: 'completed', message: 'verified', document: { _id: 'as1', code: 'TH1', orderId: 'o1', type: 'return' } });
  const done = vi.fn();
  render(<AfterSalesForm order={order} type='return' close={vi.fn()} done={done} />);
  await userEvent.click(screen.getByRole('button', { name: 'Đối chiếu yêu cầu hậu mãi' }));
  expect(retailAfterSalesApi.create).not.toHaveBeenCalled();
  expect(retailAfterSalesApi.reconcile).toHaveBeenCalledWith({ companyCode: 'A', branchId: 'B' }, saved);
  expect(done).toHaveBeenCalledOnce();
});

it('allows resolving each conflicting operation without posting a new document', async () => {
  const key = 'retail-after-sale-pending:v1:["A","B","u1","o1"]';
  const saved = { type: 'return', orderId: 'o1', idempotencyKey: 'return', reason: 'Unused', paymentMethod: 'cash', items: [{ orderLineIndex: 0, quantity: 1, condition: 'good' }] };
  const legacy = { ...saved, type: 'buyback', idempotencyKey: 'buyback', items: [{ ...saved.items[0], unitAmount: 100 }] };
  localStorage.setItem(key, JSON.stringify(saved)); sessionStorage.setItem(key, JSON.stringify(legacy));
  vi.mocked(retailAfterSalesApi.revoke).mockResolvedValue({ status: 'revoked', message: 'revoked' });
  const close = vi.fn();
  render(<AfterSalesForm order={order} type='return' close={close} done={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: 'Thử lại yêu cầu cũ' }));
  expect(retailAfterSalesApi.create).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Yêu cầu 2: Thu mua' }));
  await userEvent.click(screen.getByRole('button', { name: 'Thu hồi yêu cầu hậu mãi chưa ghi nhận' }));
  expect(sessionStorage.getItem(key)).toBeNull();
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual(saved);
  expect(close).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Thu hồi yêu cầu hậu mãi chưa ghi nhận' }));
  expect(close).toHaveBeenCalledOnce();
});
