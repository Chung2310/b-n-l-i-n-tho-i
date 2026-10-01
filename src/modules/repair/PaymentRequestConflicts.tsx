import React, { useEffect, useRef, useState } from "react";
import { repairService } from "../../services/repairService";
import { clearResolvedPaymentCandidate, paymentRequestCandidates, samePaymentRequest, withPaymentRequestLock, type PendingRepairPayment } from "./repairPaymentRequest";

export default function PaymentRequestConflicts({ storageKey, ticketId, scope, disabled, requests, onComplete }: {
  storageKey: string; ticketId: string; scope: { companyCode: string; branchId: string } | null | undefined;
  disabled: boolean; requests: PendingRepairPayment[]; onComplete: () => void;
}) {
  const [rows, setRows] = useState(requests), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const active = useRef(true), allowed = useRef(!disabled), inFlight = useRef(false);
  allowed.current = !disabled;
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  async function resolve(request: PendingRepairPayment, revoke: boolean) {
    if (!scope || disabled || inFlight.current) return;
    if (revoke && !window.confirm("Vô hiệu hóa yêu cầu này ở máy chủ? Khoản thu đã ghi sổ sẽ được đối chiếu, không bị đảo tiền.")) return;
    inFlight.current = true; setBusy(true); setMessage("");
    try {
      await withPaymentRequestLock(storageKey, async () => {
        if (!active.current || !allowed.current) return;
        const latest = paymentRequestCandidates(storageKey);
        if (!latest.some(row => samePaymentRequest(row, request))) { setRows(latest); setMessage("Bản lưu đã thay đổi. Đối chiếu các bản hiện còn."); return; }
        const result = await (revoke ? repairService.revokePayment(ticketId, request, scope) : repairService.reconcilePayment(ticketId, request, scope));
        if (!["completed", "revoked"].includes(result.status)) { if (active.current && allowed.current) setMessage(result.message); return; }
        clearResolvedPaymentCandidate(storageKey, request);
        const remaining = paymentRequestCandidates(storageKey);
        if (!active.current || !allowed.current) return;
        setRows(remaining); setMessage(result.message);
        if (!remaining.length) onComplete();
      });
    } catch (cause) { if (active.current && allowed.current) setMessage(cause instanceof Error ? cause.message : "Chưa xác minh được yêu cầu. Giữ nguyên bản lưu."); }
    finally { inFlight.current = false; if (active.current && allowed.current) setBusy(false); }
  }
  return <section className="mt-4 rounded-xl border border-amber-300 p-4">
    <p role="alert">Các bản lưu khoản thu khác nhau. Đối chiếu hoặc hủy từng yêu cầu; chưa được thu thêm tiền.</p>
    {rows.map((row, i) => <div key={i} className="mt-3 border-t pt-2">
      <p>Bản {i + 1}: {row.amount.toLocaleString("vi-VN")} đ · Đã thu trước đó: {row.expectedPaidAmount.toLocaleString("vi-VN")} đ · Tổng phiếu: {row.expectedTotalAmount.toLocaleString("vi-VN")} đ</p>
      <p className="break-all text-xs">Mã yêu cầu: {row.idempotencyKey}</p>
      <button type="button" disabled={disabled || busy} onClick={() => void resolve(row, false)}>Đối chiếu bản {i + 1}</button>
      <button type="button" className="ml-3" disabled={disabled || busy} onClick={() => void resolve(row, true)}>Hủy bản {i + 1}</button>
    </div>)}
    {message && <p role="status" className="mt-2">{message}</p>}
  </section>;
}
