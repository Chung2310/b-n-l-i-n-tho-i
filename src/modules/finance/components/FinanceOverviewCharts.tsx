import { useState, useMemo } from "react";
import { TrendingUp, PieChart, AlertCircle, ArrowUpRight, ArrowRight, DollarSign, Wallet, ShieldAlert } from "lucide-react";
import { money } from "./ManagementUI";

type TrendRow = {
  date: string;
  revenue: number;
  cost: number | null;
  expense: number;
};

type SummaryData = {
  revenue: number;
  cost: number | null;
  grossProfit: number | null;
  expense: number;
  netProfit: number | null;
  missingCostCount?: number;
};

type DebtItem = {
  customerName?: string;
  supplierName?: string;
  balance: number;
  dueDate: string;
  daysUntil: number;
};

const formatShortMoney = (val: number) => {
  const abs = Math.abs(val);
  if (abs >= 1e9) return (val / 1e9).toFixed(1).replace(/\.0$/, "") + " tỷ";
  if (abs >= 1e6) return (val / 1e6).toFixed(1).replace(/\.0$/, "") + " tr";
  if (abs >= 1e3) return (val / 1e3).toFixed(0) + " k";
  return val.toLocaleString("vi-VN") + " đ";
};

const formatDateShort = (dateStr: string) => {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}` : dateStr;
};

// 1. Biểu đồ cột kép Doanh thu & Chi phí (Earning Reports style)
export function FinanceEarningsBarChart({ trends }: { trends: TrendRow[] }) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [viewScope, setViewScope] = useState<"7" | "14" | "all">("14");

  const displayRows = useMemo(() => {
    if (!trends || !trends.length) return [];
    const sorted = [...trends].sort((a, b) => a.date.localeCompare(b.date));
    if (viewScope === "7") return sorted.slice(-7);
    if (viewScope === "14") return sorted.slice(-14);
    return sorted;
  }, [trends, viewScope]);

  const maxVal = useMemo(() => {
    let max = 0;
    for (const r of displayRows) {
      if (r.revenue > max) max = r.revenue;
      if (r.expense > max) max = r.expense;
    }
    return Math.max(max, 100000);
  }, [displayRows]);

  // Tìm index có doanh thu cao nhất để hiển thị pill highlight như trong ảnh mẫu
  const highestRevenueIdx = useMemo(() => {
    let best = -1;
    let max = 0;
    displayRows.forEach((r, idx) => {
      if (r.revenue > max) {
        max = r.revenue;
        best = idx;
      }
    });
    return best;
  }, [displayRows]);

  if (!displayRows.length) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-slate-200/90 bg-white p-6 text-center shadow-xs">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Doanh thu & Chi phí</p>
        <p className="mt-2 text-sm text-slate-500">Chưa có dữ liệu trong khoảng thời gian này</p>
      </div>
    );
  }

  // Tọa độ biểu đồ SVG
  const chartHeight = 160;
  const barWidth = Math.max(8, Math.min(18, Math.floor(400 / (displayRows.length * 2.8))));
  const gap = Math.max(4, Math.floor(barWidth * 0.4));
  const groupWidth = barWidth * 2 + gap + 16;
  const svgWidth = Math.max(520, displayRows.length * groupWidth + 60);

  return (
    <div className="relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition-shadow hover:shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <h3 className="text-base font-bold text-slate-900">Báo cáo doanh thu & chi phí</h3>
          <div className="mt-1.5 flex items-center gap-4 text-xs font-semibold">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-xs" />
              <span className="text-slate-600">Chi phí</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-indigo-500 shadow-xs" />
              <span className="text-slate-600">Doanh thu</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 text-xs">
          <button
            type="button"
            onClick={() => setViewScope("7")}
            className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
              viewScope === "7" ? "bg-indigo-50 text-indigo-700 font-bold" : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            7 ngày
          </button>
          <button
            type="button"
            onClick={() => setViewScope("14")}
            className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
              viewScope === "14" ? "bg-indigo-50 text-indigo-700 font-bold" : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            14 ngày
          </button>
          <button
            type="button"
            onClick={() => setViewScope("all")}
            className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
              viewScope === "all" ? "bg-indigo-50 text-indigo-700 font-bold" : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            Tất cả
          </button>
        </div>
      </div>

      {/* SVG Bar Chart */}
      <div className="relative mt-4 overflow-x-auto" onMouseLeave={() => setActiveIdx(null)}>
        {activeIdx !== null && displayRows[activeIdx] && (
          <div className="absolute top-2 right-2 z-10 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur-xs pointer-events-none">
            <p className="font-bold text-slate-800">{formatDateShort(displayRows[activeIdx].date)}</p>
            <p className="mt-1 flex items-center justify-between gap-3 text-indigo-600 font-semibold">
              <span>Doanh thu:</span> <span>{money(displayRows[activeIdx].revenue)}</span>
            </p>
            <p className="flex items-center justify-between gap-3 text-cyan-600 font-semibold">
              <span>Chi phí:</span> <span>{money(displayRows[activeIdx].expense)}</span>
            </p>
          </div>
        )}

        <svg viewBox={`0 0 ${svgWidth} ${chartHeight + 50}`} className="w-full min-w-[500px] select-none">
          {/* Grid lines */}
          {[0, 0.33, 0.66, 1].map((ratio, i) => {
            const y = chartHeight - ratio * chartHeight + 20;
            const val = ratio * maxVal;
            return (
              <g key={i}>
                <line x1="45" x2={svgWidth - 15} y1={y} y2={y} stroke="#f1f5f9" strokeDasharray="3 3" />
                <text x="40" y={y + 3} textAnchor="end" fontSize="10" fill="#94a3b8">
                  {formatShortMoney(val)}
                </text>
              </g>
            );
          })}

          {/* Bars */}
          {displayRows.map((r, i) => {
            const groupX = 55 + i * groupWidth;
            const expenseH = Math.max(3, (r.expense / maxVal) * chartHeight);
            const revenueH = Math.max(3, (r.revenue / maxVal) * chartHeight);

            const expY = chartHeight - expenseH + 20;
            const revY = chartHeight - revenueH + 20;

            const isHovered = activeIdx === i;
            const isHighest = highestRevenueIdx === i;

            return (
              <g
                key={r.date}
                className="cursor-pointer"
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => setActiveIdx(i)}
              >
                {/* Highlight background on hover */}
                {isHovered && (
                  <rect
                    x={groupX - 6}
                    y="10"
                    width={groupWidth}
                    height={chartHeight + 15}
                    rx="8"
                    fill="#f8fafc"
                  />
                )}

                {/* Highlight pill for the highest bar */}
                {isHighest && !isHovered && r.revenue > 0 && (
                  <g>
                    <rect
                      x={groupX + barWidth + gap - 24}
                      y={revY - 22}
                      width="58"
                      height="17"
                      rx="8"
                      fill="#eef2ff"
                      stroke="#c7d2fe"
                      strokeWidth="1"
                    />
                    <text
                      x={groupX + barWidth + gap + 5}
                      y={revY - 10}
                      textAnchor="middle"
                      fontSize="9"
                      fontWeight="bold"
                      fill="#4f46e5"
                    >
                      {formatShortMoney(r.revenue)}
                    </text>
                  </g>
                )}

                {/* Expense bar (Cyan) */}
                <rect
                  x={groupX}
                  y={expY}
                  width={barWidth}
                  height={expenseH}
                  rx="4"
                  fill={isHovered ? "#06b6d4" : "#38bdf8"}
                  className="transition-colors"
                />

                {/* Revenue bar (Indigo/Purple) */}
                <rect
                  x={groupX + barWidth + gap}
                  y={revY}
                  width={barWidth}
                  height={revenueH}
                  rx="4"
                  fill={isHovered ? "#4f46e5" : "#6366f1"}
                  className="transition-colors"
                />

                {/* Date label */}
                <text
                  x={groupX + barWidth + gap / 2}
                  y={chartHeight + 36}
                  textAnchor="middle"
                  fontSize="10"
                  fill={isHovered ? "#1e293b" : "#64748b"}
                  fontWeight={isHovered ? "bold" : "normal"}
                >
                  {formatDateShort(r.date)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// 2. Biểu đồ hiệu quả tài chính & tỷ trọng cơ cấu (Performance Donut style)
export function FinancePerformanceDonut({ summary }: { summary: SummaryData }) {
  const rev = summary.revenue || 0;
  const cost = summary.cost ?? 0;
  const exp = summary.expense || 0;
  const gross = summary.grossProfit ?? (rev - cost);
  const net = summary.netProfit ?? (gross - exp);

  // Tỷ suất sinh lời cốt lõi
  const grossMarginPct = rev > 0 ? Math.round((gross / rev) * 100) : 0;
  const costPct = rev > 0 ? Math.round((cost / rev) * 100) : 0;
  const expPct = rev > 0 ? Math.round((exp / rev) * 100) : 0;

  // Donut geometry (radius 44, circumference ≈ 276.46)
  const radius = 44;
  const circumference = 2 * Math.PI * radius;

  // Giới hạn phần trăm hiển thị donut
  const boundedGross = Math.max(0, Math.min(100, grossMarginPct));
  const boundedCost = Math.max(0, Math.min(100 - boundedGross, costPct));
  const boundedExp = Math.max(0, Math.min(100 - boundedGross - boundedCost, expPct));

  const grossStroke = (boundedGross / 100) * circumference;
  const costStroke = (boundedCost / 100) * circumference;
  const expStroke = (boundedExp / 100) * circumference;

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <h3 className="text-base font-bold text-slate-900">Hiệu quả tài chính</h3>
        <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
          Biên lãi {grossMarginPct}%
        </span>
      </div>

      <div className="my-auto py-4 flex flex-col sm:flex-row items-center justify-around gap-6">
        {/* Donut chart */}
        <div className="relative flex items-center justify-center">
          <svg width="130" height="130" viewBox="0 0 120 120" className="-rotate-90">
            {/* Background ring */}
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="transparent"
              stroke="#f1f5f9"
              strokeWidth="12"
            />
            {/* Gross Profit Segment (Purple) */}
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="transparent"
              stroke="#8b5cf6"
              strokeWidth="12"
              strokeDasharray={`${grossStroke} ${circumference}`}
              strokeDashoffset="0"
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
            />
            {/* Cost Segment (Emerald) */}
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="transparent"
              stroke="#10b981"
              strokeWidth="12"
              strokeDasharray={`${costStroke} ${circumference}`}
              strokeDashoffset={`-${grossStroke}`}
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
            />
            {/* Expense Segment (Cyan) */}
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="transparent"
              stroke="#06b6d4"
              strokeWidth="12"
              strokeDasharray={`${expStroke} ${circumference}`}
              strokeDashoffset={`-${grossStroke + costStroke}`}
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              {grossMarginPct}%
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Lãi gộp
            </span>
          </div>
        </div>

        {/* Progress Breakdown Bars */}
        <div className="w-full sm:w-56 space-y-3.5">
          {/* Lãi gộp */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-semibold text-slate-700">Lãi gộp</span>
              <span className="font-bold text-purple-600">{money(gross)}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-purple-500 transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, grossMarginPct))}%` }}
              />
            </div>
          </div>

          {/* Giá vốn hàng bán */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-semibold text-slate-700">Giá vốn</span>
              <span className="font-bold text-emerald-600">{money(cost)}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, costPct))}%` }}
              />
            </div>
          </div>

          {/* Chi phí hoạt động */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-semibold text-slate-700">Chi phí</span>
              <span className="font-bold text-cyan-600">{money(exp)}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-cyan-500 transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, expPct))}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 3. Thẻ tóm tắt danh sách khoản nợ cần xử lý (Orders Overview style)
export function DebtOverviewCard({ debts }: { debts: { receivables: DebtItem[]; payables: DebtItem[] } }) {
  const urgentDebts = useMemo(() => {
    const list: (DebtItem & { party: string; type: "Phải thu" | "Phải trả" })[] = [];
    (debts?.receivables || []).forEach(r => {
      if (r.balance > 0 && r.daysUntil <= 7) {
        list.push({ ...r, party: r.customerName || "Khách hàng", type: "Phải thu" });
      }
    });
    (debts?.payables || []).forEach(p => {
      if (p.balance > 0 && p.daysUntil <= 7) {
        list.push({ ...p, party: p.supplierName || "Nhà cung cấp", type: "Phải trả" });
      }
    });
    return list.sort((a, b) => a.daysUntil - b.daysUntil).slice(0, 4);
  }, [debts]);

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
            <AlertCircle className="h-4 w-4" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Khoản nợ ưu tiên</h3>
        </div>
        <a
          href="?sub=cong-no"
          className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition"
        >
          Xem tất cả <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="mt-3 divide-y divide-slate-100">
        {urgentDebts.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500 font-medium">
            Không có khoản nợ nào sắp đến hạn hoặc quá hạn cần xử lý.
          </div>
        ) : (
          urgentDebts.map((item, idx) => {
            const isOverdue = item.daysUntil < 0;
            const isReceivable = item.type === "Phải thu";

            return (
              <div key={idx} className="flex items-center justify-between py-2.5 transition hover:bg-slate-50/70 px-2 rounded-xl">
                <div className="min-w-0 flex-1 pr-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                        isReceivable
                          ? "bg-indigo-50 text-indigo-700 border border-indigo-200/60"
                          : "bg-amber-50 text-amber-800 border border-amber-200/60"
                      }`}
                    >
                      {item.type}
                    </span>
                    <p className="truncate text-xs font-bold text-slate-800">{item.party}</p>
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Hạn: <span className={isOverdue ? "font-bold text-rose-600" : "font-medium text-slate-600"}>{item.dueDate}</span>
                    {isOverdue && ` (Quá hạn ${Math.abs(item.daysUntil)} ngày)`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-extrabold text-slate-900">{money(item.balance)}</p>
                  <span
                    className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold ${
                      isOverdue
                        ? "bg-rose-50 text-rose-700 border border-rose-200"
                        : "bg-amber-50 text-amber-700 border border-amber-200"
                    }`}
                  >
                    {isOverdue ? "Quá hạn" : "Sắp hạn"}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
