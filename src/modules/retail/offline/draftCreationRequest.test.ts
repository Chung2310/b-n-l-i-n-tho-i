// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { withDraftRequestLock, retainDraftRequest, readDraftRequest, listDraftRequests, prepareDraftCreation, prepareDraftUpdate, clearDraftCreation, allowRejectedDraftEdit } from "./draftCreationRequest";
import { ApiClientError } from "../../../services/apiClientError";
const scope = { companyCode: "A", branchId: "B" };
const input = { customerId: "c1", items: [{ productId: "p1", quantity: 1 }], shippingFee: 0 };
beforeEach(() => { sessionStorage.clear(); localStorage.clear(); });
afterEach(() => vi.restoreAllMocks());

it("retains an immutable creation key and content across retries and reordered properties", () => {
  const first = prepareDraftCreation(scope, "u1", input);
  const next = prepareDraftCreation(scope, "u1", { shippingFee: 0, items: [{ quantity: 1, productId: "p1" }], customerId: "c1" });
  expect(next).toEqual(first);
  expect(() => prepareDraftCreation(scope, "u1", { ...input, shippingFee: 1 })).toThrow("nội dung khác");
  expect(prepareDraftCreation(scope, "u1", input)).toEqual(first);
});

it("isolates branch/operator and clears only the matching completed request", () => {
  const first = prepareDraftCreation(scope, "u1", input);
  const other = prepareDraftCreation(scope, "u2", input);
  const branch = prepareDraftCreation({ ...scope, branchId: "OTHER" }, "u1", input);
  expect(new Set([first.idempotencyKey, other.idempotencyKey, branch.idempotencyKey]).size).toBe(3);
  clearDraftCreation(scope, "u1", other);
  expect(prepareDraftCreation(scope, "u1", input)).toEqual(first);
  clearDraftCreation(scope, "u1", first);
  expect(prepareDraftCreation(scope, "u1", input).idempotencyKey).not.toBe(first.idempotencyKey);
});

it("fails before sending if browser storage is unavailable or corrupt", () => {
  const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
  expect(() => prepareDraftCreation(scope, "u1", input)).toThrow("quota");
  set.mockRestore();
  sessionStorage.setItem('retail-create-draft:v1:["A","B","u1"]', "broken");
  expect(() => prepareDraftCreation(scope, "u1", input)).toThrow();
});

it("allows correction after explicit rejection while retaining the same key", () => {
  const first = prepareDraftCreation(scope, "u1", input);
  allowRejectedDraftEdit(scope, "u1", first, new ApiClientError({ status: 400, code: "API_ERROR", message: "Invalid quantity" }));
  const next = prepareDraftCreation(scope, "u1", { ...input, shippingFee: 10 });
  expect(next.idempotencyKey).toBe(first.idempotencyKey);
  expect(next.input.shippingFee).toBe(10);
  clearDraftCreation(scope, "u1", first);
  allowRejectedDraftEdit(scope, "u1", first, new ApiClientError({ status: 400, code: "API_ERROR", message: "Old response" }));
  expect(() => prepareDraftCreation(scope, "u1", input)).toThrow("nội dung khác");
});

it.each([new TypeError("network"), new ApiClientError({ status: 409, code: "ORDER_IDEMPOTENCY_CONFLICT", message: "Conflict" }), new ApiClientError({ status: 400, code: "UNKNOWN_API_ERROR", message: "Unknown" })])("does not unlock unknown/conflicting outcomes: %s", (error) => {
  const first = prepareDraftCreation(scope, "u1", input);
  allowRejectedDraftEdit(scope, "u1", first, error);
  expect(() => prepareDraftCreation(scope, "u1", { ...input, shippingFee: 10 })).toThrow("nội dung khác");
});

it("update requests isolate orders and retain the original version", () => {
  const first = prepareDraftUpdate(scope, "u1", "o1", { ...input, version: 1 });
  expect(prepareDraftUpdate(scope, "u1", "o1", { ...input, version: 1 })).toEqual(first);
  expect(prepareDraftUpdate(scope, "u1", "o2", { ...input, version: 1 }).idempotencyKey).not.toBe(first.idempotencyKey);
  expect(() => prepareDraftUpdate(scope, "u1", "o1", { ...input, version: 2 })).toThrow();
});

const key = 'retail-create-draft:v1:["A","B","u1"]';
it("recovers after the tab session is lost", () => {
  const first = prepareDraftCreation(scope, "u1", input);
  sessionStorage.clear();
  expect(readDraftRequest(scope, "u1")).toEqual(first);
  expect(prepareDraftCreation(scope, "u1", input)).toEqual(first);
});
it("migrates legacy only after verifying shared storage", () => {
  const old = { idempotencyKey: "legacy", input };
  sessionStorage.setItem(key, JSON.stringify(old));
  expect(prepareDraftCreation(scope, "u1", input)).toEqual(old);
  expect(sessionStorage.getItem(key)).toBeNull();
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual(old);
});
it("retains legacy on a failed shared write", () => {
  const raw = JSON.stringify({ idempotencyKey: "legacy", input });
  sessionStorage.setItem(key, raw);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {});
  expect(() => prepareDraftCreation(scope, "u1", input)).toThrow("Không lưu");
  expect(sessionStorage.getItem(key)).toBe(raw);
});
it("preserves conflicting shared and legacy identities", () => {
  const first = prepareDraftCreation(scope, "u1", input);
  const raw = JSON.stringify({ ...first, idempotencyKey: "legacy" });
  sessionStorage.setItem(key, raw);
  expect(() => prepareDraftCreation(scope, "u1", input)).toThrow("khác bản lưu chung");
  expect(() => retainDraftRequest(scope, "u1", first)).toThrow();
  expect(sessionStorage.getItem(key)).toBe(raw);
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual(first);
});
it.each(["", "null", "[]", '{"idempotencyKey":7,"input":{}}', '{"idempotencyKey":"k","input":[]}', '{"idempotencyKey":"k","input":{},"editable":"yes"}'])("blocks corrupt shared records: %s", raw => {
  localStorage.setItem(key, raw);
  expect(() => prepareDraftCreation(scope, "u1", input)).toThrow();
  expect(localStorage.getItem(key)).toBe(raw);
});
it("a legacy editable flag cannot unlock a shared attempt", () => {
  const first = prepareDraftCreation(scope, "u1", input);
  sessionStorage.setItem(key, JSON.stringify({ ...first, editable: true }));
  expect(() => prepareDraftCreation(scope, "u1", { ...input, shippingFee: 2 })).toThrow();
});
it("cleanup preserves a replacement shared request", () => {
  const first = prepareDraftCreation(scope, "u1", input);
  sessionStorage.setItem(key, JSON.stringify(first));
  localStorage.setItem(key, JSON.stringify({ ...first, idempotencyKey: "replacement" }));
  clearDraftCreation(scope, "u1", first);
  expect(sessionStorage.getItem(key)).toBeNull();
  expect(JSON.parse(localStorage.getItem(key)!).idempotencyKey).toBe("replacement");
});
it("lists only the current scope and retains the saved update version", () => {
  prepareDraftCreation(scope, "u1", input);
  prepareDraftUpdate(scope, "u1", "o1", { ...input, version: 7 });
  prepareDraftCreation(scope, "u2", input);
  expect(listDraftRequests(scope, "u1")).toHaveLength(2);
  expect(listDraftRequests(scope, "u1")[1]).toMatchObject({ orderId: "o1", request: { input: { version: 7 } } });
});
it("excludes another tab until network work completes", async () => {
  let held = false;
  Object.defineProperty(navigator, "locks", { configurable: true, value: { request: vi.fn(async (_key, _options, work) => {
    if (held) return work(null);
    held = true; try { return await work({}); } finally { held = false; }
  }) } });
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const first = withDraftRequestLock(scope, "u1", () => gate);
  const send = vi.fn();
  await expect(withDraftRequestLock(scope, "u1", send)).rejects.toThrow("tab khác");
  expect(send).not.toHaveBeenCalled(); release(); await first;
  await withDraftRequestLock(scope, "u1", send); expect(send).toHaveBeenCalledTimes(1);
});
it("fails closed without Web Locks", async () => {
  Object.defineProperty(navigator, "locks", { configurable: true, value: undefined });
  const send = vi.fn();
  await expect(withDraftRequestLock(scope, "u1", send)).rejects.toThrow("Không khóa");
  expect(send).not.toHaveBeenCalled();
});
