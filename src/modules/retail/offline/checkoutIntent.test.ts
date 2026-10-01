// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { checkoutWithPersistedIntent } from "./checkoutIntent";
import { createMemoryRetailOfflineQueue } from "./retailOfflineQueue";
import { confirmOfflineOrder } from "./confirmOfflineOrder";
import { syncRetailOfflineQueue } from "./retailOfflineSync";
import { retailOrdersApi } from "../api/retailOrders.api";
vi.mock("../api/retailOrders.api", () => ({ retailOrdersApi: { createDraft: vi.fn(), updateDraft: vi.fn(), confirm: vi.fn() } }));
const scope = { companyCode: "A", branchId: "B", userId: "u1" };
const input = { customerId: "c1", items: [{ productId: "p1", quantity: 1 }] };
const payments = [{ method: "cash" as const, amount: 100 }];
const result = { order: { _id: "o1" }, invoice: { _id: "i1", orderId: "o1" } } as any;
beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear(); sessionStorage.clear();
  Object.defineProperty(navigator, "locks", { configurable: true, value: { request: vi.fn(async (_key, _options, work) => work({})) } });
  vi.mocked(retailOrdersApi.createDraft).mockResolvedValue({ _id: "o1", version: 2 } as any);
  vi.mocked(retailOrdersApi.updateDraft).mockResolvedValue({ _id: "o1", version: 2 } as any);
  vi.mocked(retailOrdersApi.confirm).mockResolvedValue(result);
});
it("commits the full intent before saving draft, then commits version before confirm", async () => {
  const queue = createMemoryRetailOfflineQueue();
  vi.mocked(retailOrdersApi.createDraft).mockImplementation(async (_scope, request) => {
    const rows = await queue.list(scope);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "syncing", payload: { payments, expectedGrandTotal: 100, draftSaved: false, draftCreation: { idempotencyKey: (request as any).idempotencyKey, input } } });
    return { _id: "o1", version: 2 } as any;
  });
  vi.mocked(retailOrdersApi.confirm).mockImplementation(async (_scope, id, request) => {
    expect((await queue.list(scope))[0]).toMatchObject({ idempotencyKey: request.idempotencyKey, payload: { draftSaved: true, draftId: id, draftVersion: 2, payments } });
    return result;
  });
  await checkoutWithPersistedIntent(scope, queue, input, payments, 100);
  expect((await queue.list(scope))[0].status).toBe("synced");
});
it("does not send if initial durable persistence fails", async () => {
  const queue = createMemoryRetailOfflineQueue();
  vi.spyOn(queue, "put").mockRejectedValue(new Error("quota"));
  await expect(checkoutWithPersistedIntent(scope, queue, input, payments, 100)).rejects.toThrow("quota");
  expect(retailOrdersApi.createDraft).not.toHaveBeenCalled(); expect(retailOrdersApi.confirm).not.toHaveBeenCalled();
});
it("recovers after a lost draft response without rotating either key", async () => {
  const queue = createMemoryRetailOfflineQueue();
  vi.mocked(retailOrdersApi.createDraft).mockRejectedValueOnce(new TypeError("network"));
  await expect(checkoutWithPersistedIntent(scope, queue, input, payments, 100)).rejects.toThrow("network");
  const saved = (await queue.list(scope))[0];
  await expect(checkoutWithPersistedIntent(scope, queue, input, [], 100)).rejects.toThrow("Còn yêu cầu");
  await confirmOfflineOrder(scope, saved, queue);
  const calls = vi.mocked(retailOrdersApi.createDraft).mock.calls;
  expect(calls[0][1]).toEqual(calls[1][1]);
  expect(retailOrdersApi.confirm).toHaveBeenCalledWith(scope, "o1", { expectedVersion: 2, expectedGrandTotal: 100, payments, idempotencyKey: saved.idempotencyKey });
});
it("retains the committed version if confirmation loses its response", async () => {
  const queue = createMemoryRetailOfflineQueue();
  vi.mocked(retailOrdersApi.confirm).mockRejectedValueOnce(new TypeError("network"));
  await expect(checkoutWithPersistedIntent(scope, queue, input, payments, 100)).rejects.toThrow();
  const saved = (await queue.list(scope))[0];
  await confirmOfflineOrder(scope, saved, queue);
  expect(retailOrdersApi.createDraft).toHaveBeenCalledTimes(1);
  expect(vi.mocked(retailOrdersApi.confirm).mock.calls[0]).toEqual(vi.mocked(retailOrdersApi.confirm).mock.calls[1]);
});
it("never confirms when the recovered version cannot commit", async () => {
  const queue = createMemoryRetailOfflineQueue();
  vi.spyOn(queue, "update").mockRejectedValue(new Error("commit failed"));
  await expect(checkoutWithPersistedIntent(scope, queue, input, payments, 100)).rejects.toThrow("commit failed");
  expect(retailOrdersApi.confirm).not.toHaveBeenCalled();
  expect((await queue.list(scope))[0]).toMatchObject({ status: "syncing", payload: { draftSaved: false } });
});
it("reconciles a committed confirmation after the local completion write fails", async () => {
  const queue = createMemoryRetailOfflineQueue(); const update = queue.update.bind(queue);
  vi.spyOn(queue, "update").mockImplementation((id, patch) => patch.status ? Promise.reject(new Error("closed tab")) : update(id, patch));
  await expect(checkoutWithPersistedIntent(scope, queue, input, payments, 100)).rejects.toThrow("closed tab");
  vi.mocked(queue.update).mockImplementation(update);
  const send = vi.fn();
  await syncRetailOfflineQueue(queue, scope, { check: vi.fn().mockResolvedValue({ status: "completed", ...result }), send });
  expect(send).not.toHaveBeenCalled(); expect((await queue.list(scope))[0].status).toBe("synced");
});
it("retains an explicit business rejection and blocks a replacement checkout", async () => {
  const queue = createMemoryRetailOfflineQueue();
  vi.mocked(retailOrdersApi.confirm).mockRejectedValue(Object.assign(new Error("Sai giá"), { status: 409 }));
  await expect(checkoutWithPersistedIntent(scope, queue, input, payments, 100)).rejects.toThrow("Sai giá");
  await expect(checkoutWithPersistedIntent(scope, queue, input, payments, 110)).rejects.toThrow("Còn yêu cầu");
  expect(retailOrdersApi.createDraft).toHaveBeenCalledTimes(1);
});
it("persists the original update version before the first update request", async () => {
  const queue = createMemoryRetailOfflineQueue();
  vi.mocked(retailOrdersApi.updateDraft).mockImplementation(async () => {
    expect((await queue.list(scope))[0].payload).toMatchObject({ draftUpdate: { input: { version: 1 } } });
    return { _id: "o1", version: 2 } as any;
  });
  await checkoutWithPersistedIntent(scope, queue, input, payments, 100, { _id: "o1", version: 1 });
  expect(retailOrdersApi.createDraft).not.toHaveBeenCalled();
});

it("allows a fresh checkout after the old intent was durably revoked", async () => {
  const queue = createMemoryRetailOfflineQueue();
  await queue.put({ id: "old", ...scope, idempotencyKey: "revoked-key", payload: {}, status: "revoked", attempts: 1, createdAt: "2026-01-01", updatedAt: "2026-01-01" });
  await checkoutWithPersistedIntent(scope, queue, input, payments, 100);
  const rows = await queue.list(scope);
  expect(rows).toHaveLength(2); expect(rows[0].status).toBe("revoked"); expect(rows[1].status).toBe("synced");
  expect(rows[1].idempotencyKey).not.toBe("revoked-key");
});
