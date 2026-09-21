import React, { useState, useEffect, useMemo } from "react";
import {
  Clock,
  Search,
  X,
  User,
  Building2,
  Calendar,
  Coffee,
  CheckCircle2,
  Filter,
  SlidersHorizontal,
  Edit3,
  Sparkles,
  Users
} from "lucide-react";
import { toast } from "../../pages/Toast";
import { getApiErrorMessage } from "../../utils/errorMessage";

interface WorkHoursConfig {
  useCustom: boolean;
  checkInLimit?: string;
  checkOutLimit?: string;
  lunchBreakStart?: string;
  lunchBreakEnd?: string;
  workingDays?: number[];
  annualLeaveDays?: number;
  employmentStatus?: "official" | "probation" | "internship";
  officialDate?: string;
}

interface EmployeeRow {
  _id: string;
  fullName?: string;
  email?: string;
  role?: string;
  department?: string;
  workHoursConfig?: WorkHoursConfig;
  employmentStatus?: "official" | "probation" | "internship";
  officialDate?: string;
}

const DAY_OPTIONS = [
  { day: 1, label: "Thứ 2", short: "T2" },
  { day: 2, label: "Thứ 3", short: "T3" },
  { day: 3, label: "Thứ 4", short: "T4" },
  { day: 4, label: "Thứ 5", short: "T5" },
  { day: 5, label: "Thứ 6", short: "T6" },
  { day: 6, label: "Thứ 7", short: "T7" },
  { day: 0, label: "Chủ Nhật", short: "CN" },
];

const DEFAULT_CONFIG: WorkHoursConfig = {
  useCustom: false,
  checkInLimit: "08:30",
  checkOutLimit: "17:30",
  lunchBreakStart: "12:00",
  lunchBreakEnd: "13:00",
  workingDays: [1, 2, 3, 4, 5],
  annualLeaveDays: undefined,
  employmentStatus: "official",
  officialDate: "",
};

export default function EmployeeWorkHoursTab() {
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "custom" | "standard">("all");
  const [editing, setEditing] = useState<EmployeeRow | null>(null);
  const [form, setForm] = useState<WorkHoursConfig>(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const res = await fetch("/api/v1/timekeeping/work-hours", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
        });
        const result = await res.json();
        if (res.ok) {
          setEmployees(Array.isArray(result.data) ? result.data : []);
        } else {
          toast.error(result.message || "Không tải được danh sách nhân viên.");
        }
      } catch (err) {
        toast.error(getApiErrorMessage(err, "Lỗi kết nối khi tải danh sách nhân viên."));
      } finally {
        setLoading(false);
      }
    };
    fetchEmployees();
  }, []);

  const openEdit = (emp: EmployeeRow) => {
    setEditing(emp);
    setForm({
      ...DEFAULT_CONFIG,
      ...(emp.workHoursConfig || {}),
      employmentStatus:
        emp.employmentStatus || emp.workHoursConfig?.employmentStatus || "official",
      officialDate: emp.officialDate || emp.workHoursConfig?.officialDate || "",
    });
  };

  const handleSave = async () => {
    if (!editing) return;
    if (form.useCustom && (!form.workingDays || form.workingDays.length === 0)) {
      toast.error("Vui lòng chọn ít nhất một ngày làm việc.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/timekeeping/work-hours/${editing._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
        body: JSON.stringify(form),
      });
      const result = await res.json();
      if (res.ok) {
        toast.success("Cập nhật giờ làm việc thành công!");
        setEmployees((current) =>
          current.map((emp) =>
            emp._id === editing._id
              ? { ...emp, workHoursConfig: result.data?.workHoursConfig || form }
              : emp
          )
        );
        setEditing(null);
      } else {
        const joiErrors = result.errors ? Object.values(result.errors).flat().join(" ") : "";
        toast.error(joiErrors || result.message || "Cập nhật thất bại.");
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Lỗi kết nối khi lưu giờ làm việc."));
    } finally {
      setSaving(false);
    }
  };

  const keyword = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    return employees.filter((emp) => {
      const isCustom = emp.workHoursConfig?.useCustom;
      if (filterType === "custom" && !isCustom) return false;
      if (filterType === "standard" && isCustom) return false;

      if (keyword) {
        const nameMatch = (emp.fullName || "").toLowerCase().includes(keyword);
        const emailMatch = (emp.email || "").toLowerCase().includes(keyword);
        const deptMatch = (emp.department || "").toLowerCase().includes(keyword);
        if (!nameMatch && !emailMatch && !deptMatch) return false;
      }
      return true;
    });
  }, [employees, filterType, keyword]);

  const customCount = employees.filter((e) => e.workHoursConfig?.useCustom).length;
  const standardCount = employees.length - customCount;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm space-y-5 text-left">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
            <Clock className="h-5 w-5 text-indigo-600" />
            Giờ làm việc riêng của nhân sự
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Cấu hình thời gian check-in/out, ngày làm việc hoặc phép năm tùy chỉnh cho từng nhân viên.
          </p>
        </div>

        {/* Filter Badges */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl shrink-0">
          {[
            { id: "all", label: "Tất cả", count: employees.length },
            { id: "custom", label: "Giờ riêng", count: customCount },
            { id: "standard", label: "Theo công ty", count: standardCount },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setFilterType(item.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                filterType === item.id
                  ? "bg-white text-slate-800 shadow-xs"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <span>{item.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  filterType === item.id
                    ? "bg-indigo-100 text-indigo-700 font-extrabold"
                    : "bg-slate-200/60 text-slate-500"
                }`}
              >
                {item.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm nhân viên theo họ tên, email..."
          className="w-full pl-10 pr-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Employees Table / List */}
      {loading ? (
        <div className="py-12 text-center text-slate-400 text-xs">
          <Clock className="h-6 w-6 animate-spin mx-auto text-indigo-500 mb-2" />
          Đang tải danh sách giờ làm việc nhân sự...
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center border border-dashed border-slate-200 rounded-2xl">
          <Users className="h-8 w-8 mx-auto text-slate-300 mb-2" />
          <p className="text-xs font-semibold text-slate-600">Không có nhân viên phù hợp</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Thử thay đổi từ khóa tìm kiếm hoặc bỏ chọn bộ lọc.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Nhân sự</th>
                  <th className="py-3 px-4">Chế độ áp dụng</th>
                  <th className="py-3 px-4">Khung giờ làm việc</th>
                  <th className="py-3 px-4">Giờ nghỉ trưa</th>
                  <th className="py-3 px-4">Trạng thái nhân sự</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((emp) => {
                  const custom = emp.workHoursConfig?.useCustom;
                  const cfg = emp.workHoursConfig;

                  return (
                    <tr
                      key={emp._id}
                      className="group hover:bg-slate-50/70 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-black text-xs flex items-center justify-center shrink-0">
                            {(emp.fullName || emp.email || "U")[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 text-xs group-hover:text-indigo-600 transition-colors">
                              {emp.fullName || emp.email?.split("@")[0]}
                            </p>
                            <p className="text-[11px] text-slate-400">{emp.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            custom
                              ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}
                        >
                          {custom ? "Giờ riêng" : "Theo công ty"}
                        </span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {custom && cfg?.checkInLimit && cfg?.checkOutLimit ? (
                          <div className="flex items-center gap-1.5 font-bold text-slate-800">
                            <Clock className="h-3.5 w-3.5 text-indigo-500" />
                            <span>
                              {cfg.checkInLimit} – {cfg.checkOutLimit}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">
                            Áp dụng giờ chung
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {custom && cfg?.lunchBreakStart && cfg?.lunchBreakEnd ? (
                          <div className="flex items-center gap-1 text-slate-600 font-medium">
                            <Coffee className="h-3 w-3 text-amber-500" />
                            <span>
                              {cfg.lunchBreakStart} – {cfg.lunchBreakEnd}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">
                            Áp dụng giờ chung
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {emp.employmentStatus === "probation" ? (
                          <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-200">
                            Thử việc
                          </span>
                        ) : emp.employmentStatus === "internship" ? (
                          <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200">
                            Thực tập
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                            Chính thức
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openEdit(emp)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 text-[11px] font-bold transition active:scale-95 cursor-pointer"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>Chỉnh sửa</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="bg-slate-50/70 border-t border-slate-100 px-4 py-2.5 text-[11px] text-slate-500 flex items-center justify-between">
            <span>
              Hiển thị <strong>{filtered.length}</strong> / {employees.length} nhân sự
            </span>
          </div>
        </div>
      )}

      {/* Modal: Edit Employee Custom Work Hours */}
      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => !saving && setEditing(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 sm:p-7 space-y-5 max-h-[90dvh] overflow-y-auto border border-slate-100 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <Clock className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-slate-800">
                    Cấu hình giờ làm việc riêng
                  </h4>
                  <p className="text-[11px] text-slate-400 font-medium">
                    {editing.fullName || editing.email}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Toggle Custom vs Standard */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-center justify-between">
              <div>
                <span className="text-xs font-extrabold text-slate-800 block">
                  Bật giờ làm việc riêng
                </span>
                <span className="text-[11px] text-slate-400">
                  Ghi đè giờ làm việc chung của công ty cho nhân viên này
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.useCustom}
                  onChange={(e) => setForm((f) => ({ ...f, useCustom: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 shadow-inner"></div>
              </label>
            </div>

            {/* Employment Status & Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 text-left">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                  Trạng thái nhân sự
                </label>
                <select
                  value={form.employmentStatus || "official"}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      employmentStatus: e.target.value as WorkHoursConfig["employmentStatus"],
                    }))
                  }
                  className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="official">Chính thức</option>
                  <option value="probation">Thử việc</option>
                  <option value="internship">Thực tập</option>
                </select>
              </div>

              <div className="space-y-1.5 text-left">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                  Ngày chính thức
                </label>
                <input
                  type="date"
                  value={form.officialDate || ""}
                  onChange={(e) => setForm((f) => ({ ...f, officialDate: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1.5 text-left col-span-2">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                  Phép năm riêng (Ngày)
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="Để trống để áp dụng theo quy định chung công ty"
                  value={form.annualLeaveDays ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      annualLeaveDays:
                        e.target.value === "" ? undefined : Number(e.target.value),
                    }))
                  }
                  className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400 placeholder:font-normal"
                />
              </div>
            </div>

            {/* Custom Hours Settings */}
            {form.useCustom ? (
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5 text-left">
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                      Giờ vào (Check-in)
                    </label>
                    <input
                      type="time"
                      value={form.checkInLimit || ""}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, checkInLimit: e.target.value }))
                      }
                      className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="space-y-1.5 text-left">
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                      Giờ ra (Check-out)
                    </label>
                    <input
                      type="time"
                      value={form.checkOutLimit || ""}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, checkOutLimit: e.target.value }))
                      }
                      className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5 text-left">
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                      Bắt đầu nghỉ trưa
                    </label>
                    <input
                      type="time"
                      value={form.lunchBreakStart || ""}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, lunchBreakStart: e.target.value }))
                      }
                      className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="space-y-1.5 text-left">
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                      Kết thúc nghỉ trưa
                    </label>
                    <input
                      type="time"
                      value={form.lunchBreakEnd || ""}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, lunchBreakEnd: e.target.value }))
                      }
                      className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Working Days */}
                <div className="space-y-2 text-left">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                    Ngày làm việc trong tuần <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {DAY_OPTIONS.map(({ day, label }) => {
                      const isSelected = (form.workingDays || []).includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              workingDays: (f.workingDays || []).includes(day)
                                ? (f.workingDays || []).filter((v) => v !== day)
                                : [...(f.workingDays || []), day],
                            }))
                          }
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                            isSelected
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                              : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 text-slate-500 text-xs leading-relaxed">
                Nhân viên này đang áp dụng các khung giờ và quy định làm việc mặc định toàn doanh nghiệp. Bật <strong>"Bật giờ làm việc riêng"</strong> để thiết lập lịch trình riêng.
              </div>
            )}

            {/* Modal Actions */}
            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setEditing(null)}
                disabled={saving}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-600 transition cursor-pointer disabled:opacity-50"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-indigo-600/20 active:scale-[0.98] cursor-pointer disabled:opacity-50"
              >
                {saving ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

