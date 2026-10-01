import React, { useEffect, useRef, useState } from "react";
import { repairService, type RepairTicket } from "../../services/repairService";
import { ApiClientError } from "../../services/apiClientError";
import { useRetailScope } from "../retail/hooks/useRetailScope";

import PaymentRequestConflicts from "./PaymentRequestConflicts";
import { paymentRequestCandidates, readPaymentRequest, persistPaymentRequest, clearPaymentRequest, samePaymentRequest, withPaymentRequestLock, type PendingRepairPayment as Pending } from "./repairPaymentRequest";
export default function RepairPaymentForm({ ticket, onComplete, onPendingChange }: { ticket: RepairTicket; onComplete: () => void; onPendingChange: (pending: boolean) => void }) {
  const { scope, userProfile } = useRetailScope();
  const identity = JSON.stringify([scope?.companyCode, scope?.branchId, userProfile?.uid, ticket._id]);
  const origin = useRef(identity);
  const current = useRef(identity);
  current.current = identity;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const storageKey = `repair-payment-pending:v1:${identity}`;
  const [initial] = useState(() => {
    try {
      const candidates = paymentRequestCandidates(storageKey);
      return { pending: candidates.length === 1 ? candidates[0] : null, conflicts: candidates.length > 1 ? candidates : [], error: "" };
    } catch { return { pending: null, conflicts: [] as Pending[], error: "Không đọc được khoản thu đang chờ. Cần đối chiếu khoản thu trước khi tiếp tục." }; }
  });
  const [conflicts, setConflicts] = useState(initial.conflicts);
  const [pending, setPending] = useState(initial.pending);
  const pendingRef = useRef(initial.pending);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState(initial.error);
  const [storageError, setStorageError] = useState(initial.error);
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const completed = useRef(false);
  const scopeBlocked = identity !== origin.current || !scope || !userProfile?.uid;
  const blocked = scopeBlocked || Boolean(storageError) || conflicts.length > 0;
  useEffect(() => { onPendingChange(Boolean(pending) || Boolean(storageError) || conflicts.length > 0 || busy); }, [pending, storageError, conflicts, busy, onPendingChange]);

  useEffect(() => {
    if (!initial.pending || initial.error) return;
    void withPaymentRequestLock(storageKey, async () => {
      if (!mounted.current || current.current !== origin.current) return;
      persistPaymentRequest(storageKey, initial.pending!);
    }).catch(cause => { if (mounted.current && current.current === origin.current) setStorageError(cause instanceof Error ? cause.message : "Không chuyển được khoản thu cũ. Giữ nguyên để đối soát."); });
  }, []);

  async function submit(action: "post" | "reconcile" | "revoke" = "post") {
    if (blocked || inFlight.current || completed.current || !scope) return;
    if (action === "revoke" && (!pendingRef.current || !window.confirm("Vô hiệu hóa yêu cầu thu đang chờ? Khoản đã ghi sổ sẽ được đối chiếu, không bị đảo tiền."))) return;
    const retry = Boolean(pendingRef.current);
    const request: Pending = pendingRef.current || { amount: Number(amount.replace(/\D/g, "")), idempotencyKey: crypto.randomUUID(), expectedPaidAmount: ticket.paidAmount, expectedTotalAmount: ticket.totalAmount };
    if (!Number.isSafeInteger(request.amount) || request.amount <= 0) return;
    inFlight.current = true; setBusy(true); setError(""); setResult("");
    try {
      await withPaymentRequestLock(storageKey, async () => {
        if (!mounted.current || current.current !== identity) return;
        let stored: Pending | null;
        try { stored = readPaymentRequest(storageKey); }
        catch (cause) {
          let candidates: Pending[] = [];
          try { candidates = paymentRequestCandidates(storageKey); } catch { /* Preserve corrupt storage and block all new submissions. */ }
          if (candidates.length > 1) { setConflicts(candidates); return; }
          setStorageError("Không đọc được khoản thu đã lưu. Giữ nguyên để đối soát."); throw cause;
        }
        if (stored && !samePaymentRequest(stored, request)) {
          if (pendingRef.current) throw new Error("Khoản thu lưu ở tab khác không khớp. Không thay thế yêu cầu đang chờ.");
          pendingRef.current = stored; setPending(stored); setResult("Đã khôi phục khoản thu từ tab khác. Đối chiếu hoặc thử lại khoản cũ."); return;
        }
        try { persistPaymentRequest(storageKey, request); }
        catch (cause) { setStorageError("Không lưu được nguyên yêu cầu thu tiền. Chưa gửi."); throw cause; }
        pendingRef.current = request; setPending(request);
        try {
          let revoked = false;
          if (action !== "post") {
            const response = await (action === "revoke" ? repairService.revokePayment(ticket._id, request, scope) : repairService.reconcilePayment(ticket._id, request, scope));
            revoked = response.status === "revoked";
            if (response.status !== "completed" && !revoked) {
              if (mounted.current && current.current === identity) setResult(response.message || "Chưa xác minh được kết quả. Giữ nguyên yêu cầu.");
              return;
            }
          } else {
            const { amount: paymentAmount, ...metadata } = request;
            await repairService.pay(ticket._id, paymentAmount, metadata, scope);
          }
          clearPaymentRequest(storageKey, request);
          if (revoked) {
            pendingRef.current = null;
            if (mounted.current && current.current === identity) { setPending(null); setAmount(""); setResult("Đã hủy yêu cầu cũ an toàn. Có thể nhập khoản thu mới."); }
            return;
          }
          completed.current = true;
          if (mounted.current && current.current === identity) onComplete();
        } catch (cause) {
          if (action === "post" && !retry && cause instanceof ApiClientError && cause.status === 400 && cause.code === "REPAIR_PAYMENT_INVALID") {
            clearPaymentRequest(storageKey, request); pendingRef.current = null;
            if (mounted.current && current.current === identity) setPending(null);
          }
          throw cause;
        }
      });
    } catch (cause) {
      if (mounted.current && current.current === identity) setError(cause instanceof Error ? cause.message : "Chưa xác định được kết quả thu tiền. Hãy thử lại khoản thu cũ.");
    } finally {
      inFlight.current = false;
      if (mounted.current && current.current === identity) setBusy(false);
    }
  }

  if (conflicts.length) return <PaymentRequestConflicts storageKey={storageKey} ticketId={ticket._id} scope={scope} disabled={scopeBlocked} requests={conflicts} onComplete={onComplete} />;
  if (!pending && !storageError && (ticket.status !== "done" || ticket.dueAmount <= 0)) return null;
  return <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
    <p className="text-sm font-bold text-emerald-900">Thu tiền để giao máy (Còn nợ: {ticket.dueAmount.toLocaleString("vi-VN")} đ)</p>
    {pending ? <p className="mt-2 text-sm">Khoản thu đang chờ: {pending.amount.toLocaleString("vi-VN")} đ. Thử lại sẽ giữ nguyên yêu cầu cũ. Bản chờ được giữ khi mở lại trình duyệt trong cùng hồ sơ. Không thu tiền khách thêm lần nữa khi thử lại.</p> : <div className="mt-2 flex gap-3">
      <input aria-label="Số tiền thanh toán" inputMode="numeric" value={amount} disabled={busy || blocked} onChange={e => { const digits = e.target.value.replace(/\D/g, ""); setAmount(digits ? Number(digits).toLocaleString("vi-VN") : ""); }} className="w-full rounded-xl border border-slate-300 px-3 py-2" />
      <button type="button" disabled={busy || blocked} onClick={() => setAmount(ticket.dueAmount.toLocaleString("vi-VN"))}>Thu đủ số nợ</button>
    </div>}
    {result && <p role="status" className="mt-2 text-sm">{result}</p>}
    {pending && <button type="button" disabled={busy || blocked || completed.current} onClick={() => void submit("reconcile")} className="mt-2 rounded-xl border px-3 py-2">Đối chiếu khoản thu</button>}
    {pending && <button type="button" disabled={busy || blocked || completed.current} onClick={() => void submit("revoke")} className="mt-2 ml-2 rounded-xl border px-3 py-2">Hủy khoản thu đang chờ</button>}
    {(storageError || error || blocked) && <p role="alert" className="mt-2 text-sm text-red-600">{storageError || error || "Phiên hoặc phạm vi thao tác đã thay đổi. Vui lòng mở lại đúng phiếu."}</p>}
    <button type="button" disabled={busy || blocked || completed.current || (!pending && !Number(amount.replace(/\D/g, "")))} onClick={() => void submit()} className="mt-3 min-h-11 rounded-xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? "Đang xử lý..." : pending ? "Thử lại khoản thu cũ" : "Ghi nhận thanh toán"}</button>
  </div>;
}
