import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Clock, Sparkles, X } from "lucide-react";

export interface SendTimeModalProps {
  initialTime: string;
  timeZone: string;
  canManage: boolean;
  onSave: (newTime: string) => void;
  onClose: () => void;
}

const COMMON_PRESETS = [
  { time: "08:00", label: "08:00 - Đầu giờ sáng" },
  { time: "09:00", label: "09:00 - Giờ chuẩn (Khuyên dùng)" },
  { time: "10:30", label: "10:30 - Giữa buổi sáng" },
  { time: "14:00", label: "14:00 - Đầu giờ chiều" },
  { time: "19:00", label: "19:00 - Buổi tối" },
];

export default function SendTimeModal({
  initialTime,
  timeZone,
  canManage,
  onSave,
  onClose,
}: SendTimeModalProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const [time, setTime] = useState(initialTime || "09:00");

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!time) return;
    onSave(time);
    onClose();
  };

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
        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600 shadow-2xs">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <h2 id={titleId} className="text-base font-bold text-slate-900">
                Giờ quét & gửi hằng ngày
              </h2>
              <p className="text-xs text-slate-500">Múi giờ hệ thống: {timeZone}</p>
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

        {/* Content */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Chọn giờ quét và gửi tin nhắn tự động:
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="time"
                  value={time}
                  disabled={!canManage}
                  onChange={(e) => setTime(e.target.value)}
                  required
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 font-mono text-base font-bold text-slate-800 shadow-inner focus:border-cyan-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                />
              </div>
            </div>

            {/* Quick Presets */}
            <div>
              <span className="block text-[11px] font-semibold text-slate-400 mb-2">
                Hoặc chọn khung giờ đề xuất:
              </span>
              <div className="grid gap-1.5 sm:grid-cols-1">
                {COMMON_PRESETS.map((preset) => (
                  <button
                    key={preset.time}
                    type="button"
                    disabled={!canManage}
                    onClick={() => setTime(preset.time)}
                    className={`flex items-center justify-between rounded-xl border px-3.5 py-2 text-xs font-medium transition cursor-pointer ${
                      time === preset.time
                        ? "border-cyan-500 bg-cyan-50 text-cyan-800 font-bold"
                        : "border-slate-100 bg-slate-50/40 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <span>{preset.label}</span>
                    {time === preset.time && (
                      <Check className="h-4 w-4 text-cyan-600" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Explanatory notice */}
            <div className="rounded-2xl border border-cyan-100 bg-cyan-50/50 p-3.5 text-xs text-slate-600 leading-relaxed">
              <div className="flex items-center gap-1.5 font-bold text-cyan-800 mb-1">
                <Sparkles className="h-3.5 w-3.5 text-cyan-600" />
                Cơ chế tự động
              </div>
              Vào đúng khung giờ này mỗi ngày, máy chủ sẽ tự động kích hoạt tiến trình quét sinh nhật, đối soát chiến dịch lễ tết và remarketing khách cũ để gửi thông điệp tới khách hàng.
            </div>
          </div>

          {/* Footer */}
          <footer className="flex items-center justify-end gap-2.5 border-t border-slate-100 px-6 py-4 bg-slate-50/50 rounded-b-3xl">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            >
              Hủy
            </button>
            {canManage && (
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-5 py-2 text-xs font-bold text-white shadow-xs transition hover:from-cyan-500 hover:to-blue-500 cursor-pointer"
              >
                <Check className="h-4 w-4" />
                Xác nhận thay đổi
              </button>
            )}
          </footer>
        </form>
      </section>
    </div>,
    document.body
  );
}
