import React, { useState } from "react";
import { X, Gift, AlertCircle, Sparkles, Plus, Minus, ArrowRight } from "lucide-react";
import { customerApi } from "../customerApi";
import type { Customer } from "../types";
import { Dropdown } from "../../../components/common/Dropdown";

interface AdjustPointsModalProps {
  customer: Customer;
  onClose: () => void;
  onSuccess: () => void;
}

const REASON_CATEGORIES = [
  { value: "birthday", label: "Sinh nhật khách hàng", icon: Gift },
  { value: "loyalty_gift", label: "Tri ân thành viên VIP", icon: Sparkles },
  { value: "compensation", label: "Đền bù sự cố / Trễ hẹn", icon: AlertCircle },
  { value: "correction", label: "Sửa sai số dư điểm", icon: Sparkles },
] as const;

export default function AdjustPointsModal({ customer, onClose, onSuccess }: AdjustPointsModalProps) {
  const [mode, setMode] = useState<"grant" | "deduct">("grant");
  const [pointsStr, setPointsStr] = useState("50");
  const [reasonCategory, setReasonCategory] = useState<"birthday" | "compensation" | "loyalty_gift" | "correction">("loyalty_gift");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pointsVal = Math.abs(parseInt(pointsStr, 10) || 0);
  const currentBalance = customer.pointsBalance || 0;
  const delta = mode === "grant" ? pointsVal : -pointsVal;
  const newBalance = Math.max(0, currentBalance + delta);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pointsVal <= 0) {
      setError("Số điểm phải lớn hơn 0.");
      return;
    }
    if (mode === "deduct" && currentBalance < pointsVal) {
      setError(`Không thể trừ quá số dư hiện có (${currentBalance} điểm).`);
      return;
    }
    if (!reason.trim()) {
      setError("Vui lòng nhập lý do điều chỉnh cụ thể.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await customerApi.adjustPoints(
        customer._id,
        {
          points: delta,
          reasonCategory,
          reason: reason.trim(),
        },
        customer.companyCode
      );
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể điều chỉnh điểm.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-100 text-cyan-700">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Cấp / Điều chỉnh điểm</h3>
              <p className="text-xs text-slate-500">{customer.name} · {customer.phone}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Mode Switcher */}
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setMode("grant")}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition cursor-pointer ${
                mode === "grant"
                  ? "bg-white text-emerald-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Cấp thêm điểm (+)</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("deduct")}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition cursor-pointer ${
                mode === "deduct"
                  ? "bg-white text-rose-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Minus className="h-3.5 w-3.5" />
              <span>Trừ điểm (-)</span>
            </button>
          </div>

          {/* Reason Category Selection with reusable Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Danh mục lý do
            </label>
            <Dropdown<"birthday" | "compensation" | "loyalty_gift" | "correction">
              value={reasonCategory}
              onChange={setReasonCategory}
              options={REASON_CATEGORIES.map((cat) => ({
                value: cat.value,
                label: cat.label,
                icon: <cat.icon className="h-4 w-4 text-cyan-600" />,
              }))}
              variant="default"
              size="md"
              className="w-full"
              triggerClassName="w-full justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold"
            />
          </div>

          {/* Points Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Số điểm {mode === "grant" ? "cấp thêm" : "cần trừ"}
            </label>
            <div className="relative">
              <input
                type="number"
                min="1"
                step="1"
                value={pointsStr}
                onChange={(e) => setPointsStr(e.target.value)}
                placeholder="Nhập số điểm (VD: 50)..."
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                điểm
              </span>
            </div>
          </div>

          {/* Reason Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Lý do giải trình cụ thể <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Nhập giải trình lý do điều chỉnh điểm (VD: Khách hàng sinh nhật trong tháng 9, tặng điểm tri ân VIP)..."
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition"
            />
          </div>

          {/* Balance Preview Card */}
          <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 border border-slate-200/60 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">Số dư hiện tại</span>
              <span className="font-bold text-slate-800">{currentBalance} điểm</span>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-400" />
            <div>
              <span className="text-slate-400 block text-[11px]">Biến động</span>
              <span className={`font-bold ${mode === "grant" ? "text-emerald-600" : "text-rose-600"}`}>
                {mode === "grant" ? `+${pointsVal}` : `-${pointsVal}`} điểm
              </span>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-400" />
            <div>
              <span className="text-slate-400 block text-[11px]">Số dư sau GD</span>
              <span className="font-bold text-cyan-800">{newBalance} điểm</span>
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700 font-medium">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={busy || pointsVal <= 0 || !reason.trim()}
              className={`rounded-xl px-5 py-2 text-xs font-bold text-white shadow-sm transition cursor-pointer disabled:opacity-50 ${
                mode === "grant"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-rose-600 hover:bg-rose-700"
              }`}
            >
              {busy ? "Đang xử lý..." : mode === "grant" ? `Cấp +${pointsVal} điểm` : `Trừ -${pointsVal} điểm`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
