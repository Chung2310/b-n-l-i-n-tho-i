// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useAfterSaleRequest } from "./useAfterSaleRequest";
import { retailAfterSalesApi } from "../api/retailAfterSales.api";
import { ApiClientError } from "../../../services/apiClientError";

vi.mock("../api/retailAfterSales.api", () => ({ retailAfterSalesApi: { create: vi.fn() } }));
const scope = { companyCode: "A", branchId: "B" };
const input = { type: "return" as const, orderId: "o1", items: [{ orderLineIndex: 0, quantity: 1, condition: "good" as const }], paymentMethod: "cash" as const, reason: "Unused" };
const setup = () => renderHook(() => useAfterSaleRequest(scope, "u1", "o1"));
beforeEach(() => { sessionStorage.clear(); vi.resetAllMocks(); });
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
