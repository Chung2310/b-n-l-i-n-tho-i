// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { checkoutWithPersistedIntent } from "./checkoutIntent";
import { createMemoryRetailOfflineQueue } from "./retailOfflineQueue";
import { confirmOfflineOrder } from "./confirmOfflineOrder";
import { syncRetailOfflineQueue } from "./retailOfflineSync";
import { retailOrdersApi } from "../api/retailOrders.api";

vi.mock("../api/retailOrders.api", () => ({ retailOrdersApi: { checkout: vi.fn(), createDraft: vi.fn(), updateDraft: vi.fn(), confirm: vi.fn() } }));
const scope = { companyCode: "A", branchId: "B", userId: "u1" };
const input = { customerId: "c1", items: [{ productId: "p1", quantity: 1 }] };
const payments = [{ method: "cash" as const, amount: 100 }];
const result = { order: { _id: "o1" }, invoice: { _id: "i1", orderId: "o1" } } as any;
beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear(); sessionStorage.clear();
  Object.defineProperty(navigator, "locks", { configurable: true, value: { request: vi.fn(async (_key, _options, work) => work({})) } });
  vi.mocked(retailOrdersApi.checkout).mockResolvedValue(result);
  vi.mocked(retailOrdersApi.confirm).mockResolvedValue(result);
});

it("persists the full intent before submitting one direct checkout", async () => {
  const queue = createMemoryRetailOfflineQueue();
  vi.mocked(retailOrdersApi.checkout).mockImplementation(async (_scope, request) => {
    const rows = await queue.list(scope);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "syncing", payload: { input, payments, expectedGrandTotal: 100, posSessionId: "shift-1" } });
    expect(request).toMatchObject({ input, payments, expectedGrandTotal: 100, posSessionId: "shift-1", idempotencyKey: rows[0].idempotencyKey });
    return result;
  });

  await checkoutWithPersistedIntent(scope, queue, input, payments, 100, "shift-1");

  expect((await queue.list(scope))[0].status).toBe("synced");
  expect(retailOrdersApi.checkout).toHaveBeenCalledOnce();
  expect(retailOrdersApi.createDraft).not.toHaveBeenCalled();
  expect(retailOrdersApi.confirm).not.toHaveBeenCalled();
});

it("does not send if initial durable persistence fails", async () => {
  const queue = createMemoryRetailOfflineQueue();
  vi.spyOn(queue, "put").mockRejectedValue(new Error("quota"));
  await expect(checkoutWithPersistedIntent(scope, queue, input, payments, 100)).rejects.toThrow("quota");
  expect(retailOrdersApi.checkout).not.toHaveBeenCalled();
});

it("retries a lost response with the same checkout key and payload", async () => {
  const queue = createMemoryRetailOfflineQueue();
  vi.mocked(retailOrdersApi.checkout).mockRejectedValueOnce(new TypeError("network"));
  await expect(checkoutWithPersistedIntent(scope, queue, input, payments, 100)).rejects.toThrow("network");
  const saved = (await queue.list(scope))[0];
  await expect(checkoutWithPersistedIntent(scope, queue, input, [], 100)).rejects.toThrow("Còn yêu cầu");
  await confirmOfflineOrder(scope, saved, queue);
  const calls = vi.mocked(retailOrdersApi.checkout).mock.calls;
  expect(calls).toHaveLength(2);
  expect(calls[0]).toEqual(calls[1]);
});

it("reconciles a committed checkout after the local completion write fails", async () => {
  const queue = createMemoryRetailOfflineQueue(); const update = queue.update.bind(queue);
  vi.spyOn(queue, "update").mockImplementation((id, patch) => patch.status ? Promise.reject(new Error("closed tab")) : update(id, patch));
  await expect(checkoutWithPersistedIntent(scope, queue, input, payments, 100)).rejects.toThrow("closed tab");
  vi.mocked(queue.update).mockImplementation(update);
  const send = vi.fn();
  await syncRetailOfflineQueue(queue, scope, { check: vi.fn().mockResolvedValue({ status: "completed", ...result }), send });
  expect(send).not.toHaveBeenCalled();
  expect((await queue.list(scope))[0].status).toBe("synced");
});

it("retains a business rejection and blocks a replacement checkout", async () => {
  const queue = createMemoryRetailOfflineQueue();
  vi.mocked(retailOrdersApi.checkout).mockRejectedValueOnce(Object.assign(new Error("Sai giá"), { status: 409 }));
  await expect(checkoutWithPersistedIntent(scope, queue, input, payments, 100)).rejects.toThrow("Sai giá");
  await expect(checkoutWithPersistedIntent(scope, queue, input, payments, 110)).rejects.toThrow("Còn yêu cầu");
  expect(retailOrdersApi.checkout).toHaveBeenCalledOnce();
});

it("continues a legacy saved draft confirmation without using the new checkout path", async () => {
  const item: any = {
    id: "legacy-intent", ...scope, idempotencyKey: "legacy-key",
    payload: { draftSaved: true, draftId: "o1", draftVersion: 2, expectedGrandTotal: 100, payments },
    status: "failed", attempts: 1, createdAt: "2026-01-01", updatedAt: "2026-01-01",
  };
  await confirmOfflineOrder(scope, item);
  expect(retailOrdersApi.confirm).toHaveBeenCalledWith(scope, "o1", {
    expectedVersion: 2, expectedGrandTotal: 100, payments, idempotencyKey: "legacy-key", posSessionId: undefined,
  });
  expect(retailOrdersApi.checkout).not.toHaveBeenCalled();
});

it("allows a fresh checkout after the old intent was durably revoked", async () => {
  const queue = createMemoryRetailOfflineQueue();
  await queue.put({ id: "old", ...scope, idempotencyKey: "revoked-key", payload: {}, status: "revoked", attempts: 1, createdAt: "2026-01-01", updatedAt: "2026-01-01" });
  await checkoutWithPersistedIntent(scope, queue, input, payments, 100);
  const rows = await queue.list(scope);
  expect(rows).toHaveLength(2); expect(rows[0].status).toBe("revoked"); expect(rows[1].status).toBe("synced");
  expect(rows[1].idempotencyKey).not.toBe("revoked-key");
});
