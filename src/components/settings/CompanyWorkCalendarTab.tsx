import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  CalendarDays,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
  Calendar as CalendarIcon,
  Sun,
  Coffee,
  Briefcase,
  CheckCircle2,
  AlertCircle,
  Edit3,
  Sparkles,
  ChevronDown
} from "lucide-react";
import { toast } from "../../pages/Toast";
import {
  companyWorkCalendarService,
  type WorkCalendarDay,
  type WorkCalendarDayType
} from "../../services/companyWorkCalendarService";

const TYPE_CONFIG: Record<
  WorkCalendarDayType,
  {
    label: string;
    badgeBg: string;
    badgeText: string;
    border: string;
    icon: React.ComponentType<{ className?: string }>;
    accentColor: string;
  }
> = {
  holiday: {
    label: "Ngày nghỉ lễ",
    badgeBg: "bg-rose-50 text-rose-700",
    badgeText: "text-rose-700",
    border: "border-rose-200",
    icon: Sun,
    accentColor: "rose",
  },
  substitute_holiday: {
    label: "Ngày nghỉ bù",
    badgeBg: "bg-amber-50 text-amber-700",
    badgeText: "text-amber-700",
    border: "border-amber-200",
    icon: Coffee,
    accentColor: "amber",
  },
  working_override: {
    label: "Ngày làm bù",
    badgeBg: "bg-indigo-50 text-indigo-700",
    badgeText: "text-indigo-700",
    border: "border-indigo-200",
    icon: Briefcase,
    accentColor: "indigo",
  },
};

const TYPE_LABELS: Record<WorkCalendarDayType, string> = {
  holiday: "Ngày nghỉ lễ",
  substitute_holiday: "Ngày nghỉ bù",
  working_override: "Ngày làm bù",
};

const WEEKDAY_NAMES = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

function formatVietnameseDate(dateStr: string): { fullDate: string; weekday: string; day: string; month: string } {
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const [y, m, d] = parts.map(Number);
      const dateObj = new Date(y, m - 1, d);
      const weekday = WEEKDAY_NAMES[dateObj.getDay()] || "";
      return {
        fullDate: `${d.toString().padStart(2, "0")}/${m.toString().padStart(2, "0")}/${y}`,
        weekday,
        day: d.toString().padStart(2, "0"),
        month: `Thg ${m}`,
      };
    }
  } catch {
    // fallback
  }
  return {
    fullDate: dateStr,
    weekday: "",
    day: "",
    month: "",
  };
}

export default function CompanyWorkCalendarTab() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [days, setDays] = useState<WorkCalendarDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Modals state
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reasonTarget, setReasonTarget] = useState<WorkCalendarDay | null>(null);
  const [reason, setReason] = useState("");
  const [form, setForm] = useState({
    date: `${year}-01-01`,
    name: "",
    dayType: "holiday" as WorkCalendarDayType,
  });

  // Year choices (current - 2 to current + 2)
  const availableYears = useMemo(() => {
    const start = currentYear - 2;
    return Array.from({ length: 5 }, (_, i) => start + i);
  }, [currentYear]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDays(await companyWorkCalendarService.list(year));
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    void load();
  }, [load]);

  const sync = async () => {
    setSyncing(true);
    try {
      setDays(await companyWorkCalendarService.sync(year));
      toast.success("Đã đồng bộ lịch nghỉ lễ.");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  const toggle = async (day: WorkCalendarDay) => {
    if (day.isApplied) {
      setReason("");
      setReasonTarget(day);
      return;
    }
    try {
      await companyWorkCalendarService.update(day._id, { isApplied: true });
      await load();
      toast.success(`Đã áp dụng ${day.name}`);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const disable = async () => {
    if (!reasonTarget || !reason.trim()) {
      toast.error("Vui lòng nhập lý do tắt áp dụng.");
      return;
    }
    try {
      await companyWorkCalendarService.update(reasonTarget._id, {
        isApplied: false,
        adminReason: reason.trim(),
      });
      setReasonTarget(null);
      await load();
      toast.success(`Đã tắt áp dụng ${reasonTarget.name}`);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      if (editingId) {
        await companyWorkCalendarService.update(editingId, form);
      } else {
        await companyWorkCalendarService.create(form);
      }
      setFormOpen(false);
      setEditingId(null);
      setForm({ date: `${year}-01-01`, name: "", dayType: "holiday" });
      await load();
      toast.success(editingId ? "Đã cập nhật ngày." : "Đã thêm ngày vào lịch công ty.");
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ date: `${year}-01-01`, name: "", dayType: "holiday" });
    setFormOpen(true);
  };

  const openEdit = (day: WorkCalendarDay) => {
    setEditingId(day._id);
    setForm({ date: day.date, name: day.name, dayType: day.dayType });
    setFormOpen(true);
  };

  // KPIs
  const stats = useMemo(() => {
    const total = days.length;
    const holidays = days.filter((d) => d.dayType === "holiday").length;
    const substitutes = days.filter((d) => d.dayType === "substitute_holiday").length;
    const overrides = days.filter((d) => d.dayType === "working_override").length;
    const applied = days.filter((d) => d.isApplied).length;
    const unapplied = total - applied;
    return { total, holidays, substitutes, overrides, applied, unapplied };
  }, [days]);

  // Filtered days
  const filteredDays = useMemo(() => {
    return days.filter((day) => {
      if (typeFilter !== "all" && day.dayType !== typeFilter) return false;
      if (statusFilter === "applied" && !day.isApplied) return false;
      if (statusFilter === "unapplied" && day.isApplied) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = day.name.toLowerCase().includes(q);
        const matchesDate = day.date.includes(q);
        if (!matchesName && !matchesDate) return false;
      }
      return true;
    });
  }, [days, typeFilter, statusFilter, searchQuery]);

  return (
    <div className="space-y-6 text-left max-w-7xl mx-auto pb-10">
      {/* Top Banner & Actions */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl shadow-slate-900/10">
        <div className="absolute right-0 top-0 -mt-10 -mr-10 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold backdrop-blur-md border border-indigo-500/30">
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
              <span>Chính sách nhân sự & Chấm công</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <CalendarDays className="h-7 w-7 text-indigo-400" />
              Lịch Nghỉ Lễ & Làm Bù
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Quản lý danh sách các ngày nghỉ lễ quốc gia, nghỉ bù và các ngày làm việc bù theo quy định áp dụng đồng bộ toàn doanh nghiệp.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 sm:self-center">
            {/* Year Selector */}
            <div className="relative">
              <select
                aria-label="Năm lịch"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="appearance-none bg-white/10 hover:bg-white/15 text-white text-xs font-bold px-4 py-2.5 pr-8 rounded-xl border border-white/20 backdrop-blur-md outline-none cursor-pointer transition focus:ring-2 focus:ring-indigo-400"
              >
                {availableYears.map((y) => (
                  <option key={y} value={y} className="bg-slate-900 text-white">
                    Năm {y}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/70" />
            </div>

            {/* Sync Button */}
            <button
              onClick={sync}
              disabled={syncing}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 backdrop-blur-md transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-sm"
              title="Đồng bộ lại danh mục ngày nghỉ từ nguồn hệ thống chuẩn"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin text-indigo-300" : ""}`} />
              <span>{syncing ? "Đang đồng bộ..." : "Đồng bộ"}</span>
            </button>

            {/* Add Custom Day Button */}
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-indigo-600/30 active:scale-95 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Thêm ngày mới</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="rounded-2xl bg-white p-4 border border-slate-200/80 shadow-sm flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
            <Sun className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xl font-extrabold text-slate-800">{stats.holidays}</div>
            <div className="text-[11px] font-semibold text-slate-500">Ngày nghỉ lễ</div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 border border-slate-200/80 shadow-sm flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
            <Coffee className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xl font-extrabold text-slate-800">{stats.substitutes}</div>
            <div className="text-[11px] font-semibold text-slate-500">Ngày nghỉ bù</div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 border border-slate-200/80 shadow-sm flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
            <Briefcase className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xl font-extrabold text-slate-800">{stats.overrides}</div>
            <div className="text-[11px] font-semibold text-slate-500">Ngày làm bù</div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 border border-slate-200/80 shadow-sm flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xl font-extrabold text-slate-800">
              {stats.applied}
              <span className="text-xs font-normal text-slate-400">/{stats.total}</span>
            </div>
            <div className="text-[11px] font-semibold text-slate-500">Đang áp dụng</div>
          </div>
        </div>
      </div>

      {/* Control Bar: Search & Filter Pills */}
      <div className="rounded-2xl bg-white p-4 border border-slate-200/80 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          {/* Search Input */}
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm theo tên ngày hoặc ngày..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2 text-xs outline-none transition focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 hidden sm:inline">
              Trạng thái:
            </span>
            {[
              { id: "all", label: "Tất cả" },
              { id: "applied", label: "Đang áp dụng" },
              { id: "unapplied", label: "Đã tắt" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
                  statusFilter === f.id
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Type Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
            Phân loại:
          </span>
          {[
            { id: "all", label: "Tất cả", count: stats.total },
            { id: "holiday", label: "Ngày nghỉ lễ", count: stats.holidays },
            { id: "substitute_holiday", label: "Nghỉ bù", count: stats.substitutes },
            { id: "working_override", label: "Làm bù", count: stats.overrides },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setTypeFilter(item.id)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer inline-flex items-center gap-1.5 ${
                typeFilter === item.id
                  ? "bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold"
                  : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              <span>{item.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  typeFilter === item.id ? "bg-indigo-200/70 text-indigo-900" : "bg-slate-100 text-slate-500"
                }`}
              >
                {item.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content List / Table */}
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <RefreshCw className="h-8 w-8 animate-spin text-indigo-500 mx-auto mb-3" />
          <p className="text-xs font-semibold text-slate-500">Đang đồng bộ và tải danh sách ngày lễ năm {year}...</p>
        </div>
      ) : filteredDays.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
          <div className="h-14 w-14 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 mx-auto mb-3">
            <CalendarDays className="h-7 w-7" />
          </div>
          <h3 className="text-sm font-bold text-slate-700">Không tìm thấy ngày nào</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Không có ngày nghỉ hoặc làm bù nào khớp với bộ lọc hiện tại của bạn cho năm {year}.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            {(searchQuery || typeFilter !== "all" || statusFilter !== "all") && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setTypeFilter("all");
                  setStatusFilter("all");
                }}
                className="px-3.5 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition"
              >
                Đặt lại bộ lọc
              </button>
            )}
            <button
              onClick={openCreate}
              className="px-3.5 py-1.5 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition"
            >
              Thêm ngày mới
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4 sm:px-5">Thời gian</th>
                  <th className="py-3.5 px-4">Tên ngày lễ / Sự kiện</th>
                  <th className="py-3.5 px-4">Phân loại</th>
                  <th className="py-3.5 px-4">Nguồn gốc</th>
                  <th className="py-3.5 px-4 text-center">Áp dụng</th>
                  <th className="py-3.5 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDays.map((day) => {
                  const typeMeta = TYPE_CONFIG[day.dayType] || TYPE_CONFIG.holiday;
                  const TypeIcon = typeMeta.icon;
                  const dateInfo = formatVietnameseDate(day.date);

                  return (
                    <tr
                      key={day._id}
                      className={`group hover:bg-slate-50/70 transition-colors ${
                        !day.isApplied ? "bg-slate-50/30 opacity-70 hover:opacity-100" : ""
                      }`}
                    >
                      {/* Date Column */}
                      <td className="py-3.5 px-4 sm:px-5 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200/70 flex flex-col items-center justify-center shrink-0">
                            <span className="text-[10px] uppercase font-bold text-slate-400 leading-none">
                              {dateInfo.month}
                            </span>
                            <span className="text-sm font-black text-slate-800 leading-tight">
                              {dateInfo.day}
                            </span>
                          </div>
                          <div>
                            <div className="font-bold text-slate-800">{dateInfo.fullDate}</div>
                            <div className="text-[11px] font-medium text-slate-400">
                              {dateInfo.weekday}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Name Column */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800 text-xs sm:text-sm group-hover:text-indigo-600 transition-colors">
                          {day.name}
                        </div>
                        {!day.isApplied && day.adminReason && (
                          <div className="mt-1 flex items-start gap-1 text-[11px] text-rose-500 font-medium bg-rose-50/70 px-2 py-0.5 rounded-md border border-rose-100 max-w-md">
                            <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
                            <span>Lý do tắt: {day.adminReason}</span>
                          </div>
                        )}
                      </td>

                      {/* Day Type Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${typeMeta.badgeBg} ${typeMeta.border}`}
                        >
                          <TypeIcon className="h-3 w-3" />
                          <span>{TYPE_LABELS[day.dayType]}</span>
                        </span>
                      </td>

                      {/* Source */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            day.source === "system"
                              ? "bg-slate-100 text-slate-600 border border-slate-200"
                              : "bg-indigo-50 text-indigo-700 border border-indigo-200"
                          }`}
                        >
                          {day.source === "system" ? "Hệ thống" : "Doanh nghiệp tạo"}
                        </span>
                      </td>

                      {/* Applied Toggle Switch (Maintains native checkbox for a11y & automated test suite) */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <label className="relative inline-flex items-center cursor-pointer select-none">
                          <input
                            aria-label={`Áp dụng ${day.name}`}
                            type="checkbox"
                            checked={day.isApplied}
                            onChange={() => void toggle(day)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600 shadow-inner"></div>
                        </label>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {day.source === "admin" ? (
                          <button
                            aria-label={`Sửa ${day.name}`}
                            onClick={() => openEdit(day)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-indigo-600 hover:bg-indigo-50 font-bold transition active:scale-95 cursor-pointer"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            <span>Sửa</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-300 italic">Mặc định</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="bg-slate-50/60 border-t border-slate-100 px-4 py-3 text-[11px] text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>
              Hiển thị <strong>{filteredDays.length}</strong> trên tổng số <strong>{days.length}</strong> ngày trong lịch năm {year}
            </span>
            <div className="flex items-center gap-4 text-[10px]">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Đang áp dụng chấm công
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                Đã tắt
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add or Edit Custom Day */}
      {formOpen &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <form
              onSubmit={save}
              className="w-full max-w-md space-y-5 rounded-3xl bg-white p-6 sm:p-7 shadow-2xl max-h-[90vh] overflow-y-auto text-left border border-slate-100"
            >
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                    <CalendarIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-800">
                      {editingId ? "Chỉnh sửa ngày công ty" : "Thêm ngày nghỉ / làm bù mới"}
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Áp dụng lịch nội bộ riêng cho toàn thể doanh nghiệp
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition cursor-pointer"
                  aria-label="Đóng"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4 pt-1">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                    Ngày áp dụng <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                    Tên ngày lễ / Dịp làm bù <span className="text-rose-500">*</span>
                  </label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Ví dụ: Kỷ niệm ngày thành lập công ty"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition font-medium placeholder:text-slate-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                    Phân loại ngày
                  </label>
                  <select
                    value={form.dayType}
                    onChange={(e) =>
                      setForm({ ...form, dayType: e.target.value as WorkCalendarDayType })
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 cursor-pointer transition font-medium"
                  >
                    {Object.entries(TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 font-bold text-xs text-white transition active:scale-95 shadow-md shadow-indigo-600/20 cursor-pointer"
                >
                  {editingId ? "Cập nhật ngày" : "Thêm vào lịch"}
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}

      {/* Modal: Reason for Disabling Applied Day */}
      {reasonTarget &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-md space-y-4 rounded-3xl bg-white p-6 sm:p-7 shadow-2xl max-h-[90vh] overflow-y-auto text-left border border-slate-100">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
                    <AlertCircle className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-800">
                      Tắt áp dụng ngày nghỉ
                    </h4>
                    <p className="text-[11px] text-slate-400 font-medium">
                      {reasonTarget.name} ({formatVietnameseDate(reasonTarget.date).fullDate})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setReasonTarget(null)}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition cursor-pointer"
                  aria-label="Đóng"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 leading-relaxed">
                Khi tắt ngày này, nhân sự làm việc trong ngày sẽ được tính theo lịch làm việc ngày thường và không áp dụng các chế độ ngày nghỉ lễ tương ứng.
              </div>

              <div className="space-y-1.5 text-left pt-1">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                  Lý do không áp dụng <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Nhập lý do chi tiết (ví dụ: Doanh nghiệp hoạt động bình thường, bố trí làm ca thay thế)..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-rose-500 focus:border-rose-500 min-h-24 transition font-medium placeholder:text-slate-400"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  onClick={() => setReasonTarget(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={() => void disable()}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-rose-600/20 active:scale-95 cursor-pointer"
                >
                  Xác nhận tắt áp dụng
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

