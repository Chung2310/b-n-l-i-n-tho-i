import { useState } from "react";
import { money } from "./ManagementUI";

type TrendRow = { date: string; revenue: number; cost: number | null; expense: number };
const series = [
  { label: "Doanh thu", color: "#0284c7", get: (r: TrendRow) => r.revenue },
  { label: "Giá vốn", color: "#d97706", get: (r: TrendRow) => r.cost },
  { label: "Lãi gộp", color: "#059669", get: (r: TrendRow) => r.cost == null ? null : r.revenue - r.cost },
  { label: "Lãi ròng", color: "#7c3aed", get: (r: TrendRow) => r.cost == null ? null : r.revenue - r.cost - r.expense },
];
const dateLabel = (date: string) => date.split("-").reverse().join("/");
export default function FinanceTrendChart({ data }: { data: TrendRow[] }) {
  const [activeDate, setActiveDate] = useState<string>();
  if (!data.length) return null;
  const rows = [...data].sort((a, b) => a.date.localeCompare(b.date));
  const values = rows.flatMap(r => series.map(s => s.get(r)).filter((v): v is number => v != null));
  const min = Math.min(0, ...values), max = Math.max(1, ...values);
  const y = (v: number) => 214 - (v - min) / (max - min) * 192;
  const start = Date.parse(rows[0].date), end = Date.parse(rows[rows.length - 1].date);
  const x = (i: number) => end === start ? 457 : 94 + (Date.parse(rows[i].date) - start) / (end - start) * 726;
  const active = rows.findIndex(r => r.date === activeDate);
  const ticks = [...new Set(Array.from({ length: Math.min(6, rows.length) }, (_, i) =>
    Math.round(i * (rows.length - 1) / Math.max(1, Math.min(6, rows.length) - 1))))];
  return <div className="relative rounded-2xl border border-slate-300 bg-white p-4">
    <div className="mb-2 flex flex-wrap gap-4 text-xs">{series.map(s => <span key={s.label} style={{ color: s.color }}>{s.label}</span>)}</div>
    <p className="mb-2 text-xs text-slate-500">Đơn vị: VND · Rê chuột hoặc chạm vào biểu đồ để xem chi tiết.</p>
    {active >= 0 && <div role="status" className="absolute right-4 top-14 z-10 max-w-[calc(100%-2rem)] rounded-xl border border-slate-200 bg-white/95 p-3 text-xs shadow-lg pointer-events-none">
      <div className="mb-2 font-semibold text-slate-800">{dateLabel(rows[active].date)}</div>
      {series.map(s => <div key={s.label} className="flex justify-between gap-5 py-0.5"><span style={{ color: s.color }}>{s.label}</span><span className="font-medium text-slate-800">{money(s.get(rows[active]))}</span></div>)}
    </div>}
    <div className="overflow-x-auto" onPointerLeave={() => setActiveDate(undefined)}>
      <svg viewBox="0 0 850 260" role="group" aria-label="Diễn biến doanh thu, giá vốn và lợi nhuận theo ngày" className="w-full min-w-[600px]"
        onKeyDown={e => { if (e.key === "Escape") setActiveDate(undefined); }}>
        {[0, 1, 2, 3].map(i => { const value = min + (max - min) * i / 3; return <g key={i}>
          <line x1="94" x2="820" y1={y(value)} y2={y(value)} stroke="#e2e8f0" strokeDasharray="3 4"/>
          <text x="84" y={y(value) + 4} textAnchor="end" fontSize="10" fill="#64748b">{new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value)}</text>
        </g>; })}
        <line x1="94" x2="820" y1={y(0)} y2={y(0)} stroke="#94a3b8"/>
        {ticks.map(i => <text key={i} x={x(i)} y="242" textAnchor={i === 0 && rows.length > 1 ? "start" : i === rows.length - 1 && rows.length > 1 ? "end" : "middle"} fontSize="10" fill="#475569">{dateLabel(rows[i].date)}</text>)}
        {series.map(s => <g key={s.label}>
          <path fill="none" stroke={s.color} strokeWidth="1.5" d={rows.map((r, i) => s.get(r) == null ? "" : `${i === 0 || s.get(rows[i - 1]) == null ? "M" : "L"}${x(i)},${y(s.get(r)!)}`).join(" ")}/>
          {rows.map((r, i) => s.get(r) != null && (i === active || (i === 0 || s.get(rows[i - 1]) == null) && (i === rows.length - 1 || s.get(rows[i + 1]) == null)) ? <circle key={r.date} cx={x(i)} cy={y(s.get(r)!)} r="2.5" fill={s.color}/> : null)}
        </g>)}
        {active >= 0 && <line x1={x(active)} x2={x(active)} y1="22" y2="214" stroke="#94a3b8" strokeDasharray="3 4"/>}
        {rows.map((r, i) => { const left = i === 0 ? 94 : (x(i - 1) + x(i)) / 2; const right = i === rows.length - 1 ? 820 : (x(i) + x(i + 1)) / 2; return <rect key={r.date} x={left} y="12" width={right - left} height="214" fill="transparent" tabIndex={0} role="button" aria-label={"Xem ngày " + dateLabel(r.date)} className="cursor-crosshair focus:outline-none focus:stroke-sky-300"
          onPointerEnter={() => setActiveDate(r.date)} onPointerDown={() => setActiveDate(r.date)} onClick={() => setActiveDate(r.date)} onFocus={() => setActiveDate(r.date)} onBlur={() => setActiveDate(undefined)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActiveDate(r.date); } }}/>;
        })}
      </svg>
    </div>
  </div>;
}
