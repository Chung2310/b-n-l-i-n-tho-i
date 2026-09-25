import React from "react";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  DollarSign,
  Download,
  Eye,
  FileText,
  Loader2,
  Printer,
  QrCode,
  RefreshCw,
  Search,
  User,
  Wallet,
  X,
} from "lucide-react";
import { retailInvoicesApi } from "../api/retailInvoices.api";
import { retailOrdersApi } from "../api/retailOrders.api";
import ReceiptPrintView from "../components/pos/ReceiptPrintViewSerial";
import { useRetailScope } from "../hooks/useRetailScope";
import type { RetailInvoice, RetailPaymentQr } from "../types";
import { invoicePaymentRows, invoicePaymentSummary } from "../components/pos/invoicePaymentDisplay";
import { getApiErrorMessage } from "../../../utils/errorMessage";
import { toast } from "../../../pages/Toast";

const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value) + " ₫";

export default function RetailInvoicesPageContent() {
  const { scope } = useRetailScope();
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [items, setItems] = React.useState<RetailInvoice[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selected, setSelected] = React.useState<RetailInvoice | null>(null);
  const [downloadingId, setDownloadingId] = React.useState("");
  const [paymentQr, setPaymentQr] = React.useState<RetailPaymentQr | null>(null);

  // Poll payment status if QR modal is active
  React.useEffect(() => {
    if (!scope || !paymentQr) return;
    const timer = window.setInterval(() => {
      void retailOrdersApi.detail(scope, paymentQr.orderId).then((order) => {
        if (order.paymentStatus === "paid") {
          window.clearInterval(timer);
          setPaymentQr(null);
          toast.success("Đã nhận thanh toán qua SePay.");
          void loadInvoices();
        }
      }).catch(() => undefined);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [scope?.companyCode, scope?.branchId, paymentQr?.orderId]);

  const loadInvoices = React.useCallback(async () => {
    if (!scope) return;
    setLoading(true);
    try {
      const data = await retailInvoicesApi.list(scope, { q, status: status || undefined });
      setItems(data.items);
    } catch (cause) {
      toast.error(getApiErrorMessage(cause, "Không tải được hóa đơn."));
    } finally {
      setLoading(false);
    }
  }, [scope?.companyCode, scope?.branchId, q, status]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      void loadInvoices();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadInvoices]);

  if (!scope) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-500">
        <Building2 className="mb-3 h-10 w-10 text-slate-400" />
        <p className="text-base font-medium">Vui lòng chọn chi nhánh để xem danh sách hóa đơn.</p>
      </div>
    );
  }

  const detail = async (id: string) => {
    try {
      const invoice = await retailInvoicesApi.detail(scope, id);
      setSelected(invoice);
      return invoice;
    } catch (cause) {
      toast.error(getApiErrorMessage(cause, "Không tải được hóa đơn."));
      return null;
    }
  };

  const reprint = async (id: string) => {
    const invoice = await detail(id);
    if (invoice) {
      setTimeout(() => window.print(), 0);
    }
  };

  const download = async (id: string) => {
    setDownloadingId(id);
    try {
      await retailInvoicesApi.downloadPdf(scope, id);
    } catch (cause) {
      toast.error(getApiErrorMessage(cause, "Không tải được PDF hóa đơn."));
    } finally {
      setDownloadingId("");
    }
  };

  const showPaymentQr = async (orderId: string) => {
    try {
      setPaymentQr(await retailOrdersApi.paymentQr(scope, orderId));
    } catch (cause) {
      toast.error(getApiErrorMessage(cause, "Không tạo được QR thanh toán."));
    }
  };

  // KPI computations
  const totalGrand = items.reduce((sum, item) => sum + Number(item.snapshot?.grandTotal || 0), 0);
  const totalDue = items.reduce((sum, item) => sum + Number(item.snapshot?.dueAmount || 0), 0);
  const totalPaid = items.reduce((sum, item) => {
    const paid = item.snapshot?.paidAmount ?? (Number(item.snapshot?.grandTotal || 0) - Number(item.snapshot?.dueAmount || 0));
    return sum + Number(paid || 0);
  }, 0);

  return (
    <section className="space-y-3.5">
      {/* Header card */}
      <header className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-2.5 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-xs">
            <FileText className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900">
              Hóa đơn nội bộ
            </h1>
            <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-xs font-semibold text-cyan-700 border border-cyan-200/60">
              {items.length} chứng từ
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void loadInvoices()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 active:scale-95 disabled:opacity-60 cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-cyan-600 ${loading ? "animate-spin" : ""}`} />
          <span>Làm mới</span>
        </button>
      </header>

      {/* Quick Summary KPIs */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Tổng hóa đơn</span>
            <FileText className="h-3.5 w-3.5 text-cyan-600" />
          </div>
          <p className="mt-1 text-lg sm:text-xl font-bold tracking-tight text-slate-900">{items.length}</p>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Tổng doanh số</span>
            <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
          </div>
          <p className="mt-1 text-lg sm:text-xl font-bold tracking-tight text-emerald-700">{money(totalGrand)}</p>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Đã thu tiền</span>
            <Wallet className="h-3.5 w-3.5 text-blue-600" />
          </div>
          <p className="mt-1 text-lg sm:text-xl font-bold tracking-tight text-blue-700">{money(totalPaid)}</p>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Công nợ còn lại</span>
            <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <p className="mt-1 text-lg sm:text-xl font-bold tracking-tight text-amber-600">{money(totalDue)}</p>
        </div>
      </div>

      {/* Filter and Search toolbar */}
      <div className="flex flex-col gap-2.5 rounded-xl border border-slate-200/80 bg-white p-2.5 shadow-2xs sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            aria-label="Tìm hóa đơn"
            className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-8 text-xs sm:text-sm text-slate-800 placeholder-slate-400 transition focus:border-cyan-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/10"
            placeholder="Số hóa đơn, mã đơn, khách hàng..."
            value={q}
            onChange={(event) => setQ(event.target.value)}
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
            aria-label="Trạng thái hóa đơn"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 transition focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/10 cursor-pointer"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="issued">Đã phát hành</option>
            <option value="void">Đã vô hiệu</option>
          </select>
        </div>
      </div>

      {/* Invoice list */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-400">
            <FileText className="h-6 w-6" />
          </div>
          <h3 className="mt-3 text-sm font-bold text-slate-800">Không tìm thấy hóa đơn</h3>
          <p className="mt-1 text-xs text-slate-500">
            Không có hóa đơn nào khớp với từ khóa tìm kiếm hoặc bộ lọc hiện tại.
          </p>
          {(q || status) && (
            <button
              type="button"
              onClick={() => {
                setQ("");
                setStatus("");
              }}
              className="mt-3 rounded-xl border border-cyan-200 bg-cyan-50 px-3.5 py-1.5 text-xs font-semibold text-cyan-700 hover:bg-cyan-100 cursor-pointer"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] text-left text-xs">
              <thead className="bg-slate-50/90 border-b border-slate-200/80 text-[11px] uppercase tracking-wider text-slate-500 font-bold select-none">
                <tr>
                  <th className="px-4 py-3">Số hóa đơn</th>
                  <th className="px-4 py-3">Mã đơn & Khách hàng</th>
                  <th className="px-4 py-3">Thanh toán & Công nợ</th>
                  <th className="px-4 py-3 text-right">Tổng tiền</th>
                  <th className="px-4 py-3 text-center">Trạng thái</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {items.map((invoice) => {
                  const summary = invoicePaymentSummary(invoice.snapshot);
                  const isVoid = invoice.status === "void";
                  const hasDue = Number(invoice.snapshot?.dueAmount || 0) > 0;

                  return (
                    <tr
                      key={invoice._id}
                      onClick={() => void detail(invoice._id)}
                      className="hover:bg-cyan-50/40 transition-colors group cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-slate-900 group-hover:text-cyan-700 transition">
                          {invoice.invoiceNo}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">
                          {invoice.snapshot.customerName || "Khách lẻ"}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {invoice.orderCode}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-medium text-cyan-700">
                          {summary.label}
                          {summary.paidAmount !== undefined && ` · Đã thanh toán ${money(summary.paidAmount)}`}
                          {summary.dueAmount !== undefined && ` · Còn nợ ${money(summary.dueAmount)}`}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className="font-mono text-sm font-bold text-slate-900">
                          {money(invoice.snapshot.grandTotal)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            isVoid
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          }`}
                        >
                          {isVoid ? (
                            <AlertCircle className="h-3 w-3" />
                          ) : (
                            <CheckCircle2 className="h-3 w-3" />
                          )}
                          {isVoid ? "Đã vô hiệu" : "Đã phát hành"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            type="button"
                            aria-label={`Xem hóa đơn ${invoice.invoiceNo}`}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700 active:scale-95 shadow-2xs cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              void detail(invoice._id);
                            }}
                            title="Xem chi tiết hóa đơn"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            aria-label={`In lại hóa đơn ${invoice.invoiceNo}`}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700 active:scale-95 shadow-2xs cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              void reprint(invoice._id);
                            }}
                            title="In lại hóa đơn"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            aria-label={`Tải PDF hóa đơn ${invoice.invoiceNo}`}
                            disabled={downloadingId === invoice._id}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700 active:scale-95 disabled:opacity-50 shadow-2xs cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              void download(invoice._id);
                            }}
                            title="Tải tệp PDF"
                          >
                            {downloadingId === invoice._id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-600" />
                            ) : (
                              <Download className="h-3.5 w-3.5" />
                            )}
                          </button>

                          {!isVoid && hasDue && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void showPaymentQr(invoice.orderId);
                              }}
                              className="inline-flex h-7 items-center gap-1 rounded-lg border border-cyan-200 bg-cyan-50 px-2 text-[11px] font-semibold text-cyan-700 transition hover:bg-cyan-100 active:scale-95 cursor-pointer"
                              title="Tạo mã QR thu nợ SePay"
                            >
                              <QrCode className="h-3 w-3" />
                              <span className="hidden sm:inline">QR nợ</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invoice Detail Dialog */}
      {selected && (
        <InvoiceDialog
          invoice={selected}
          downloading={downloadingId === selected._id}
          onDownload={() => void download(selected._id)}
          onClose={() => setSelected(null)}
          onShowQr={() => void showPaymentQr(selected.orderId)}
        />
      )}

      {/* Floating QR button when viewing an invoice with debt */}
      {selected && selected.status === "issued" && Number(selected.snapshot.dueAmount || 0) > 0 && (
        <button
          type="button"
          className="fixed bottom-6 right-6 z-[60] flex items-center gap-2 rounded-full bg-cyan-600 px-5 py-3 font-bold text-white shadow-xl shadow-cyan-600/30 transition hover:bg-cyan-700 hover:shadow-cyan-600/40 active:scale-95"
          onClick={() => void showPaymentQr(selected.orderId)}
        >
          <QrCode className="h-5 w-5" />
          QR thanh toán
        </button>
      )}

      {/* Payment QR Dialog */}
      {paymentQr && <PaymentQrDialog qr={paymentQr} onClose={() => setPaymentQr(null)} />}
    </section>
  );
}

function PaymentQrDialog({ qr, onClose }: { qr: RetailPaymentQr; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-label="QR thanh toán hóa đơn"
        className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl border border-slate-100"
      >
        <div className="flex items-center justify-between text-left">
          <div>
            <h2 className="text-lg font-bold text-slate-900">QR thanh toán</h2>
            <p className="text-sm font-medium text-slate-500">{qr.orderCode}</p>
          </div>
          <button
            type="button"
            aria-label="Đóng QR thanh toán"
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-2 shadow-inner">
          <img
            className="mx-auto aspect-square w-full max-w-[260px] rounded-xl object-contain bg-white p-2"
            src={qr.qrUrl}
            alt={`QR thanh toán ${qr.orderCode}`}
          />
        </div>

        <p className="mt-4 text-2xl font-black tracking-tight text-cyan-700">
          {money(qr.amount)}
        </p>

        <div className="mt-2 rounded-xl bg-slate-50 p-3 text-left text-sm border border-slate-100">
          <p className="text-xs text-slate-400 uppercase font-semibold">Nội dung chuyển khoản:</p>
          <p className="mt-0.5 font-mono text-base font-bold text-slate-900">
            {qr.paymentCode}
          </p>
        </div>

        <p className="mt-3 text-xs text-slate-500 font-medium">
          {qr.accountName} · <span className="font-mono">{qr.accountNumber}</span>
        </p>

        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-cyan-600">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-500" />
          </span>
          <span>Tự động cập nhật khi khách hàng chuyển khoản thành công</span>
        </div>
      </div>
    </div>
  );
}

function InvoiceDialog({
  invoice,
  downloading,
  onDownload,
  onClose,
  onShowQr,
}: {
  invoice: RetailInvoice;
  downloading: boolean;
  onDownload: () => void;
  onClose: () => void;
  onShowQr: () => void;
}) {
  const isVoid = invoice.status === "void";
  const hasDue = Number(invoice.snapshot.dueAmount || 0) > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 sm:items-center sm:p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl border border-slate-100">
        {/* Modal Header */}
        <div className="flex flex-col gap-3 pb-4 border-b border-slate-100 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">{invoice.invoiceNo}</h2>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${isVoid
                    ? "bg-rose-50 text-rose-700 border border-rose-200"
                    : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  }`}
              >
                {isVoid ? "Đã vô hiệu" : "Đã phát hành"}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              <span className="font-semibold text-slate-700">{invoice.orderCode}</span> ·{" "}
              <span>{invoice.snapshot.customerName}</span>
            </p>
            <p className="text-sm text-slate-500">
              Thu ngân: <span className="font-medium text-slate-800">{invoice.snapshot.cashierName}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Tải PDF hóa đơn"
              disabled={downloading}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
              onClick={onDownload}
            >
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              PDF
            </button>
            <button
              type="button"
              aria-label="In hóa đơn"
              className="flex items-center gap-1.5 rounded-xl border border-cyan-600 bg-cyan-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700 active:scale-95"
              onClick={() => window.print()}
            >
              <Printer className="h-4 w-4" />
              In
            </button>
            <button
              type="button"
              aria-label="Đóng hóa đơn"
              onClick={onClose}
              className="rounded-xl border border-slate-200 p-2 text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Store & Customer meta card */}
        {invoice.snapshot.store && (
          <div className="mt-4 rounded-2xl bg-slate-50 p-3.5 text-xs text-slate-600 border border-slate-100">
            <p className="font-bold text-slate-800 text-sm">{invoice.snapshot.store.storeName || invoice.snapshot.store.legalName}</p>
            <p className="mt-0.5">{invoice.snapshot.store.branchName} · {invoice.snapshot.store.branchAddress}</p>
          </div>
        )}

        {/* Items List */}
        <div className="mt-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Chi tiết sản phẩm</h3>
          <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200/80 bg-white px-4">
            {invoice.snapshot.items.length === 0 ? (
              <p className="py-3 text-sm text-slate-400 italic">Không có dòng sản phẩm.</p>
            ) : (
              invoice.snapshot.items.map((item, idx) => (
                <div key={`${item.productId}-${item.sku}-${idx}`} className="flex items-center justify-between py-3 text-sm">
                  <div className="space-y-0.5">
                    <span className="font-medium text-slate-800">
                      {item.productName} × {item.quantity}
                    </span>
                    {item.serialNumbers && item.serialNumbers.length > 0 && (
                      <p className="font-mono text-xs text-slate-400">
                        S/N: {item.serialNumbers.join(", ")}
                      </p>
                    )}
                  </div>
                  <b className="font-mono font-bold text-slate-900">{money(item.lineTotal)}</b>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pricing calculations */}
        <div className="mt-5 space-y-2 rounded-2xl bg-slate-50/70 p-4 border border-slate-100 text-sm">
          <Row label="Tạm tính" value={invoice.snapshot.subtotal} />
          <Row label="Giảm giá" value={invoice.snapshot.orderDiscount} />
          <Row label="Thuế" value={invoice.snapshot.taxAmount} />
          <div className="border-t border-slate-200/80 pt-2">
            <Row label="Tổng cộng" value={invoice.snapshot.grandTotal} strong />
          </div>
        </div>

        {/* Payment rows */}
        <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Thanh toán</h3>
          {invoicePaymentRows(invoice.snapshot).map((row, index) => (
            <Row key={`${row.label}-${index}`} label={row.label} value={row.amount} />
          ))}
        </div>

        {/* Amount in words */}
        <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600 border border-slate-100">
          Bằng chữ: <span className="font-semibold text-slate-900">{invoice.snapshot.amountInWords}</span>
        </p>

        {/* Print view */}
        <div className="hidden print:block">
          <ReceiptPrintView invoice={invoice} />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "text-base font-bold text-slate-900" : "text-slate-600"}`}>
      <span>{label}</span>
      <span className="font-mono">{money(value)}</span>
    </div>
  );
}
