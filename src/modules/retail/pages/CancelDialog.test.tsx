// @vitest-environment jsdom
import React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CancelDialog } from "./RetailOrdersPageV2";
import { retailOrdersApi } from "../api/retailOrders.api";
import type { RetailOrder } from "../types";
const context = vi.hoisted(() => ({ branchId: "B" }));
vi.mock("../hooks/useRetailScope", () => ({ useRetailScope: () => ({ scope: { companyCode: "A", branchId: context.branchId }, userProfile: { uid: "u1" } }) }));
vi.mock("../api/retailOrders.api", () => ({ retailOrdersApi: { cancel: vi.fn() } }));
const order = { _id: "o1", paidAmount: 400, refundedAmount: 0, version: 1 } as RetailOrder;
beforeEach(() => { vi.resetAllMocks(); sessionStorage.clear(); context.branchId = "B"; });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("keeps cancellation reason, refund, version and key through a lost response and remount", async () => {
  const done = vi.fn();
  vi.mocked(retailOrdersApi.cancel).mockRejectedValueOnce(new Error("network"));
  const view = render(<CancelDialog order={order} onClose={vi.fn()} done={done} />);
  await userEvent.type(screen.getByLabelText("Lý do hủy"), "Unused");
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
  await userEvent.click(screen.getByRole("button", { name: "Xác nhận hủy đơn" }));
  expect(retailOrdersApi.cancel).not.toHaveBeenCalled();
  expect(await screen.findByRole("alert")).toBeTruthy();
});
