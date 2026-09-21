import { useState } from "react";
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Edit3,
  ExternalLink,
  History,
  Info,
  MessageSquare,
  Send,
  ShieldAlert,
  ShieldCheck,
  User,
  X,
} from "lucide-react";
import { PAYROLL_RECONCILIATION_FIELDS, type PayrollReconciliation, type PayrollReconciliationField } from "../../../shared/payrollReconciliation";
import { PAYROLL_RESULT_FIELDS } from "./payrollLineOverrides";

export type ReconciliationRequest = { action: "confirm" | "dispute" | "reply" | "resolve"; field?: PayrollReconciliationField; issueId?: string; body?: string };
const money = (value: number) => `${Number(value || 0).toLocaleString("vi-VN")} đ`;

export function PayrollReconciliationConversation({ record, staff = false, onAction, onEdit, issueId }: {
  record: PayrollReconciliation; staff?: boolean; onAction?: (action: ReconciliationRequest) => Promise<void>; onEdit?: (field: string) => void; issueId?: string;
}) {
  const [compose, setCompose] = useState<ReconciliationRequest | null>(null);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const editable = record.runStatus === "draft" && Boolean(onAction);
  const openCount = record.issues.filter(issue => issue.status === "open").length;
  const confirmed = record.confirmedChecksum === record.snapshot.checksum;
  const focusedIssue = issueId ? record.issues.find(issue => issue.id === issueId) : undefined;

  const start = (action: ReconciliationRequest) => { setCompose(action); setBody(""); setError(""); };
  const submit = async (action: ReconciliationRequest) => {
    if (!onAction) return;
    setBusy(true); setError("");
    try { await onAction(action); setCompose(null); setBody(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Không thể gửi phản hồi."); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4 text-xs">
      {/* Header trạng thái bản phát hành */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 border border-slate-200/80 px-3.5 py-2.5">
        <div className="flex items-center gap-2 text-slate-600">
          <Calendar size={13} className="text-slate-400" />
          <span>
            Phát hành {new Date(record.snapshot.publishedAt).toLocaleString("vi-VN")}
          </span>
          <span className="text-slate-300">·</span>
          <span className={`font-semibold ${openCount > 0 ? "text-amber-700" : confirmed ? "text-emerald-700" : "text-slate-500"}`}>
            {openCount ? `${openCount} khiếu nại đang mở` : confirmed ? "Đã xác nhận" : "Chờ xác nhận"}
          </span>
        </div>
        {confirmed && (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            <CheckCircle2 size={12} /> Đã chốt số liệu
          </span>
        )}
      </div>

      {/* Cảnh báo số liệu cũ cần phát hành lại */}
      {record.stale && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 shadow-2xs">
          <AlertTriangle size={15} className="text-amber-600 shrink-0" />
          <span>Kế toán đã sửa số liệu. Cần phát hành bản mới để nhân viên xác nhận lại.</span>
        </div>
      )}

      {/* Bảng số liệu đã phát hành */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50/90 text-slate-500 font-semibold border-b border-slate-200">
              <th className="py-2.5 px-3">Khoản lương tạm tính</th>
              <th className="py-2.5 px-3 text-right">Số liệu đã phát hành</th>
              <th className="py-2.5 px-3 text-right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {PAYROLL_RECONCILIATION_FIELDS.filter(field => !issueId || field.key === focusedIssue?.field).map(field => (
              <tr key={field.key} className="hover:bg-slate-50/50 transition-colors">
                <td className="py-2.5 px-3 text-slate-800">{field.label}</td>
                <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-900 font-semibold">
                  {field.unit === "minutes"
                    ? `${(record.snapshot.values[field.key] / 60).toLocaleString("vi-VN")} giờ`
                    : money(record.snapshot.values[field.key])}
                </td>
                <td className="py-2.5 px-3 text-right whitespace-nowrap">
                  {editable && (!staff ? (
                    <button
                      type="button"
                      disabled={busy}
                      aria-label={`Khiếu nại ${field.label}`}
                      onClick={() => start({ action: "dispute", field: field.key })}
                      className="inline-flex items-center gap-1 rounded-md border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700 hover:bg-cyan-100 disabled:opacity-50 cursor-pointer transition-colors"
                    >
                      <MessageSquare size={11} />
                      Gửi khiếu nại
                    </button>
                  ) : onEdit && PAYROLL_RESULT_FIELDS.some(item => item.key === field.key) && (
                    <button
                      type="button"
                      onClick={() => onEdit(field.key)}
                      className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 cursor-pointer transition-colors"
                    >
                      <Edit3 size={11} />
                      Sửa trên bảng lương
                    </button>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {staff && editable && (
        <div className="flex items-start gap-2 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 text-[11px] text-slate-600">
          <Info size={14} className="text-indigo-600 shrink-0 mt-0.5" />
          <p>
            Thiếu công: sửa dữ liệu chấm công rồi tính lại kỳ lương. Phụ cấp: sửa nguồn phụ cấp rồi tính lại. Thực nhận được tính từ các khoản lương. Sau khi lưu thay đổi, phát hành lại để nhân viên đối soát.
          </p>
        </div>
      )}

      {/* Luồng tin nhắn trao đổi (Issues) */}
      <div className="space-y-3 pt-1">
        {record.issues.filter(issue => !issueId || issue.id === issueId).map(issue => {
          const isOpen = issue.status === "open";
          const fieldDef = PAYROLL_RECONCILIATION_FIELDS.find(field => field.key === issue.field);

          return (
            <div key={issue.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
              {/* Header vấn đề */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
                  <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-indigo-700 border border-indigo-200">
                    {fieldDef?.label}
                  </span>
                  <span className="text-slate-400">—</span>
                  <span className={isOpen ? "text-amber-700" : "text-emerald-700"}>
                    {isOpen ? "Đang xử lý" : "Đã giải quyết"}
                  </span>
                </div>
                {isOpen ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">
                    Chưa hoàn tất
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                    <CheckCircle2 size={10} /> Đã xử lý xong
                  </span>
                )}
              </div>

              {/* Danh sách tin nhắn */}
              <div className="space-y-2.5">
                {issue.messages.map(message => {
                  const isStaff = message.role === "staff";
                  return (
                    <div
                      key={message.id}
                      className={`rounded-xl p-3 text-xs transition-all ${
                        isStaff
                          ? "border border-indigo-100 bg-indigo-50/50 text-indigo-950 ml-4 shadow-2xs"
                          : "border border-slate-200 bg-slate-50/80 text-slate-800 mr-4"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold ${
                            isStaff ? "bg-indigo-600 text-white" : "bg-slate-300 text-slate-700"
                          }`}>
                            {isStaff ? "KT" : "NV"}
                          </span>
                          <span className="font-bold text-slate-900">{message.authorName}</span>
                          <span className={`rounded px-1.5 py-0.2 text-[10px] font-semibold ${
                            isStaff ? "bg-indigo-100 text-indigo-800" : "bg-slate-200 text-slate-600"
                          }`}>
                            {isStaff ? "Kế toán" : "Nhân viên"}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(message.at).toLocaleString("vi-VN")}
                          {message.action === "resolve" ? " · Đánh dấu đã giải quyết" : ""}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap break-words leading-relaxed pl-6.5 text-slate-800">
                        {message.body}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Nút hành động phản hồi */}
              {editable && isOpen && (
                <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => start({ action: "reply", issueId: issue.id })}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors shadow-2xs"
                  >
                    <MessageSquare size={12} className="text-indigo-600" />
                    Trả lời
                  </button>
                  {staff && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => start({ action: "resolve", issueId: issue.id })}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 cursor-pointer transition-colors shadow-2xs"
                    >
                      <Check size={12} />
                      Giải quyết khiếu nại
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Khung soạn thảo phản hồi / giải quyết */}
      {compose && editable && (
        <form
          className="rounded-2xl border-2 border-indigo-200 bg-indigo-50/30 p-4 space-y-3 shadow-md"
          onSubmit={event => { event.preventDefault(); void submit({ ...compose, body }); }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              {compose.action === "resolve" ? (
                <>
                  <CheckCircle2 size={14} className="text-emerald-600" />
                  Xác nhận kết quả giải quyết khiếu nại
                </>
              ) : (
                <>
                  <MessageSquare size={14} className="text-indigo-600" />
                  Soạn nội dung phản hồi
                </>
              )}
            </span>
            <button
              type="button"
              onClick={() => setCompose(null)}
              className="text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>

          <label className="block text-xs font-semibold text-slate-700">
            {compose.action === "resolve" ? "Kết quả giải quyết" : "Nội dung trao đổi"}
            <textarea
              required
              maxLength={4000}
              placeholder={compose.action === "resolve" ? "Mô tả kết quả xử lý điều chỉnh lương hoặc giải thích cho nhân viên..." : "Nhập nội dung trao đổi làm rõ..."}
              value={body}
              onChange={event => setBody(event.target.value)}
              className="mt-1.5 min-h-24 w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 transition-all font-sans"
            />
          </label>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setCompose(null)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={busy || !body.trim()}
              className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-bold text-white shadow-xs cursor-pointer disabled:opacity-40 transition-colors ${
                compose.action === "resolve"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-indigo-600 hover:bg-indigo-700"
              }`}
            >
              <Send size={12} className={busy ? "animate-spin" : ""} />
              {busy ? "Đang gửi..." : "Gửi phản hồi"}
            </button>
          </div>
        </form>
      )}

      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-center gap-2">
          <AlertTriangle size={14} className="text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Xác nhận bảng lương dành cho nhân viên */}
      {!staff && editable && (
        <div className="pt-2">
          <button
            type="button"
            disabled={busy || Boolean(record.stale) || openCount > 0 || confirmed}
            onClick={() => void submit({ action: "confirm" })}
            className={`w-full inline-flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 text-xs font-bold text-white shadow-xs cursor-pointer disabled:opacity-50 transition-colors ${
              confirmed
                ? "bg-slate-400 cursor-not-allowed"
                : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            <ShieldCheck size={16} />
            {confirmed ? "Đã xác nhận bảng lương" : "Xác nhận bảng lương"}
          </button>
        </div>
      )}

      {/* Lịch sử phát hành và xác nhận (Collapsible Accordion) */}
      <details className="group rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 text-xs text-slate-600 transition-all">
        <summary className="flex items-center justify-between font-semibold text-slate-700 cursor-pointer select-none">
          <span className="flex items-center gap-1.5">
            <History size={13} className="text-slate-400" />
            Lịch sử phát hành và xác nhận ({record.publications.length} bản)
          </span>
          <ChevronDown size={14} className="text-slate-400 transition-transform group-open:rotate-180" />
        </summary>

        <div className="mt-2.5 space-y-2 border-t border-slate-200/60 pt-2">
          {record.publications.map((publication, index) => (
            <div key={`${publication.checksum}-${index}`} className="rounded-lg border border-slate-200 bg-white p-2.5 space-y-1">
              <div className="flex items-center justify-between font-bold text-slate-800">
                <span>Bản {index + 1}</span>
                <span className="font-mono text-[11px] text-slate-500">{new Date(publication.publishedAt).toLocaleString("vi-VN")}</span>
              </div>
              <p className="font-semibold text-indigo-700">Thực nhận: {money(publication.values.net)}</p>
              <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                {PAYROLL_RECONCILIATION_FIELDS.map(field => (
                  <p key={field.key}>
                    {field.label}: {field.unit === "minutes" ? `${publication.values[field.key]} phút` : money(publication.values[field.key])}
                  </p>
                ))}
              </div>
            </div>
          ))}

          {record.confirmations.map((confirmation, index) => (
            <p key={index} className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
              <CheckCircle2 size={12} />
              Xác nhận lúc {new Date(confirmation.at).toLocaleString("vi-VN")}
            </p>
          ))}
        </div>
      </details>
    </div>
  );
}
