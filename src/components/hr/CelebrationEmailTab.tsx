import React from "react";
import {
  Eye,
  Loader2,
  Save,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Image as ImageIcon,
  X,
  Cake,
  PartyPopper,
  Clock,
  Send,
  Sparkles,
  CheckCircle2,
  Mail,
  History,
  Info,
  CalendarDays,
  Check,
} from "lucide-react";
import { companyEmailApi } from "../../services/companyEmailService";
import { toast } from "../../pages/Toast";
import { authService } from "../../services/authService";
import type { TemplateVariableConfig } from "../template-editor/templateEditorTypes";
import { toFriendlyTokens } from "../template-editor/templateTokenCodec";
import {
  HR_BIRTHDAY_TEMPLATE_VARIABLES,
  HR_HOLIDAY_TEMPLATE_VARIABLES,
} from "./hrCelebrationVariableRegistry";

function RichTextEditor({
  value,
  onChange,
  onUpload,
  variables,
}: {
  value: string;
  onChange: (val: string) => void;
  onUpload?: (token: string) => void;
  variables: TemplateVariableConfig[];
}) {
  const editorRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || "";
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const execCmd = (command: string, arg: string = "") => {
    document.execCommand(command, false, arg);
    handleInput();
  };

  const insertVariable = (variable: string) => {
    editorRef.current?.focus();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    range.deleteContents();
    const textNode = document.createTextNode(variable);
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.setEndAfter(textNode);
    selection.removeAllRanges();
    selection.addRange(range);
    handleInput();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const uploaded = await authService.uploadManagedFile(file, "hr.celebration");
      editorRef.current?.focus();
      execCmd(
        "insertHTML",
        `<img src="${uploaded.url}" class="max-w-full my-2 rounded-xl shadow-xs" style="max-height: 250px; object-fit: contain;" />`
      );
      onUpload?.(uploaded.uploadToken);
      toast.success("Đã chèn hình ảnh.");
    } catch (err: any) {
      toast.error(err.message || "Tải hình ảnh thất bại");
    }
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-all focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-100">
      {/* Editor Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50/80 p-2 text-slate-600 select-none">
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => execCmd("bold")}
            className="rounded-lg p-1.5 text-slate-700 transition-colors hover:bg-slate-200/80 cursor-pointer"
            title="In đậm"
          >
            <Bold className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => execCmd("italic")}
            className="rounded-lg p-1.5 text-slate-700 transition-colors hover:bg-slate-200/80 cursor-pointer"
            title="In nghiêng"
          >
            <Italic className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => execCmd("underline")}
            className="rounded-lg p-1.5 text-slate-700 transition-colors hover:bg-slate-200/80 cursor-pointer"
            title="Gạch chân"
          >
            <Underline className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mx-1 h-4 w-px bg-slate-200" />

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => execCmd("justifyLeft")}
            className="rounded-lg p-1.5 text-slate-700 transition-colors hover:bg-slate-200/80 cursor-pointer"
            title="Căn lề trái"
          >
            <AlignLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => execCmd("justifyCenter")}
            className="rounded-lg p-1.5 text-slate-700 transition-colors hover:bg-slate-200/80 cursor-pointer"
            title="Căn giữa"
          >
            <AlignCenter className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => execCmd("justifyRight")}
            className="rounded-lg p-1.5 text-slate-700 transition-colors hover:bg-slate-200/80 cursor-pointer"
            title="Căn lề phải"
          >
            <AlignRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mx-1 h-4 w-px bg-slate-200" />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200/80 cursor-pointer"
          title="Chèn ảnh"
        >
          <ImageIcon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Ảnh</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageUpload}
        />

        <div className="mx-1 h-4 w-px bg-slate-200" />

        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-0.5">
            Biến:
          </span>
          {variables.map((variable) => (
            <button
              key={variable.key}
              type="button"
              onClick={() => insertVariable(`{{${variable.key}}}`)}
              className="inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50/80 px-2.5 py-0.5 text-[11px] font-bold text-cyan-700 transition-all hover:bg-cyan-100 hover:border-cyan-300 active:scale-95 cursor-pointer shadow-2xs"
              title={`Chèn {{${variable.key}}}`}
              aria-label={variable.label}
            >
              <span>+</span>
              <span>{variable.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        className="min-h-[200px] max-h-[320px] overflow-y-auto p-4 text-xs sm:text-sm outline-none leading-relaxed prose prose-sm max-w-none bg-white text-slate-800"
        {...({ placeholder: "Nhập nội dung thư chúc mừng..." } as any)}
      />
    </div>
  );
}

const defaults = {
  birthdayEnabled: false,
  holidayEnabled: false,
  sendTime: "08:00",
  birthdayTemplate: {
    subject: "Chúc mừng sinh nhật {{employeeName}}",
    html: "<p>Chúc mừng sinh nhật {{employeeName}}!</p>",
  },
  holidayTemplate: {
    subject: "Chúc mừng {{holidayName}}",
    html: "<p>{{companyName}} kính chúc bạn một kỳ nghỉ vui vẻ.</p>",
  },
  holidayOverrides: [],
};

export default function CelebrationEmailTab() {
  const [config, setConfig] = React.useState<any>(defaults);
  const [history, setHistory] = React.useState<any[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [preview, setPreview] = React.useState<any>(null);
  const [uploadTokens, setUploadTokens] = React.useState<string[]>([]);

  const load = React.useCallback(
    () =>
      Promise.all([companyEmailApi.getCelebration(), companyEmailApi.history()])
        .then(([c, h]) => {
          setConfig({ ...defaults, ...(c || {}) });
          setHistory(h || []);
        })
        .catch((e) => toast.error(e.message)),
    []
  );

  React.useEffect(() => {
    void load();
  }, [load]);

  const template = (
    key: "birthdayTemplate" | "holidayTemplate",
    field: "subject" | "html",
    value: string
  ) =>
    setConfig((c: any) => ({ ...c, [key]: { ...c[key], [field]: value } }));

  const save = async () => {
    setBusy(true);
    try {
      await companyEmailApi.saveCelebration({ ...config, uploadTokens });
      setUploadTokens([]);
      toast.success("Đã lưu cấu hình email chúc mừng.");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const showPreview = async (value: any) => {
    try {
      setPreview(await companyEmailApi.preview(value));
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const sentSuccessCount = history.filter((h) => h.status === "sent").length;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-50/50">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-600 text-white shadow-md shadow-cyan-600/20">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-800">
                Email chúc mừng
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Tự động gửi thư chúc mừng nhân sự vào ngày sinh nhật hoặc các dịp nghỉ lễ theo cấu hình.
            </p>
          </div>
        </div>

        <button
          onClick={save}
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 text-white px-5 py-2.5 text-xs font-bold transition-all cursor-pointer shadow-sm shadow-cyan-600/25 active:scale-95 disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          <span>Lưu cấu hình</span>
        </button>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Sinh nhật
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
              <Cake className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-xl font-black text-slate-800">
              {config.birthdayEnabled ? "Đang bật" : "Đã tắt"}
            </p>
            <span
              className={`inline-block h-2 w-2 rounded-full ${config.birthdayEnabled ? "bg-emerald-500" : "bg-slate-300"
                }`}
            />
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Gửi đúng ngày sinh</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Ngày lễ / Tết
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <PartyPopper className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-xl font-black text-slate-800">
              {config.holidayEnabled ? "Đang bật" : "Đã tắt"}
            </p>
            <span
              className={`inline-block h-2 w-2 rounded-full ${config.holidayEnabled ? "bg-emerald-500" : "bg-slate-300"
                }`}
            />
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Theo lịch nghỉ lễ</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Giờ gửi
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-xl font-black text-cyan-700">
            {config.sendTime || "08:00"}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Gửi tự động hàng ngày</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Đã gửi
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <Send className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-xl font-black text-emerald-600">
            {sentSuccessCount}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Lượt gửi thành công</p>
        </div>
      </div>

      {/* Automation Trigger Settings Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-4 w-4 text-cyan-600" />
          <h3 className="text-sm font-bold text-slate-800">
            Cài đặt kích hoạt tự động
          </h3>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
          <div className="flex flex-wrap items-center gap-6">
            <Toggle
              label="Tự động chúc mừng sinh nhật"
              description="Tự động gửi email vào ngày sinh nhật nhân sự"
              checked={config.birthdayEnabled}
              onChange={(v: boolean) =>
                setConfig({ ...config, birthdayEnabled: v })
              }
            />
            <Toggle
              label="Tự động chúc mừng lễ/Tết"
              description="Tự động gửi email khi đến các ngày nghỉ lễ"
              checked={config.holidayEnabled}
              onChange={(v: boolean) =>
                setConfig({ ...config, holidayEnabled: v })
              }
            />
          </div>

          <div className="pt-4 sm:pt-0 sm:pl-6 shrink-0">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-2.5">
              <Clock className="h-4 w-4 text-slate-400" />
              <span>Giờ gửi tự động:</span>
              <input
                type="time"
                value={config.sendTime}
                onChange={(e) =>
                  setConfig({ ...config, sendTime: e.target.value })
                }
                className="h-9 rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-xs font-bold text-slate-800 outline-none transition-all focus:border-cyan-600 focus:bg-white focus:ring-2 focus:ring-cyan-100 cursor-pointer"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Template
          title="Mẫu thư chúc mừng sinh nhật"
          subtitle="Tự động gửi vào đúng ngày sinh nhật của nhân sự theo hồ sơ"
          icon={Cake}
          iconColor="text-rose-600 bg-rose-50"
          value={config.birthdayTemplate}
          variables={HR_BIRTHDAY_TEMPLATE_VARIABLES}
          onChange={(f: any, v: string) => template("birthdayTemplate", f, v)}
          onPreview={() => showPreview(config.birthdayTemplate)}
          onUpload={(token: string) =>
            setUploadTokens((current) => [...current, token])
          }
        />
        <Template
          title="Mẫu thư chúc mừng lễ/Tết"
          subtitle="Tự động gửi vào các ngày nghỉ lễ theo lịch của công ty"
          icon={PartyPopper}
          iconColor="text-amber-600 bg-amber-50"
          value={config.holidayTemplate}
          variables={HR_HOLIDAY_TEMPLATE_VARIABLES}
          onChange={(f: any, v: string) => template("holidayTemplate", f, v)}
          onPreview={() =>
            showPreview({ ...config.holidayTemplate, holidayName: "Ngày lễ" })
          }
          onUpload={(token: string) =>
            setUploadTokens((current) => [...current, token])
          }
        />
      </div>

      {/* Email Preview Modal */}
      {preview && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[calc(100vh-4rem)] animate-in zoom-in-95 duration-200">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 block" />
                </div>
                <span className="text-[11px] font-bold font-mono tracking-wider text-slate-300 ml-2">
                  XEM TRƯỚC EMAIL GỬI ĐI
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer rounded-lg p-1 hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="bg-slate-50/80 border-b border-slate-200/80 p-4 space-y-2 text-xs">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-slate-400 w-16 text-right shrink-0">
                  Từ:
                </span>
                <span className="text-slate-800 font-medium">
                  Hệ thống Anh Khoa Mobile &lt;no-reply@igen.vn&gt;
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-slate-400 w-16 text-right shrink-0">
                  Đến:
                </span>
                <span className="text-slate-800 font-medium">
                  nhanvien@company.com (Mẫu nhân sự)
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-slate-400 w-16 text-right shrink-0">
                  Tiêu đề:
                </span>
                <span className="text-slate-900 font-bold text-sm">
                  {preview.subject}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-100/60 flex justify-center">
              <div
                className="w-full max-w-xl bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm min-h-[250px] prose prose-sm max-w-none text-slate-800"
                dangerouslySetInnerHTML={{ __html: preview.html }}
              />
            </div>

            <div className="bg-slate-50 border-t border-slate-200/80 p-3.5 flex justify-end">
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="bg-slate-800 hover:bg-slate-950 text-white rounded-xl px-5 py-2 text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-xs"
              >
                Đóng bản xem trước
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-cyan-600" />
            <h3 className="font-bold text-sm text-slate-800">
              Lịch sử gửi email gần đây
            </h3>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {history.length} lượt gửi ghi nhận
          </span>
        </div>

        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3">
              <Mail className="h-6 w-6" />
            </div>
            <p className="text-xs font-bold text-slate-700">
              Chưa có lượt gửi email chúc mừng nào
            </p>
            <p className="text-[11px] text-slate-400 mt-1 max-w-sm">
              Khi đến giờ hẹn, các email chúc mừng sinh nhật hoặc lễ/Tết sẽ được hệ thống gửi tự động và ghi nhận tại đây.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">Nhân sự nhận</th>
                  <th className="px-3">Phân loại</th>
                  <th className="px-3">Ngày thực hiện</th>
                  <th className="px-3">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {history.map((row) => (
                  <tr
                    key={row._id}
                    className="text-slate-700 hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="py-3 px-3 font-medium">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-100/80 text-cyan-800 font-bold text-[11px] shrink-0">
                          {row.recipientEmail?.charAt(0)?.toUpperCase() || "@"}
                        </div>
                        <span className="truncate">{row.recipientEmail}</span>
                      </div>
                    </td>
                    <td className="px-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${row.eventType === "birthday"
                            ? "bg-rose-50 text-rose-700 border border-rose-200/60"
                            : "bg-amber-50 text-amber-700 border border-amber-200/60"
                          }`}
                      >
                        {row.eventType === "birthday" ? (
                          <>
                            <Cake className="h-3 w-3" />
                            Sinh nhật
                          </>
                        ) : (
                          <>
                            <PartyPopper className="h-3 w-3" />
                            Ngày lễ
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-3 text-slate-600 font-medium">
                      <div className="flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                        <span>{row.eventDate}</span>
                      </div>
                    </td>
                    <td className="px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${row.status === "sent"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                      >
                        {row.status === "sent" && (
                          <CheckCircle2 className="h-3 w-3" />
                        )}
                        {row.status === "sent" ? "Đã gửi" : row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none group">
      <div className="relative inline-flex items-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div
          className={`h-6 w-11 rounded-full transition-colors duration-200 ease-in-out ${checked ? "bg-cyan-600" : "bg-slate-200 group-hover:bg-slate-300"
            }`}
        >
          <div
            className={`h-5 w-5 transform rounded-full bg-white shadow-xs transition-transform duration-200 ease-in-out mt-0.5 ml-0.5 ${checked ? "translate-x-5" : "translate-x-0"
              }`}
          />
        </div>
      </div>
      <div>
        <span className="text-xs font-bold text-slate-750 block">{label}</span>
        {description && (
          <span className="text-[11px] text-slate-400 block">{description}</span>
        )}
      </div>
    </label>
  );
}

function Template({
  title,
  subtitle,
  icon: Icon,
  iconColor,
  value,
  variables,
  onChange,
  onPreview,
  onUpload,
}: {
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  value: { subject: string; html: string };
  variables: TemplateVariableConfig[];
  onChange: (field: "subject" | "html", value: string) => void;
  onPreview: () => void;
  onUpload: (token: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-5">
      <div className="space-y-4">
        {/* Card Header */}
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl shrink-0 ${iconColor}`}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-800">{title}</h3>
            {subtitle && (
              <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Subject Input */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Tiêu đề email
          </label>
          <input
            value={value.subject}
            onChange={(e) => onChange("subject", e.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-xs sm:text-sm font-semibold text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
            placeholder="Nhập tiêu đề email..."
          />
          <div className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-500 border border-slate-100">
            <Info className="h-3.5 w-3.5 text-cyan-600 shrink-0" />
            <span className="truncate">
              Hiển thị token:{" "}
              <strong className="font-semibold text-slate-700">
                {toFriendlyTokens(value.subject, variables)}
              </strong>
            </span>
          </div>
        </div>

        {/* Body Editor */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Nội dung thư
          </label>
          <RichTextEditor
            value={value.html}
            onChange={(val: string) => onChange("html", val)}
            onUpload={onUpload}
            variables={variables}
          />
        </div>
      </div>

      {/* Card Footer Actions */}
      <div className="flex justify-end pt-2 border-t border-slate-100">
        <button
          type="button"
          onClick={onPreview}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-2xs cursor-pointer active:scale-95"
        >
          <Eye className="h-4 w-4 text-slate-500" />
          <span>Bản xem trước</span>
        </button>
      </div>
    </section>
  );
}
