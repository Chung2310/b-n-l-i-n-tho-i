import React, { useEffect, useState, useMemo } from "react";
import {
  repairExtras,
  type RepairRevenueRow,
  type RepairTechnicianRow,
} from "../../services/repairService";
import { toast } from "../../pages/Toast";
import { Dropdown } from "../../components/common/Dropdown";
import { TablePagination } from "../../components/common/TablePagination";
import { RotateCw, Calendar } from "lucide-react";

export const formatMoney = (value?: number) =>
  `${Number(value || 0).toLocaleString("vi-VN")} đ`;

export const formatLocalDate = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const today = () => formatLocalDate(new Date());
const monthStart = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};

const GROUP_LABEL: Record<string, string> = {
  branch: "Chi nhánh",
  technician: "Kỹ thuật viên",
  day: "Ngày",
};

type PresetKey = "today" | "week" | "month" | "lastMonth" | "quarter";

interface StatCardProps {
  label: string;
  value: string;
  sublabel?: string;
  tone?: string;
  badge?: string;
  badgeColor?: string;
}

function StatCard({
  label,
  value,
  sublabel,
  tone = "text-slate-900",
  badge,
  badgeColor = "bg-slate-100 text-slate-700",
}: StatCardProps) {
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs transition hover:shadow-md">
      <div className="flex items-center justify-between gap-1 mb-2">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          {label}
        </span>
        {badge && (
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${badgeColor}`}
          >
            {badge}
          </span>
        )}
      </div>
      <div>
        <p className={`text-xl sm:text-2xl font-black tracking-tight ${tone}`}>
          {value}
        </p>
        {sublabel && (
          <p className="mt-1 text-xs text-slate-500 font-medium">{sublabel}</p>
        )}
      </div>
    </div>
  );
}

export default function RepairReportsPanel() {
  const [range, setRange] = useState({ from: monthStart(), to: today() });
  const [activePreset, setActivePreset] = useState<PresetKey | "custom">("month");
  const [groupBy, setGroupBy] = useState<"branch" | "technician" | "day">("branch");
  const [revenue, setRevenue] = useState<{
    items: RepairRevenueRow[];
    total: RepairRevenueRow;
  } | null>(null);
  const [technicians, setTechnicians] = useState<RepairTechnicianRow[]>([]);
  const [busy, setBusy] = useState(false);

  // Pagination states for Revenue and Technician tables
  const [revenuePage, setRevenuePage] = useState(1);
  const [revenuePageSize, setRevenuePageSize] = useState(10);
  const [techPage, setTechPage] = useState(1);
  const [techPageSize, setTechPageSize] = useState(10);

  // Quick date presets
  const applyPreset = (preset: PresetKey) => {
    setActivePreset(preset);
    const now = new Date();
    const todayStr = formatLocalDate(now);

    if (preset === "today") {
      setRange({ from: todayStr, to: todayStr });
    } else if (preset === "week") {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
      setRange({ from: formatLocalDate(d), to: todayStr });
    } else if (preset === "month") {
      setRange({ from: monthStart(), to: todayStr });
    } else if (preset === "lastMonth") {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      setRange({
        from: formatLocalDate(firstDay),
        to: formatLocalDate(lastDay),
      });
    } else if (preset === "quarter") {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      const qStart = new Date(now.getFullYear(), qMonth, 1);
      setRange({ from: formatLocalDate(qStart), to: todayStr });
    }
  };

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupBy, range.from, range.to]);

  // Reset pagination on filter change
  useEffect(() => {
    setRevenuePage(1);
    setTechPage(1);
  }, [groupBy, range.from, range.to]);

  // Paginated revenue data
  const totalRevenuePages = useMemo(
    () => Math.max(1, Math.ceil((revenue?.items.length || 0) / revenuePageSize)),
    [revenue?.items.length, revenuePageSize]
  );
  const validRevenuePage = Math.min(Math.max(1, revenuePage), totalRevenuePages);
  const paginatedRevenueItems = useMemo(() => {
    if (!revenue?.items) return [];
    const start = (validRevenuePage - 1) * revenuePageSize;
    return revenue.items.slice(start, start + revenuePageSize);
  }, [revenue?.items, validRevenuePage, revenuePageSize]);

  // Paginated technician data
  const totalTechPages = useMemo(
    () => Math.max(1, Math.ceil(technicians.length / techPageSize)),
    [technicians.length, techPageSize]
  );
  const validTechPage = Math.min(Math.max(1, techPage), totalTechPages);
  const paginatedTechnicians = useMemo(() => {
    const start = (validTechPage - 1) * techPageSize;
    return technicians.slice(start, start + techPageSize);
  }, [technicians, validTechPage, techPageSize]);

  // Check if gross profit / costs are exposed by permission
  const showCost = useMemo(
    () => Boolean(revenue?.items?.some((row) => row.grossProfit !== undefined)),
    [revenue]
  );

  return (
    <div className="space-y-5 pb-8">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Báo cáo sửa chữa & bảo hành
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Doanh thu phân loại theo chi nhánh và hiệu suất kỹ thuật viên, tính trên
            phiếu đã sửa xong trong kỳ.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void load()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition shadow-2xs cursor-pointer disabled:opacity-50"
        >
          <RotateCw className={`h-3.5 w-3.5 ${busy ? "animate-spin text-cyan-600" : "text-slate-400"}`} />
          <span>{busy ? "Đang tải dữ liệu..." : "Làm mới"}</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Quick Date Presets */}
          <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => applyPreset("today")}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                activePreset === "today"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Hôm nay
            </button>
            <button
              type="button"
              onClick={() => applyPreset("week")}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                activePreset === "week"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              7 ngày qua
            </button>
            <button
              type="button"
              onClick={() => applyPreset("month")}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                activePreset === "month"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Tháng này
            </button>
            <button
              type="button"
              onClick={() => applyPreset("lastMonth")}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                activePreset === "lastMonth"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Tháng trước
            </button>
            <button
              type="button"
              onClick={() => applyPreset("quarter")}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                activePreset === "quarter"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Quý này
            </button>
          </div>

          {/* Group By Filter Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Nhóm theo:</span>
            <Dropdown<"branch" | "technician" | "day">
              aria-label="Nhóm dữ liệu báo cáo"
              value={groupBy}
              onChange={(val) => setGroupBy(val)}
              options={[
                { value: "branch", label: "Theo Chi nhánh" },
                { value: "technician", label: "Theo Kỹ thuật viên" },
                { value: "day", label: "Theo Ngày" },
              ]}
              variant="filter"
              size="sm"
            />
          </div>
        </div>

        {/* Date Inputs & Submit Row */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void load();
          }}
          className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3"
        >
          <div className="flex items-center gap-2">
            <div className="relative flex items-center">
              <span className="text-xs font-medium text-slate-500 mr-2">Từ:</span>
              <input
                type="date"
                value={range.from}
                onChange={(e) => {
                  setActivePreset("custom");
                  setRange({ ...range, from: e.target.value });
                }}
                className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:border-cyan-500 focus:bg-white focus:outline-none transition"
              />
            </div>

            <div className="relative flex items-center">
              <span className="text-xs font-medium text-slate-500 mr-2">Đến:</span>
              <input
                type="date"
                value={range.to}
                onChange={(e) => {
                  setActivePreset("custom");
                  setRange({ ...range, to: e.target.value });
                }}
                className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:border-cyan-500 focus:bg-white focus:outline-none transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-cyan-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-cyan-700 transition shadow-2xs cursor-pointer disabled:opacity-50"
          >
            {busy ? "Đang tải..." : "Xem báo cáo"}
          </button>
        </form>
      </div>

      {/* KPI Metrics Strip */}
      {revenue && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard
            label="Tổng số phiếu"
            value={`${revenue.total.ticketCount} máy`}
            sublabel="Đã sửa xong trong kỳ"
            badge="Tổng số"
            badgeColor="bg-blue-50 text-blue-700 border border-blue-200/60"
          />
          <StatCard
            label="Bảo hành"
            value={`${revenue.total.warrantyTicketCount} máy`}
            sublabel={`${Math.round((revenue.total.warrantyTicketCount / (revenue.total.ticketCount || 1)) * 100)}% tổng số máy`}
            badge="Bảo hành"
            badgeColor="bg-amber-50 text-amber-700 border border-amber-200/60"
          />
          <StatCard
            label="Doanh thu công sửa"
            value={formatMoney(revenue.total.laborRevenue)}
            sublabel="Tiền công kỹ thuật"
            badge="Công sửa"
            badgeColor="bg-indigo-50 text-indigo-700 border border-indigo-200/60"
          />
          <StatCard
            label="Doanh thu linh kiện"
            value={formatMoney(revenue.total.partRevenue)}
            sublabel="Phụ tùng thay thế"
            badge="Linh kiện"
            badgeColor="bg-violet-50 text-violet-700 border border-violet-200/60"
          />
          <StatCard
            label="Tổng doanh thu"
            value={formatMoney(revenue.total.revenue)}
            sublabel={`Đã thu: ${formatMoney(revenue.total.collected)}`}
            tone="text-emerald-700"
            badge="Doanh số"
            badgeColor="bg-emerald-50 text-emerald-800 border border-emerald-200/60"
          />
          <StatCard
            label="Công nợ còn lại"
            value={formatMoney(revenue.total.outstanding)}
            sublabel={
              revenue.total.outstanding > 0
                ? "Cần thu hồi từ khách"
                : "Đã thu đủ 100%"
            }
            tone={revenue.total.outstanding > 0 ? "text-rose-600" : "text-emerald-600"}
            badge={revenue.total.outstanding > 0 ? "Chưa thu" : "Đủ"}
            badgeColor={
              revenue.total.outstanding > 0
                ? "bg-rose-50 text-rose-700 border border-rose-200/60"
                : "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
            }
          />
        </div>
      )}

      {/* Revenue Breakdown Table Card */}
      {revenue && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          <div className="border-b border-slate-100 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-slate-50/40">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Phân tích doanh thu theo {GROUP_LABEL[groupBy]}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Bóc tách chi tiết công sửa, linh kiện và tình trạng công nợ
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-500 self-start sm:self-auto">
              {revenue.items.length} bản ghi
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/90 text-slate-500 uppercase tracking-wider text-[11px] font-bold">
                <tr>
                  <th className="py-3 px-4">{GROUP_LABEL[groupBy]}</th>
                  <th className="py-3 px-3 text-center">Số phiếu</th>
                  <th className="py-3 px-3 text-center">Bảo hành</th>
                  <th className="py-3 px-3 text-right">Công sửa</th>
                  <th className="py-3 px-3 text-right">Linh kiện</th>
                  <th className="py-3 px-3 text-right font-bold text-slate-800">Doanh thu</th>
                  <th className="py-3 px-3 text-right">Đã thu</th>
                  <th className="py-3 px-4 text-right">Còn nợ</th>
                  {showCost && (
                    <>
                      <th className="py-3 px-3 text-right">Giá vốn LK</th>
                      <th className="py-3 px-3 text-right">Chi phí BH</th>
                      <th className="py-3 px-4 text-right font-bold text-emerald-800">Lãi gộp</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {paginatedRevenueItems.map((row) => (
                  <tr key={row.key} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {row.technicianName || row.key || "—"}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                        {row.ticketCount}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      {row.warrantyTicketCount > 0 ? (
                        <span className="rounded-md bg-amber-50 border border-amber-200/70 px-2 py-0.5 font-bold text-amber-800">
                          {row.warrantyTicketCount}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">{formatMoney(row.laborRevenue)}</td>
                    <td className="py-3 px-3 text-right">{formatMoney(row.partRevenue)}</td>
                    <td className="py-3 px-3 text-right font-bold text-slate-900">
                      {formatMoney(row.revenue)}
                    </td>
                    <td className="py-3 px-3 text-right text-emerald-700">
                      {formatMoney(row.collected)}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-bold ${
                        row.outstanding > 0 ? "text-rose-600" : "text-slate-400 font-normal"
                      }`}
                    >
                      {row.outstanding > 0 ? formatMoney(row.outstanding) : "0 đ"}
                    </td>
                    {showCost && (
                      <>
                        <td className="py-3 px-3 text-right text-slate-600">
                          {formatMoney(row.partCost)}
                        </td>
                        <td className="py-3 px-3 text-right text-slate-600">
                          {formatMoney(row.warrantyPartCost)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-700">
                          {formatMoney(row.grossProfit)}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
              {revenue.items.length > 0 && (
                <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-bold text-slate-900">
                  <tr>
                    <td className="py-3 px-4 uppercase text-xs tracking-wider text-slate-500">
                      Tổng cộng
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="rounded-md bg-slate-200/80 px-2 py-0.5">
                        {revenue.total.ticketCount}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center text-amber-800">
                      {revenue.total.warrantyTicketCount}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {formatMoney(revenue.total.laborRevenue)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {formatMoney(revenue.total.partRevenue)}
                    </td>
                    <td className="py-3 px-3 text-right text-cyan-800 font-black">
                      {formatMoney(revenue.total.revenue)}
                    </td>
                    <td className="py-3 px-3 text-right text-emerald-700">
                      {formatMoney(revenue.total.collected)}
                    </td>
                    <td
                      className={`py-3 px-4 text-right ${
                        revenue.total.outstanding > 0 ? "text-rose-600" : "text-slate-500"
                      }`}
                    >
                      {formatMoney(revenue.total.outstanding)}
                    </td>
                    {showCost && (
                      <>
                        <td className="py-3 px-3 text-right text-slate-700">
                          {formatMoney(revenue.total.partCost)}
                        </td>
                        <td className="py-3 px-3 text-right text-slate-700">
                          {formatMoney(revenue.total.warrantyPartCost)}
                        </td>
                        <td className="py-3 px-4 text-right text-emerald-800 font-black">
                          {formatMoney(revenue.total.grossProfit)}
                        </td>
                      </>
                    )}
                  </tr>
                </tfoot>
              )}
            </table>
            {!revenue.items.length && (
              <div className="p-8 text-center text-slate-400">
                <Calendar className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                <p className="text-sm font-medium">
                  Chưa có phiếu sửa chữa nào hoàn tất trong khoảng thời gian đã chọn.
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Hãy thử chọn khoảng thời gian rộng hơn hoặc đổi nhóm phân loại.
                </p>
              </div>
            )}

            {revenue.items.length > 0 && (
              <TablePagination
                currentPage={validRevenuePage}
                totalPages={totalRevenuePages}
                pageSize={revenuePageSize}
                totalItems={revenue.items.length}
                onPageChange={setRevenuePage}
                onPageSizeChange={setRevenuePageSize}
                itemLabel={GROUP_LABEL[groupBy].toLowerCase()}
              />
            )}
          </div>
        </div>
      )}

      {/* Technician Performance Table Card */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="border-b border-slate-100 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-slate-50/40">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Hiệu suất & Đánh giá kỹ thuật viên
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Thống kê thời gian hoàn thành, tỷ lệ bảo hành sửa lại và điểm đánh giá
              chất lượng từ khách hàng
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500 self-start sm:self-auto">
            {technicians.length} kỹ thuật viên
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/90 text-slate-500 uppercase tracking-wider text-[11px] font-bold">
              <tr>
                <th className="py-3 px-4">Kỹ thuật viên</th>
                <th className="py-3 px-3 text-center">Phiếu</th>
                <th className="py-3 px-3 text-center">TG sửa TB</th>
                <th className="py-3 px-3 text-center">Sửa lại</th>
                <th className="py-3 px-3 text-center">Lượt chấm</th>
                <th className="py-3 px-3 text-center font-bold text-slate-800">Điểm TB</th>
                <th className="py-3 px-2 text-center">Tay nghề</th>
                <th className="py-3 px-2 text-center">Thái độ</th>
                <th className="py-3 px-2 text-center">Tốc độ</th>
                <th className="py-3 px-4 text-right font-bold text-slate-800">Doanh số tạo ra</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {paginatedTechnicians.map((row) => {
                const avgMinutes = row.averageMinutes || 0;
                const timeText =
                  avgMinutes >= 60
                    ? `${Math.round(avgMinutes / 6) / 10} giờ`
                    : `${avgMinutes} phút`;

                return (
                  <tr key={row.technicianId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-100 text-xs font-bold text-cyan-800">
                          {(row.technicianName || row.technicianId).charAt(0).toUpperCase()}
                        </div>
                        <span className="font-bold text-slate-900 truncate">
                          {row.technicianName || row.technicianId}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 font-bold text-slate-800">
                        {row.ticketCount}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-semibold text-slate-600">
                      {timeText}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {row.reworkCount > 0 ? (
                        <span className="rounded-full bg-rose-50 border border-rose-200 px-2 py-0.5 text-xs font-bold text-rose-700">
                          {row.reworkCount} ({row.reworkRate}%)
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                          0 (0%)
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center text-slate-600">
                      {row.ratingCount || 0}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {row.averageRating ? (
                        <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-50 border border-amber-200/70 px-2 py-0.5 text-xs font-bold text-amber-800">
                          ★ {row.averageRating}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-center text-slate-600">
                      {row.criteria.skill || "—"}
                    </td>
                    <td className="py-3 px-2 text-center text-slate-600">
                      {row.criteria.attitude || "—"}
                    </td>
                    <td className="py-3 px-2 text-center text-slate-600">
                      {row.criteria.speed || "—"}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-slate-900">
                      {formatMoney(row.revenue)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!technicians.length && (
            <div className="p-8 text-center text-slate-400">
              <p className="text-sm font-medium">
                Chưa có dữ liệu hiệu suất kỹ thuật viên trong kỳ này.
              </p>
            </div>
          )}

          {technicians.length > 0 && (
            <TablePagination
              currentPage={validTechPage}
              totalPages={totalTechPages}
              pageSize={techPageSize}
              totalItems={technicians.length}
              onPageChange={setTechPage}
              onPageSizeChange={setTechPageSize}
              itemLabel="kỹ thuật viên"
            />
          )}
        </div>
      </div>
    </div>
  );
}
