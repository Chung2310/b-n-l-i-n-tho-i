import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar, CalendarPlus, Loader2, Sparkles, X } from "lucide-react";
import { marketingApi, type MarketingCampaign } from "../api/marketing.api";
import TemplateEditor from "./TemplateEditor";

export interface HolidayCampaignModalProps {
  onClose: () => void;
  onCreated: () => void;
}

export default function HolidayCampaignModal({
  onClose,
  onCreated,
}: HolidayCampaignModalProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const [name, setName] = useState("");
  const [runDate, setRunDate] = useState("");
  const [targetTierCodes, setTargetTierCodes] = useState("");
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !runDate || !subject.trim() || !html.trim()) {
      setError("Vui lòng nhập đầy đủ: Tên dịp, ngày chạy, tiêu đề và nội dung.");
      return;
    }

    setBusy(true);
    setError(undefined);
    try {
      await marketingApi.createCampaign({
        name: name.trim(),
        runDate,
        subject: subject.trim(),
        html: html.trim(),
        targetTierCodes: targetTierCodes
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      });
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Tạo chiến dịch lễ tết thất bại.");
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in"
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
        className="relative flex max-h-[92dvh] w-full max-w-3xl flex-col rounded-3xl border border-slate-100 bg-white shadow-2xl outline-none"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-50 to-blue-50 text-cyan-600 shadow-2xs">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h2 id={titleId} className="text-base font-bold text-slate-900">
                Thêm chiến dịch lễ tết mới
              </h2>
              <p className="text-xs text-slate-500">
                Thiết lập thông điệp tự động gửi vào ngày lễ đặc biệt
              </p>
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

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
                {error}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold text-slate-700 block">
                <span className="block mb-1">Tên dịp lễ / chiến dịch <span className="text-rose-500">*</span></span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="VD: Chúc Tết Nguyên Đán 2026, 8/3..."
                  required
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-800 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                />
              </label>

              <label className="text-xs font-bold text-slate-700 block">
                <span className="block mb-1">Ngày chạy chiến dịch <span className="text-rose-500">*</span></span>
                <input
                  type="date"
                  value={runDate}
                  onChange={(e) => setRunDate(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-800 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                />
              </label>

              <label className="text-xs font-bold text-slate-700 block sm:col-span-2">
                <span className="block mb-1">Áp dụng cho hạng khách hàng (để trống = tất cả khách hàng)</span>
                <input
                  value={targetTierCodes}
                  onChange={(e) => setTargetTierCodes(e.target.value)}
                  placeholder="VD: VIP, PLATINUM, GOLD (phân cách bằng dấu phẩy)"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-800 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                />
              </label>
            </div>

            <div>
              <span className="text-xs font-bold text-slate-800 block mb-2">
                Nội dung mẫu tin nhắn <span className="text-rose-500">*</span>
              </span>
              <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                <TemplateEditor
                  automationType="holiday"
                  subject={subject}
                  html={html}
                  disabled={false}
                  onChange={(values) => {
                    if (values.subject !== undefined) setSubject(values.subject);
                    if (values.html !== undefined) setHtml(values.html);
                  }}
                />
              </div>
            </div>
          </div>

          <footer className="flex shrink-0 items-center justify-end gap-2.5 border-t border-slate-100 px-6 py-4 bg-slate-50/50 rounded-b-3xl">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-5 py-2 text-xs font-bold text-white shadow-xs transition hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 cursor-pointer"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CalendarPlus className="h-4 w-4" />
              )}
              Tạo chiến dịch
            </button>
          </footer>
        </form>
      </section>
    </div>,
    document.body
  );
}
