import React, { useEffect } from "react";
import { CheckCircle2, Sparkles, Award, Coins, ShieldCheck, X, ArrowRight, Layers } from "lucide-react";
import type { CustomerSettings } from "../types";

export interface SaveTiersSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: CustomerSettings | null;
}

const formatCurrency = (val?: number) => {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(val || 0);
};

export default function SaveTiersSuccessModal({
  isOpen,
  onClose,
  settings,
}: SaveTiersSuccessModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen || !settings) return null;

  const tiers = settings.customerTiers || [];
  const points = settings.pointsPolicy;
  const isPointsActive = points?.enabled ?? true;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="success-modal-title"
        className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-2xl transition-all sm:my-8"
      >
        {/* Header with celebratory gradient */}
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700 px-6 pt-7 pb-6 text-white">
          {/* Subtle background glow circles */}
          <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-white/10 blur-xl pointer-events-none" />
          <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-emerald-400/20 blur-lg pointer-events-none" />

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 rounded-full p-1.5 text-white/80 hover:bg-white/20 hover:text-white transition cursor-pointer"
            aria-label="Đóng popup"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Success Badge & Icon */}
          <div className="flex items-center gap-3">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 shadow-inner backdrop-blur-md border border-white/30">
              <CheckCircle2 className="h-8 w-8 text-white drop-shadow-sm" />
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-200 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-400"></span>
              </span>
            </div>
            <div>
              <div className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-emerald-100 backdrop-blur-xs border border-white/20">
                <Sparkles className="h-3 w-3 text-emerald-200" />
                Cập nhật thành công
              </div>
              <h2 id="success-modal-title" className="mt-1 text-xl font-black text-white tracking-tight">
                Đã lưu cấu hình phân hạng!
              </h2>
            </div>
          </div>
          <p className="mt-3 text-xs sm:text-sm text-emerald-50/95 leading-relaxed">
            Chính sách phân hạng VIP theo Lợi Nhuận Gộp và quy tắc điểm thưởng đã được đồng bộ và áp dụng ngay lập tức trên hệ thống.
          </p>
        </div>

        {/* Modal Body / Summary Details */}
        <div className="space-y-4 p-5 sm:p-6 bg-slate-50/40 max-h-[60vh] overflow-y-auto">
          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-2.5 text-center">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-2xs">
              <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-center gap-1">
                <Layers className="h-3 w-3 text-cyan-600" />
                Số bậc hạng
              </div>
              <div className="mt-1 text-base font-extrabold text-slate-900">{tiers.length} bậc</div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-2xs">
              <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-center gap-1">
                <Award className="h-3 w-3 text-emerald-600" />
                Tiêu chí
              </div>
              <div className="mt-1 text-xs font-bold text-slate-900 truncate" title="Lợi Nhuận Gộp (GP)">
                Lợi Nhuận Gộp
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-2xs">
              <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-center gap-1">
                <Coins className="h-3 w-3 text-amber-600" />
                Điểm thưởng
              </div>
              <div className="mt-1 text-xs font-bold">
                {isPointsActive ? (
                  <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full">Đang bật</span>
                ) : (
                  <span className="text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">Tạm tắt</span>
                )}
              </div>
            </div>
          </div>

          {/* Configured Tiers List */}
          <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Award className="h-3.5 w-3.5 text-cyan-600" />
                Bậc phân hạng đã lưu
              </span>
              <span className="text-[11px] text-slate-400 font-medium">Theo thứ tự ngưỡng GP</span>
            </div>

            <div className="space-y-1.5">
              {tiers.map((t, idx) => (
                <div
                  key={t.code || idx}
                  className="flex items-center justify-between rounded-xl bg-slate-50/80 px-3 py-2 text-xs border border-slate-100 hover:bg-slate-50 transition"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-100 text-[10px] font-black text-cyan-800">
                      {idx + 1}
                    </span>
                    <div>
                      <span className="font-bold text-slate-900">{t.name || t.code}</span>
                      <span className="ml-1.5 text-[10px] font-mono text-slate-400 uppercase">({t.code})</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-slate-700">{formatCurrency(t.minGrossProfit || 0)}</span>
                    <span className="text-[10px] text-slate-400 ml-1.5">x{t.pointMultiplier || 1} điểm</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Points Policy Summary */}
          {isPointsActive && points && (
            <div className="rounded-2xl border border-amber-200/60 bg-amber-50/50 p-3.5 text-xs text-amber-950 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-amber-900">
                <Coins className="h-4 w-4 text-amber-600" />
                Quy tắc điểm thưởng áp dụng:
              </div>
              <ul className="text-[11px] text-amber-800/90 space-y-1 list-disc list-inside">
                <li>
                  Tích điểm: Cứ mỗi <b>{formatCurrency(points.grossProfitPerPoint)}</b> lãi gộp tích được <b>1 điểm</b>.
                </li>
                <li>
                  Tiêu điểm: <b>1 điểm = {formatCurrency(points.pointRedeemValue)}</b> khi cấn trừ đơn hàng / sửa chữa.
                </li>
                <li>
                  Trần cấn trừ tối đa: <b>{points.maxRedeemPercent || 50}%</b> giá trị đơn để bảo vệ dòng tiền cửa hàng.
                </li>
              </ul>
            </div>
          )}

          {/* System Sync Notice */}
          <div className="flex items-start gap-2.5 rounded-2xl border border-cyan-100 bg-cyan-50/60 p-3 text-[11px] text-cyan-950">
            <ShieldCheck className="h-4 w-4 text-cyan-700 shrink-0 mt-0.5" />
            <p className="leading-relaxed text-slate-600">
              Hệ thống tự động đồng bộ thang phân hạng và hệ số tích điểm này vào tất cả giao dịch bán lẻ và phiếu dịch vụ sửa chữa của khách hàng.
            </p>
          </div>
        </div>

        {/* Footer with primary button */}
        <div className="border-t border-slate-100 bg-white p-4 sm:px-6 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center gap-2 w-full sm:w-auto rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md shadow-emerald-600/20 hover:from-emerald-700 hover:to-teal-700 transition cursor-pointer active:scale-95"
          >
            <span>Đã hiểu & Hoàn tất</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
