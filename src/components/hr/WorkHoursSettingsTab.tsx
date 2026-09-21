import React, { useState, useEffect } from "react";
import {
  MapPin,
  Clock,
  Building2,
  Calendar,
  Compass,
  CheckCircle2,
  Coffee,
  Sparkles,
  ShieldCheck,
  Save,
  Crosshair
} from "lucide-react";
import { toast } from "../../pages/Toast";
import { getApiErrorMessage } from "../../utils/errorMessage";
import { useAuth } from "../../context/AuthContext";
import EmployeeWorkHoursTab from "../settings/EmployeeWorkHoursTab";

const WEEKDAYS = [
  { day: 1, label: "Thứ 2", short: "T2" },
  { day: 2, label: "Thứ 3", short: "T3" },
  { day: 3, label: "Thứ 4", short: "T4" },
  { day: 4, label: "Thứ 5", short: "T5" },
  { day: 5, label: "Thứ 6", short: "T6" },
  { day: 6, label: "Thứ 7", short: "T7" },
  { day: 0, label: "Chủ Nhật", short: "CN" },
];

export default function WorkHoursSettingsTab() {
  const { userProfile, hasPermission } = useAuth();

  // States for timekeeping location setup
  const [addressName, setAddressName] = useState("");
  const [latitude, setLatitude] = useState<number | "">("");
  const [longitude, setLongitude] = useState<number | "">("");
  const [allowedRadius, setAllowedRadius] = useState<number | "">("");
  const [checkInLimit, setCheckInLimit] = useState("08:30");
  const [checkOutLimit, setCheckOutLimit] = useState("17:30");
  const [lunchBreakStart, setLunchBreakStart] = useState("12:00");
  const [lunchBreakEnd, setLunchBreakEnd] = useState("13:00");
  const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [annualLeaveDays, setAnnualLeaveDays] = useState(12);
  const [isLocating, setIsLocating] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);

  // Cấu hình vị trí chấm công (GPS) dành cho admin/superadmin hoặc role được cấp quyền timekeeping:manage
  const canManageLocation =
    userProfile?.role === "superadmin" ||
    userProfile?.role === "admin" ||
    hasPermission("timekeeping:manage");

  useEffect(() => {
    if (canManageLocation) {
      const fetchCompanyLocation = async () => {
        try {
          const res = await fetch("/api/v1/timekeeping/company-location", {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
            },
          });
          if (res.ok) {
            const result = await res.json();
            if (result.data) {
              setAddressName(result.data.addressName || "");
              setLatitude(result.data.latitude ?? "");
              setLongitude(result.data.longitude ?? "");
              setAllowedRadius(result.data.allowedRadius ?? "");
              setCheckInLimit(result.data.checkInLimit || "08:30");
              setCheckOutLimit(result.data.checkOutLimit || "17:30");
              setLunchBreakStart(result.data.lunchBreakStart || "12:00");
              setLunchBreakEnd(result.data.lunchBreakEnd || "13:00");
              setWorkingDays(
                Array.isArray(result.data.workingDays) && result.data.workingDays.length
                  ? result.data.workingDays
                  : [1, 2, 3, 4, 5]
              );
              setAnnualLeaveDays(Number(result.data.annualLeaveDays ?? 12));
            }
          }
        } catch (err) {
          console.error("Lỗi khi tải vị trí công ty:", err);
        }
      };
      fetchCompanyLocation();
    }
  }, [canManageLocation]);

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Trình duyệt của bạn không hỗ trợ định vị GPS.");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude);
        setLongitude(position.coords.longitude);
        setIsLocating(false);
        toast.success("Đã lấy tọa độ định vị GPS hiện tại!");
      },
      () => {
        setIsLocating(false);
        toast.error("Không thể tự động lấy vị trí hiện tại. Vui lòng nhập tọa độ thủ công.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (latitude === "" || longitude === "" || allowedRadius === "") {
      toast.error("Vui lòng điền đầy đủ thông tin tọa độ và bán kính.");
      return;
    }

    if (workingDays.length === 0) {
      toast.error("Vui lòng chọn ít nhất một ngày làm việc trong tuần.");
      return;
    }

    setSavingLocation(true);
    try {
      const res = await fetch("/api/v1/timekeeping/company-location", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
        body: JSON.stringify({
          latitude: Number(latitude),
          longitude: Number(longitude),
          allowedRadius: Number(allowedRadius),
          addressName,
          checkInLimit,
          checkOutLimit,
          lunchBreakStart,
          lunchBreakEnd,
          workingDays,
          annualLeaveDays,
        }),
      });
      const result = await res.json();
      if (res.ok) {
        toast.success("Cấu hình vị trí chấm công công ty thành công!");
      } else {
        toast.error(result.message || "Lưu cấu hình thất bại.");
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Lỗi kết nối khi gửi dữ liệu cấu hình."));
    } finally {
      setSavingLocation(false);
    }
  };

  return (
    <div className="space-y-8 text-left max-w-7xl mx-auto pb-12">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl shadow-slate-900/10">
        <div className="absolute right-0 top-0 -mt-10 -mr-10 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold backdrop-blur-md border border-indigo-500/30">
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
              <span>Chấm công GPS & Giờ làm việc</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <Clock className="h-7 w-7 text-indigo-400" />
              Thiết Lập Giờ Làm Việc & Vị Trí
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Quản lý khung giờ chấm công tiêu chuẩn công ty, bán kính GPS hợp lệ và cấu hình giờ làm việc riêng biệt cho từng nhân viên.
            </p>
          </div>
        </div>
      </div>

      {canManageLocation && (
        <form onSubmit={handleSaveLocation} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Box 1: GPS & Location Settings */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                    <MapPin className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-800">
                      Tọa độ & Vị trí chấm công GPS
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Xác thực nhân viên có mặt trong bán kính văn phòng khi check-in
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGetCurrentLocation}
                  disabled={isLocating}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl text-xs font-bold transition active:scale-95 disabled:opacity-50 cursor-pointer"
                  title="Lấy tọa độ hiện tại của thiết bị này"
                >
                  <Crosshair className={`h-3.5 w-3.5 ${isLocating ? "animate-spin" : ""}`} />
                  <span>{isLocating ? "Đang định vị..." : "Lấy GPS hiện tại"}</span>
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                    Tên địa điểm / Văn phòng
                  </label>
                  <input
                    type="text"
                    value={addressName}
                    onChange={(e) => setAddressName(e.target.value)}
                    placeholder="Ví dụ: Trụ sở chính - Tòa nhà Landmark 81"
                    className="w-full px-3 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                      Vĩ độ (Latitude) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={latitude}
                      onChange={(e) =>
                        setLatitude(e.target.value === "" ? "" : Number(e.target.value))
                      }
                      placeholder="VD: 10.7769"
                      className="w-full px-3 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                      Kinh độ (Longitude) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={longitude}
                      onChange={(e) =>
                        setLongitude(e.target.value === "" ? "" : Number(e.target.value))
                      }
                      placeholder="VD: 106.7009"
                      className="w-full px-3 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                      Bán kính cho phép (Mét) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={allowedRadius}
                      onChange={(e) =>
                        setAllowedRadius(e.target.value === "" ? "" : Number(e.target.value))
                      }
                      placeholder="VD: 150"
                      className="w-full px-3 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                      Số ngày phép năm chuẩn
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={annualLeaveDays}
                      onChange={(e) => setAnnualLeaveDays(Number(e.target.value) || 0)}
                      placeholder="12"
                      className="w-full px-3 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Box 2: Working Hours & Days */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm space-y-5">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3.5">
                <div className="h-9 w-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <Clock className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-800">
                    Khung giờ chuẩn & Ngày làm việc
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Khung giờ hành chính chung toàn công ty
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                      Giờ Check-in (Vào ca)
                    </label>
                    <input
                      type="time"
                      value={checkInLimit}
                      onChange={(e) => setCheckInLimit(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                      Giờ Check-out (Hết ca)
                    </label>
                    <input
                      type="time"
                      value={checkOutLimit}
                      onChange={(e) => setCheckOutLimit(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
                      required
                    />
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-2.5">
                  <div className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Coffee className="h-3.5 w-3.5 text-amber-500" />
                    Giờ nghỉ trưa
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 font-medium block">Từ giờ</label>
                      <input
                        type="time"
                        value={lunchBreakStart}
                        onChange={(e) => setLunchBreakStart(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 font-medium block">Đến giờ</label>
                      <input
                        type="time"
                        value={lunchBreakEnd}
                        onChange={(e) => setLunchBreakEnd(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Weekdays Toggle */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                    Ngày làm việc trong tuần
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAYS.map(({ day, label }) => {
                      const isSelected = workingDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() =>
                            setWorkingDays((curr) =>
                              curr.includes(day)
                                ? curr.filter((v) => v !== day)
                                : [...curr, day]
                            )
                          }
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                            isSelected
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
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
            </div>
          </div>

          {/* Action Button */}
          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={savingLocation}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-indigo-600/20 active:scale-[0.98] cursor-pointer disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>{savingLocation ? "Đang lưu cấu hình..." : "Lưu Cấu Hình Chung"}</span>
            </button>
          </div>
        </form>
      )}

      {/* Employee Specific Work Hours Sub-Tab */}
      <EmployeeWorkHoursTab />
    </div>
  );
}

