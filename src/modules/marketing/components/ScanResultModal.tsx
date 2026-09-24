import React, { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, Clock, Sparkles, Users, X } from "lucide-react";

export interface ScanResultModalProps {
  typeLabel: string;
  stats: { eligible: number; queued: number; skipped: number; failed: number };
  onClose: () => void;
}

export default function ScanResultModal({
  typeLabel,
  stats,
  onClose,
}: ScanResultModalProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const titleId = useId();

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex w-full max-w-md flex-col rounded-3xl border border-slate-100 bg-white shadow-2xl outline-none"
      >
        <header className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600 shadow-2xs">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 id={titleId} className="text-base font-bold text-slate-900">
                Kết quả quét tự động
              </h2>
              <p className="text-xs text-slate-500">{typeLabel}</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Đóng popup"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5">
              <span className="block text-[11px] font-semibold text-slate-500 mb-1">Khách phù hợp</span>
              <span className="text-xl font-extrabold text-slate-800">{stats.eligible}</span>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-3.5">
              <span className="block text-[11px] font-semibold text-emerald-700 mb-1">Vào hàng đợi gửi</span>
              <span className="text-xl font-extrabold text-emerald-700">{stats.queued}</span>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5">
              <span className="block text-[11px] font-semibold text-slate-500 mb-1">Bỏ qua (đã gửi)</span>
              <span className="text-xl font-extrabold text-slate-600">{stats.skipped}</span>
            </div>

            <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-3.5">
              <span className="block text-[11px] font-semibold text-rose-700 mb-1">Thất bại / Lỗi</span>
              <span className="text-xl font-extrabold text-rose-700">{stats.failed}</span>
            </div>
          </div>

          <p className="text-xs text-slate-500 text-center leading-relaxed">
            Các tin nhắn đã vào hàng đợi sẽ được chuyển đi tự động qua kênh liên lạc tương ứng.
          </p>
        </div>

        <footer className="flex items-center justify-end border-t border-slate-100 px-6 py-4 bg-slate-50/50 rounded-b-3xl">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:from-cyan-500 hover:to-blue-500 transition cursor-pointer"
          >
            Đã hiểu
          </button>
        </footer>
      </section>
    </div>,
    document.body
  );
}
