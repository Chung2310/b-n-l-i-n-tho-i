import React from "react";
import { partnerRequest } from "./partnerApi";
export default function CollaboratorPicker({ value, onChange }: { value?: string; onChange: (id: string) => void }) {
  const [items, setItems] = React.useState<Array<{ _id: string; code: string; name: string }>>([]);
  const [error, setError] = React.useState("");
  React.useEffect(() => { let active = true; partnerRequest("/collaborators").then(data => { if (active) setItems(data); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, []);
  return <label className="block text-sm"><span className="font-medium text-slate-600">CTV giới thiệu</span><select className="mt-1 w-full rounded-lg border bg-white p-2" value={value || ""} onChange={e => onChange(e.target.value)}><option value="">Không có CTV</option>{value && !items.some(p => p._id === value) && <option value={value}>CTV đã chọn</option>}{items.map(p => <option key={p._id} value={p._id}>{p.code} — {p.name}</option>)}</select>{error && <span className="text-xs text-red-600">Không tải được CTV: {error}</span>}</label>;
}
