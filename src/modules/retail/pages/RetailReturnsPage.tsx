import React from "react";
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  CreditCard,
  Eye,
  FileText,
  PackageCheck,
  RefreshCw,
  RotateCcw,
  Search,
  ShoppingBasket,
  Smartphone,
  User,
  X,
} from "lucide-react";
import { retailAfterSalesApi } from "../api/retailAfterSales.api";
import { useRetailScope } from "../hooks/useRetailScope";
import type { RetailAfterSale } from "../types";
import { toast } from "../../../pages/Toast";

const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value) + " ₫";

const formatDate = (value?: string) => {
  if (!value) return "—";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString("vi-VN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
};

const CONDITION_LABELS: Record<string, { label: string; badge: string }> = {
  like_new: { label: "Như mới", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  good: { label: "Tốt", badge: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  fair: { label: "Trung bình", badge: "bg-amber-50 text-amber-700 border-amber-200" },
  poor: { label: "Cũ / Lỗi", badge: "bg-rose-50 text-rose-700 border-rose-200" },
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Tiền mặt",
  card: "Thẻ ngân hàng",
  transfer: "Chuyển khoản",
  ewallet: "Ví điện tử",
};

export default function RetailReturnsPage() {
  const { scope } = useRetailScope();
  const [items, setItems] = React.useState<RetailAfterSale[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [q, setQ] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<string>("");
  const [selected, setSelected] = React.useState<RetailAfterSale | null>(null);

  const refresh = React.useCallback(async () => {
    if (!scope) return;
    setLoading(true);
    setError("");
    try {
      const data = await retailAfterSalesApi.list(scope, {
        type: typeFilter || undefined,
      });
      setItems(data?.items || []);
    } catch (cause: any) {
      const msg = cause?.message || "Không tải được danh sách chứng từ đổi trả.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [scope?.companyCode, scope?.branchId, typeFilter]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!scope) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-500">
        <Building2 className="mb-3 h-10 w-10 text-slate-400" />
        <p className="text-base font-medium">Vui lòng chọn chi nhánh để xem danh sách đổi trả.</p>
      </div>
    );
  }

  // Client search filter for responsive typing
  const filtered = items.filter((doc) => {
    if (!q.trim()) return true;
    const query = q.toLowerCase().trim();
    const matchCode = doc.code?.toLowerCase().includes(query);
    const matchOrder = doc.orderCode?.toLowerCase().includes(query);
    const matchCustomer = doc.customerName?.toLowerCase().includes(query);
    const matchPhone = (doc as any).customerPhone?.includes(query);
    const matchItem = doc.items?.some(
      (i) => i.productName?.toLowerCase().includes(query) || i.sku?.toLowerCase().includes(query)
    );
    return matchCode || matchOrder || matchCustomer || matchPhone || matchItem;
  });

  // KPIs
  const returnDocs = items.filter((d) => d.type === "return");
  const buybackDocs = items.filter((d) => d.type === "buyback");
  const returnCount = returnDocs.length;
  const buybackCount = buybackDocs.length;
  const returnTotal = returnDocs.reduce((sum, d) => sum + Number(d.totalAmount || 0), 0);
  const buybackTotal = buybackDocs.reduce((sum, d) => sum + Number(d.totalAmount || 0), 0);
  const totalAmount = returnTotal + buybackTotal;

  return (
    <section className="space-y-3.5">
      {/* Header Card */}
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-2.5 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-xs">
            <RotateCcw className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900">
              Đổi trả & Hoàn tiền
            </h1>
            <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700 border border-orange-200/60">
              {filtered.length} phiếu
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 active:scale-95 disabled:opacity-60 cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-orange-600 ${loading ? "animate-spin" : ""}`} />
          <span>Làm mới</span>
        </button>
      </header>

      {/* Overview KPI Cards */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Tổng phiếu
            </span>
            <FileText className="h-3.5 w-3.5 text-slate-500" />
          </div>
          <p className="mt-1 text-lg sm:text-xl font-bold tracking-tight text-slate-900">
            {items.length}
          </p>
          <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">
            Chứng từ sau bán hàng
          </span>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Khách trả hàng (TH)
            </span>
            <RotateCcw className="h-3.5 w-3.5 text-orange-500" />
          </div>
          <p className="mt-1 text-lg sm:text-xl font-bold tracking-tight text-orange-600 font-mono">
            {money(returnTotal)}
          </p>
          <span className="text-[10px] text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded font-medium inline-block mt-0.5">
            {returnCount} phiếu hoàn tiền
          </span>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Thu mua máy cũ (TM)
            </span>
            <ShoppingBasket className="h-3.5 w-3.5 text-cyan-600" />
          </div>
          <p className="mt-1 text-lg sm:text-xl font-bold tracking-tight text-cyan-700 font-mono">
            {money(buybackTotal)}
          </p>
          <span className="text-[10px] text-cyan-700 bg-cyan-50 px-1.5 py-0.5 rounded font-medium inline-block mt-0.5">
            {buybackCount} phiếu chi mua
          </span>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Tổng tiền đã chi
            </span>
            <CreditCard className="h-3.5 w-3.5 text-rose-500" />
          </div>
          <p className="mt-1 text-lg sm:text-xl font-bold tracking-tight text-rose-600 font-mono">
            {money(totalAmount)}
          </p>
          <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">
            Gồm hoàn trả & thu mua
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-2.5 rounded-xl border border-slate-200/80 bg-white p-2.5 shadow-2xs sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            aria-label="Tìm phiếu đổi trả"
            className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-8 text-xs sm:text-sm text-slate-800 placeholder-slate-400 transition focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/10"
            placeholder="Tìm theo mã phiếu TH-, mã đơn gốc DH-, tên khách hàng, số điện thoại..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="w-full sm:w-52">
          <select
            aria-label="Loại chứng từ"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/10 cursor-pointer"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">Tất cả loại chứng từ</option>
            <option value="return">Khách trả hàng (TH)</option>
            <option value="buyback">Thu mua máy cũ (TM)</option>
          </select>
        </div>
      </div>

      {/* Inline Error banner */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs sm:text-sm font-medium text-red-700 shadow-2xs flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void refresh()}
            className="font-bold underline hover:no-underline ml-3"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Main Table Card */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="border-b border-slate-200/90 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Mã phiếu</th>
                <th className="px-4 py-3">Đơn bán gốc</th>
                <th className="px-4 py-3">Khách hàng</th>
                <th className="px-4 py-3">Mặt hàng trả</th>
                <th className="px-4 py-3 text-right">Tiền hoàn</th>
                <th className="px-4 py-3 text-center">Phương thức</th>
                <th className="px-4 py-3">Thời gian</th>
                <th className="px-4 py-3 text-right">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading && items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    <div className="inline-flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin text-orange-600" />
                      <span>Đang tải danh sách đổi trả...</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3">
                        <RotateCcw className="h-6 w-6" />
                      </div>
                      <p className="text-sm font-semibold text-slate-700">
                        Chưa có chứng từ đổi trả nào
                      </p>
                      <p className="mt-1 text-xs text-slate-400 max-w-sm">
                        Khi khách mang hàng hoặc phụ kiện đến trả lại tại mục Đơn hàng, các phiếu
                        hoàn tiền sẽ được ghi nhận tại đây.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((doc) => {
                  const isReturn = doc.type === "return";
                  const itemCount = doc.items?.reduce((s, i) => s + (i.quantity || 1), 0) || 0;

                  return (
                    <tr
                      key={doc._id}
                      className="transition-colors hover:bg-slate-50/70 cursor-pointer"
                      onClick={() => setSelected(doc)}
                    >
                      <td className="px-4 py-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ${
                            isReturn
                              ? "bg-orange-50 text-orange-700 border border-orange-200"
                              : "bg-cyan-50 text-cyan-700 border border-cyan-200"
                          }`}
                        >
                          {isReturn ? (
                            <RotateCcw className="h-3 w-3" />
                          ) : (
                            <ShoppingBasket className="h-3 w-3" />
                          )}
                          {doc.code}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono font-medium text-slate-600 whitespace-nowrap">
                        {doc.orderCode}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">
                          {doc.customerName || "Khách lẻ"}
                        </div>
                        {(doc as any).customerPhone && (
                          <div className="text-[11px] text-slate-400 font-mono">
                            {(doc as any).customerPhone}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        {doc.items && doc.items.length > 0 ? (
                          <div className="space-y-0.5">
                            <span className="font-medium text-slate-800 line-clamp-1">
                              {doc.items[0].productName} × {doc.items[0].quantity}
                            </span>
                            {doc.items.length > 1 && (
                              <span className="text-[11px] text-orange-600 font-semibold">
                                +{doc.items.length - 1} sản phẩm khác (tổng {itemCount} món)
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-rose-600 whitespace-nowrap">
                        {money(doc.totalAmount)}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-700">
                          {PAYMENT_LABELS[doc.paymentMethod] || doc.paymentMethod}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">
                        {formatDate(doc.createdAt || doc.businessDate)}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          aria-label="Xem chi tiết phiếu trả hàng"
                          className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700 active:scale-95 cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelected(doc);
                          }}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Xem</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Return Detail Modal */}
      {selected && (
        <ReturnDetailModal doc={selected} onClose={() => setSelected(null)} />
      )}
    </section>
  );
}

function ReturnDetailModal({
  doc,
  onClose,
}: {
  doc: RetailAfterSale;
  onClose: () => void;
}) {
  const isReturn = doc.type === "return";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 sm:items-center sm:p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl border border-slate-100">
        {/* Header */}
        <div className="flex flex-col gap-3 pb-4 border-b border-slate-100 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2.5 rounded-2xl text-white ${
                isReturn ? "bg-orange-500" : "bg-cyan-600"
              }`}
            >
              {isReturn ? <RotateCcw className="h-5 w-5" /> : <ShoppingBasket className="h-5 w-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">{doc.code}</h2>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    isReturn
                      ? "bg-orange-50 text-orange-700 border border-orange-200"
                      : "bg-cyan-50 text-cyan-700 border border-cyan-200"
                  }`}
                >
                  {isReturn ? "Trả hàng / Hoàn tiền" : "Thu mua máy cũ"}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Đơn bán gốc: <span className="font-mono font-semibold text-slate-700">{doc.orderCode}</span>
                {" · "}
                Ngày tạo: <span>{formatDate(doc.createdAt)}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 p-2 text-slate-400 transition hover:bg-slate-50 hover:text-slate-600 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Customer & Creator Meta */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
              Khách hàng
            </span>
            <span className="font-bold text-slate-900 text-sm mt-0.5 block">
              {doc.customerName || "Khách lẻ"}
            </span>
            {(doc as any).customerPhone && (
              <span className="text-xs text-slate-500 font-mono block">
                {(doc as any).customerPhone}
              </span>
            )}
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
              Người tiếp nhận
            </span>
            <span className="font-bold text-slate-900 text-sm mt-0.5 block">
              {(doc as any).createdByName || "Nhân viên thu ngân"}
            </span>
            <span className="text-xs text-slate-500 block">
              Ca: {(doc as any).shiftId ? `#${String((doc as any).shiftId).slice(-6)}` : doc.businessDate}
            </span>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3 col-span-2 sm:col-span-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
              Phương thức chi tiền
            </span>
            <span className="font-bold text-slate-900 text-sm mt-0.5 block">
              {PAYMENT_LABELS[doc.paymentMethod] || doc.paymentMethod}
            </span>
            {(doc as any).paymentReference && (
              <span className="text-xs text-slate-500 font-mono block">
                Ref: {(doc as any).paymentReference}
              </span>
            )}
          </div>
        </div>

        {/* Returned Items List */}
        <div className="mt-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Danh sách mặt hàng trả lại
          </h3>
          <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200/80 bg-white px-4">
            {doc.items?.map((item, idx) => {
              const cond = CONDITION_LABELS[item.condition] || {
                label: item.condition,
                badge: "bg-slate-50 text-slate-600",
              };

              return (
                <div key={idx} className="py-3 text-sm flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">{item.productName}</span>
                      <span className="text-xs text-slate-500 font-bold">× {item.quantity}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border ${cond.badge}`}>
                        {cond.label}
                      </span>
                    </div>
                    <div className="font-mono text-xs text-slate-400 flex flex-wrap gap-2">
                      <span>SKU: {item.sku}</span>
                      {item.serialNumbers && item.serialNumbers.length > 0 && (
                        <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded font-semibold">
                          IMEI/SN: {item.serialNumbers.join(", ")}
                        </span>
                      )}
                      {item.internalBarcodes && item.internalBarcodes.length > 0 && (
                        <span className="text-cyan-700 bg-cyan-50 px-1.5 py-0.2 rounded font-semibold">
                          Barcode: {item.internalBarcodes.join(", ")}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right sm:self-center">
                    <span className="font-mono font-bold text-slate-900 block">
                      {money(item.lineAmount || (item.unitAmount || 0) * (item.quantity || 1))}
                    </span>
                    {item.quantity > 1 && item.unitAmount && (
                      <span className="text-[11px] text-slate-400 font-mono">
                        {money(item.unitAmount)} / cái
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Reason Box */}
        {doc.reason && (
          <div className="mt-4 rounded-2xl bg-amber-50/80 border border-amber-200/70 p-3.5">
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wide block mb-1">
              Lý do trả hàng:
            </span>
            <p className="text-xs sm:text-sm text-amber-900">{doc.reason}</p>
          </div>
        )}

        {/* Inventory Status Note */}
        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-emerald-50/70 border border-emerald-200/70 p-3 text-xs text-emerald-800">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>
            Hàng đã được tự động nhập kho trở lại chi nhánh, số lượng tồn và trạng thái IMEI đã được
            khôi phục <strong>Trong kho (in_stock)</strong>.
          </span>
        </div>

        {/* Total Footer */}
        <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
          <div>
            <span className="text-xs text-slate-400 uppercase tracking-wider block">
              Tổng tiền hoàn trả cho khách
            </span>
            <span className="text-xl sm:text-2xl font-bold font-mono text-rose-600">
              {money(doc.totalAmount)}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
