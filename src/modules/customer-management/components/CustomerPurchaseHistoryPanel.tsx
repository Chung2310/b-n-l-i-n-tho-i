import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  ShoppingBag,
  TrendingUp,
  ShieldCheck,
  AlertCircle,
  Calendar,
  Copy,
  Check,
  Package,
  RotateCw,
} from "lucide-react";
import { customerApi } from "../customerApi";
import type { CustomerPurchaseHistory } from "../types";
import { Dropdown } from "../../../components/common/Dropdown";
import { TablePagination } from "../../../components/common/TablePagination";

type Props = { customerId: string; companyCode: string; branchId?: string };

const currency = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const date = (value?: string) =>
  value ? new Date(value).toLocaleDateString("vi-VN") : "—";

const STATUS_CONFIG: Record<
  string,
  { label: string; badge: string }
> = {
  draft: {
    label: "Nháp",
    badge: "bg-slate-100 text-slate-700 border-slate-200",
  },
  confirmed: {
    label: "Đã xác nhận",
    badge: "bg-blue-50 text-blue-700 border-blue-200",
  },
  completed: {
    label: "Hoàn thành",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  cancelled: {
    label: "Đã hủy",
    badge: "bg-rose-50 text-rose-700 border-rose-200",
  },
};

const statusLabel = (status?: string) =>
  STATUS_CONFIG[status || ""]?.label || status || "Không rõ";

const orderLabel = (order: CustomerPurchaseHistory["items"][number]) =>
  order.orderCode || `Đơn treo #${order._id.slice(-6)}`;

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

export default function CustomerPurchaseHistoryPanel({
  customerId,
  companyCode,
  branchId,
}: Props) {
  const [history, setHistory] = useState<CustomerPurchaseHistory | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const loadHistory = useCallback(async () => {
    if (!branchId) {
      setHistory(null);
      setLoading(false);
      setError("");
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    setHistory(null);
    try {
      const data = await customerApi.purchaseHistory(customerId, {
        companyCode,
        branchId,
      });
      if (active) setHistory(data);
    } catch (cause) {
      if (active) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Không tải được lịch sử mua hàng."
        );
      }
    } finally {
      if (active) setLoading(false);
    }
    return () => {
      active = false;
    };
  }, [branchId, companyCode, customerId]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory, refreshTrigger]);

  const filteredItems = useMemo(() => {
    if (!history?.items) return [];
    if (!statusFilter) return history.items;
    return history.items.filter((item) => item.status === statusFilter);
  }, [history?.items, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, page, pageSize]);

  if (!branchId)
    return (
      <section className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-xs text-slate-500">
        Vui lòng chọn chi nhánh để xem lịch sử mua hàng.
      </section>
    );

  if (loading)
    return (
      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500 shadow-2xs">
        <div className="flex items-center justify-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent"></div>
          <span>Đang tải lịch sử mua hàng...</span>
        </div>
      </section>
    );

  if (error)
    return (
      <section className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-700">
        {error}
      </section>
    );

  if (!history) return null;

  const cards = [
    {
      label: "Số đơn",
      value: String(history.summary.orderCount),
      subtext: "đơn tại chi nhánh",
      icon: ShoppingBag,
      color: "text-cyan-700",
      bg: "bg-cyan-50/70 border-cyan-100",
    },
    {
      label: "Tổng đã mua",
      value: currency.format(history.summary.totalPurchased),
      subtext: "giá trị tích lũy",
      icon: TrendingUp,
      color: "text-slate-900",
      bg: "bg-slate-50 border-slate-200/80",
    },
    {
      label: "Đã thanh toán",
      value: currency.format(history.summary.totalPaid),
      subtext: "đã thực thu",
      icon: ShieldCheck,
      color: "text-emerald-700",
      bg: "bg-emerald-50/70 border-emerald-100",
    },
    {
      label: "Công nợ hiện tại",
      value: currency.format(history.summary.currentDebt),
      subtext: "cần thu hồi",
      icon: AlertCircle,
      color:
        history.summary.currentDebt > 0 ? "text-rose-700" : "text-slate-700",
      bg:
        history.summary.currentDebt > 0
          ? "bg-rose-50/70 border-rose-200"
          : "bg-slate-50 border-slate-200/80",
    },
    {
      label: "Lần mua gần nhất",
      value: date(history.summary.lastPurchaseAt),
      subtext: "giao dịch cuối",
      icon: Calendar,
      color: "text-indigo-700",
      bg: "bg-indigo-50/70 border-indigo-100",
    },
  ];

  return (
    <section className="mt-4 space-y-4" aria-label="Lịch sử mua hàng">
      {/* Top 5 Summary Bento Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className={`rounded-2xl border p-3.5 shadow-2xs ${card.bg}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {card.label}
                </span>
                <Icon className={`h-4 w-4 ${card.color}`} />
              </div>
              <p
                className={`mt-1 font-black text-sm sm:text-base tabular-nums truncate ${card.color}`}
              >
                {card.value}
              </p>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                {card.subtext}
              </span>
            </div>
          );
        })}
      </div>

      {/* Orders Table Container */}
      <div className="rounded-2xl border border-slate-200/90 bg-white overflow-hidden shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 p-4 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-100 text-cyan-700">
              <ShoppingBag className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Lịch sử Đơn hàng Chi nhánh
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Chi tiết tất cả hóa đơn bán lẻ phát sinh tại chi nhánh được chọn
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Dropdown<string>
              value={statusFilter}
              onChange={(val) => {
                setStatusFilter(val);
                setPage(1);
              }}
              options={[
                { value: "", label: "Tất cả trạng thái" },
                { value: "completed", label: "Hoàn thành" },
                { value: "confirmed", label: "Đã xác nhận" },
                { value: "draft", label: "Nháp" },
                { value: "cancelled", label: "Đã hủy" },
              ]}
              size="sm"
              variant="filter"
              triggerClassName="text-xs"
            />

            <button
              type="button"
              onClick={() => setRefreshTrigger((prev) => prev + 1)}
              disabled={loading}
              title="Tải lại đơn hàng"
              className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100 transition cursor-pointer"
            >
              <RotateCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {history.items.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <Package className="h-8 w-8 mx-auto mb-2 text-slate-300" />
            <p className="text-xs font-bold text-slate-600">
              Khách hàng chưa có đơn mua tại chi nhánh này.
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Các đơn hàng tạo tại chi nhánh khác hoặc kênh khác không hiển thị tại đây.
            </p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-10 text-center text-slate-400">
            <Package className="h-7 w-7 mx-auto mb-1.5 text-slate-300" />
            <p className="text-xs font-bold text-slate-600">
              Không tìm thấy đơn hàng nào với trạng thái đã chọn.
            </p>
            <button
              type="button"
              onClick={() => setStatusFilter("")}
              className="mt-2 text-xs font-semibold text-cyan-600 hover:underline cursor-pointer"
            >
              Xóa bộ lọc
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-3.5 whitespace-nowrap">Mã đơn hàng</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Ngày bán</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Sản phẩm</th>
                  <th className="py-3 px-3.5 text-right whitespace-nowrap">Tổng tiền</th>
                  <th className="py-3 px-3.5 text-right whitespace-nowrap">Đã thanh toán</th>
                  <th className="py-3 px-3.5 text-right whitespace-nowrap">Công nợ</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Nhân viên</th>
                  <th className="py-3 px-3.5 text-right whitespace-nowrap">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {paginatedItems.map((order) => {
                  const cfg =
                    STATUS_CONFIG[order.status || ""] || {
                      label: order.status || "Không rõ",
                      badge: "bg-slate-50 text-slate-700 border-slate-200",
                    };
                  const code = orderLabel(order);

                  return (
                    <tr
                      key={order._id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* Order Code */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-50/80 px-2 py-0.5 border border-cyan-100 font-mono text-xs font-bold text-cyan-800">
                          <span>{code}</span>
                          <CopyTextButton text={code} title="Mã đơn" />
                        </div>
                      </td>

                      {/* Business Date */}
                      <td className="py-3 px-3.5 text-slate-500 whitespace-nowrap font-mono text-[11px]">
                        {date(order.businessDate)}
                      </td>

                      {/* Item count */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-semibold text-slate-700 text-xs">
                          {order.itemCount} sản phẩm
                        </span>
                      </td>

                      {/* Grand Total */}
                      <td className="py-3 px-3.5 text-right font-black text-slate-900 whitespace-nowrap">
                        {currency.format(order.grandTotal)}
                      </td>

                      {/* Paid Amount */}
                      <td className="py-3 px-3.5 text-right font-bold text-emerald-700 whitespace-nowrap">
                        {currency.format(order.paidAmount)}
                      </td>

                      {/* Due Amount */}
                      <td className="py-3 px-3.5 text-right whitespace-nowrap">
                        <span
                          className={`font-bold ${
                            order.dueAmount > 0
                              ? "text-rose-600"
                              : "text-slate-400 font-medium"
                          }`}
                        >
                          {currency.format(order.dueAmount)}
                        </span>
                      </td>

                      {/* Salesperson */}
                      <td className="py-3 px-3.5 text-slate-600 whitespace-nowrap">
                        <span>Nhân viên: {order.salespersonName || "—"}</span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3.5 text-right whitespace-nowrap">
                        <span
                          className={`inline-block rounded-md border px-2.5 py-0.5 text-[11px] font-bold ${cfg.badge}`}
                        >
                          {statusLabel(order.status)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {filteredItems.length > 0 && (
          <TablePagination
            currentPage={page}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={filteredItems.length}
            onPageChange={setPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setPage(1);
            }}
            itemLabel="đơn hàng"
          />
        )}
      </div>
    </section>
  );
}

