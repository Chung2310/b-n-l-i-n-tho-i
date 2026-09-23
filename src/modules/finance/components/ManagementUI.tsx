import { useState, type ReactNode } from "react";
import { X } from "lucide-react";
export const money = (n: number | null | undefined) => n == null ? "Chưa có dữ liệu" : `${Math.round(n).toLocaleString("vi-VN")} đ`;
export const inputClass = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800";
export const buttonClass = "rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
export function Stats({ values }: {
    values: [
        string,
        ReactNode
    ][];
}) { return <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{values.map(([title, value]) => <div key={title} className="rounded-2xl border border-slate-300 bg-white p-4"><div className="text-xl font-bold text-sky-700">{value}</div><div className="mt-1 text-sm text-slate-600">{title}</div></div>)}</div>; }
export function DataTable({ headers, rows }: {
    headers: string[];
    rows: ReactNode[][];
}) {
    const [page, setPage] = useState(0);
    const safePage = Math.min(page, Math.max(0, Math.ceil(rows.length / 25) - 1));
    return <div className="overflow-hidden rounded-2xl border border-slate-300 bg-white"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr>{headers.map(h => <th key={h} className="whitespace-nowrap px-4 py-3">{h}</th>)}</tr></thead><tbody>{rows.slice(safePage * 25, safePage * 25 + 25).map((row, i) => <tr key={i} className="border-t border-slate-100">{row.map((cell, j) => <td key={j} className="px-4 py-3">{cell}</td>)}</tr>)}{!rows.length && <tr><td colSpan={headers.length} className="p-6 text-center text-slate-500">Không có dữ liệu trong phạm vi đã chọn.</td></tr>}</tbody></table></div>{rows.length > 25 && <div className="flex items-center justify-end gap-3 border-t p-3 text-sm"><button disabled={!safePage} onClick={() => setPage(safePage - 1)}>Trước</button><span>{safePage + 1} / {Math.ceil(rows.length / 25)}</span><button disabled={(safePage + 1) * 25 >= rows.length} onClick={() => setPage(safePage + 1)}>Sau</button></div>}</div>;
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
