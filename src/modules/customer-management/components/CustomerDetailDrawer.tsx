import React, { useState } from "react";
import {
  X,
  Award,
  Coins,
  TrendingUp,
  Gift,
  ShieldCheck,
  ShoppingBag,
  FileText,
  User,
  Phone,
  Mail,
  Calendar,
  MapPin,
  Edit,
  Power,
} from "lucide-react";
import type { Customer } from "../types";
import BillingProfilesPanel from "./BillingProfilesPanel";
import CustomerPurchaseHistoryPanel from "./CustomerPurchaseHistoryPanel";
import CustomerPointLedgerPanel from "./CustomerPointLedgerPanel";
import AdjustPointsModal from "./AdjustPointsModal";

const spend = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const TIER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  diamond: { bg: "bg-cyan-50", text: "text-cyan-800", border: "border-cyan-300" },
  gold: { bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-300" },
  silver: { bg: "bg-slate-100", text: "text-slate-800", border: "border-slate-300" },
  bronze: { bg: "bg-orange-50", text: "text-orange-900", border: "border-orange-200" },
};

export default function CustomerDetailDrawer({
  customer,
  branchId,
  canManage,
  onClose,
  onEdit,
  onToggleStatus,
  onCustomerUpdated,
}: {
  customer: Customer;
  branchId?: string;
  canManage: boolean;
  onClose: () => void;
  onEdit: () => void;
  onToggleStatus: () => void;
  onCustomerUpdated?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"points" | "orders" | "vat" | "info">("points");
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const tierCode = customer.tier?.code?.toLowerCase() || "bronze";
  const tierStyle = TIER_COLORS[tierCode] || {
    bg: "bg-slate-50",
    text: "text-slate-700",
    border: "border-slate-200",
  };

  const handleAdjustSuccess = () => {
    setAdjustModalOpen(false);
    setRefreshTrigger((prev) => prev + 1);
    onCustomerUpdated?.();
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-2xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-4xl xl:max-w-5xl flex-col border-l border-slate-200 bg-slate-50/70 shadow-2xl backdrop-blur-md animate-in slide-in-from-right duration-200">
        {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white p-5">
        <div className="flex items-center gap-3">
          {customer.avatarUrl ? (
            <img
              src={customer.avatarUrl}
              alt={customer.name}
              className="h-12 w-12 shrink-0 rounded-2xl object-cover border border-slate-200 shadow-2xs"
            />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-600 text-white font-black text-sm shadow-2xs select-none">
              {customer.name?.slice(0, 2)?.toUpperCase()}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-slate-900">{customer.name}</h2>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${
                  customer.status === "active"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-slate-100 text-slate-500 border-slate-200"
                }`}
              >
                {customer.status === "active" ? "Đang hoạt động" : "Ngừng hoạt động"}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
              <span className="font-mono font-bold text-slate-700">{customer.customerCode}</span>
              <span>·</span>
              <span>{customer.phone}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          aria-label="Đóng chi tiết"
          onClick={onClose}
          className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Top VIP & Points Highlight Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Card 1: VIP Tier & Gross Profit */}
          <div className={`rounded-2xl border p-4 shadow-xs ${tierStyle.bg} ${tierStyle.border}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Hạng VIP Thành Viên
              </span>
              <Award className={`h-5 w-5 ${tierStyle.text}`} />
            </div>

            <div className="flex items-baseline gap-2">
              <span className={`text-xl font-black ${tierStyle.text}`}>
                {customer.tier?.name || "Hạng Đồng"}
              </span>
            </div>

            <div className="mt-2.5 border-t border-slate-200/60 pt-2 flex items-center justify-between text-xs">
              <span className="text-slate-500">Lãi gộp mang lại:</span>
              <span className="font-bold text-slate-900">
                {spend.format(customer.tierGrossProfit || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
              <span>Doanh số: {spend.format(customer.tierTotalSales || 0)}</span>
            </div>
          </div>

          {/* Card 2: Loyalty Points Balance */}
          <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/60 to-white p-4 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                  Điểm Thưởng Khả Dụng
                </span>
                <Coins className="h-5 w-5 text-amber-600" />
              </div>

              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-amber-900">
                  {(customer.pointsBalance || 0).toLocaleString("vi-VN")}
                </span>
                <span className="text-xs font-bold text-amber-700">điểm</span>
                <span className="text-[11px] text-slate-400 ml-1">
                  (≈ {((customer.pointsBalance || 0) * 1000).toLocaleString("vi-VN")} đ)
                </span>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2 border-t border-amber-100 pt-2.5">
              <div className="text-[11px] text-slate-500">
                <span>Đã tích: <b>{customer.totalPointsEarned || 0}</b></span>
                <span className="mx-1">·</span>
                <span>Đã tiêu: <b>{customer.totalPointsRedeemed || 0}</b></span>
              </div>

              {canManage && (
                <button
                  type="button"
                  onClick={() => setAdjustModalOpen(true)}
                  className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1 text-xs font-bold text-white shadow-2xs hover:bg-amber-700 transition cursor-pointer"
                >
                  <Gift className="h-3 w-3" />
                  <span>Cấp / Trừ điểm</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tab Navigation Switcher */}
        <div className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-2xs gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("points")}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition cursor-pointer ${
              activeTab === "points"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <Coins className="h-3.5 w-3.5" />
            <span>Sổ cái Điểm</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("orders")}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition cursor-pointer ${
              activeTab === "orders"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            <span>Lịch sử mua</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("vat")}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition cursor-pointer ${
              activeTab === "vat"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Hóa đơn VAT</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("info")}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition cursor-pointer ${
              activeTab === "info"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <User className="h-3.5 w-3.5" />
            <span>Hồ sơ</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className={activeTab === "points" ? "block" : "hidden"}>
          <CustomerPointLedgerPanel
            customerId={customer._id}
            companyCode={customer.companyCode}
            refreshTrigger={refreshTrigger}
          />
        </div>

        <div className={activeTab === "orders" ? "block" : "hidden"}>
          <CustomerPurchaseHistoryPanel
            customerId={customer._id}
            companyCode={customer.companyCode}
            branchId={branchId}
          />
        </div>

        <div className={activeTab === "vat" ? "block" : "hidden"}>
          <BillingProfilesPanel
            customerId={customer._id}
            companyCode={customer.companyCode}
            canManage={canManage}
          />
        </div>

        <div className={activeTab === "info" ? "block" : "hidden"}>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3 text-xs">
            <h3 className="font-bold text-slate-900 text-sm mb-2">Chi tiết thông tin cá nhân</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 p-3">
                <span className="text-slate-400 block text-[11px]">Họ và tên</span>
                <span className="font-bold text-slate-800">{customer.name}</span>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <span className="text-slate-400 block text-[11px]">Số điện thoại</span>
                <span className="font-bold text-slate-800">{customer.phone}</span>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <span className="text-slate-400 block text-[11px]">Email</span>
                <span className="font-medium text-slate-700">{customer.email || "—"}</span>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <span className="text-slate-400 block text-[11px]">Ngày sinh</span>
                <span className="font-medium text-slate-700">
                  {customer.dateOfBirth
                    ? new Date(customer.dateOfBirth).toLocaleDateString("vi-VN")
                    : "—"}
                </span>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 col-span-2">
                <span className="text-slate-400 block text-[11px]">Địa chỉ liên hệ</span>
                <span className="font-medium text-slate-700">{customer.address || "—"}</span>
              </div>
              {customer.notes && (
                <div className="rounded-xl bg-amber-50/50 border border-amber-100 p-3 col-span-2">
                  <span className="text-amber-800 block text-[11px] font-bold">Ghi chú</span>
                  <span className="text-slate-700 mt-0.5 block">{customer.notes}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      {canManage && (
        <div className="border-t border-slate-200 bg-white p-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onToggleStatus}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
          >
            {customer.status === "active" ? "Ngừng hoạt động" : "Kích hoạt lại"}
          </button>

          <button
            type="button"
            onClick={onEdit}
            className="rounded-xl bg-cyan-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-cyan-700 transition cursor-pointer"
          >
            Sửa hồ sơ
          </button>
        </div>
      )}

      {adjustModalOpen && (
        <AdjustPointsModal
          customer={customer}
          onClose={() => setAdjustModalOpen(false)}
          onSuccess={handleAdjustSuccess}
        />
      )}
    </aside>
    </>
  );
}
