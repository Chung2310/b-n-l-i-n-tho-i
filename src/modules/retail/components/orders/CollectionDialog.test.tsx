// @vitest-environment jsdom
import React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import CollectionDialog from "./CollectionDialog";
import { retailOrdersApi } from "../../api/retailOrders.api";
import type { RetailOrder } from "../../types";
const context = vi.hoisted(() => ({ branchId: "B" }));
vi.mock("../../hooks/useRetailScope", () => ({ useRetailScope: () => ({ scope: { companyCode: "A", branchId: context.branchId }, userProfile: { uid: "u1" } }) }));
vi.mock("../../api/retailOrders.api", () => ({ retailOrdersApi: { collect: vi.fn() } }));
const order = { _id: "o1", customerId: "c1", dueAmount: 400, version: 3 } as RetailOrder;
beforeEach(() => { vi.resetAllMocks(); context.branchId = "B"; sessionStorage.clear(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("reopens with the same key, version and payments after a lost response", async () => {
  const done = vi.fn();
  vi.mocked(retailOrdersApi.collect).mockRejectedValueOnce(new Error("network"));
  const view = render(<CollectionDialog order={order} close={vi.fn()} done={done} />);
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
});

it("blocks duplicate clicks and ignores late success after a branch change", async () => {
  let resolve!: (value: RetailOrder) => void;
  vi.mocked(retailOrdersApi.collect).mockReturnValue(new Promise((done) => { resolve = done; }));
  const done = vi.fn();
  const view = render(<CollectionDialog order={order} close={vi.fn()} done={done} />);
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
  await userEvent.click(screen.getByRole("button", { name: "Xác nhận thanh toán" }));
  expect(retailOrdersApi.collect).not.toHaveBeenCalled();
  expect(await screen.findByRole("alert")).toBeTruthy();
});
