import { useEffect, useRef, useState } from "react";
import { ApiClientError } from "../../../services/apiClientError";
import { retailAfterSalesApi } from "../api/retailAfterSales.api";
import type { RetailAfterSaleInput, RetailScope } from "../types";

// Session storage survives modal remounts/reloads, without sharing customer data
// with a different operator, branch, company or order.
export function useAfterSaleRequest(scope: RetailScope | null, actorId: string, orderId: string) {
  const identity = JSON.stringify([scope?.companyCode, scope?.branchId, actorId, orderId]);
  const origin = useRef(identity);
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const storageKey = `retail-after-sale-pending:v1:${identity}`;
  const [initial] = useState(() => {
    try {
      const value = sessionStorage.getItem(storageKey);
      const pending = value ? JSON.parse(value) as RetailAfterSaleInput : null;
      if (pending && (pending.orderId !== orderId || !pending.idempotencyKey ||
          !["return", "buyback"].includes(pending.type) || !Array.isArray(pending.items))) throw new Error();
      return { pending, error: "" };
    } catch {
      return { pending: null, error: "Không đọc được yêu cầu đang chờ. Vui lòng đối chiếu chứng từ trước khi tiếp tục." };
    }
  });
  const [pending, setPending] = useState(initial.pending);
  const pendingRef = useRef(initial.pending);
  const inFlight = useRef(false);
  const completed = useRef(false);
  const [busy, setBusy] = useState(false);
  const [storageError, setStorageError] = useState(initial.error);
  const scopeChanged = origin.current !== identity;

  async function send(input: Omit<RetailAfterSaleInput, "idempotencyKey">) {
    if (inFlight.current || completed.current) return;
    if (!scope || !actorId || scopeChanged || storageError) throw new Error("Phạm vi hoặc phiên thao tác đã thay đổi. Vui lòng mở lại đơn hàng.");
    if (pendingRef.current && pendingRef.current.type !== input.type) throw new Error("Đơn này có yêu cầu đang chờ thuộc nghiệp vụ khác. Vui lòng mở lại đúng thao tác để kiểm tra kết quả.");
    const retry = Boolean(pendingRef.current);
    const request = pendingRef.current || JSON.parse(JSON.stringify({ ...input, idempotencyKey: crypto.randomUUID() })) as RetailAfterSaleInput;
    // Persist before sending. If storage is unavailable, do not risk a write
    // whose identity would be lost on reload.
    try { sessionStorage.setItem(storageKey, JSON.stringify(request)); }
    catch {
      setStorageError("Không lưu được yêu cầu để thử lại an toàn. Chưa gửi chứng từ; vui lòng kiểm tra bộ nhớ trình duyệt.");
      return;
    }
    pendingRef.current = request;
    setPending(request);
    inFlight.current = true;
    setBusy(true);
    try {
      const result = await retailAfterSalesApi.create(scope, request);
      completed.current = true;
      // Failed cleanup retains a safe replay, never generates a replacement key.
      try { sessionStorage.removeItem(storageKey); } catch { /* keep the committed request */ }
      return mounted.current && currentIdentity.current === identity ? result : undefined;
    } catch (error) {
      // Only an initial, explicit validation rejection proves nothing was posted.
      // An uncertain earlier response must always keep the original request.
      if (!retry && error instanceof ApiClientError && error.status === 400 && error.code === "AFTER_SALE_INVALID") {
        try {
          sessionStorage.removeItem(storageKey);
          pendingRef.current = null;
          setPending(null);
        } catch { /* keep the pending request if storage cannot be cleared */ }
      }
      throw error;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return { pending, busy, send, scopeChanged, storageError };
}
