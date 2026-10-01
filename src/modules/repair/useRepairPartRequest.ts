import { useEffect, useRef, useState } from "react";
import { useRetailScope } from "../retail/hooks/useRetailScope";
import { repairService } from "../../services/repairService";

export type PartRequest = { kind: "issue"; input: Record<string, any> } | { kind: "return"; partId: string; reason: string; idempotencyKey?: string };
function read(key: string): PartRequest | null {
  const raw = localStorage.getItem(key);
  if (raw === null) return null;
  const row = JSON.parse(raw);
  const text = (v: any) => typeof v === "string" && Boolean(v.trim());
  if (row?.kind === "return" && text(row.partId) && text(row.reason) && (row.idempotencyKey === undefined || text(row.idempotencyKey))) return row;
  if (row?.kind === "issue" && text(row.input?.idempotencyKey) && text(row.input?.productId) && text(row.input?.sku) && text(row.input?.productName) && Number.isSafeInteger(row.input?.quantity) && row.input.quantity > 0 && [row.input.unitCost, row.input.unitPrice].every(v => Number.isFinite(v) && v >= 0)) return row;
  throw new Error("Bản lưu linh kiện bị lỗi. Giữ nguyên để đối soát.");
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export function useRepairPartRequest(ticketId: string, onComplete: () => void) {
  const { scope, userProfile } = useRetailScope();
  const identity = JSON.stringify([scope?.companyCode, scope?.branchId, userProfile?.uid, ticketId]);
  const origin = useRef(identity), current = useRef(identity), mounted = useRef(true), inFlight = useRef(false);
  current.current = identity;
  const key = `repair-part-pending:v1:${identity}`;
  const [initial] = useState(() => { try { return { pending: read(key), error: "" }; } catch (e) { return { pending: null, error: e instanceof Error ? e.message : "Không đọc được bản lưu." }; } });
  const [pending, setPending] = useState(initial.pending), pendingRef = useRef(initial.pending);
  const [error, setError] = useState(initial.error), [storageError, setStorageError] = useState(initial.error), [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const scopeBlocked = identity !== origin.current || !scope || !userProfile?.uid;
  const blocked = scopeBlocked || Boolean(storageError);
  async function run(factory?: () => PartRequest, reconcile: boolean | "revoke" = false) {
    if (blocked || !scope || inFlight.current) return;
    if (reconcile === "revoke" && (!pendingRef.current || !window.confirm("Vô hiệu hóa yêu cầu linh kiện đang chờ? Chứng từ đã ghi sẽ được đối chiếu, không đảo kho."))) return;
    inFlight.current = true; setBusy(true); setError(""); setMessage("");
    const active = () => mounted.current && current.current === identity;
    try {
      if (!navigator.locks?.request) throw new Error("Cần trình duyệt hỗ trợ Web Locks qua HTTPS để khóa thao tác giữa các tab.");
      await navigator.locks.request(key, { mode: "exclusive", ifAvailable: true }, async lock => {
        if (!lock) throw new Error("Tab khác đang xử lý linh kiện. Chờ rồi đối chiếu yêu cầu cũ.");
        if (!active()) return;
        let stored: PartRequest | null;
        try { stored = read(key); } catch (e) { setStorageError("Không đọc được bản lưu. Giữ nguyên để đối soát."); throw e; }
        if (stored && !same(stored, pendingRef.current)) {
          if (pendingRef.current) throw new Error("Bản lưu đã đổi. Không ghi đè yêu cầu khác.");
          pendingRef.current = stored; setPending(stored); return;
        }
        const request: PartRequest | null = pendingRef.current || (factory ? JSON.parse(JSON.stringify(factory())) : null);
        if (!request) return;
        try {
          localStorage.setItem(key, JSON.stringify(request));
          if (!same(read(key), request)) throw new Error("Bản lưu không khớp.");
        } catch (e) { setStorageError("Không lưu được yêu cầu linh kiện. Chưa gửi."); throw e; }
        pendingRef.current = request; setPending(request);
        if (!reconcile) {
          if (request.kind === "issue") await repairService.issuePart(ticketId, request.input, scope);
          else await repairService.returnPart(ticketId, request.partId, request.reason, scope, request.idempotencyKey);
        }
        // Both replay and normal success must have matching stock evidence before cleanup.
        const result = await (reconcile === "revoke" ? repairService.revokePartRequest(ticketId, request, scope) : repairService.reconcilePart(ticketId, request, scope));
        if (result.status !== "revoked" && (result.status !== "completed" || !result.partId)) { if (active()) setMessage(result.message); return; }
        const latest = read(key);
        if (latest && !same(latest, request)) throw new Error("Đã xử lý nhưng bản lưu đã đổi. Không xóa yêu cầu khác.");
        localStorage.removeItem(key); pendingRef.current = null;
        if (active()) { setPending(null); if (result.status === "revoked") setMessage("Đã hủy yêu cầu cũ an toàn. Có thể nhập lại bằng khóa mới."); else onComplete(); }
      });
    } catch (e) { if (active()) setError(e instanceof Error ? e.message : "Chưa xác định kết quả. Giữ nguyên yêu cầu."); }
    finally { inFlight.current = false; if (active()) setBusy(false); }
  }
  return { pending, busy, blocked, scopeBlocked, scope, identity, run, error: storageError || error || (scopeBlocked ? "Phạm vi đã thay đổi. Mở lại đúng phiếu." : ""), message };
}
