import React, { useEffect, useState } from "react";
import {
  BarChart3,
  Calendar,
  Layers,
  Loader2,
  FileText,
  ShieldCheck,
  Wrench,
  Cpu,
  Coins,
  AlertCircle,
  UserCheck,
  Star,
  Clock,
  TrendingUp,
} from "lucide-react";
import {
  repairExtras,
  type RepairRevenueRow,
  type RepairTechnicianRow,
} from "../../services/repairService";
import { toast } from "../../pages/Toast";

const money = (value?: number) => Number(value || 0).toLocaleString("vi-VN");
const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => `${new Date().toISOString().slice(0, 7)}-01`;
const GROUP_LABEL: Record<string, string> = {
  branch: "Chi nhánh",
  technician: "Kỹ thuật viên",
  day: "Ngày",
};

function Card({
  label,
  value,
  icon: Icon,
  iconColor,
  tone = "text-slate-900",
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  tone?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </span>
        <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${iconColor}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className={`mt-2 text-xl sm:text-2xl font-black ${tone}`}>{value}</p>
    </div>
  );
}

export default function RepairReportsPanel() {
  const [range, setRange] = useState({ from: monthStart(), to: today() });
  const [groupBy, setGroupBy] = useState<"branch" | "technician" | "day">("branch");
  const [revenue, setRevenue] = useState<{
    items: RepairRevenueRow[];
    total: RepairRevenueRow;
  } | null>(null);
  const [technicians, setTechnicians] = useState<RepairTechnicianRow[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    try {
      const [revenueReport, technicianReport] = await Promise.all([
        repairExtras.revenueReport({ ...range, groupBy }),
        repairExtras.technicianReport(range),
      ]);
      setRevenue(revenueReport);
      setTechnicians(technicianReport);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không tải được báo cáo.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void load();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [groupBy]);

  // Cột giá vốn/lãi chỉ có khi tài khoản được cấp repair:cost:read — server đã lược bỏ sẵn.
  const showCost = Boolean(
    revenue?.items?.some((row) => row.grossProfit !== undefined)
  );

  return (
    <div className="space-y-5">
      {/* Filters Form Card */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void load();
        }}
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs"
      >
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            Từ ngày
          </span>
          <input
            type="date"
            value={range.from}
            onChange={(e) => setRange({ ...range, from: e.target.value })}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs sm:text-sm font-medium text-slate-800 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100 cursor-pointer"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            Đến ngày
          </span>
          <input
            type="date"
            value={range.to}
            onChange={(e) => setRange({ ...range, to: e.target.value })}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs sm:text-sm font-medium text-slate-800 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100 cursor-pointer"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
          <span className="flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-slate-400" />
            Nhóm theo
          </span>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as any)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs sm:text-sm font-medium text-slate-800 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100 cursor-pointer"
          >
            {Object.entries(GROUP_LABEL).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <button
          disabled={busy}
          className="h-10 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 px-5 text-xs sm:text-sm font-bold text-white shadow-sm shadow-cyan-600/20 active:scale-95 disabled:opacity-50 cursor-pointer transition-all"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          <span>{busy ? "Đang tải..." : "Xem báo cáo"}</span>
        </button>
      </form>

      {/* KPI Cards */}
      {revenue && (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            <Card
              label="Số phiếu"
              value={String(revenue.total.ticketCount)}
              icon={FileText}
              iconColor="bg-slate-100 text-slate-700"
            />
            <Card
              label="Trong đó BH"
              value={String(revenue.total.warrantyTicketCount)}
              icon={ShieldCheck}
              iconColor="bg-emerald-50 text-emerald-700"
            />
            <Card
              label="Công sửa"
              value={money(revenue.total.laborRevenue)}
              icon={Wrench}
              iconColor="bg-cyan-50 text-cyan-700"
              tone="text-cyan-800"
            />
            <Card
              label="Linh kiện"
              value={money(revenue.total.partRevenue)}
              icon={Cpu}
              iconColor="bg-purple-50 text-purple-700"
            />
            <Card
              label="Tổng DT"
              value={money(revenue.total.revenue)}
              icon={Coins}
              iconColor="bg-indigo-50 text-indigo-700"
              tone="text-indigo-800"
            />
            <Card
              label="Còn nợ"
              value={money(revenue.total.outstanding)}
              icon={AlertCircle}
              iconColor="bg-rose-50 text-rose-700"
              tone="text-rose-600"
            />
          </div>

          {/* Revenue Breakdown Table */}
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h2 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-cyan-600" />
                <span>Doanh thu theo {GROUP_LABEL[groupBy]}</span>
              </h2>
              <span className="text-xs text-slate-400 font-medium">
                {revenue.items.length} bản ghi
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">{GROUP_LABEL[groupBy]}</th>
                    <th className="px-3 py-3 text-center">Số phiếu</th>
                    <th className="px-3 py-3 text-center">Bảo hành</th>
                    <th className="px-3 py-3 text-right">Công sửa</th>
                    <th className="px-3 py-3 text-right">Linh kiện</th>
                    <th className="px-3 py-3 text-right">Doanh thu</th>
                    <th className="px-3 py-3 text-right">Đã thu</th>
                    <th className="px-3 py-3 text-right">Còn nợ</th>
                    {showCost && (
                      <>
                        <th className="px-3 py-3 text-right">Giá vốn LK</th>
                        <th className="px-3 py-3 text-right">Chi phí BH</th>
                        <th className="px-3 py-3 text-right">Lãi gộp</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {revenue.items.map((row) => (
                    <tr key={row.key} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-bold text-slate-800">
                        {row.technicianName || row.key || "—"}
                      </td>
                      <td className="px-3 py-3 text-center font-medium text-slate-700">
                        {row.ticketCount}
                      </td>
                      <td className="px-3 py-3 text-center font-medium text-emerald-700">
                        {row.warrantyTicketCount}
                      </td>
                      <td className="px-3 py-3 text-right font-medium text-slate-700">
                        {money(row.laborRevenue)}
                      </td>
                      <td className="px-3 py-3 text-right font-medium text-slate-700">
                        {money(row.partRevenue)}
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-slate-900">
                        {money(row.revenue)}
                      </td>
                      <td className="px-3 py-3 text-right font-medium text-emerald-700">
                        {money(row.collected)}
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-rose-600">
                        {money(row.outstanding)}
                      </td>
                      {showCost && (
                        <>
                          <td className="px-3 py-3 text-right font-medium text-slate-600">
                            {money(row.partCost)}
                          </td>
                          <td className="px-3 py-3 text-right font-medium text-slate-600">
                            {money(row.warrantyPartCost)}
                          </td>
                          <td className="px-3 py-3 text-right font-bold text-emerald-700">
                            {money(row.grossProfit)}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>

              {!revenue.items.length && (
                <div className="p-8 text-center text-xs text-slate-400">
                  Chưa có phiếu nào hoàn tất trong kỳ đã chọn.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Technician Performance Table */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h2 className="font-bold text-sm text-slate-800 flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-cyan-600" />
            <span>Hiệu suất kỹ thuật viên</span>
          </h2>
          <span className="text-xs text-slate-400 font-medium">
            {technicians.length} kỹ thuật viên
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Kỹ thuật viên</th>
                <th className="px-3 py-3 text-center">Phiếu</th>
                <th className="px-3 py-3 text-center">TG sửa TB</th>
                <th className="px-3 py-3 text-center">Sửa lại</th>
                <th className="px-3 py-3 text-center">Lượt chấm</th>
                <th className="px-3 py-3 text-center">Điểm TB</th>
                <th className="px-3 py-3 text-center">Tay nghề</th>
                <th className="px-3 py-3 text-center">Thái độ</th>
                <th className="px-3 py-3 text-center">Tốc độ</th>
                <th className="px-4 py-3 text-right">Doanh thu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {technicians.map((row) => (
                <tr key={row.technicianId} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3 font-bold text-slate-800">
                    {row.technicianName || row.technicianId}
                  </td>
                  <td className="px-3 py-3 text-center font-medium text-slate-700">
                    {row.ticketCount}
                  </td>
                  <td className="px-3 py-3 text-center font-medium text-slate-600">
                    {row.averageMinutes >= 60
                      ? `${Math.round(row.averageMinutes / 6) / 10} giờ`
                      : `${row.averageMinutes} phút`}
                  </td>
                  <td className="px-3 py-3 text-center font-medium text-amber-700">
                    {row.reworkCount} ({row.reworkRate}%)
                  </td>
                  <td className="px-3 py-3 text-center font-medium text-slate-600">
                    {row.ratingCount}
                  </td>
                  <td className="px-3 py-3 text-center font-bold text-amber-600">
                    {row.averageRating || "—"}
                  </td>
                  <td className="px-3 py-3 text-center text-slate-600">
                    {row.criteria.skill || "—"}
                  </td>
                  <td className="px-3 py-3 text-center text-slate-600">
                    {row.criteria.attitude || "—"}
                  </td>
                  <td className="px-3 py-3 text-center text-slate-600">
                    {row.criteria.speed || "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-cyan-800">
                    {money(row.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!technicians.length && (
            <div className="p-8 text-center text-xs text-slate-400">
              Chưa có phiếu nào được phân công kỹ thuật viên trong kỳ.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
