import React, { useState, useRef } from "react";
import { apiFetch } from "../shared/lib/apiFetch";
import { RotateCcw, AlertCircle, Receipt, FileText, CheckCircle2 } from "lucide-react";

const money = (value: number) => Number(value || 0).toLocaleString("vi-VN");

export default function RepairRefundForm({ ticket, onChanged }: { ticket: any; onChanged: () => void }) {
  const [amount, setAmount] = useState("");
  const [laborAmount, setLaborAmount] = useState("");
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const key = useRef(crypto.randomUUID());

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
    key.current = crypto.randomUUID();
  };

  const handleLaborAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatWithDots(e.target.value);
    setLaborAmount(formatted);
    key.current = crypto.randomUUID();
  };

  const applyFullRefund = () => {
    const total = ticket.totalAmount || 0;
    const labor = ticket.laborFee || 0;
    setAmount(total > 0 ? total.toLocaleString("vi-VN") : "0");
    setLaborAmount(labor > 0 ? labor.toLocaleString("vi-VN") : "0");
    key.current = crypto.randomUUID();
  };

  const applyLaborOnlyRefund = () => {
    const labor = ticket.laborFee || 0;
    setAmount(labor > 0 ? labor.toLocaleString("vi-VN") : "0");
    setLaborAmount(labor > 0 ? labor.toLocaleString("vi-VN") : "0");
    key.current = crypto.randomUUID();
  };

  const submit = async () => {
    const rawAmount = parseDigits(amount);
    const rawLabor = parseDigits(laborAmount);

    if (rawAmount <= 0) {
      setError("Số tiền hoàn phải lớn hơn 0.");
      return;
    }
    if (rawLabor > rawAmount) {
      setError("Tiền công hoàn không được vượt quá tổng tiền hoàn.");
      return;
    }

    if (
      !window.confirm(
        `Xác nhận đã hoàn tiền ${rawAmount.toLocaleString("vi-VN")} đ cho khách hàng?\nHệ thống sẽ thu hồi hoa hồng CTV/KTV tương ứng.`
      )
    ) {
      return;
    }

    setBusy(true);
    setError("");
    try {
      await apiFetch(`/repair/tickets/${ticket._id}/refunds`, {
        method: "POST",
        body: JSON.stringify({
          amount: rawAmount,
          laborAmount: rawLabor,
          reason: reason.trim(),
          reference: reference.trim(),
          idempotencyKey: key.current,
        }),
      });
      key.current = crypto.randomUUID();
      setAmount("");
      setLaborAmount("");
      setReason("");
      setReference("");
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const rawAmount = parseDigits(amount);
  const rawLabor = parseDigits(laborAmount);

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
            Nhập số tiền đã hoàn trả cho khách hàng để hệ thống tự động trừ doanh thu và khấu trừ hoa hồng kỹ thuật viên.
          </p>
        </div>

        {/* Quick Fill Presets */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={applyFullRefund}
            className="rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition shadow-2xs cursor-pointer"
          >
            Hoàn toàn bộ ({money(ticket.totalAmount)} đ)
          </button>
          <button
            type="button"
            onClick={applyLaborOnlyRefund}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs cursor-pointer"
          >
            Chỉ hoàn tiền công ({money(ticket.laborFee)} đ)
          </button>
        </div>
      </div>

      {/* Input Grid */}
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Total Refund Amount */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700">
            Tổng tiền hoàn (VNĐ) <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
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
              <span>💵 Đang nhập:</span>
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
            <input
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
              <span>🔧 Tiền công:</span>
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
            <input
              type="text"
              value={reason}
              placeholder="VD: Khách hoàn trả linh kiện lỗi, không sửa nữa..."
              onChange={(e) => {
                setReason(e.target.value);
                key.current = crypto.randomUUID();
              }}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 shadow-2xs focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 focus:outline-none"
            />
          </div>
        </div>

        {/* Reference Document */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700">
            Chứng từ hoàn tiền <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={reference}
              placeholder="VD: UNC-00918 hoặc Phiếu chi PC-123"
              onChange={(e) => {
                setReference(e.target.value);
                key.current = crypto.randomUUID();
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
          disabled={busy || !amount || laborAmount === "" || !reason.trim() || !reference.trim()}
          onClick={() => void submit()}
          className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-rose-700 active:scale-95 transition disabled:opacity-50 cursor-pointer"
        >
          <RotateCcw className="h-4 w-4" />
          <span>
            {busy
              ? "Đang lưu hoàn tiền..."
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
