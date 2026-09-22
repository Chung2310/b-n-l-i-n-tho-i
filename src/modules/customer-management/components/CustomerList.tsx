import React, { useState } from "react";
import {
  Search,
  Users,
  Award,
  Sparkles,
  Crown,
  Building2,
  Phone,
  Mail,
  Copy,
  Check,
  ChevronRight,
  Filter,
  X,
  Coins,
} from "lucide-react";
import type { Customer, CustomerStatus, CustomerType } from "../types";
import { Dropdown } from "../../../components/common/Dropdown";
import { TablePagination } from "../../../components/common/TablePagination";

type Props = {
  items: Customer[];
  total: number;
  page: number;
  limit: number;
  query: string;
  status: CustomerStatus;
  type: "" | CustomerType;
  onQueryChange: (value: string) => void;
  onStatusChange: (value: CustomerStatus) => void;
  onTypeChange: (value: "" | CustomerType) => void;
  onPageChange: (value: number) => void;
  onLimitChange?: (value: number) => void;
  onOpen: (customer: Customer) => void;
};

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "KH";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const getAvatarGradient = (name: string) => {
  const gradients = [
    "from-cyan-500 to-blue-600 text-white",
    "from-teal-500 to-emerald-600 text-white",
    "from-indigo-500 to-purple-600 text-white",
    "from-amber-500 to-orange-600 text-white",
    "from-rose-500 to-pink-600 text-white",
    "from-blue-600 to-indigo-700 text-white",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return gradients[Math.abs(hash) % gradients.length];
};

function CopyTextButton({ text, title }: { text: string; title: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title={`Sao chép ${title}`}
      onClick={(e) => {
        e.stopPropagation();
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-slate-700 transition cursor-pointer shrink-0"
    >
      {copied ? (
        <Check className="h-3 w-3 text-emerald-600" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </button>
  );
}

const renderTierBadge = (tier?: { name: string; code: string }) => {
  if (!tier) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100/90 px-2.5 py-0.5 text-[11px] font-medium text-slate-400 border border-slate-200/60 select-none">
        Chưa xếp hạng
      </span>
    );
  }
  const code = (tier.code || "").toLowerCase();
  if (code.includes("diamond") || code.includes("kim-cuong")) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-cyan-50 to-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-cyan-800 border border-cyan-200/80 shadow-2xs">
        <Sparkles className="h-3 w-3 text-cyan-600 shrink-0" />
        <span>{tier.name}</span>
      </span>
    );
  }
  if (code.includes("gold") || code.includes("vang")) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-50 to-yellow-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-200/80 shadow-2xs">
        <Crown className="h-3 w-3 text-amber-600 shrink-0" />
        <span>{tier.name}</span>
      </span>
    );
  }
  if (code.includes("silver") || code.includes("bac")) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700 border border-slate-300/80">
        <Award className="h-3 w-3 text-slate-500 shrink-0" />
        <span>{tier.name}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-0.5 text-[11px] font-bold text-orange-800 border border-orange-200">
      <Award className="h-3 w-3 text-orange-600 shrink-0" />
      <span>{tier.name}</span>
    </span>
  );
};

export default function CustomerList(props: Props) {
  const hasFilter = Boolean(props.query || props.status !== "active" || props.type);

  const resetFilters = () => {
    props.onQueryChange("");
    props.onStatusChange("active");
    props.onTypeChange("");
    props.onPageChange(1);
  };

  const totalPages = Math.max(1, Math.ceil(props.total / props.limit));

  return (
    <div className="space-y-4">
      {/* Search & Filter Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-2xs">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            aria-label="Tìm khách hàng"
            value={props.query}
            onChange={(event) => props.onQueryChange(event.target.value)}
            placeholder="Tìm theo mã KH, họ tên, số điện thoại hoặc email..."
            className="w-full rounded-xl border border-slate-200/90 bg-slate-50/50 py-2.5 pl-10 pr-9 text-xs sm:text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition shadow-2xs"
          />
          {props.query && (
            <button
              type="button"
              onClick={() => props.onQueryChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
              title="Xóa tìm kiếm"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
          <div className="w-full sm:w-48">
            <Dropdown<CustomerStatus>
              aria-label="Trạng thái"
              name="status"
              value={props.status}
              onChange={props.onStatusChange}
              options={[
                { value: "active", label: "Đang hoạt động" },
                { value: "inactive", label: "Ngừng hoạt động" },
              ]}
              variant="filter"
              size="md"
              triggerClassName="w-full justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-semibold"
            />
          </div>

          <div className="w-full sm:w-48">
            <Dropdown<"" | CustomerType>
              aria-label="Loại khách"
              name="type"
              value={props.type}
              onChange={props.onTypeChange}
              options={[
                { value: "", label: "Tất cả loại khách" },
                { value: "regular", label: "Khách thường" },
                { value: "vat", label: "Khách xuất VAT" },
              ]}
              variant="filter"
              size="md"
              triggerClassName="w-full justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-semibold"
            />
          </div>

          {hasFilter && (
            <button
              type="button"
              onClick={resetFilters}
              title="Đặt lại bộ lọc"
              className="inline-flex items-center gap-1 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer whitespace-nowrap"
            >
              <X className="h-3.5 w-3.5 text-slate-400" />
              <span>Đặt lại</span>
            </button>
          )}
        </div>
      </div>

      {/* Customer Data Table Container */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/70 text-slate-500 font-bold text-[11px] uppercase tracking-wider select-none">
                <th className="py-3 px-4">Mã khách</th>
                <th className="py-3 px-4">Khách hàng</th>
                <th className="py-3 px-4">Điện thoại</th>
                <th className="py-3 px-4">Hạng thành viên</th>
                <th className="py-3 px-4">Loại khách</th>
                <th className="py-3 px-4">Trạng thái</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {props.items.map((customer) => {
                const initials = getInitials(customer.name);
                const gradient = getAvatarGradient(customer.name);

                return (
                  <tr
                    key={customer._id}
                    onClick={() => props.onOpen(customer)}
                    className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                  >
                    {/* Customer Code */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-50/80 px-2 py-0.5 border border-cyan-100/90 text-cyan-800 font-mono text-xs font-bold shadow-2xs">
                        <span>{customer.customerCode}</span>
                        <CopyTextButton text={customer.customerCode} title="Mã KH" />
                      </div>
                    </td>

                    {/* Customer Identity with Avatar */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {customer.avatarUrl ? (
                          <img
                            src={customer.avatarUrl}
                            alt={customer.name}
                            className="h-9 w-9 shrink-0 rounded-xl object-cover shadow-2xs border border-slate-200"
                          />
                        ) : (
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-xs font-black shadow-2xs select-none`}
                          >
                            {initials}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 group-hover:text-cyan-700 transition-colors truncate">
                            {customer.name}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5 truncate">
                            {customer.email ? (
                              <span className="flex items-center gap-1 truncate" title={customer.email}>
                                <Mail className="h-3 w-3 shrink-0" />
                                <span className="truncate">{customer.email}</span>
                              </span>
                            ) : (
                              <span>Chưa có email</span>
                            )}
                            {customer.pointsBalance !== undefined && customer.pointsBalance > 0 && (
                              <>
                                <span>·</span>
                                <span className="flex items-center gap-0.5 font-semibold text-amber-700">
                                  <Coins className="h-3 w-3" />
                                  {customer.pointsBalance.toLocaleString("vi-VN")} đ
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Phone Number */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5 text-slate-700 font-medium">
                        <Phone className="h-3.5 w-3.5 text-slate-400" />
                        <span>{customer.phone}</span>
                        <CopyTextButton text={customer.phone} title="Số điện thoại" />
                      </div>
                    </td>

                    {/* VIP Tier */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {renderTierBadge(customer.tier)}
                    </td>

                    {/* Customer Type */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {customer.type === "vat" ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 border border-indigo-200/60">
                          <Building2 className="h-3 w-3 text-indigo-500" />
                          <span>Xuất VAT</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                          <span>Khách thường</span>
                        </span>
                      )}
                    </td>

                    {/* Status with Pulsing Dot */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {customer.status === "active" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200/60">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </span>
                          <span>Đang hoạt động</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                          <span>Ngừng hoạt động</span>
                        </span>
                      )}
                    </td>

                    {/* Action Button */}
                    <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        aria-label={`Chi tiết ${customer.name}`}
                        onClick={() => props.onOpen(customer)}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-800 transition-all shadow-2xs cursor-pointer group-hover:border-cyan-300"
                      >
                        <span>Chi tiết</span>
                        <ChevronRight className="h-3.5 w-3.5 text-slate-400 group-hover:translate-x-0.5 group-hover:text-cyan-600 transition-all" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!props.items.length && (
            <div className="py-14 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3">
                <Users className="h-6 w-6" />
              </div>
              <p className="text-sm font-bold text-slate-700">Chưa có khách hàng phù hợp</p>
              <p className="text-xs text-slate-400 mt-1">
                {hasFilter ? "Hãy thử thay đổi từ khóa hoặc xóa bộ lọc tìm kiếm." : "Hãy bấm nút 'Thêm khách hàng' để tạo khách hàng đầu tiên."}
              </p>
              {hasFilter && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-3 inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-cyan-700 hover:bg-cyan-50 transition cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Xóa tất cả bộ lọc</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Standard Table Pagination */}
        {props.total > 0 && (
          <TablePagination
            currentPage={props.page}
            totalPages={totalPages}
            pageSize={props.limit}
            totalItems={props.total}
            onPageChange={props.onPageChange}
            onPageSizeChange={props.onLimitChange || (() => {})}
            itemLabel="khách hàng"
            pageSizeOptions={[10, 20, 50, 100]}
          />
        )}
      </div>
    </div>
  );
}
