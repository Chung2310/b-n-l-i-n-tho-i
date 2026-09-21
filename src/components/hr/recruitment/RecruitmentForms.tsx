import React from "react";
import { X, AlertCircle, Inbox, Loader2 } from "lucide-react";

export function RecruitmentDialog({
  title,
  children,
  onClose,
  maxWidth = "max-w-3xl",
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  maxWidth?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-sm transition-all"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`flex max-h-[92vh] w-full ${maxWidth} flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/10 transition-all`}
      >
        <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-3.5 backdrop-blur">
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
            title="Đóng"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export const fieldClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100 disabled:bg-slate-50 disabled:text-slate-500";

export const labelClass = "grid gap-1.5 text-xs font-semibold text-slate-700";

export const primaryButton =
  "inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 px-4 text-xs sm:text-sm font-semibold text-white shadow-sm transition-all hover:from-cyan-700 hover:to-teal-700 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer";

export const secondaryButton =
  "inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs sm:text-sm font-semibold text-slate-700 shadow-xs transition-all hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer";

export function ViewState({
  loading,
  error,
  empty,
}: {
  loading?: boolean;
  error?: string;
  empty?: string;
}) {
  if (loading) {
    return (
      <div className="flex min-h-52 flex-col items-center justify-center gap-3 py-10 text-slate-400">
        <Loader2 className="h-7 w-7 animate-spin text-cyan-600" />
        <span className="text-xs font-medium text-slate-500">Đang tải dữ liệu...</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="my-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-700">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
        <div>
          <p className="font-semibold text-red-900">Đã xảy ra lỗi</p>
          <p className="text-xs text-red-700 mt-0.5">{error}</p>
        </div>
      </div>
    );
  }
  if (empty) {
    return (
      <div className="flex min-h-52 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center text-slate-400">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60">
          <Inbox className="h-6 w-6 text-slate-400" />
        </div>
        <p className="text-sm font-medium text-slate-600">{empty}</p>
        <p className="text-xs text-slate-400">Bắt đầu bằng việc thêm mới hoặc điều chỉnh bộ lọc tìm kiếm.</p>
      </div>
    );
  }
  return null;
}
