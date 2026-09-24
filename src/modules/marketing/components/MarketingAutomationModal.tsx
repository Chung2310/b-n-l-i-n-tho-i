import React, { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  Check,
  FileText,
  Loader2,
  Save,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import type {
  MarketingAutomationConfig,
  MarketingAutomationType,
  MarketingChannel,
  MarketingChannelStatus,
  MarketingSettings,
} from "../api/marketing.api";
import TemplateEditor from "./TemplateEditor";

export interface MarketingAutomationModalProps {
  automation: {
    type: MarketingAutomationType;
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    manualScan?: "birthday" | "holiday" | "remarketing";
  };
  config: MarketingAutomationConfig;
  settings: MarketingSettings;
  canManage: boolean;
  channels: MarketingChannelStatus[];
  dirty: boolean;
  saving: boolean;
  onPatch: (type: MarketingAutomationType, values: Partial<MarketingAutomationConfig>) => void;
  onUpdateSettings: (patch: Partial<MarketingSettings>) => void;
  onSendTest: (type: MarketingAutomationType) => void;
  onRunScan: (scan: "birthday" | "holiday" | "remarketing") => void;
  onClose: () => void;
  onSave: () => void;
}

export default function MarketingAutomationModal({
  automation,
  config,
  settings,
  canManage,
  channels,
  dirty,
  saving,
  onPatch,
  onUpdateSettings,
  onSendTest,
  onRunScan,
  onClose,
  onSave,
}: MarketingAutomationModalProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const Icon = automation.icon;

  // ESC key and body scroll lock
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
        {/* Header */}
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600 shadow-2xs">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id={titleId} className="text-base font-bold text-slate-900">
                  {automation.title}
                </h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    config.enabled
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {config.enabled ? "Đang bật" : "Đang tắt"}
                </span>
              </div>
              <p className="text-xs text-slate-500 line-clamp-1">{automation.description}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 select-none">
              <input
                type="checkbox"
                checked={config.enabled}
                disabled={!canManage}
                onChange={(event) =>
                  onPatch(automation.type, { enabled: event.target.checked })
                }
                className="h-4 w-4 rounded accent-cyan-600 cursor-pointer"
              />
              Bật tự động
            </label>
            <button
              type="button"
              aria-label="Đóng popup"
              onClick={onClose}
              className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Scrollable Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Section: Channels */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">
                Kênh gửi tin nhắn khả dụng
              </span>
              <span className="text-[11px] text-slate-400">
                Hệ thống gửi qua kênh khả dụng đầu tiên
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {channels.map((channel) => {
                const active = config.channels.includes(channel.channel);
                const usable = channel.implemented;
                return (
                  <button
                    key={channel.channel}
                    type="button"
                    disabled={!canManage}
                    title={
                      usable
                        ? channel.configured
                          ? "Đã cấu hình"
                          : "Chưa cấu hình"
                        : "Chưa nối API nhà cung cấp"
                    }
                    onClick={() =>
                      onPatch(automation.type, {
                        channels: active
                          ? config.channels.filter((item) => item !== channel.channel)
                          : ([...config.channels, channel.channel] as MarketingChannel[]),
                      })
                    }
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                      active
                        ? "border-cyan-500 bg-cyan-50 text-cyan-700 shadow-2xs"
                        : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                    } ${usable ? "" : "opacity-60"}`}
                  >
                    {active && <Check className="h-3.5 w-3.5 text-cyan-600" />}
                    {channel.label}
                    {!usable && (
                      <span className="text-[10px] text-slate-400">· sắp có</span>
                    )}
                    {usable && !channel.configured && (
                      <span className="text-[10px] text-amber-500">· chưa cấu hình</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Special Option: Thank you - attachInvoicePdf */}
          {automation.type === "thank_you" && (
            <label className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 text-xs font-semibold text-slate-700 cursor-pointer hover:border-slate-300 transition">
              <input
                type="checkbox"
                checked={settings.attachInvoicePdf}
                disabled={!canManage}
                onChange={(event) =>
                  onUpdateSettings({ attachInvoicePdf: event.target.checked })
                }
                className="mt-0.5 h-4 w-4 rounded accent-cyan-600 cursor-pointer"
              />
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <FileText className="h-4 w-4 text-cyan-600" />
                  Gửi kèm hoá đơn PDF khi gửi qua Email
                </div>
                <p className="text-slate-500 font-normal leading-relaxed">
                  Tự động đính kèm bản in hoá đơn chính thức của chi nhánh. Áp dụng cho email; nếu đơn chưa xuất hoá đơn thì tin vẫn gửi bình thường không có tệp đính kèm.
                </p>
              </div>
            </label>
          )}

          {/* Special Option: Remarketing - days */}
          {automation.type === "remarketing" && (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
              <span className="block text-xs font-bold text-slate-800 mb-2.5">
                Quy tắc chu kỳ quét khách cũ
              </span>
              <div className="grid gap-3 sm:grid-cols-2 text-xs text-slate-700">
                <label className="font-semibold block">
                  <span className="block mb-1 text-slate-600">Không mua sau (ngày):</span>
                  <input
                    type="number"
                    min={7}
                    value={settings.remarketingInactiveDays}
                    disabled={!canManage}
                    onChange={(event) =>
                      onUpdateSettings({
                        remarketingInactiveDays: Number(event.target.value),
                      })
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                  />
                </label>
                <label className="font-semibold block">
                  <span className="block mb-1 text-slate-600">Chờ giữa 2 lần gửi (ngày):</span>
                  <input
                    type="number"
                    min={7}
                    value={settings.remarketingCooldownDays}
                    disabled={!canManage}
                    onChange={(event) =>
                      onUpdateSettings({
                        remarketingCooldownDays: Number(event.target.value),
                      })
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                  />
                </label>
              </div>
            </div>
          )}

          {/* Section: Template Editor */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">
                Nội dung mẫu tin nhắn
              </span>
              <span className="text-[11px] text-slate-400">
                Hỗ trợ chèn biến linh hoạt
              </span>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs">
              <TemplateEditor
                automationType={automation.type}
                subject={config.subject}
                html={config.html}
                disabled={!canManage}
                onChange={(values) => onPatch(automation.type, values)}
              />
            </div>
          </div>

          {/* Test & Run Scan Controls */}
          {canManage && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onSendTest(automation.type)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer shadow-2xs"
                >
                  <Send className="h-3.5 w-3.5 text-slate-500" />
                  Gửi thử nghiệm
                </button>
                {automation.manualScan && (
                  <button
                    type="button"
                    onClick={() => onRunScan(automation.manualScan!)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-200 bg-cyan-50 px-3.5 py-2 text-xs font-bold text-cyan-700 hover:bg-cyan-100 transition cursor-pointer shadow-2xs"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-cyan-600" />
                    Chạy quét ngay
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="flex shrink-0 items-center justify-between border-t border-slate-100 px-6 py-4 bg-slate-50/50 rounded-b-3xl">
          <div>
            {dirty ? (
              <span className="text-xs font-semibold text-amber-600">
                ● Có thay đổi chưa lưu
              </span>
            ) : (
              <span className="text-xs font-semibold text-slate-400">
                Đã đồng bộ
              </span>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            >
              Đóng
            </button>
            {canManage && (
              <button
                type="button"
                onClick={onSave}
                disabled={saving || !dirty}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-5 py-2 text-xs font-bold text-white shadow-xs transition hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 cursor-pointer"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Lưu cài đặt
              </button>
            )}
          </div>
        </footer>
      </section>
    </div>,
    document.body
  );
}
