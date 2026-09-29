import type { RetailScope } from "../types";
import { ApiClientError } from "../../../services/apiClientError";
export type DraftCreationRequest = { idempotencyKey: string; input: Record<string, unknown>; editable?: boolean };
export type DraftUpdateRequest = DraftCreationRequest & { orderId: string };
const storageKey = (scope: RetailScope, userId: string, orderId?: string) => orderId
  ? `retail-update-draft:v1:${JSON.stringify([scope.companyCode, scope.branchId, userId, orderId])}`
  : `retail-create-draft:v1:${JSON.stringify([scope.companyCode, scope.branchId, userId])}`;
const canonical = (value: any): any => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object"
  ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;

export function prepareDraftCreation(scope: RetailScope, userId: string, input: object, orderId?: string): DraftCreationRequest {
  if (!userId) throw new Error("Thiếu tài khoản tạo đơn.");
  const key = storageKey(scope, userId, orderId);
  const raw = sessionStorage.getItem(key);
  if (raw) {
    const saved = JSON.parse(raw) as DraftCreationRequest;
    if (!saved.idempotencyKey || (!saved.editable && JSON.stringify(canonical(saved.input)) !== JSON.stringify(canonical(input)))) {
      throw new Error("Có yêu cầu tạo nháp chưa rõ kết quả với nội dung khác. Vui lòng đối chiếu đơn gốc trước khi tạo đơn mới.");
    }
    const request = JSON.parse(JSON.stringify({ idempotencyKey: saved.idempotencyKey, input })) as DraftCreationRequest;
    sessionStorage.setItem(key, JSON.stringify(request));
    return request;
  }
  const request = JSON.parse(JSON.stringify({ idempotencyKey: crypto.randomUUID(), input })) as DraftCreationRequest;
  sessionStorage.setItem(key, JSON.stringify(request));
  return request;
}

export function prepareDraftUpdate(scope: RetailScope, userId: string, orderId: string, input: object): DraftUpdateRequest {
  return { ...prepareDraftCreation(scope, userId, input, orderId), orderId };
}

export function allowRejectedDraftEdit(scope: RetailScope, userId: string, request: DraftCreationRequest, error: unknown, orderId?: string) {
  // Keep the SAME key even after rejection. If an earlier request actually
  // committed, the server will reject changed content instead of duplicating it.
  if (!(error instanceof ApiClientError) || error.status !== 400 || error.code === "UNKNOWN_API_ERROR") return;
  try {
    const key = storageKey(scope, userId, orderId);
    const saved = JSON.parse(sessionStorage.getItem(key) || "null");
    if (saved?.idempotencyKey === request.idempotencyKey && JSON.stringify(canonical(saved.input)) === JSON.stringify(canonical(request.input))) sessionStorage.setItem(key, JSON.stringify({ ...saved, editable: true }));
  } catch { /* preserve the original request */ }
}

export function clearDraftCreation(scope: RetailScope, userId: string, request: DraftCreationRequest, orderId?: string) {
  try {
    const key = storageKey(scope, userId, orderId);
    const saved = JSON.parse(sessionStorage.getItem(key) || "null");
    if (saved?.idempotencyKey === request.idempotencyKey && JSON.stringify(canonical(saved.input)) === JSON.stringify(canonical(request.input))) sessionStorage.removeItem(key);
  } catch { /* retain the original request rather than replace its key */ }
}
