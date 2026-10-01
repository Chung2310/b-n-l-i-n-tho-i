import { describe, expect, it, vi } from "vitest";
import { createMemoryRetailOfflineQueue, createRetailOfflineOrder } from "./retailOfflineQueue";
import { syncRetailOfflineQueue, isRetailNetworkFailure } from "./retailOfflineSync";
describe("offline sync", () => {
  it("checks idempotency before resending ambiguous syncing items", async () => { const queue = createMemoryRetailOfflineQueue(), item = { ...createRetailOfflineOrder({ companyCode: "A", branchId: "B", userId: "u" }, {}, "key", new Date()), status: "syncing" as const }; await queue.put(item); const check = vi.fn().mockResolvedValue({ status: "completed", order: { _id: "o1" }, invoice: { _id: "i1" } }), send = vi.fn(); const result = await syncRetailOfflineQueue(queue, { companyCode: "A", branchId: "B", userId: "u" }, { check, send }); expect(send).not.toHaveBeenCalled(); expect(result[0]).toMatchObject({ status: "synced", orderId: "o1", invoiceId: "i1" }); });
  it("keeps an ambiguous item syncing when the idempotency check is offline", async () => { const queue = createMemoryRetailOfflineQueue(), item = { ...createRetailOfflineOrder({ companyCode: "A", branchId: "B", userId: "u" }, {}, "key", new Date()), status: "syncing" as const }; await queue.put(item); const send = vi.fn(); await syncRetailOfflineQueue(queue, { companyCode: "A", branchId: "B", userId: "u" }, { check: vi.fn().mockRejectedValue(new TypeError("Failed to fetch")), send }); expect(send).not.toHaveBeenCalled(); expect((await queue.list({ companyCode: "A", branchId: "B", userId: "u" }))[0].status).toBe("syncing"); });
});
it("queues only network failures, not business errors", () => { expect(isRetailNetworkFailure(new TypeError("Failed to fetch"))).toBe(true); expect(isRetailNetworkFailure(Object.assign(new Error("Sai giá"), { status: 409 }))).toBe(false); });

it.each(["processing", "unknown", undefined])("never resends an ambiguous status: %s", async status => {
  const scope = { companyCode: "A", branchId: "B", userId: "u" }, queue = createMemoryRetailOfflineQueue();
  const item = { ...createRetailOfflineOrder(scope, {}, "key"), status: "syncing" as const }; await queue.put(item);
  const send = vi.fn(); await syncRetailOfflineQueue(queue, scope, { check: vi.fn().mockResolvedValue({ status }), send });
  expect(send).not.toHaveBeenCalled(); expect((await queue.list(scope))[0].status).toBe("syncing");
});
it("retains completed responses with missing or mismatched evidence", async () => {
  const scope = { companyCode: "A", branchId: "B", userId: "u" }, queue = createMemoryRetailOfflineQueue();
  const item = { ...createRetailOfflineOrder(scope, { draftId: "o1" }, "key"), status: "syncing" as const }; await queue.put(item);
  const send = vi.fn(); await syncRetailOfflineQueue(queue, scope, { check: vi.fn().mockResolvedValue({ status: "completed", order: { _id: "wrong" }, invoice: { _id: "i1" } }), send });
  expect(send).not.toHaveBeenCalled(); expect((await queue.list(scope))[0].status).toBe("syncing");
});
it("resends only the original intent after an explicit not_found", async () => {
  const scope = { companyCode: "A", branchId: "B", userId: "u" }, queue = createMemoryRetailOfflineQueue();
  const item = { ...createRetailOfflineOrder(scope, { draftId: "o1" }, "key"), status: "syncing" as const }; await queue.put(item);
  const send = vi.fn().mockResolvedValue({ order: { _id: "o1" }, invoice: { _id: "i1" } });
  await syncRetailOfflineQueue(queue, scope, { check: vi.fn().mockResolvedValue({ status: "not_found" }), send });
  expect(send).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: "key", payload: item.payload }));
  expect((await queue.list(scope))[0].status).toBe("synced");
});

it("stops replaying a durably revoked confirmation", async () => {
  const scope = { companyCode: "A", branchId: "B", userId: "u" }, queue = createMemoryRetailOfflineQueue();
  const item = { ...createRetailOfflineOrder(scope, {}, "key"), status: "syncing" as const }; await queue.put(item);
  const send = vi.fn(); await syncRetailOfflineQueue(queue, scope, { check: vi.fn().mockResolvedValue({ status: "revoked" }), send });
  expect(send).not.toHaveBeenCalled(); expect((await queue.list(scope))[0].status).toBe("revoked");
});
