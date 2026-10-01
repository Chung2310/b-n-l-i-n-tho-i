// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { resolveCheckoutIntent } from "./resolveCheckoutIntent";
import { createMemoryRetailOfflineQueue, createRetailOfflineOrder } from "./retailOfflineQueue";
import { retailOrdersApi } from "../api/retailOrders.api";
vi.mock("../api/retailOrders.api", () => ({ retailOrdersApi: { reconcileCheckout: vi.fn(), revokeCheckout: vi.fn(), confirm: vi.fn(), createDraft: vi.fn() } }));
const scope = { companyCode: "A", branchId: "B", userId: "u1" };
const draftCreation = { idempotencyKey: "create-key", input: { customerId: "c1", items: [] } };
const payload = { draftCreation, draftSaved: false, expectedGrandTotal: 100, payments: [{ method: "cash", amount: 100 }] };
const key = 'retail-create-draft:v1:["A","B","u1"]';
beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear(); sessionStorage.clear();
  Object.defineProperty(navigator, "locks", { configurable: true, value: { request: vi.fn(async (_key, _options, work) => work({})) } });
});
it("reconciles the full saved intent and clears only its draft after a lost revocation response", async () => {
  const queue = createMemoryRetailOfflineQueue(), item = createRetailOfflineOrder(scope, payload, "confirm-key"); await queue.put(item);
  localStorage.setItem(key, JSON.stringify(draftCreation));
  vi.mocked(retailOrdersApi.reconcileCheckout).mockResolvedValue({ status: "revoked" });
  expect(await resolveCheckoutIntent(scope, queue, item.id)).toEqual({ status: "revoked" });
  expect(retailOrdersApi.reconcileCheckout).toHaveBeenCalledWith(scope, { idempotencyKey: "confirm-key", payload });
  expect(localStorage.getItem(key)).toBeNull(); expect((await queue.list(scope))[0].status).toBe("revoked");
  expect(retailOrdersApi.confirm).not.toHaveBeenCalled(); expect(retailOrdersApi.createDraft).not.toHaveBeenCalled();
});
it.each(["not_found", "processing", "conflict"])("keeps an unresolved request after %s", async status => {
  const queue = createMemoryRetailOfflineQueue(), item = createRetailOfflineOrder(scope, payload, "confirm-key"); await queue.put(item);
  localStorage.setItem(key, JSON.stringify(draftCreation));
  vi.mocked(retailOrdersApi.reconcileCheckout).mockResolvedValue({ status });
  await resolveCheckoutIntent(scope, queue, item.id);
  expect((await queue.list(scope))[0]).toEqual(item); expect(localStorage.getItem(key)).not.toBeNull();
});
it("retains both copies when the revocation response is lost", async () => {
  const queue = createMemoryRetailOfflineQueue(), item = createRetailOfflineOrder(scope, payload, "confirm-key"); await queue.put(item);
  localStorage.setItem(key, JSON.stringify(draftCreation));
  vi.mocked(retailOrdersApi.revokeCheckout).mockRejectedValue(new TypeError("network"));
  await expect(resolveCheckoutIntent(scope, queue, item.id, true)).rejects.toThrow("network");
  expect((await queue.list(scope))[0]).toEqual(item); expect(localStorage.getItem(key)).not.toBeNull();
});
it("marks an already-posted request completed instead of revoked", async () => {
  const queue = createMemoryRetailOfflineQueue(), item = createRetailOfflineOrder(scope, payload, "confirm-key"); await queue.put(item);
  vi.mocked(retailOrdersApi.revokeCheckout).mockResolvedValue({ status: "completed", order: { _id: "o1" }, invoice: { _id: "i1", orderId: "o1" } });
  await resolveCheckoutIntent(scope, queue, item.id, true);
  expect((await queue.list(scope))[0].status).toBe("synced");
});
it("preserves another pending draft while resolving a terminal checkout", async () => {
  const queue = createMemoryRetailOfflineQueue(), item = createRetailOfflineOrder(scope, payload, "confirm-key"); await queue.put(item);
  const replacement = JSON.stringify({ ...draftCreation, idempotencyKey: "other-key" }); localStorage.setItem(key, replacement);
  vi.mocked(retailOrdersApi.revokeCheckout).mockResolvedValue({ status: "revoked" });
  await resolveCheckoutIntent(scope, queue, item.id, true);
  expect(localStorage.getItem(key)).toBe(replacement); expect((await queue.list(scope))[0].status).toBe("revoked");
});
it("does not apply a response to a replaced queue payload", async () => {
  const queue = createMemoryRetailOfflineQueue(), item = createRetailOfflineOrder(scope, payload, "confirm-key"); await queue.put(item);
  vi.mocked(retailOrdersApi.revokeCheckout).mockImplementation(async () => {
    await queue.update(item.id, { payload: { ...payload, expectedGrandTotal: 200 } }); return { status: "revoked" };
  });
  await expect(resolveCheckoutIntent(scope, queue, item.id, true)).rejects.toThrow("đã thay đổi");
  expect((await queue.list(scope))[0].status).toBe("pending");
});
it("does not resolve an item belonging to another operator", async () => {
  const queue = createMemoryRetailOfflineQueue(), item = createRetailOfflineOrder(scope, payload, "confirm-key"); await queue.put(item);
  await expect(resolveCheckoutIntent({ ...scope, userId: "other" }, queue, item.id, true)).rejects.toThrow("Không tìm thấy");
  expect(retailOrdersApi.revokeCheckout).not.toHaveBeenCalled();
});
it("keeps the queued request when storing the terminal status fails", async () => {
  const queue = createMemoryRetailOfflineQueue(), item = createRetailOfflineOrder(scope, payload, "confirm-key"); await queue.put(item);
  vi.mocked(retailOrdersApi.revokeCheckout).mockResolvedValue({ status: "revoked" });
  vi.spyOn(queue, "update").mockRejectedValue(new Error("disk"));
  await expect(resolveCheckoutIntent(scope, queue, item.id, true)).rejects.toThrow("disk");
  expect((await queue.list(scope))[0]).toEqual(item);
});
