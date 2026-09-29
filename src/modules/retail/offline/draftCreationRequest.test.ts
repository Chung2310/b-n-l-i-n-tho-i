// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { prepareDraftCreation, prepareDraftUpdate, clearDraftCreation, allowRejectedDraftEdit } from "./draftCreationRequest";
import { ApiClientError } from "../../../services/apiClientError";
const scope = { companyCode: "A", branchId: "B" };
const input = { customerId: "c1", items: [{ productId: "p1", quantity: 1 }], shippingFee: 0 };
beforeEach(() => sessionStorage.clear());
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
