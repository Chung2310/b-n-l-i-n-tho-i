// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { confirmOfflineOrder } from "./confirmOfflineOrder";
import { retailOrdersApi } from "../api/retailOrders.api";
import { createMemoryRetailOfflineQueue, createRetailOfflineOrder } from "./retailOfflineQueue";
import { syncRetailOfflineQueue } from "./retailOfflineSync";
vi.mock("../api/retailOrders.api", () => ({ retailOrdersApi: { confirm: vi.fn(), createDraft: vi.fn(), updateDraft: vi.fn(), detail: vi.fn() } }));
const scope = { companyCode: "A", branchId: "B", userId: "u1" };
const payload = { draftId: "o1", draftVersion: 3, draftSaved: true, expectedGrandTotal: 400, payments: [{ method: "cash", amount: 400 }] };
beforeEach(() => { vi.resetAllMocks(); vi.mocked(retailOrdersApi.confirm).mockImplementation(async (_scope, id) => ({ order: { _id: id }, invoice: { _id: "i1", orderId: id } }) as any); localStorage.clear(); sessionStorage.clear(); Object.defineProperty(navigator, "locks", { configurable: true, value: { request: vi.fn(async (_key, _options, work) => work({})) } }); });

it("sends the persisted version and key without loading a newer draft", async () => {
  const item = createRetailOfflineOrder(scope, payload, "key");
  await confirmOfflineOrder(scope, item);
  expect(retailOrdersApi.confirm).toHaveBeenCalledWith(scope, "o1", { expectedVersion: 3, expectedGrandTotal: 400, payments: payload.payments, idempotencyKey: "key" });
  expect(retailOrdersApi.detail).not.toHaveBeenCalled();
  expect(retailOrdersApi.createDraft).not.toHaveBeenCalled();
});

it.each([
  { draftSaved: undefined }, { draftSaved: false }, { draftVersion: undefined },
  { draftVersion: "3" }, { draftVersion: -1 }, { draftId: undefined },
])("retains legacy or uncertain draft saves for reconciliation: %j", async (extra) => {
  const item = createRetailOfflineOrder(scope, { ...payload, ...extra }, "key");
  const queue = createMemoryRetailOfflineQueue(); await queue.put(item);
  await syncRetailOfflineQueue(queue, scope, { check: vi.fn(), send: (next) => confirmOfflineOrder(scope, next) });
  const saved = (await queue.list(scope))[0];
  expect(saved).toMatchObject({ status: "failed", idempotencyKey: "key", payload: item.payload });
  expect(retailOrdersApi.confirm).not.toHaveBeenCalled();
  expect(retailOrdersApi.createDraft).not.toHaveBeenCalled();
});

it("keeps a conflicting version and request intact instead of rebasing", async () => {
  const queue = createMemoryRetailOfflineQueue(), item = createRetailOfflineOrder(scope, payload, "key");
  await queue.put(item);
  vi.mocked(retailOrdersApi.confirm).mockRejectedValue(new Error("ORDER_VERSION_CONFLICT"));
  await syncRetailOfflineQueue(queue, scope, { check: vi.fn(), send: (next) => confirmOfflineOrder(scope, next) });
  expect((await queue.list(scope))[0]).toMatchObject({ status: "failed", payload, idempotencyKey: "key" });
  expect(retailOrdersApi.detail).not.toHaveBeenCalled();
});

it("rejects a queued request belonging to another operator or branch", async () => {
  const item = createRetailOfflineOrder(scope, payload, "key");
  await expect(confirmOfflineOrder({ ...scope, branchId: "OTHER" }, item)).rejects.toThrow("không thuộc");
  await expect(confirmOfflineOrder({ ...scope, userId: "other" }, item)).rejects.toThrow("không thuộc");
  expect(retailOrdersApi.confirm).not.toHaveBeenCalled();
});

it("recovers an uncertain keyed creation and saves its version before confirmation", async () => {
  const queue = createMemoryRetailOfflineQueue();
  const draftCreation = { idempotencyKey: "create-key", input: { customerId: "c1", items: [] } };
  const item = createRetailOfflineOrder(scope, { ...payload, draftId: undefined, draftSaved: false, draftCreation }, "confirm-key");
  await queue.put(item);
  vi.mocked(retailOrdersApi.createDraft).mockResolvedValue({ _id: "recovered", version: 0 } as any);
  vi.mocked(retailOrdersApi.confirm).mockRejectedValueOnce(new TypeError("network"));
  await expect(confirmOfflineOrder(scope, item, queue)).rejects.toThrow("network");
  const saved = (await queue.list(scope))[0];
  expect(saved.payload).toMatchObject({ draftId: "recovered", draftVersion: 0, draftSaved: true });
  await confirmOfflineOrder(scope, saved, queue);
  expect(retailOrdersApi.createDraft).toHaveBeenCalledTimes(1);
  expect(retailOrdersApi.createDraft).toHaveBeenCalledWith(scope, { ...draftCreation.input, idempotencyKey: "create-key" });
  expect(vi.mocked(retailOrdersApi.confirm).mock.calls[1][2]).toMatchObject({ expectedVersion: 0, idempotencyKey: "confirm-key" });
});

it("does not confirm if the recovered draft cannot be saved to the queue", async () => {
  const queue = createMemoryRetailOfflineQueue();
  const item = createRetailOfflineOrder(scope, { ...payload, draftId: undefined, draftSaved: false, draftCreation: { idempotencyKey: "create-key", input: {} } }, "confirm-key");
  vi.mocked(retailOrdersApi.createDraft).mockResolvedValue({ _id: "recovered", version: 0 } as any);
  vi.spyOn(queue, "update").mockRejectedValue(new Error("storage failed"));
  await expect(confirmOfflineOrder(scope, item, queue)).rejects.toThrow("storage failed");
  expect(retailOrdersApi.confirm).not.toHaveBeenCalled();
});

it("recovers an uncertain update using its original version/key and persists before confirm", async () => {
  const queue = createMemoryRetailOfflineQueue();
  const draftUpdate = { orderId: "o1", idempotencyKey: "update-key", input: { version: 2, items: [] } };
  const item = createRetailOfflineOrder(scope, { ...payload, draftSaved: false, draftUpdate }, "confirm-key");
  await queue.put(item);
  vi.mocked(retailOrdersApi.updateDraft).mockResolvedValue({ _id: "o1", version: 3 } as any);
  vi.mocked(retailOrdersApi.confirm).mockRejectedValueOnce(new Error("network"));
  await expect(confirmOfflineOrder(scope, item, queue)).rejects.toThrow("network");
  const saved = (await queue.list(scope))[0];
  expect(saved.payload).toMatchObject({ draftSaved: true, draftVersion: 3 });
  await confirmOfflineOrder(scope, saved, queue);
  expect(retailOrdersApi.updateDraft).toHaveBeenCalledTimes(1);
  expect(retailOrdersApi.updateDraft).toHaveBeenCalledWith(scope, "o1", { ...draftUpdate.input, idempotencyKey: "update-key" });
  expect(retailOrdersApi.createDraft).not.toHaveBeenCalled();
});

it("preserves both queue and shared request when identities differ", async () => {
  const queue = createMemoryRetailOfflineQueue();
  const request = { idempotencyKey: "queued", input: { customerId: "c1" } };
  const item = createRetailOfflineOrder(scope, { ...payload, draftId: undefined, draftSaved: false, draftCreation: request }, "confirm-key");
  await queue.put(item);
  const raw = JSON.stringify({ ...request, idempotencyKey: "other-tab" });
  localStorage.setItem('retail-create-draft:v1:["A","B","u1"]', raw);
  await expect(confirmOfflineOrder(scope, item, queue)).rejects.toThrow("khác bản nháp");
  expect(retailOrdersApi.createDraft).not.toHaveBeenCalled();
  expect(retailOrdersApi.confirm).not.toHaveBeenCalled();
  expect((await queue.list(scope))[0].payload).toEqual(item.payload);
  expect(localStorage.getItem('retail-create-draft:v1:["A","B","u1"]')).toBe(raw);
});

it.each(["create", "update"])("retains the queued %s request after a malformed response", async kind => {
  const queue = createMemoryRetailOfflineQueue();
  const request = { idempotencyKey: "draft-key", input: { version: 2 }, orderId: "o1" };
  const pending = kind === "create" ? { draftId: undefined, draftCreation: request } : { draftId: "o1", draftUpdate: request };
  const item = createRetailOfflineOrder(scope, { ...payload, ...pending, draftSaved: false }, "confirm-key");
  await queue.put(item);
  vi.mocked(retailOrdersApi.createDraft).mockResolvedValue({ _id: "o1" } as any);
  vi.mocked(retailOrdersApi.updateDraft).mockResolvedValue({ _id: "wrong", version: 3 } as any);
  await expect(confirmOfflineOrder(scope, item, queue)).rejects.toThrow("Phản hồi bản nháp không khớp");
  expect((await queue.list(scope))[0].payload).toEqual(item.payload);
  expect(retailOrdersApi.confirm).not.toHaveBeenCalled();
  expect(localStorage.length).toBe(1);
});
