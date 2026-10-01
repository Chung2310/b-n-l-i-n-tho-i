import React, { useState, useRef, useEffect } from "react";
import { useRetailScope } from "../retail/hooks/useRetailScope";
import { readRefundRequest, sameRefundRequest, withRefundRequestLock, type RepairRefundRequest } from "./repairRefundRequest";
import { apiFetch } from "../shared/lib/apiFetch";
import { RotateCcw, AlertCircle, Receipt, FileText, CheckCircle2, DollarSign, Wrench } from "lucide-react";

const money = (value: number) => Number(value || 0).toLocaleString("vi-VN");

export default function RepairRefundForm({ ticket, onChanged }: { ticket: any; onChanged: () => void }) {
  const { scope, userProfile } = useRetailScope();
  const identity = JSON.stringify([scope?.companyCode, scope?.branchId, userProfile?.uid, ticket._id]);
  const storageKey = 'repair-refund-pending:v1:' + identity;
  const [initial] = useState(() => {
    try { return { pending: readRefundRequest(storageKey), error: '' }; }
    catch { return { pending: null, error: 'Không đọc được yêu cầu hoàn tiền đã lưu. Cần đối soát trước khi tiếp tục.' }; }
  });
  const [pending, setPending] = useState(initial.pending);
  const pendingRef = useRef(initial.pending);
  const [amount, setAmount] = useState(initial.pending ? money(initial.pending.amount) : '');
  const [laborAmount, setLaborAmount] = useState(initial.pending ? money(initial.pending.laborAmount) : '');
  const [reason, setReason] = useState(initial.pending?.reason || '');
  const [reference, setReference] = useState(initial.pending?.reference || '');
  const [error, setError] = useState(initial.error);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');
  const origin = useRef(identity), current = useRef(identity), mounted = useRef(true), inFlight = useRef(false), completed = useRef(false);
  current.current = identity;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const blocked = Boolean(initial.error) || !scope || !userProfile?.uid || identity !== origin.current || ticket.companyCode !== scope.companyCode || ticket.branchId !== scope.branchId;
  const editingBlocked = blocked || busy || Boolean(pending) || completed.current;
  const refunded = (ticket.commissionRefunds || []).reduce((s: number, r: any) => s + r.amount, 0);
  const refundedLabor = (ticket.commissionRefunds || []).reduce((s: number, r: any) => s + r.laborAmount, 0);
  const gross = Number(ticket.laborFee || 0) + Number(ticket.partRevenue || 0);
  const laborBase = ticket.commissionSnapshot?.lines?.[0]?.base ?? (gross ? Math.round(Number(ticket.laborFee || 0) * Math.min(gross, ticket.totalAmount) / gross) : 0);
  const remaining = Math.max(0, Number(ticket.paidAmount || 0) - refunded);
  const remainingLabor = Math.max(0, laborBase - refundedLabor);

  const parseDigits = (val: string): number => {
    const clean = val.replace(/\D/g, "");
    return clean ? Number(clean) : 0;
  };

  const formatWithDots = (val: string): string => {
    const num = parseDigits(val);
    return num > 0 ? num.toLocaleString("vi-VN") : "";
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatWithDots(e.target.value);
    setAmount(formatted);
  };

  const handleLaborAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatWithDots(e.target.value);
    setLaborAmount(formatted);
  };

  const applyFullRefund = () => {
    const total = remaining;
    const labor = Math.min(remaining, remainingLabor);
    setAmount(total > 0 ? total.toLocaleString("vi-VN") : "0");
    setLaborAmount(labor > 0 ? labor.toLocaleString("vi-VN") : "0");
  };

  const applyLaborOnlyRefund = () => {
    const labor = Math.min(remaining, remainingLabor);
    setAmount(labor > 0 ? labor.toLocaleString("vi-VN") : "0");
    setLaborAmount(labor > 0 ? labor.toLocaleString("vi-VN") : "0");
  };

  const submit = async (action: "post" | "reconcile" | "revoke" = "post") => {
    if (blocked || inFlight.current || completed.current || !scope) return;
    const request: RepairRefundRequest = pendingRef.current || { amount: parseDigits(amount), laborAmount: parseDigits(laborAmount), reason: reason.trim(), reference: reference.trim(), idempotencyKey: crypto.randomUUID() };
    if (!Number.isSafeInteger(request.amount) || request.amount <= 0 || !Number.isSafeInteger(request.laborAmount) || request.laborAmount > request.amount || !request.reason || !request.reference) { setError('Số tiền hoặc nội dung hoàn tiền không hợp lệ.'); return; }
    if (action === "revoke" && (!pendingRef.current || !window.confirm("Vô hiệu hóa yêu cầu đang chờ ở máy chủ? Nếu khoản hoàn đã ghi nhận, hệ thống sẽ đối chiếu thay vì hủy. Thao tác này không đảo phiếu chi."))) return;
    if (action === "post" && !pendingRef.current && !window.confirm('Liên kết phiếu chi Finance cho khoản hoàn ' + money(request.amount) + ' đ? Không chi tiền lần nữa.')) return;
    inFlight.current = true; setBusy(true); setError(''); setResult('');
    try {
      await withRefundRequestLock(storageKey, async () => {
        if (!mounted.current || current.current !== identity) return;
        const stored = readRefundRequest(storageKey);
        if (stored && !sameRefundRequest(stored, request)) {
          if (pendingRef.current) throw new Error('Yêu cầu lưu ở tab khác không khớp. Giữ nguyên nội dung để đối soát, không ghi đè.');
          pendingRef.current = stored; setPending(stored); setAmount(money(stored.amount)); setLaborAmount(money(stored.laborAmount)); setReason(stored.reason); setReference(stored.reference);
          setResult('Đã khôi phục yêu cầu từ tab khác. Hãy đối chiếu hoặc thử lại khoản cũ.'); return;
        }
        localStorage.setItem(storageKey, JSON.stringify(request));
        const saved = readRefundRequest(storageKey);
        if (!saved || !sameRefundRequest(saved, request)) throw new Error('Không lưu được nguyên yêu cầu hoàn tiền. Chưa gửi.');
        pendingRef.current = request; setPending(request);
        const response = await apiFetch<{ success: boolean; data?: { status?: string; message?: string } }>(
          '/repair/tickets/' + ticket._id + '/refunds' + (action === 'post' ? '' : '/' + action),
          { method: 'POST', params: { companyCode: scope.companyCode, branchId: scope.branchId }, body: JSON.stringify(request) }
        );
        if (!response.success) throw new Error('Chưa xác minh được kết quả hoàn tiền. Giữ nguyên yêu cầu để đối chiếu.');
        if (action !== 'post' && !['completed', 'revoked'].includes(response.data?.status || '')) {
          if (mounted.current && current.current === identity) setResult(response.data?.message || 'Chưa xác minh được kết quả. Giữ nguyên yêu cầu.');
          return;
        }
        const latest = readRefundRequest(storageKey);
        if (latest && !sameRefundRequest(latest, request)) throw new Error('Khoản hoàn đã ghi nhận nhưng yêu cầu lưu đã thay đổi. Không xóa yêu cầu khác.');
        if (latest) localStorage.removeItem(storageKey);
        const revoked = action !== 'post' && response.data?.status === 'revoked';
        completed.current = !revoked;
        if (revoked) pendingRef.current = null;
        if (!mounted.current || current.current !== identity) return;
        if (revoked) {
          setPending(null); setAmount(''); setLaborAmount(''); setReason(''); setReference('');
          setResult('Yêu cầu cũ đã bị vô hiệu hóa. Có thể nhập lại nội dung đúng; phiếu chi và khoản hoàn đã ghi sổ không bị đảo.');
          return;
        }
        setResult('Khoản hoàn đã ghi nhận và khớp chứng từ Finance.');
        onChanged();
      });
    } catch (e) {
      if (mounted.current && current.current === identity) setError((e as Error).message);
    } finally {
      inFlight.current = false;
      if (mounted.current && current.current === identity) setBusy(false);
    }
  };

  const rawAmount = parseDigits(amount);
  const rawLabor = parseDigits(laborAmount);

  if (ticket.status !== "delivered" && !pending && !initial.error) return null;

  return (
    <section className="mt-4 rounded-2xl border border-rose-200/90 bg-gradient-to-b from-rose-50/40 via-white to-white p-4 sm:p-5 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-rose-100 pb-3">
        <div>
          <h3 className="font-black text-rose-950 text-sm sm:text-base flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-100 text-rose-700 text-sm">
              <RotateCcw className="h-4 w-4" />
            </span>
            <span>Hoàn tiền sửa chữa & Thu hồi hoa hồng</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Dùng phiếu chi Finance đã ghi sổ, đúng số tiền và có tham chiếu {ticket.ticketCode}. Liên kết sẽ giảm doanh thu theo ngày phiếu chi và thu hồi hoa hồng CTV; không chi tiền lần nữa.
          </p>
        </div>

        {/* Quick Fill Presets */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            disabled={editingBlocked}
            onClick={applyFullRefund}
            className="rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition shadow-2xs cursor-pointer"
          >
            Hoàn toàn bộ ({money(remaining)} đ)
          </button>
          <button
            type="button"
            disabled={editingBlocked}
            onClick={applyLaborOnlyRefund}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs cursor-pointer"
          >
            Chỉ hoàn tiền công ({money(Math.min(remaining, remainingLabor))} đ)
          </button>
        </div>
      </div>

      {blocked && <p role="alert">Phiên hoặc chi nhánh đã thay đổi. Vui lòng mở lại đúng phiếu.</p>}
      {pending && <p className="text-sm text-amber-800">Khoản hoàn đang chờ đối chiếu: {money(pending.amount)} đ, tiền công {money(pending.laborAmount)} đ, phiếu chi {pending.reference}. Nội dung đã được giữ nguyên khi đóng cửa sổ hoặc mở tab khác. Không lập phiếu chi mới để thử lại.</p>}
      {result && <p role="status" className="text-sm text-slate-700">{result}</p>}
      {pending && <button type="button" disabled={blocked || busy || completed.current} onClick={() => void submit("reconcile")} className="rounded-xl border px-3 py-2">Đối chiếu khoản hoàn</button>}
      {pending && <button type="button" disabled={blocked || busy || completed.current} onClick={() => void submit("revoke")} className="rounded-xl border border-rose-300 px-3 py-2">Hủy yêu cầu đang chờ</button>}
      {/* Input Grid */}
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Total Refund Amount */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700">
            Tổng tiền hoàn (VNĐ) <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input disabled={editingBlocked}
              type="text"
              inputMode="numeric"
              value={amount}
              placeholder="VD: 350.000"
              onChange={handleAmountChange}
              className="w-full rounded-xl border border-slate-300 bg-white pl-3.5 pr-8 py-2.5 text-sm font-bold text-slate-900 shadow-2xs focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 focus:outline-none"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
              đ
            </span>
          </div>
          {rawAmount > 0 ? (
            <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200/80 w-fit">
              <DollarSign className="h-3.5 w-3.5 text-rose-600" />
              <span>Đang nhập:</span>
              <span>{rawAmount.toLocaleString("vi-VN")} đ</span>
            </div>
          ) : (
            <span className="text-[11px] text-slate-400">Định dạng số tự động: xx.xxx.xxx đ</span>
          )}
        </div>

        {/* Labor Refund Amount */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700">
            Trong đó tiền công hoàn (VNĐ) <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input disabled={editingBlocked}
              type="text"
              inputMode="numeric"
              value={laborAmount}
              placeholder="VD: 100.000"
              onChange={handleLaborAmountChange}
              className="w-full rounded-xl border border-slate-300 bg-white pl-3.5 pr-8 py-2.5 text-sm font-bold text-slate-900 shadow-2xs focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 focus:outline-none"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
              đ
            </span>
          </div>
          {rawLabor > 0 ? (
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/80 w-fit">
              <Wrench className="h-3.5 w-3.5 text-amber-600" />
              <span>Tiền công:</span>
              <span>{rawLabor.toLocaleString("vi-VN")} đ</span>
            </div>
          ) : (
            <span className="text-[11px] text-slate-400">Phần tiền công để thu hồi hoa hồng</span>
          )}
        </div>

        {/* Refund Reason */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700">
            Lý do hoàn tiền <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input disabled={editingBlocked}
              type="text"
              value={reason}
              placeholder="VD: Khách hoàn trả linh kiện lỗi, không sửa nữa..."
              onChange={(e) => {
                setReason(e.target.value);
              }}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 shadow-2xs focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 focus:outline-none"
            />
          </div>
        </div>

        {/* Reference Document */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700">
            Mã/ID phiếu chi Finance đã ghi sổ <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input disabled={editingBlocked}
              type="text"
              value={reference}
              placeholder="Mã phiếu trong Finance → Lịch sử & nguồn"
              onChange={(e) => {
                setReference(e.target.value);
              }}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 shadow-2xs focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700 font-medium">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Action Button */}
      <div className="pt-1 flex items-center justify-between">
        <button
          type="button"
          disabled={blocked || busy || completed.current || !amount || laborAmount === "" || !reason.trim() || !reference.trim()}
          onClick={() => void submit()}
          className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-rose-700 active:scale-95 transition disabled:opacity-50 cursor-pointer"
        >
          <RotateCcw className="h-4 w-4" />
          <span>
            {busy
              ? "Đang xử lý hoàn tiền..."
              : pending ? "Thử lại khoản hoàn cũ"
              : rawAmount > 0
              ? `Ghi nhận hoàn tiền (${rawAmount.toLocaleString("vi-VN")} đ)`
              : "Ghi nhận đã hoàn tiền"}
          </span>
        </button>
      </div>

      {/* Existing Refunds List */}
      {(ticket.commissionRefunds || []).length > 0 && (
        <div className="mt-3 border-t border-rose-100 pt-3 space-y-2">
          <span className="text-xs font-bold text-slate-700 block">Lịch sử hoàn tiền phiếu này:</span>
          <div className="space-y-1.5">
            {(ticket.commissionRefunds || []).map((r: any) => (
              <div
                key={r.key}
                className="flex items-center justify-between rounded-xl bg-white p-2.5 border border-slate-200/80 text-xs shadow-2xs"
              >
                <div className="flex items-center gap-2">
                  <span className="text-rose-600 font-black">-{money(r.amount)} đ</span>
                  <span className="text-slate-500">· {r.reason}</span>
                  <span className="text-slate-400 font-mono">({r.reference})</span>
                  <span className="text-slate-500">{r.financeVoucherId ? "Đã đối soát Finance" : "Chưa đối soát Finance"}</span>
                </div>
                <span className="text-slate-400 text-[11px]">
                  {new Date(r.at).toLocaleDateString("vi-VN")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
