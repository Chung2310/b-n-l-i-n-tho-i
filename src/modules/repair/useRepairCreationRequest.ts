import { useEffect, useRef, useState } from "react";
import { useRetailScope } from "../retail/hooks/useRetailScope";
import { repairService } from "../../services/repairService";

type Payload = Record<string, any>;
function read(key: string): Payload | null {
  const raw = localStorage.getItem(key);
  if (raw === null) return null;
  const row = JSON.parse(raw);
  if (!row || typeof row !== "object" || Array.isArray(row) || !["service", "warranty"].includes(row.ticketType) ||
    ![row.ticketCode, row.customerId, row.customerName, row.customerPhone, row.symptom, row.device?.name, row.receivedAt].every(v => typeof v === "string" && v.trim()) ||
    !Number.isFinite(Date.parse(row.receivedAt)) || !Array.isArray(row.device?.accessories) ||
    (row.ticketType === "warranty" && !row.device?.serialNumber?.trim())) throw new Error("Bản lưu tạo phiếu bị lỗi. Giữ nguyên để đối soát.");
  return row;
}
const same = (a: Payload | null, b: Payload) => JSON.stringify(a) === JSON.stringify(b);

export function useRepairCreationRequest(onCreated: () => void) {
  const { scope, userProfile } = useRetailScope();
  const identity = JSON.stringify([scope?.companyCode, scope?.branchId, userProfile?.uid]);
  const origin = useRef(identity), current = useRef(identity), mounted = useRef(true), inFlight = useRef(false), completed = useRef(false);
  current.current = identity;
  const key = `repair-create-pending:v1:${identity}`;
  const [initial] = useState(() => {
    try { return { pending: read(key), error: "" }; }
    catch (e) { return { pending: null, error: e instanceof Error ? e.message : "Không đọc được bản lưu tạo phiếu." }; }
  });
  const [pending, setPending] = useState(initial.pending), pendingRef = useRef(initial.pending);
  const [error, setError] = useState(initial.error), [storageError, setStorageError] = useState(initial.error);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const blocked = identity !== origin.current || !scope || !userProfile?.uid || Boolean(storageError);
  async function run(factory?: () => Payload, reconcile: boolean | "revoke" = false) {
    if (blocked || !scope || inFlight.current || completed.current) return;
    if (reconcile === "revoke" && (!pendingRef.current || !window.confirm("Vô hiệu hóa yêu cầu tạo phiếu đang chờ? Phiếu đã tạo sẽ được đối chiếu, không bị hủy."))) return;
    inFlight.current = true; setBusy(true); setError(""); setMessage("");
    const active = () => mounted.current && current.current === identity;
    try {
      if (!navigator.locks?.request) throw new Error("Không khóa được thao tác giữa các tab. Cần trình duyệt hỗ trợ Web Locks qua HTTPS.");
      await navigator.locks.request(key, { mode: "exclusive", ifAvailable: true }, async lock => {
        if (!lock) throw new Error("Tab khác đang xử lý tạo phiếu. Chờ rồi đối chiếu yêu cầu cũ.");
        if (!active()) return;
        let stored: Payload | null;
        try { stored = read(key); }
        catch (e) { setStorageError("Không đọc được bản lưu tạo phiếu. Giữ nguyên để đối soát."); throw e; }
        if (stored && !same(stored, pendingRef.current || {})) {
          if (pendingRef.current) throw new Error("Bản lưu đã thay đổi. Không ghi đè hoặc xóa yêu cầu khác.");
          pendingRef.current = stored; setPending(stored); setMessage("Đã khôi phục yêu cầu từ tab khác. Hãy đối chiếu hoặc thử lại yêu cầu đó."); return;
        }
        const payload = pendingRef.current || (factory ? JSON.parse(JSON.stringify(factory())) : null);
        if (!payload) return;
        try {
          localStorage.setItem(key, JSON.stringify(payload));
          if (!same(read(key), payload)) throw new Error("Không xác minh được bản lưu tạo phiếu.");
        } catch (e) { setStorageError("Không lưu được nguyên yêu cầu. Chưa gửi tạo phiếu."); throw e; }
        pendingRef.current = payload; setPending(payload);
        let revoked = false;
        if (reconcile) {
          const result = await (reconcile === "revoke" ? repairService.revokeCreation(payload, scope) : repairService.reconcileCreation(payload, scope));
          revoked = result.status === "revoked";
          if (!revoked && (result.status !== "completed" || !result.ticketId)) { if (active()) setMessage(result.message); return; }
        } else {
          const result = await repairService.create(payload, scope);
          if (!result?._id || result.ticketCode !== payload.ticketCode) throw new Error("Phản hồi chưa xác minh được đúng phiếu. Giữ nguyên yêu cầu để đối chiếu.");
        }
        const latest = read(key);
        if (latest && !same(latest, payload)) throw new Error("Phiếu đã tạo nhưng bản lưu đã thay đổi. Không xóa yêu cầu khác.");
        localStorage.removeItem(key);
        if (revoked) {
          pendingRef.current = null;
          if (active()) { setPending(null); setMessage("Đã hủy yêu cầu cũ an toàn. Có thể nhập lại để tạo phiếu bằng mã mới."); }
          return;
        }
        completed.current = true;
        if (active()) onCreated();
      });
    } catch (e) { if (active()) setError(e instanceof Error ? e.message : "Chưa xác định kết quả tạo phiếu. Giữ nguyên yêu cầu."); }
    finally { inFlight.current = false; if (active()) setBusy(false); }
  }
  return { pending, busy, blocked, error: storageError || error || (blocked ? "Phiên hoặc chi nhánh đã thay đổi. Mở lại đúng phạm vi để tiếp tục." : ""), message, run };
}
