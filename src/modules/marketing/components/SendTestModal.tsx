import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Mail, Send, X } from "lucide-react";
import type { MarketingAutomationType } from "../api/marketing.api";

export interface SendTestModalProps {
  automationType: MarketingAutomationType;
  title: string;
  onSend: (recipient: string) => Promise<void>;
  onClose: () => void;
}

export default function SendTestModal({
  automationType,
  title,
  onSend,
  onClose,
}: SendTestModalProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const [recipient, setRecipient] = useState("");
  const [busy, setBusy] = useState(false);

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
    if (!recipient.trim()) return;
    setBusy(true);
    try {
      await onSend(recipient.trim());
      onClose();
    } finally {
      setBusy(false);
    }
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
        <header className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600 shadow-2xs">
              <Send className="h-5 w-5" />
            </div>
            <div>
              <h2 id={titleId} className="text-base font-bold text-slate-900">
                Gửi tin thử nghiệm
              </h2>
              <p className="text-xs text-slate-500 line-clamp-1">{title}</p>
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

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Nhập địa chỉ Email hoặc Số điện thoại người nhận:
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={recipient}
                  disabled={busy}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="VD: test@example.com hoặc 0912345678"
                  autoFocus
                  required
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-xs font-medium text-slate-800 shadow-inner focus:border-cyan-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                />
              </div>
              <p className="mt-1.5 text-[11px] text-slate-400">
                Tin nhắn mẫu sẽ được điền thông tin giả lập và gửi tới hòm thư hoặc số này để kiểm tra nội dung trước khi chạy tự động.
              </p>
            </div>
          </div>

          <footer className="flex items-center justify-end gap-2.5 border-t border-slate-100 px-6 py-4 bg-slate-50/50 rounded-b-3xl">
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
              disabled={busy || !recipient.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-5 py-2 text-xs font-bold text-white shadow-xs transition hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 cursor-pointer"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Gửi ngay
            </button>
          </footer>
        </form>
      </section>
    </div>,
    document.body
  );
}
