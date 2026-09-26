import { useState, type ReactNode, type ElementType } from "react";
import {
  X,
  TrendingUp,
  TrendingDown,
  Package,
  Boxes,
  Wallet,
  Receipt,
  Scale,
  Clock,
  AlertTriangle,
  AlertCircle,
  FileCheck,
  FileSpreadsheet,
  Calculator,
  History,
  Lock,
  PieChart,
  Target,
  Hourglass,
  ArrowDownLeft,
  ArrowUpRight,
  Landmark,
  Coins,
  Users,
  Building2,
  DollarSign,
  Inbox,
} from "lucide-react";

export const money = (n: number | null | undefined) =>
  n == null ? "Chưa có dữ liệu" : `${Math.round(n).toLocaleString("vi-VN")} đ`;
export const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-800 outline-none transition-all focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20";
export const buttonClass =
  "rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 px-4 py-2 text-sm font-bold text-white shadow-sm shadow-cyan-600/20 hover:from-cyan-500 hover:to-sky-500 transition-all disabled:opacity-50 cursor-pointer";

export interface StatTheme {
  icon: ElementType;
  iconBg: string;
  iconColor: string;
  borderColor: string;
  accentBar: string;
  valueColor: string;
}

export function getStatConfig(title: string): StatTheme {
  const t = title.toLowerCase();

  if (t.includes("lãi ròng") || t.includes("lợi nhuận sau thuế")) {
    return {
      icon: Wallet,
      iconBg: "bg-violet-50 border border-violet-100/80",
      iconColor: "text-violet-600",
      borderColor: "hover:border-violet-200 hover:shadow-violet-500/5",
      accentBar: "from-violet-500 to-indigo-500",
      valueColor: "text-violet-900",
    };
  }
  if (t.includes("lãi gộp") || t.includes("lợi nhuận gộp")) {
    return {
      icon: Coins,
      iconBg: "bg-sky-50 border border-sky-100/80",
      iconColor: "text-sky-600",
      borderColor: "hover:border-sky-200 hover:shadow-sky-500/5",
      accentBar: "from-sky-500 to-cyan-500",
      valueColor: "text-sky-900",
    };
  }
  if (t.includes("doanh thu") || t.includes("thu thực tế") || t.includes("thu dự kiến") || t.includes("đã tất toán") || t.includes("khớp thực tế")) {
    return {
      icon: TrendingUp,
      iconBg: "bg-emerald-50 border border-emerald-100/80",
      iconColor: "text-emerald-600",
      borderColor: "hover:border-emerald-200 hover:shadow-emerald-500/5",
      accentBar: "from-emerald-500 to-teal-500",
      valueColor: "text-emerald-900",
    };
  }
  if (t.includes("giá vốn") || t.includes("chi phí cố định") || t.includes("định phí")) {
    return {
      icon: Package,
      iconBg: "bg-slate-100 border border-slate-200/80",
      iconColor: "text-slate-600",
      borderColor: "hover:border-slate-300",
      accentBar: "from-slate-400 to-slate-500",
      valueColor: "text-slate-900",
    };
  }
  if (t.includes("tồn kho") || t.includes("tài sản") || t.includes("nguyên giá")) {
    return {
      icon: Boxes,
      iconBg: "bg-amber-50 border border-amber-100/80",
      iconColor: "text-amber-600",
      borderColor: "hover:border-amber-200 hover:shadow-amber-500/5",
      accentBar: "from-amber-500 to-orange-500",
      valueColor: "text-amber-950",
    };
  }
  if (t.includes("quá hạn") || t.includes("đến hạn") || t.includes("thiếu") || t.includes("cần thanh toán") || t.includes("chênh lệch thiếu")) {
    return {
      icon: AlertCircle,
      iconBg: "bg-rose-50 border border-rose-100/80",
      iconColor: "text-rose-600",
      borderColor: "hover:border-rose-200 hover:shadow-rose-500/5",
      accentBar: "from-rose-500 to-red-500",
      valueColor: "text-rose-900",
    };
  }
  if (t.includes("phải thu") || t.includes("còn nợ")) {
    return {
      icon: ArrowDownLeft,
      iconBg: "bg-blue-50 border border-blue-100/80",
      iconColor: "text-blue-600",
      borderColor: "hover:border-blue-200 hover:shadow-blue-500/5",
      accentBar: "from-blue-500 to-indigo-500",
      valueColor: "text-blue-900",
    };
  }
  if (t.includes("phải trả") || t.includes("tổng chi") || t.includes("chi công nợ")) {
    return {
      icon: ArrowUpRight,
      iconBg: "bg-orange-50 border border-orange-100/80",
      iconColor: "text-orange-600",
      borderColor: "hover:border-orange-200 hover:shadow-orange-500/5",
      accentBar: "from-orange-500 to-amber-500",
      valueColor: "text-orange-950",
    };
  }
  if (t.includes("dòng tiền") || t.includes("số dư") || t.includes("dư cuối")) {
    return {
      icon: Landmark,
      iconBg: "bg-cyan-50 border border-cyan-100/80",
      iconColor: "text-cyan-600",
      borderColor: "hover:border-cyan-200 hover:shadow-cyan-500/5",
      accentBar: "from-cyan-500 to-blue-500",
      valueColor: "text-cyan-900",
    };
  }
  if (t.includes("chi phí") || t.includes("khấu hao")) {
    return {
      icon: Receipt,
      iconBg: "bg-purple-50 border border-purple-100/80",
      iconColor: "text-purple-600",
      borderColor: "hover:border-purple-200 hover:shadow-purple-500/5",
      accentBar: "from-purple-500 to-pink-500",
      valueColor: "text-purple-900",
    };
  }
  if (t.includes("vat đầu vào")) {
    return {
      icon: FileCheck,
      iconBg: "bg-emerald-50 border border-emerald-100/80",
      iconColor: "text-emerald-600",
      borderColor: "hover:border-emerald-200 hover:shadow-emerald-500/5",
      accentBar: "from-emerald-500 to-teal-500",
      valueColor: "text-emerald-900",
    };
  }
  if (t.includes("vat đầu ra")) {
    return {
      icon: FileSpreadsheet,
      iconBg: "bg-blue-50 border border-blue-100/80",
      iconColor: "text-blue-600",
      borderColor: "hover:border-blue-200 hover:shadow-blue-500/5",
      accentBar: "from-blue-500 to-cyan-500",
      valueColor: "text-blue-900",
    };
  }
  if (t.includes("vat phải nộp")) {
    return {
      icon: Calculator,
      iconBg: "bg-rose-50 border border-rose-100/80",
      iconColor: "text-rose-600",
      borderColor: "hover:border-rose-200 hover:shadow-rose-500/5",
      accentBar: "from-rose-500 to-red-500",
      valueColor: "text-rose-900",
    };
  }
  if (t.includes("chuyển kỳ")) {
    return {
      icon: History,
      iconBg: "bg-indigo-50 border border-indigo-100/80",
      iconColor: "text-indigo-600",
      borderColor: "hover:border-indigo-200 hover:shadow-indigo-500/5",
      accentBar: "from-indigo-500 to-violet-500",
      valueColor: "text-indigo-900",
    };
  }
  if (t.includes("hòa vốn")) {
    return {
      icon: Target,
      iconBg: "bg-teal-50 border border-teal-100/80",
      iconColor: "text-teal-600",
      borderColor: "hover:border-teal-200 hover:shadow-teal-500/5",
      accentBar: "from-teal-500 to-emerald-500",
      valueColor: "text-teal-900",
    };
  }
  if (t.includes("tỷ lệ đóng góp")) {
    return {
      icon: PieChart,
      iconBg: "bg-violet-50 border border-violet-100/80",
      iconColor: "text-violet-600",
      borderColor: "hover:border-violet-200 hover:shadow-violet-500/5",
      accentBar: "from-violet-500 to-purple-500",
      valueColor: "text-violet-900",
    };
  }
  if (t.includes("đối tượng") || t.includes("khách hàng") || t.includes("tổng số khoản")) {
    return {
      icon: Users,
      iconBg: "bg-indigo-50 border border-indigo-100/80",
      iconColor: "text-indigo-600",
      borderColor: "hover:border-indigo-200 hover:shadow-indigo-500/5",
      accentBar: "from-indigo-500 to-blue-500",
      valueColor: "text-indigo-900",
    };
  }

  return {
    icon: Scale,
    iconBg: "bg-slate-50 border border-slate-200/80",
    iconColor: "text-slate-600",
    borderColor: "hover:border-slate-300",
    accentBar: "from-slate-400 to-slate-500",
    valueColor: "text-slate-900",
  };
}

export function Stats({
  values,
}: {
  values: [string, ReactNode][];
}) {
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
      {values.map(([title, value]) => {
        const theme = getStatConfig(title);
        const Icon = theme.icon;
        return (
          <div
            key={title}
            className={`group relative flex flex-col justify-between overflow-hidden rounded-xl border border-slate-200/90 bg-white px-3.5 py-3 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${theme.borderColor}`}
          >
            {/* Top row: Label & Icon */}
            <div className="flex items-start justify-between gap-2.5">
              <span className="text-[11px] sm:text-xs font-semibold text-slate-500 line-clamp-1 group-hover:text-slate-700 transition-colors">
                {title}
              </span>
              <div
                className={`flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105 ${theme.iconBg} ${theme.iconColor}`}
              >
                <Icon className="h-4 w-4" />
              </div>
            </div>

            {/* Value */}
            <div className="mt-1.5 min-w-0">
              <div
                className={`tracking-tight break-words ${
                  typeof value === "string" && (value.includes("Chưa") || value.includes("không"))
                    ? "text-xs sm:text-sm font-medium text-slate-400"
                    : `text-base sm:text-lg font-bold ${theme.valueColor}`
                }`}
              >
                {value}
              </div>
            </div>

            {/* Subtle bottom gradient accent bar on hover */}
            <div
              className={`absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r ${theme.accentBar} opacity-0 group-hover:opacity-100 transition-opacity`}
            />
          </div>
        );
      })}
    </div>
  );
}

export function DataTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: ReactNode[][];
}) {
  const [page, setPage] = useState(0);
  const safePage = Math.min(page, Math.max(0, Math.ceil(rows.length / 25) - 1));
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-bold uppercase tracking-wider text-slate-500">
            <tr>
              {headers.map((h) => (
                <th key={h} className="whitespace-nowrap px-4 py-3.5">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.slice(safePage * 25, safePage * 25 + 25).map((row, i) => (
              <tr key={i} className="hover:bg-slate-50/70 transition-colors">
                {row.map((cell, j) => (
                  <td key={j} className="px-4 py-3 text-slate-800">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td
                  colSpan={headers.length}
                  className="p-10 text-center text-slate-400"
                >
                  <Inbox className="mx-auto mb-2 h-8 w-8 stroke-1 text-slate-300" />
                  <p className="text-sm font-medium">Không có dữ liệu trong phạm vi đã chọn.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {rows.length > 25 && (
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 p-3 text-sm text-slate-600">
          <button
            disabled={!safePage}
            onClick={() => setPage(safePage - 1)}
            className="rounded-lg border border-slate-200 px-3 py-1 font-medium hover:bg-slate-50 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            Trước
          </button>
          <span className="text-xs font-semibold">
            {safePage + 1} / {Math.ceil(rows.length / 25)}
          </span>
          <button
            disabled={(safePage + 1) * 25 >= rows.length}
            onClick={() => setPage(safePage + 1)}
            className="rounded-lg border border-slate-200 px-3 py-1 font-medium hover:bg-slate-50 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            Sau
          </button>
        </div>
      )}
    </div>
  );
}
export type Field = {
    key: string;
    label: string;
    type?: string;
    options?: [
        string,
        string
    ][];
    required?: boolean;
    initial?: string | number;
};
export function EntryForm({ title, fields, onSave, onClose }: {
    title: string;
    fields: Field[];
    onSave: (value: any) => Promise<void>;
    onClose: () => void;
}) {
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label={title}><form onSubmit={async (e) => { e.preventDefault(); const form = new FormData(e.currentTarget); const values = Object.fromEntries(fields.map(f => [f.key, f.type === "number" ? Number(form.get(f.key)) : String(form.get(f.key) || "")])); setBusy(true); setError(""); try {
        await onSave(values);
        onClose();
    }
    catch (err) {
        setError(err instanceof Error ? err.message : "Không lưu được chứng từ.");
    }
    finally {
        setBusy(false);
    } }} className="max-h-[90vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-2xl bg-white p-5 text-slate-800"><div className="flex items-center justify-between"><h2 className="text-lg font-bold">{title}</h2><button type="button" disabled={busy} onClick={onClose} aria-label="Đóng"><X size={20}/></button></div><div className="grid gap-3 sm:grid-cols-2">{fields.map(f => <label key={f.key} className="space-y-1 text-sm"><span>{f.label}</span>{f.options ? <select className={inputClass} name={f.key} required={f.required !== false} defaultValue={f.initial}>{f.options.map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select> : <input className={inputClass} name={f.key} type={f.type || "text"} required={f.required !== false} defaultValue={f.initial} min={f.type === "number" ? 0 : undefined} step={f.type === "number" ? "any" : undefined}/>}</label>)}</div>{error && <p role="alert" className="text-sm text-red-600">{error}</p>}<button disabled={busy} className={buttonClass}>{busy ? "Đang lưu…" : "Lưu"}</button></form></div>;
}
export function exportCsv(name: string, headers: string[], rows: unknown[][]) {
    const escape = (value: unknown) => { let text = String(value ?? ""); if (/^[=+@-]/.test(text))
        text = `'${text}`; return `"${text.replace(/"/g, '""')}"`; };
    const blob = new Blob(["\uFEFF", [headers, ...rows].map(r => r.map(escape).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}
