import { describe, expect, it, vi } from "vitest";
import { createIndexedDbRetailOfflineQueue, createMemoryRetailOfflineQueue, createRetailOfflineOrder } from "./retailOfflineQueue";
describe("retail offline queue", () => {
  it("isolates scope and atomically claims FIFO", async () => { const queue = createMemoryRetailOfflineQueue(); const a = createRetailOfflineOrder({ companyCode: "A", branchId: "B1", userId: "u1" }, { n: 1 }, "key-1", new Date("2026-01-01")); const b = createRetailOfflineOrder({ companyCode: "A", branchId: "B1", userId: "u1" }, { n: 2 }, "key-2", new Date("2026-01-02")); await queue.put(b); await queue.put(a); await queue.put(createRetailOfflineOrder({ companyCode: "A", branchId: "B2", userId: "u1" }, {}, "other", new Date())); expect((await queue.list({ companyCode: "A", branchId: "B1", userId: "u1" })).map((x) => x.idempotencyKey)).toEqual(["key-1", "key-2"]); expect((await queue.claimNext({ companyCode: "A", branchId: "B1", userId: "u1" }))?.id).toBe(a.id); expect((await queue.claimNext({ companyCode: "A", branchId: "B1", userId: "u1" }))?.id).toBe(b.id); expect(await queue.claimNext({ companyCode: "A", branchId: "B1", userId: "u1" })).toBeNull(); });
  it("keeps the supplied idempotency key stable across updates", async () => { const queue = createMemoryRetailOfflineQueue(), item = createRetailOfflineOrder({ companyCode: "A", branchId: "B", userId: "u" }, {}, "stable-key", new Date()); await queue.put(item); await queue.update(item.id, { status: "failed", attempts: 2 }); expect((await queue.list({ companyCode: "A", branchId: "B", userId: "u" }))[0].idempotencyKey).toBe("stable-key"); });
});

function controlledDatabase(rows: any[] = []) {
  const request = (result: any) => { const req: any = { result }; queueMicrotask(() => req.onsuccess?.()); return req; };
  const store = { put: vi.fn(() => request(undefined)), delete: vi.fn(() => request(undefined)), getAll: vi.fn(() => request(rows)), get: vi.fn(() => request(rows[0])) };
  const tx: any = { objectStore: () => store, abort: () => tx.onabort?.(), error: null };
  const database = { transaction: () => tx };
  const factory = { open: () => request(database) } as any;
  return { queue: createIndexedDbRetailOfflineQueue(factory), tx, store };
}
it("does not resolve IndexedDB put at request success before transaction commit", async () => {
  const { queue, tx, store } = controlledDatabase();
  const item = createRetailOfflineOrder({ companyCode: "A", branchId: "B", userId: "u" }, {}, "key");
  let finished = false;
  const writing = queue.put(item).then(() => { finished = true; });
  await vi.waitFor(() => expect(store.put).toHaveBeenCalled());
  expect(finished).toBe(false); tx.oncomplete(); await writing; expect(finished).toBe(true);
});
it("rejects a transaction abort even after its put request succeeded", async () => {
  const { queue, tx, store } = controlledDatabase();
  const item = createRetailOfflineOrder({ companyCode: "A", branchId: "B", userId: "u" }, {}, "key");
  const writing = queue.put(item); const rejected = expect(writing).rejects.toThrow("disk full");
  await vi.waitFor(() => expect(store.put).toHaveBeenCalled());
  tx.error = new Error("disk full"); tx.onabort(); await rejected;
});
it("does not release a claimed queue item until its claim transaction commits", async () => {
  const scope = { companyCode: "A", branchId: "B", userId: "u" };
  const item = createRetailOfflineOrder(scope, {}, "key");
  const { queue, tx, store } = controlledDatabase([item]);
  let finished = false; const claiming = queue.claimNext(scope).then(row => { finished = true; return row; });
  await vi.waitFor(() => expect(store.put).toHaveBeenCalled());
  expect(finished).toBe(false); tx.oncomplete();
  expect(await claiming).toMatchObject({ idempotencyKey: "key", status: "syncing" });
});
it("rejects a missing queue row instead of pretending to save its recovered version", async () => {
  const { queue } = controlledDatabase();
  await expect(queue.update("missing", { payload: { draftSaved: true } })).rejects.toThrow("Không tìm thấy");
  await expect(createMemoryRetailOfflineQueue().update("missing", {})).rejects.toThrow("Không tìm thấy");
});
