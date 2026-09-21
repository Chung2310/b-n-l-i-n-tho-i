import React from "react";
import { partnerRequest } from "./partnerApi";
import { Users, AlertCircle } from "lucide-react";

export default function CollaboratorPicker({
  value,
  onChange,
}: {
  value?: string;
  onChange: (id: string) => void;
}) {
  const [items, setItems] = React.useState<Array<{ _id: string; code: string; name: string }>>([]);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let active = true;
    partnerRequest("/collaborators")
      .then((data) => {
        if (active) setItems(data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
      <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
        <Users className="h-3.5 w-3.5 text-slate-400" />
        CTV giới thiệu (tính hoa hồng)
      </span>
      <select
        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 cursor-pointer"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Không có CTV</option>
        {value && !items.some((p) => p._id === value) && (
          <option value={value}>CTV đã chọn</option>
        )}
        {items.map((p) => (
          <option key={p._id} value={p._id}>
            {p.code} — {p.name}
          </option>
        ))}
      </select>
      {error && (
        <span className="mt-1 flex items-center gap-1 text-[11px] text-rose-600 dark:text-rose-400">
          <AlertCircle className="h-3 w-3" />
          Không tải được danh sách CTV: {error}
        </span>
      )}
    </label>
  );
}
