import React from "react";
import {
  AlertCircle,
  Ban,
  Banknote,
  Building2,
  CheckCircle2,
  Clock,
  DollarSign,
  Eye,
  FileText,
  ListOrdered,
  Loader2,
  Package,
  RefreshCw,
  RotateCcw,
  Search,
  ShoppingBag,
  ShoppingBasket,
  User,
  Wallet,
  X,
} from "lucide-react";
import PaymentDialog from "../components/pos/PaymentDialog";
import { retailOrdersApi } from "../api/retailOrders.api";
import { retailAfterSalesApi } from "../api/retailAfterSales.api";
import { useRetailScope } from "../hooks/useRetailScope";
import type { RetailAfterSaleInput, RetailAfterSaleType, RetailOrder, RetailPaymentInput } from "../types";
import { getApiErrorMessage } from "../../../utils/errorMessage";
import { toast } from "../../../pages/Toast";

const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value) + " ₫";

export default function RetailOrdersPageV2() {
  const { scope, userProfile } = useRetailScope();
  const manager =
    userProfile?.role === "admin" ||
    userProfile?.role === "superadmin" ||
    userProfile?.permissions?.some((p) => p === "*" || p === "retail:manage");

  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [orders, setOrders] = React.useState<RetailOrder[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selected, setSelected] = React.useState<RetailOrder | null>(null);
  const [collecting, setCollecting] = React.useState(false);
  const [cancelling, setCancelling] = React.useState(false);
  const [error, setError] = React.useState("");

  const refresh = React.useCallback(async () => {
    if (!scope) return;
    setLoading(true);
    try {
      const data = await retailOrdersApi.list(scope, { q, status: status || undefined });
      setOrders(data.items);
      setError("");
    } catch (cause) {
      const msg = getApiErrorMessage(cause, "Không tải được đơn hàng.");
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [scope?.companyCode, scope?.branchId, q, status]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      void refresh();
    }, 250);
    return () => clearTimeout(timer);
  }, [refresh]);

  if (!scope) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-500">
        <Building2 className="mb-3 h-10 w-10 text-slate-400" />
        <p className="text-base font-medium">Vui lòng chọn chi nhánh để xem danh sách đơn hàng.</p>
      </div>
    );
  }

  const detail = async (id: string) => {
    try {
      const order = await retailOrdersApi.detail(scope, id);
      setSelected(order);
    } catch (cause) {
      const msg = getApiErrorMessage(cause, "Không tải được chi tiết đơn hàng.");
      setError(msg);
      toast.error(msg);
    }
  };

  const openCollection = () => {
    if (!selected?.customerId) {
      setError("Vui lòng chọn khách hàng trước khi thanh toán.");
      toast.error("Vui lòng chọn khách hàng trước khi thanh toán.");
      return;
    }
    setError("");
    setCollecting(true);
  };

  const collect = async (payments: RetailPaymentInput[]) => {
    if (!selected) return;
    try {
      const updated = await retailOrdersApi.collect(scope, selected._id, payments);
      setSelected(updated);
      setCollecting(false);
      toast.success("Đã ghi nhận thanh toán công nợ thành công.");
      void refresh();
    } catch (cause) {
      const msg = getApiErrorMessage(cause, "Không thu được công nợ.");
      setError(msg);
      toast.error(msg);
    }
  };

  const cancel = async (reason: string, refundMethod: RetailPaymentInput["method"]) => {
    if (!selected) return;
    const wasDraft = selected.status === "draft";
    const remaining = Math.max(0, selected.paidAmount - (selected.refundedAmount || 0));
    const refunds = remaining ? [{ method: refundMethod, amount: remaining }] : [];
    try {
      const updated = await retailOrdersApi.cancel(scope, selected._id, { reason, refunds });
      if (wasDraft) {
        setSelected(null);
      } else {
        setSelected(updated);
      }
      setCancelling(false);
      toast.success("Đã hủy đơn hàng thành công.");
      void refresh();
    } catch (cause) {
      const msg = getApiErrorMessage(cause, "Không hủy được đơn hàng.");
      setError(msg);
      toast.error(msg);
    }
  };

  // KPI Computations
  const totalGrand = orders.reduce((sum, o) => sum + Number(o.grandTotal || 0), 0);
  const completedCount = orders.filter((o) => o.status === "completed").length;
  const pendingCount = orders.filter((o) => o.status === "confirmed" || Number(o.dueAmount || 0) > 0).length;

  return (
    <section className="space-y-6">
      {/* Header Card */}
      <header className="flex flex-col gap-4 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-indigo-600 text-white shadow-md shadow-cyan-500/20">
            <ListOrdered className="h-6 w-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                Đơn hàng
              </h1>
              <span className="rounded-full bg-cyan-50 px-2.5 py-0.5 text-xs font-semibold text-cyan-700">
                {orders.length} đơn
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 text-cyan-600 ${loading ? "animate-spin" : ""}`} />
          Làm mới
        </button>
      </header>

      {/* Overview KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tổng đơn hàng</span>
            <ShoppingBag className="h-4 w-4 text-cyan-600" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{orders.length}</p>
          <p className="mt-0.5 text-xs text-slate-400">Trong danh sách hiển thị</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tổng doanh số</span>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-700">{money(totalGrand)}</p>
          <p className="mt-0.5 text-xs text-slate-400">Giá trị đơn hàng</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Đã hoàn tất</span>
            <CheckCircle2 className="h-4 w-4 text-blue-600" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-blue-700">{completedCount}</p>
          <p className="mt-0.5 text-xs text-slate-400">Giao dịch thành công</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Chờ xử lý / Nợ</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-amber-600">{pendingCount}</p>
          <p className="mt-0.5 text-xs text-slate-400">Chưa quyết toán xong</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            aria-label="Tìm đơn hàng"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-9 text-sm text-slate-800 placeholder-slate-400 transition focus:border-cyan-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-cyan-500/10"
            placeholder="Tìm mã đơn, khách hàng, số điện thoại..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="w-full sm:w-56">
          <select
            aria-label="Trạng thái đơn"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 transition focus:border-cyan-500 focus:outline-none focus:ring-4 focus:ring-cyan-500/10"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="draft">Đơn treo</option>
            <option value="confirmed">Còn xử lý</option>
            <option value="completed">Hoàn tất</option>
            <option value="cancelled">Đã hủy</option>
          </select>
        </div>
      </div>

      {/* Inline Error banner */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm font-medium text-red-700 shadow-sm flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError("")} className="text-red-400 hover:text-red-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Orders List */}
      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-400">
            <ShoppingBag className="h-8 w-8" />
          </div>
          <h3 className="mt-4 text-base font-bold text-slate-800">Không tìm thấy đơn hàng</h3>
          <p className="mt-1 text-sm text-slate-500">
            Không có đơn hàng nào khớp với điều kiện tìm kiếm hoặc bộ lọc hiện tại.
          </p>
          {(q || status) && (
            <button
              type="button"
              onClick={() => {
                setQ("");
                setStatus("");
              }}
              className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-700 hover:bg-cyan-100"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-3.5">
          {orders.map((order) => {
            const isCompleted = order.status === "completed";
            const isCancelled = order.status === "cancelled";
            const isConfirmed = order.status === "confirmed";

            return (
              <article
                key={order._id}
                className="group rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm transition hover:border-cyan-400 hover:shadow-md sm:p-5"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  {/* Left info */}
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-mono text-base font-bold text-slate-900 group-hover:text-cyan-700">
                        {order.orderCode || `Đơn #${order._id.slice(-6)}`}
                      </p>

                      {/* Status Badges */}
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${isCompleted
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : isCancelled
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : isConfirmed
                                ? "bg-blue-50 text-blue-700 border border-blue-200"
                                : "bg-slate-100 text-slate-700 border border-slate-200"
                          }`}
                      >
                        {isCompleted && <CheckCircle2 className="h-3 w-3" />}
                        {isCancelled && <Ban className="h-3 w-3" />}
                        {isConfirmed && <Clock className="h-3 w-3" />}
                        {order.status === "completed"
                          ? "Hoàn tất"
                          : order.status === "cancelled"
                            ? "Đã hủy"
                            : order.status === "confirmed"
                              ? "Còn xử lý"
                              : "Đơn treo"}
                      </span>

                      {order.paymentStatus && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${order.paymentStatus === "paid"
                              ? "bg-cyan-50 text-cyan-700"
                              : order.paymentStatus === "partial"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                        >
                          {order.paymentStatus === "paid"
                            ? "Đã thanh toán"
                            : order.paymentStatus === "partial"
                              ? "Thanh toán một phần"
                              : order.paymentStatus === "refunded"
                                ? "Đã hoàn tiền"
                                : "Chưa thanh toán"}
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-slate-500">
                      <span className="font-semibold text-slate-700">{order.customerName || "Khách lẻ"}</span>
                      {order.customerPhone && <span> · {order.customerPhone}</span>}
                      {order.businessDate && <span> · Ngày {order.businessDate}</span>}
                    </p>

                    {order.items && order.items.length > 0 && (
                      <p className="text-xs text-slate-400 line-clamp-1">
                        {order.items.map((i) => `${i.sku} × ${i.quantity}`).join("; ")}
                      </p>
                    )}
                  </div>

                  {/* Right: Amounts & Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
                    <div className="text-left sm:text-right">
                      <p className="font-mono text-lg font-bold text-cyan-700">
                        {money(order.grandTotal)}
                      </p>
                      <p className="text-xs uppercase font-medium text-slate-400">
                        {order.status} · {order.paymentStatus}
                      </p>
                    </div>

                    <button
                      type="button"
                      aria-label="Xem chi tiết"
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700 active:scale-95"
                      onClick={() => void detail(order._id)}
                    >
                      <Eye className="h-4 w-4" />
                      <span>Xem</span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Order Detail Modal */}
      {selected && (
        <OrderDialog
          order={selected}
          manager={Boolean(manager)}
          onClose={() => setSelected(null)}
          onCollect={openCollection}
          onCancel={() => setCancelling(true)}
          onRefreshDetail={() => void detail(selected._id)}
        />
      )}

      {/* Payment / Debt Collection Dialog */}
      {collecting && selected && (
        <PaymentDialog
          total={selected.dueAmount}
          busy={false}
          customerId={selected.customerId}
          onClose={() => setCollecting(false)}
          onSubmit={(payments) => collect(payments)}
        />
      )}

      {/* Cancel Order Dialog */}
      {cancelling && selected && (
        <CancelDialog
          refundRequired={selected.paidAmount > 0}
          onClose={() => setCancelling(false)}
          onSubmit={cancel}
        />
      )}
    </section>
  );
}

function OrderDialog({
  order,
  manager,
  onClose,
  onCollect,
  onCancel,
  onRefreshDetail,
}: {
  order: RetailOrder;
  manager: boolean;
  onClose: () => void;
  onCollect: () => void;
  onCancel: () => void;
  onRefreshDetail: () => void;
}) {
  const [mode, setMode] = React.useState<RetailAfterSaleType>();
  const canCancel = order.status !== "cancelled" && (order.status !== "completed" || manager);
  const isCompleted = order.status === "completed";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 sm:items-center sm:p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl border border-slate-100">
        {/* Header */}
        <div className="flex flex-col gap-3 pb-4 border-b border-slate-100 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">
                {order.orderCode || `Đơn #${order._id.slice(-6)}`}
              </h2>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${order.status === "completed"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : order.status === "cancelled"
                      ? "bg-rose-50 text-rose-700 border border-rose-200"
                      : "bg-blue-50 text-blue-700 border border-blue-200"
                  }`}
              >
                {order.status === "completed"
                  ? "Hoàn tất"
                  : order.status === "cancelled"
                    ? "Đã hủy"
                    : "Còn xử lý"}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              <span className="font-semibold text-slate-700">{order.customerName || "Khách lẻ"}</span>
              {order.customerPhone && <span> · SĐT: {order.customerPhone}</span>}
              {order.createdByName && <span> · Thu ngân: {order.createdByName}</span>}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 p-2 text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Product Items */}
        <div className="mt-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Danh mục sản phẩm
          </h3>
          <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200/80 bg-white px-4">
            {order.items.map((i, idx) => (
              <div key={`${i.sku}-${idx}`} className="flex items-center justify-between py-3 text-sm">
                <div className="space-y-0.5">
                  <span className="font-medium text-slate-800">
                    {i.productName} × {i.quantity}
                  </span>
                  <p className="font-mono text-xs text-slate-400">
                    SKU: {i.sku}
                    {i.serialNumbers && i.serialNumbers.length > 0 && ` · S/N: ${i.serialNumbers.join(", ")}`}
                  </p>
                </div>
                <b className="font-mono font-bold text-slate-900">{money(i.lineTotal)}</b>
              </div>
            ))}
          </div>
        </div>

        {/* Financial Metrics */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          <Metric label="Tổng cộng" value={order.grandTotal} />
          <Metric label="Đã thu" value={order.paidAmount} />
          <Metric label="Còn nợ" value={order.dueAmount} />
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-wrap items-center gap-2.5 pt-4 border-t border-slate-100">
          {order.status === "confirmed" && order.dueAmount > 0 && (
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-700 active:scale-95"
              onClick={onCollect}
            >
              <Banknote className="h-4 w-4" />
              Thu công nợ
            </button>
          )}

          {isCompleted && (
            <>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl border border-orange-300 bg-orange-50 px-4 py-2.5 text-sm font-bold text-orange-700 shadow-sm transition hover:bg-orange-100 active:scale-95"
                onClick={() => setMode("return")}
              >
                <RotateCcw className="h-4 w-4" />
                Trả hàng
              </button>

              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl border border-cyan-300 bg-cyan-50 px-4 py-2.5 text-sm font-bold text-cyan-700 shadow-sm transition hover:bg-cyan-100 active:scale-95"
                onClick={() => setMode("buyback")}
              >
                <ShoppingBasket className="h-4 w-4" />
                Thu mua lại
              </button>
            </>
          )}

          {canCancel && (
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 shadow-sm transition hover:bg-red-100 active:scale-95 ml-auto"
              onClick={onCancel}
            >
              <Ban className="h-4 w-4" />
              Hủy/hoàn tiền
            </button>
          )}
        </div>

        {/* After-Sales Modal */}
        {mode && (
          <AfterSalesForm
            order={order}
            type={mode}
            close={() => setMode(undefined)}
            done={() => {
              setMode(undefined);
              onRefreshDetail();
            }}
          />
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="mt-1 font-mono text-lg font-bold text-slate-900">{money(value)}</p>
    </div>
  );
}

function AfterSalesForm({
  order,
  type,
  close,
  done,
}: {
  order: RetailOrder;
  type: RetailAfterSaleType;
  close: () => void;
  done: () => void;
}) {
  const { scope } = useRetailScope();
  const [reason, setReason] = React.useState("");
  const [method, setMethod] = React.useState<RetailAfterSaleInput["paymentMethod"]>("cash");
  const [busy, setBusy] = React.useState(false);

  const [rows, setRows] = React.useState(() =>
    order.items.map((i) => ({
      selected: false,
      quantity: 1,
      unitAmount: Math.round(i.lineTotal / i.quantity),
      condition: "good" as const,
      serialNumbers: [] as string[],
      internalBarcodes: [] as string[],
    }))
  );

  const update = (n: number, patch: Partial<(typeof rows)[number]>) =>
    setRows((a) => a.map((r, i) => (i === n ? { ...r, ...patch } : r)));

  const items = rows.flatMap((r, i) =>
    r.selected
      ? [
        {
          orderLineIndex: i,
          quantity: r.quantity,
          unitAmount: r.unitAmount,
          condition: r.condition,
          serialNumbers: r.serialNumbers,
          internalBarcodes: r.internalBarcodes,
        },
      ]
      : []
  );

  const refundRatio =
    order.subtotal > 0
      ? Math.min(order.subtotal, Math.max(0, order.grandTotal - (order.shippingFee || 0))) / order.subtotal
      : 0;

  const total = items.reduce(
    (s, r) =>
      s +
      (type === "return"
        ? Math.floor((order.items[r.orderLineIndex].lineTotal / order.items[r.orderLineIndex].quantity) * refundRatio)
        : r.unitAmount) *
      r.quantity,
    0
  );

  const submit = async () => {
    if (!scope) return;
    setBusy(true);
    try {
      const d = await retailAfterSalesApi.create(scope, {
        type,
        orderId: order._id,
        items,
        paymentMethod: method,
        reason: reason.trim(),
        idempotencyKey: crypto.randomUUID(),
      });
      toast.success(`Đã tạo chứng từ ${d.code}`);
      done();
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Không tạo được chứng từ sau bán hàng."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl border border-slate-100">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl text-white ${type === "return" ? "bg-orange-500" : "bg-cyan-600"}`}>
              {type === "return" ? <RotateCcw className="h-5 w-5" /> : <ShoppingBasket className="h-5 w-5" />}
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {type === "return" ? "Trả hàng / Hoàn tiền" : "Thu mua máy cũ từ khách"}
              </h3>
              <p className="text-xs text-slate-500">Đơn hàng: {order.orderCode}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:bg-slate-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <p className="text-xs font-semibold uppercase text-slate-400">Chọn mặt hàng áp dụng:</p>
          {order.items.map((item, i) => {
            const r = rows[i];
            const codes =
              item.trackingMode === "serial"
                ? item.serialNumbers
                : item.trackingMode === "unit_barcode"
                  ? item.internalBarcodes
                  : undefined;
            const key = item.trackingMode === "serial" ? "serialNumbers" : "internalBarcodes";

            return (
              <div
                key={i}
                className={`rounded-2xl border p-4 transition ${r.selected ? "border-cyan-400 bg-cyan-50/20" : "border-slate-200 bg-white"
                  }`}
              >
                <label className="flex items-center gap-2.5 font-semibold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded text-cyan-600 focus:ring-cyan-500"
                    checked={r.selected}
                    onChange={(e) => update(i, { selected: e.target.checked })}
                  />
                  <span>
                    {item.productName} <span className="font-mono text-xs font-normal text-slate-500">({item.sku})</span>
                  </span>
                </label>

                {r.selected && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 pt-2 border-t border-slate-100">
                    <label className="text-xs font-semibold text-slate-600">
                      Số lượng
                      <input
                        className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                        type="number"
                        min={1}
                        max={item.quantity}
                        disabled={Boolean(codes?.length)}
                        value={r.quantity}
                        onChange={(e) => update(i, { quantity: Number(e.target.value) })}
                      />
                    </label>

                    {type === "buyback" && (
                      <label className="text-xs font-semibold text-slate-600">
                        Định giá thu mua / đơn vị
                        <input
                          className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm font-mono"
                          type="number"
                          min={0}
                          value={r.unitAmount}
                          onChange={(e) => update(i, { unitAmount: Number(e.target.value) })}
                        />
                      </label>
                    )}

                    {codes?.length ? (
                      <div className="sm:col-span-2 space-y-1.5">
                        <span className="text-xs font-semibold text-slate-600">Chọn số Serial / IMEI trả:</span>
                        <div className="flex flex-wrap gap-2">
                          {codes.map((code) => {
                            const values = r[key];
                            const checked = values.includes(code);
                            return (
                              <label
                                key={code}
                                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-mono cursor-pointer transition ${checked
                                    ? "border-cyan-500 bg-cyan-50 text-cyan-700 font-bold"
                                    : "border-slate-200 bg-white text-slate-600"
                                  }`}
                              >
                                <input
                                  type="checkbox"
                                  className="hidden"
                                  checked={checked}
                                  onChange={(e) => {
                                    const next = e.target.checked
                                      ? [...values, code]
                                      : values.filter((v) => v !== code);
                                    update(i, { [key]: next, quantity: Math.max(1, next.length) });
                                  }}
                                />
                                {code}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Payment Method and Reason */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-slate-600">
            Phương thức chi tiền
            <select
              className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm bg-white"
              value={method}
              onChange={(e) => setMethod(e.target.value as any)}
            >
              <option value="cash">Tiền mặt</option>
              <option value="transfer">Chuyển khoản</option>
              <option value="card">Thẻ</option>
              <option value="ewallet">Ví điện tử</option>
            </select>
          </label>

          <label className="text-xs font-semibold text-slate-600">
            Lý do thực hiện (bắt buộc)
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
              placeholder="Nhập lý do đổi trả/thu mua..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between pt-4 border-t border-slate-100">
          <div>
            <span className="text-xs text-slate-400 uppercase font-semibold">Tổng số tiền chi hoàn:</span>
            <p className="font-mono text-xl font-bold text-slate-900">{money(total)}</p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={close}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={busy || !items.length || !reason.trim()}
              className="rounded-xl bg-cyan-600 px-6 py-2.5 font-bold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-40"
              onClick={() => void submit()}
            >
              {busy ? "Đang xử lý..." : "Xác nhận"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CancelDialog({
  refundRequired,
  onClose,
  onSubmit,
}: {
  refundRequired: boolean;
  onClose: () => void;
  onSubmit: (reason: string, method: RetailPaymentInput["method"]) => Promise<void>;
}) {
  const [reason, setReason] = React.useState("");
  const [method, setMethod] = React.useState<RetailPaymentInput["method"]>("cash");
  const [submitting, setSubmitting] = React.useState(false);

  const handleCancel = async () => {
    if (!reason.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(reason.trim(), method);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md space-y-4 rounded-3xl bg-white p-6 shadow-2xl border border-slate-100">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 text-rose-600">
            <Ban className="h-5 w-5" />
            <h2 className="text-lg font-bold text-slate-900">
              Hủy đơn{refundRequired ? " và hoàn tiền" : ""}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 p-1.5 text-slate-400 hover:bg-slate-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600">Lý do hủy (bắt buộc):</label>
          <textarea
            aria-label="Lý do hủy"
            className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-rose-500 focus:outline-none focus:ring-4 focus:ring-rose-500/10"
            rows={3}
            placeholder="Nhập lý do hủy đơn hàng..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        {refundRequired && (
          <div>
            <label className="text-xs font-semibold text-slate-600">Phương thức hoàn tiền:</label>
            <select
              aria-label="Phương thức hoàn tiền"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm bg-white"
              value={method}
              onChange={(e) => setMethod(e.target.value as any)}
            >
              <option value="cash">Tiền mặt</option>
              <option value="card">Thẻ</option>
              <option value="transfer">Chuyển khoản</option>
              <option value="ewallet">Ví điện tử</option>
            </select>
          </div>
        )}

        <button
          type="button"
          disabled={!reason.trim() || submitting}
          className="w-full rounded-xl bg-red-600 py-3 font-bold text-white shadow-md shadow-red-500/20 transition hover:bg-red-700 active:scale-95 disabled:opacity-40"
          onClick={() => void handleCancel()}
        >
          {submitting ? "Đang xử lý..." : "Xác nhận hủy đơn"}
        </button>
      </div>
    </div>
  );
}
