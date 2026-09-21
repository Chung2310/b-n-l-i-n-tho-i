import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Clock3,
  Pencil,
  Plus,
  Users,
  Search,
  Sparkles,
  Layers,
  CalendarCheck,
  CalendarDays,
  Coffee,
  CheckCircle2,
  AlertCircle,
  X,
  UserCheck,
  Building2,
  ChevronRight,
  ArrowRight,
  ShieldCheck,
  SunMedium
} from "lucide-react";
import { toast } from "../../pages/Toast";
import { getApiErrorMessage } from "../../utils/errorMessage";

type Shift = {
  _id: string;
  code: string;
  name: string;
  color: string;
  startTime: string;
  endTime: string;
  crossesMidnight: boolean;
  workingDays: number[];
  allowedLateMinutes: number;
  allowedEarlyLeaveMinutes: number;
  isDefault: boolean;
  isActive: boolean;
  employeeCount?: number;
  breakPeriods?: { name: string; startTime: string; endTime: string; paid: boolean }[];
};

type Employee = {
  _id: string;
  displayName?: string;
  email: string;
  department?: string;
  assignment?: {
    shiftId: string;
    effectiveFrom: string;
    effectiveTo?: string;
    daysOfWeek: number[];
  };
};

const token = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
});

const DAYS_OF_WEEK = [
  { v: 1, l: "Thứ 2", short: "T2" },
  { v: 2, l: "Thứ 3", short: "T3" },
  { v: 3, l: "Thứ 4", short: "T4" },
  { v: 4, l: "Thứ 5", short: "T5" },
  { v: 5, l: "Thứ 6", short: "T6" },
  { v: 6, l: "Thứ 7", short: "T7" },
  { v: 0, l: "Chủ Nhật", short: "CN" },
];

const PRESET_COLORS = [
  "#4F46E5", // Indigo
  "#2563EB", // Blue
  "#0D9488", // Teal
  "#059669", // Emerald
  "#D97706", // Amber
  "#EA580C", // Orange
  "#E11D48", // Rose
  "#7C3AED", // Violet
];

const blankForm = {
  code: "",
  name: "",
  color: "#4F46E5",
  startTime: "08:00",
  endTime: "17:00",
  lunchStart: "12:00",
  lunchEnd: "13:00",
  workingDays: [1, 2, 3, 4, 5],
  allowedLateMinutes: 0,
  allowedEarlyLeaveMinutes: 0,
  isDefault: false,
  isActive: true,
};

export default function WorkShiftsTab() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals & Forms
  const [editing, setEditing] = useState<Shift | null | "new">(null);
  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);

  // Assignment section state
  const [selected, setSelected] = useState<string[]>([]);
  const [assignShift, setAssignShift] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [assigning, setAssigning] = useState(false);

  // Search and filter for employees & shifts
  const [empSearch, setEmpSearch] = useState("");
  const [empDeptFilter, setEmpDeptFilter] = useState("all");
  const [shiftFilter, setShiftFilter] = useState<"all" | "assigned" | "unassigned">("all");

  const shiftMap = useMemo(() => new Map(shifts.map((s) => [s._id, s])), [shifts]);

  const load = async () => {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([
        fetch("/api/v1/timekeeping/shifts", { headers: token() }),
        fetch("/api/v1/timekeeping/shift-assignments", { headers: token() }),
      ]);
      const ar = await a.json();
      const br = await b.json();
      if (!a.ok || !b.ok) throw new Error(ar.message || br.message);
      setShifts(ar.data || []);
      setEmployees(br.data || []);
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Không thể tải dữ liệu ca làm việc."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const open = (shift?: Shift) => {
    setEditing(shift || "new");
    setForm(
      shift
        ? {
            code: shift.code,
            name: shift.name,
            color: shift.color || "#4F46E5",
            startTime: shift.startTime,
            endTime: shift.endTime,
            lunchStart: shift.breakPeriods?.[0]?.startTime || "",
            lunchEnd: shift.breakPeriods?.[0]?.endTime || "",
            workingDays: shift.workingDays || [1, 2, 3, 4, 5],
            allowedLateMinutes: shift.allowedLateMinutes || 0,
            allowedEarlyLeaveMinutes: shift.allowedEarlyLeaveMinutes || 0,
            isDefault: Boolean(shift.isDefault),
            isActive: shift.isActive ?? true,
          }
        : blankForm
    );
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim() || !form.workingDays.length) {
      toast.error("Vui lòng điền đủ mã ca, tên ca và ít nhất một ngày làm việc.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        crossesMidnight: form.endTime <= form.startTime,
        breakPeriods:
          form.lunchStart && form.lunchEnd
            ? [{ name: "Nghỉ giữa ca", startTime: form.lunchStart, endTime: form.lunchEnd, paid: false }]
            : [],
      };
      const url =
        editing === "new"
          ? "/api/v1/timekeeping/shifts"
          : `/api/v1/timekeeping/shifts/${(editing as Shift)._id}`;
      const res = await fetch(url, {
        method: editing === "new" ? "POST" : "PATCH",
        headers: token(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      toast.success(editing === "new" ? "Đã tạo ca làm việc mới." : "Đã cập nhật ca làm việc.");
      setEditing(null);
      await load();
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Không thể lưu ca."));
    } finally {
      setSaving(false);
    }
  };

  const assign = async () => {
    if (!selected.length || !assignShift) {
      return toast.error("Hãy chọn ít nhất một nhân viên và ca làm việc muốn phân.");
    }
    setAssigning(true);
    try {
      const shift = shiftMap.get(assignShift)!;
      const res = await fetch("/api/v1/timekeeping/shift-assignments", {
        method: "POST",
        headers: token(),
        body: JSON.stringify({
          employeeIds: selected,
          shiftId: assignShift,
          effectiveFrom,
          daysOfWeek: shift?.workingDays || [1, 2, 3, 4, 5],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      toast.success(`Đã phân ca thành công cho ${selected.length} nhân viên.`);
      setSelected([]);
      await load();
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Không thể phân ca."));
    } finally {
      setAssigning(false);
    }
  };

  // Departments list for filter
  const departments = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((emp) => {
      if (emp.department) set.add(emp.department);
    });
    return Array.from(set);
  }, [employees]);

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      if (empDeptFilter !== "all" && emp.department !== empDeptFilter) return false;
      if (shiftFilter === "assigned" && !emp.assignment) return false;
      if (shiftFilter === "unassigned" && emp.assignment) return false;
      if (empSearch.trim()) {
        const q = empSearch.toLowerCase().trim();
        const nameMatch = (emp.displayName || "").toLowerCase().includes(q);
        const emailMatch = emp.email.toLowerCase().includes(q);
        const deptMatch = (emp.department || "").toLowerCase().includes(q);
        if (!nameMatch && !emailMatch && !deptMatch) return false;
      }
      return true;
    });
  }, [employees, empDeptFilter, shiftFilter, empSearch]);

  const selectAllFiltered = () => {
    if (selected.length === filteredEmployees.length && filteredEmployees.length > 0) {
      setSelected([]);
    } else {
      setSelected(filteredEmployees.map((e) => e._id));
    }
  };

  // KPIs
  const totalShifts = shifts.length;
  const defaultShift = shifts.find((s) => s.isDefault);
  const totalEmployees = employees.length;
  const assignedCount = employees.filter((e) => e.assignment).length;

  return (
    <div className="space-y-6 text-left max-w-7xl mx-auto pb-12">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl shadow-slate-900/10">
        <div className="absolute right-0 top-0 -mt-10 -mr-10 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold backdrop-blur-md border border-indigo-500/30">
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
              <span>Chấm công & Ca kíp</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <Clock3 className="h-7 w-7 text-indigo-400" />
              Quản Lý Ca Làm Việc
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Thiết lập khung giờ vào/ra ca, giờ nghỉ giữa ca và phân công ca làm việc linh hoạt cho từng nhân sự hoặc phòng ban.
            </p>
          </div>

          <button
            onClick={() => open()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-indigo-600/30 active:scale-95 cursor-pointer self-start md:self-center"
          >
            <Plus className="h-4 w-4" />
            <span>Thêm ca mới</span>
          </button>
        </div>
      </div>

      {/* KPI Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="rounded-2xl bg-white p-4 border border-slate-200/80 shadow-sm flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xl font-extrabold text-slate-800">{totalShifts}</div>
            <div className="text-[11px] font-semibold text-slate-500">Tổng số ca làm</div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 border border-slate-200/80 shadow-sm flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-extrabold text-slate-800 truncate max-w-[140px]" title={defaultShift?.name || "Chưa có"}>
              {defaultShift ? defaultShift.name : "Chưa đặt"}
            </div>
            <div className="text-[11px] font-semibold text-slate-500">Ca mặc định</div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 border border-slate-200/80 shadow-sm flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xl font-extrabold text-slate-800">{totalEmployees}</div>
            <div className="text-[11px] font-semibold text-slate-500">Tổng nhân sự</div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 border border-slate-200/80 shadow-sm flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
            <UserCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xl font-extrabold text-slate-800">
              {assignedCount}
              <span className="text-xs font-normal text-slate-400">/{totalEmployees}</span>
            </div>
            <div className="text-[11px] font-semibold text-slate-500">Đã gán ca riêng</div>
          </div>
        </div>
      </div>

      {/* Section 1: Shifts Grid */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold text-slate-800">Danh mục ca làm việc</h3>
            <p className="text-xs text-slate-500">Khung giờ, ca qua đêm, độ trễ và các ngày áp dụng trong tuần.</p>
          </div>
          <span className="text-xs font-semibold text-slate-400">
            {shifts.length} ca đang hoạt động
          </span>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <Clock3 className="h-8 w-8 animate-spin text-indigo-500 mx-auto mb-3" />
            <p className="text-xs font-semibold text-slate-500">Đang tải danh sách ca làm việc...</p>
          </div>
        ) : shifts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
            <div className="h-12 w-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mx-auto mb-3">
              <Clock3 className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-700">Chưa thiết lập ca làm việc</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Hệ thống hiện đang áp dụng giờ làm việc chung. Hãy thêm ca mới để phân lịch linh hoạt cho từng nhân viên.
            </p>
            <button
              onClick={() => open()}
              className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-md cursor-pointer"
            >
              Thêm ca đầu tiên
            </button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {shifts.map((shift) => {
              const breakPeriod = shift.breakPeriods?.[0];
              return (
                <div
                  key={shift._id}
                  className="group relative rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3.5">
                    {/* Header of Card */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-3.5 h-3.5 rounded-full ring-2 ring-offset-2 ring-transparent group-hover:ring-indigo-200 transition-all shrink-0"
                          style={{ backgroundColor: shift.color || "#4F46E5" }}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-extrabold text-sm text-slate-800 group-hover:text-indigo-600 transition-colors">
                              {shift.name}
                            </h4>
                            {shift.isDefault && (
                              <span className="px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-[10px] font-extrabold text-indigo-600">
                                MẶC ĐỊNH
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] font-mono font-bold text-slate-400">
                            {shift.code}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => open(shift)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
                        title="Chỉnh sửa ca"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Time details */}
                    <div className="rounded-xl bg-slate-50 p-3 space-y-2 border border-slate-100">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-medium flex items-center gap-1.5">
                          <Clock3 className="h-3.5 w-3.5 text-indigo-500" />
                          Thời gian ca:
                        </span>
                        <span className="font-black text-slate-800">
                          {shift.startTime} – {shift.endTime}
                          {shift.crossesMidnight && (
                            <span className="ml-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              +1 ngày
                            </span>
                          )}
                        </span>
                      </div>

                      {breakPeriod && breakPeriod.startTime && breakPeriod.endTime && (
                        <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200/60">
                          <span className="text-slate-500 font-medium flex items-center gap-1.5">
                            <Coffee className="h-3.5 w-3.5 text-amber-500" />
                            Nghỉ giữa ca:
                          </span>
                          <span className="font-bold text-slate-700">
                            {breakPeriod.startTime} – {breakPeriod.endTime}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Weekdays badge list */}
                    <div className="flex flex-wrap items-center gap-1">
                      {DAYS_OF_WEEK.map((d) => {
                        const active = shift.workingDays.includes(d.v);
                        return (
                          <span
                            key={d.v}
                            className={`w-7 h-6 rounded-md text-[10px] font-bold flex items-center justify-center transition ${
                              active
                                ? "bg-indigo-600 text-white shadow-xs"
                                : "bg-slate-100 text-slate-400"
                            }`}
                            title={d.l}
                          >
                            {d.short}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Footer info */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <div className="flex items-center gap-1.5 font-semibold">
                      <Users className="h-3.5 w-3.5 text-slate-400" />
                      <span>{shift.employeeCount || 0} nhân sự</span>
                    </div>
                    {shift.allowedLateMinutes > 0 ? (
                      <span className="text-[11px] text-slate-400">
                        Trễ tối đa: {shift.allowedLateMinutes}p
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400">Không cho phép trễ</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 2: Employee Assignment */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-600" />
              Phân ca cho nhân sự
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Chọn một hoặc nhiều nhân viên để gán vào ca làm việc tương ứng từ ngày áp dụng cụ thể.
            </p>
          </div>

          {/* Quick Action controls */}
          <div className="flex flex-wrap items-center gap-2.5 bg-slate-50 p-2.5 rounded-2xl border border-slate-200/70">
            <div className="w-48">
              <select
                value={assignShift}
                onChange={(e) => setAssignShift(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="">-- Chọn ca áp dụng --</option>
                {shifts
                  .filter((s) => s.isActive)
                  .map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} ({s.startTime} - {s.endTime})
                    </option>
                  ))}
              </select>
            </div>

            <div className="w-36">
              <input
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                title="Ngày bắt đầu có hiệu lực"
              />
            </div>

            <button
              onClick={assign}
              disabled={assigning || !selected.length || !assignShift}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>
                {assigning
                  ? "Đang phân ca..."
                  : `Phân ca (${selected.length})`}
              </span>
            </button>
          </div>
        </div>

        {/* Filter bar for employees */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={empSearch}
              onChange={(e) => setEmpSearch(e.target.value)}
              placeholder="Tìm nhân sự theo tên, email, phòng ban..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2 text-xs outline-none transition focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 placeholder:text-slate-400"
            />
            {empSearch && (
              <button
                onClick={() => setEmpSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Department Filter */}
            {departments.length > 0 && (
              <select
                value={empDeptFilter}
                onChange={(e) => setEmpDeptFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold outline-none cursor-pointer"
              >
                <option value="all">Mọi phòng ban</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            )}

            {/* Shift Assignment Status Filter */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              {[
                { id: "all", label: "Tất cả" },
                { id: "assigned", label: "Đã có ca" },
                { id: "unassigned", label: "Chưa gán" },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setShiftFilter(f.id as any)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                    shiftFilter === f.id
                      ? "bg-white text-slate-800 shadow-xs"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Employee Table */}
        <div className="rounded-xl border border-slate-200/80 overflow-hidden">
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200/80 z-10 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">
                    <input
                      type="checkbox"
                      checked={
                        filteredEmployees.length > 0 &&
                        selected.length === filteredEmployees.length
                      }
                      onChange={selectAllFiltered}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      title="Chọn tất cả danh sách đang hiển thị"
                    />
                  </th>
                  <th className="py-3 px-4">Nhân sự</th>
                  <th className="py-3 px-4">Phòng ban</th>
                  <th className="py-3 px-4">Ca hiện tại</th>
                  <th className="py-3 px-4">Thời gian hiệu lực</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 italic">
                      Không tìm thấy nhân sự phù hợp với bộ lọc
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp) => {
                    const isChecked = selected.includes(emp._id);
                    const currentShift = emp.assignment
                      ? shiftMap.get(emp.assignment.shiftId)
                      : null;

                    return (
                      <tr
                        key={emp._id}
                        onClick={() =>
                          setSelected((prev) =>
                            prev.includes(emp._id)
                              ? prev.filter((id) => id !== emp._id)
                              : [...prev, emp._id]
                          )
                        }
                        className={`group hover:bg-indigo-50/40 transition-colors cursor-pointer select-none ${
                          isChecked ? "bg-indigo-50/60" : ""
                        }`}
                      >
                        <td
                          className="py-3 px-4 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() =>
                              setSelected((prev) =>
                                prev.includes(emp._id)
                                  ? prev.filter((id) => id !== emp._id)
                                  : [...prev, emp._id]
                              )
                            }
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-800">
                            {emp.displayName || emp.email.split("@")[0]}
                          </div>
                          <div className="text-[11px] text-slate-400">{emp.email}</div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {emp.department ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-medium">
                              <Building2 className="h-3 w-3 text-slate-400" />
                              {emp.department}
                            </span>
                          ) : (
                            <span className="text-slate-300 italic text-[11px]">Chưa gán</span>
                          )}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {currentShift ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-white border border-slate-200 shadow-2xs">
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: currentShift.color || "#4F46E5" }}
                              />
                              <span className="text-slate-800">{currentShift.name}</span>
                              <span className="text-slate-400 font-normal">
                                ({currentShift.startTime}-{currentShift.endTime})
                              </span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[11px] font-medium">
                              Áp dụng ca mặc định
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-slate-500 text-[11px]">
                          {emp.assignment?.effectiveFrom ? (
                            <span>Từ {emp.assignment.effectiveFrom.split("-").reverse().join("/")}</span>
                          ) : (
                            <span className="text-slate-300 italic">--</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="bg-slate-50/70 border-t border-slate-100 px-4 py-2.5 text-[11px] text-slate-500 flex items-center justify-between">
            <span>
              Đang chọn <strong>{selected.length}</strong> / {filteredEmployees.length} nhân sự
            </span>
            {selected.length > 0 && (
              <button
                onClick={() => setSelected([])}
                className="text-xs font-bold text-rose-600 hover:underline cursor-pointer"
              >
                Bỏ chọn tất cả
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modal: Add or Edit Shift */}
      {editing &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <form
              onSubmit={save}
              className="w-full max-w-xl space-y-5 rounded-3xl bg-white p-6 sm:p-7 shadow-2xl max-h-[90vh] overflow-y-auto text-left border border-slate-100"
            >
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                    <Clock3 className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-800">
                      {editing === "new" ? "Thêm ca làm việc mới" : "Chỉnh sửa ca làm việc"}
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Cấu hình khung giờ và các quy định điểm danh cho ca
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition cursor-pointer"
                  aria-label="Đóng"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Code, Name and Color */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-4 space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                      Mã ca <span className="text-rose-500">*</span>
                    </label>
                    <input
                      required
                      placeholder="VD: CA-SANG"
                      value={form.code}
                      onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs font-mono font-bold outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="sm:col-span-8 space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                      Tên ca làm việc <span className="text-rose-500">*</span>
                    </label>
                    <input
                      required
                      placeholder="VD: Ca Hành Chính"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs font-medium outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Color presets */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                    Màu nhận diện
                  </label>
                  <div className="flex items-center gap-2">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setForm({ ...form, color })}
                        className={`w-6 h-6 rounded-full transition-transform cursor-pointer ${
                          form.color === color
                            ? "scale-125 ring-2 ring-indigo-400 ring-offset-2"
                            : "hover:scale-110 opacity-80 hover:opacity-100"
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                    <input
                      type="color"
                      value={form.color}
                      onChange={(e) => setForm({ ...form, color: e.target.value })}
                      className="w-7 h-7 p-0 border-0 rounded cursor-pointer ml-2"
                      title="Màu tùy chỉnh"
                    />
                  </div>
                </div>

                {/* Start Time & End Time */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-3">
                  <div className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock3 className="h-3.5 w-3.5 text-indigo-500" />
                    Khung thời gian làm việc
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-500 block">
                        Giờ bắt đầu ca
                      </label>
                      <input
                        type="time"
                        required
                        value={form.startTime}
                        onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-500 block">
                        Giờ kết thúc ca
                      </label>
                      <input
                        type="time"
                        required
                        value={form.endTime}
                        onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {form.endTime <= form.startTime && form.startTime && form.endTime && (
                    <div className="flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 p-2 rounded-xl border border-amber-200">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                      <span>Ca này qua đêm (giờ kết thúc vào ngày hôm sau).</span>
                    </div>
                  )}

                  {/* Lunch / Break Time */}
                  <div className="pt-2 border-t border-slate-200/60">
                    <div className="text-[11px] font-semibold text-slate-500 mb-1.5 flex items-center gap-1">
                      <Coffee className="h-3 w-3 text-amber-500" />
                      Giờ nghỉ giữa ca (Tùy chọn)
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="time"
                        placeholder="Nghỉ từ"
                        value={form.lunchStart}
                        onChange={(e) => setForm({ ...form, lunchStart: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <input
                        type="time"
                        placeholder="Đến"
                        value={form.lunchEnd}
                        onChange={(e) => setForm({ ...form, lunchEnd: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Working Days */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                    Ngày áp dụng trong tuần <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS_OF_WEEK.map((d) => {
                      const isSelected = form.workingDays.includes(d.v);
                      return (
                        <button
                          key={d.v}
                          type="button"
                          onClick={() => {
                            setForm({
                              ...form,
                              workingDays: isSelected
                                ? form.workingDays.filter((x) => x !== d.v)
                                : [...form.workingDays, d.v],
                            });
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                            isSelected
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                              : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          {d.l}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Allowed late / early */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 block">
                      Đi muộn cho phép (Phút)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={form.allowedLateMinutes}
                      onChange={(e) =>
                        setForm({ ...form, allowedLateMinutes: Number(e.target.value) || 0 })
                      }
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2 text-xs font-semibold outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 block">
                      Về sớm cho phép (Phút)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={form.allowedEarlyLeaveMinutes}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          allowedEarlyLeaveMinutes: Number(e.target.value) || 0,
                        })
                      }
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2 text-xs font-semibold outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Default shift checkbox */}
                <div className="pt-2 border-t border-slate-100">
                  <label className="flex items-center gap-2.5 text-xs font-bold text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={form.isDefault}
                      onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer h-4 w-4"
                    />
                    <span>Đặt làm ca làm việc mặc định của công ty</span>
                  </label>
                  <p className="text-[11px] text-slate-400 ml-6 mt-0.5">
                    Nhân viên chưa được phân ca riêng sẽ tự động chấm công theo ca mặc định này.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={saving || !form.code || !form.name || !form.workingDays.length}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 font-bold text-xs text-white transition active:scale-95 shadow-md shadow-indigo-600/20 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? "Đang lưu..." : editing === "new" ? "Tạo ca làm việc" : "Lưu thay đổi"}
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}
    </div>
  );
}

