import React, { useState, useEffect } from "react";
import {
  X,
  ShoppingBag,
  Wrench,
  RotateCcw,
  ArrowDownLeft,
  Copy,
  Check,
  Calendar,
  User,
  Phone,
  Banknote,
  Package,
  Smartphone,
  AlertTriangle,
  Receipt,
  RotateCw,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import type { CustomerPurchaseHistoryItem } from "../types";
import { retailOrdersApi } from "../../retail/api/retailOrders.api";
import { retailAfterSalesApi } from "../../retail/api/retailAfterSales.api";
import { repairService } from "../../../services/repairService";

interface Props {
  transaction: CustomerPurchaseHistoryItem;
  companyCode: string;
  branchId: string;
  onClose: () => void;
}

const currency = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

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

const formatShortDate = (value?: string) => {
  if (!value) return "—";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString("vi-VN");
  } catch {
    return value;
  }
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Tiền mặt",
  transfer: "Chuyển khoản",
  card: "Thẻ ngân hàng",
  ewallet: "Ví điện tử",
};

const CONDITION_LABELS: Record<string, { label: string; badge: string }> = {
  like_new: { label: "Như mới", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  good: { label: "Tốt", badge: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  fair: { label: "Trung bình", badge: "bg-amber-50 text-amber-700 border-amber-200" },
  poor: { label: "Cũ / Lỗi", badge: "bg-rose-50 text-rose-700 border-rose-200" },
};

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  // Retail
  draft: { label: "Nháp", badge: "bg-slate-100 text-slate-700 border-slate-200" },
  confirmed: { label: "Đã xác nhận", badge: "bg-blue-50 text-blue-700 border-blue-200" },
  completed: { label: "Hoàn tất", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cancelled: { label: "Đã hủy", badge: "bg-rose-50 text-rose-700 border-rose-200" },

  // Repair
  received: { label: "Tiếp nhận", badge: "bg-sky-50 text-sky-700 border-sky-200" },
  diagnosing: { label: "Chẩn đoán", badge: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  quoted: { label: "Đã báo giá", badge: "bg-amber-50 text-amber-700 border-amber-200" },
  approved: { label: "Khách duyệt", badge: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  repairing: { label: "Đang sửa", badge: "bg-orange-50 text-orange-700 border-orange-200" },
  in_progress: { label: "Đang sửa", badge: "bg-orange-50 text-orange-700 border-orange-200" },
  done: { label: "Sửa xong", badge: "bg-teal-50 text-teal-700 border-teal-200" },
  delivered: { label: "Đã trả máy", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  active: { label: "Còn bảo hành", badge: "bg-teal-50 text-teal-700 border-teal-200" },
  expired: { label: "Hết hạn BH", badge: "bg-slate-100 text-slate-600 border-slate-200" },
};

const TYPE_CONFIG = {
  purchase: {
    label: "Đơn mua hàng",
    badge: "bg-blue-50 text-blue-700 border-blue-200",
    icon: ShoppingBag,
    iconBg: "bg-blue-600 text-white",
  },
  repair: {
    label: "Phiếu sửa chữa",
    badge: "bg-purple-50 text-purple-700 border-purple-200",
    icon: Wrench,
    iconBg: "bg-purple-600 text-white",
  },
  warranty: {
    label: "Phiếu bảo hành",
    badge: "bg-teal-50 text-teal-700 border-teal-200",
    icon: ShieldCheck,
    iconBg: "bg-teal-600 text-white",
  },
  buyback: {
    label: "Bán lại / Thu mua",
    badge: "bg-amber-50 text-amber-800 border-amber-200",
    icon: ArrowDownLeft,
    iconBg: "bg-amber-600 text-white",
  },
  return: {
    label: "Đổi trả hàng",
    badge: "bg-rose-50 text-rose-700 border-rose-200",
    icon: RotateCcw,
    iconBg: "bg-rose-600 text-white",
  },
};

function CopyButton({ text, label = "Mã" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title={`Sao chép ${label}`}
      onClick={(e) => {
        e.stopPropagation();
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-200/80 hover:text-slate-800 transition cursor-pointer"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
      <span className="text-[11px]">{copied ? "Đã chép" : "Sao chép"}</span>
    </button>
  );
}

export default function CustomerTransactionDetailModal({
  transaction,
  companyCode,
  branchId,
  onClose,
}: Props) {
  const recordType = transaction.recordType || "purchase";
  const typeMeta = TYPE_CONFIG[recordType] || TYPE_CONFIG.purchase;
  const TypeIcon = typeMeta.icon;

  const [loadingLive, setLoadingLive] = useState(false);
  const [liveData, setLiveData] = useState<any>(null);

  // Esc key listener to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Fetch full live document in the background to augment data
  useEffect(() => {
    let active = true;
    async function fetchLiveDetails() {
      if (!transaction._id || !branchId || !companyCode) return;
      setLoadingLive(true);
      try {
        if (recordType === "purchase") {
          const doc = await retailOrdersApi.detail({ companyCode, branchId }, transaction._id);
          if (active && doc) setLiveData(doc);
        } else if (recordType === "repair") {
          const doc = await repairService.get(transaction._id, { companyCode, branchId });
          if (active && doc) setLiveData(doc);
        } else if (recordType === "buyback" || recordType === "return") {
          const doc = await retailAfterSalesApi.detail({ companyCode, branchId }, transaction._id);
          if (active && doc) setLiveData(doc);
        }
      } catch {
        // Fallback gracefully to the rich data passed from transaction
      } finally {
        if (active) setLoadingLive(false);
      }
    }
    void fetchLiveDetails();
    return () => {
      active = false;
    };
  }, [transaction._id, recordType, companyCode, branchId]);

  // Merged values
  const orderCode = liveData?.orderCode || liveData?.ticketCode || liveData?.code || transaction.orderCode || `#${transaction._id.slice(-6)}`;
  const status = liveData?.status || transaction.status || "completed";
  const statusMeta = STATUS_CONFIG[status] || {
    label: status,
    badge: "bg-slate-100 text-slate-700 border-slate-200",
  };
  const grandTotal = Number(liveData?.grandTotal ?? liveData?.totalAmount ?? transaction.grandTotal ?? 0);
  const paidAmount = Number(liveData?.paidAmount ?? transaction.paidAmount ?? 0);
  const dueAmount = Number(liveData?.dueAmount ?? transaction.dueAmount ?? 0);
  const businessDate = liveData?.businessDate || transaction.businessDate;
  const createdAt = liveData?.createdAt || liveData?.receivedAt || transaction.createdAt;

  const customerName = liveData?.customerName || transaction.customerName || "Khách lẻ";
  const customerPhone = liveData?.customerPhone || transaction.customerPhone || "";
  const staffName =
    liveData?.salespersonName ||
    liveData?.technicianName ||
    liveData?.createdByName ||
    transaction.salespersonName ||
    "—";

  // Items
  const items = liveData?.items || transaction.items || [];
  const payments = liveData?.payments || transaction.payments || [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-5 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white shadow-2xl border border-slate-100 text-slate-800 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/70 sticky top-0 z-10 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-2xl shadow-xs ${typeMeta.iconBg}`}>
              <TypeIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  {orderCode}
                </span>
                <CopyButton text={orderCode} label="mã chứng từ" />
                <span className={`rounded-md border px-2 py-0.5 text-[11px] font-bold ${typeMeta.badge}`}>
                  {typeMeta.label}
                </span>
                <span className={`rounded-md border px-2 py-0.5 text-[11px] font-bold ${statusMeta.badge}`}>
                  {statusMeta.label}
                </span>
                {loadingLive && (
                  <RotateCw className="h-3.5 w-3.5 animate-spin text-slate-400" title="Đang đồng bộ..." />
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                <Calendar className="h-3 w-3" />
                <span>Ngày: {businessDate ? formatShortDate(businessDate) : formatDate(createdAt)}</span>
                {createdAt && businessDate && (
                  <span className="text-slate-400 text-[11px]">({formatDate(createdAt)})</span>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200/80 p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 flex-1">
          {/* Metadata Cards Bento Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Customer card */}
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3.5 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <User className="h-3 w-3" />
                  Khách hàng
                </span>
                <p className="mt-1 font-bold text-sm text-slate-900 truncate">{customerName}</p>
                {customerPhone ? (
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    <Phone className="h-3 w-3 text-slate-400" />
                    <span className="font-mono">{customerPhone}</span>
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400 mt-0.5">Chưa có SĐT</p>
                )}
              </div>
            </div>

            {/* Staff / Salesperson / Technician card */}
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3.5 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <Receipt className="h-3 w-3" />
                  {recordType === "repair" ? "Kỹ thuật viên" : "Nhân viên phụ trách"}
                </span>
                <p className="mt-1 font-bold text-sm text-slate-900 truncate">{staffName}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Chi nhánh: {branchId}</p>
              </div>
            </div>

            {/* Financial Overview Card */}
            <div
              className={`rounded-2xl border p-3.5 flex flex-col justify-between ${
                dueAmount > 0
                  ? "bg-rose-50/80 border-rose-200 text-rose-900"
                  : "bg-emerald-50/80 border-emerald-200 text-emerald-900"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    {dueAmount > 0 ? "Công nợ cần thu" : "Trạng thái thanh toán"}
                  </span>
                  {dueAmount > 0 && <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />}
                </div>
                <p className="mt-1 font-black text-base tabular-nums">
                  {dueAmount > 0 ? currency.format(dueAmount) : "Đã thanh toán đủ"}
                </p>
                <p className="text-[11px] opacity-80 mt-0.5">
                  Đã trả: {currency.format(paidAmount)} / Tổng: {currency.format(grandTotal)}
                </p>
              </div>
            </div>
          </div>

          {/* REPAIR SPECIFIC: Device & Symptoms info */}
          {recordType === "repair" && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Smartphone className="h-3.5 w-3.5 text-purple-600" />
                Thông tin Thiết bị & Tiếp nhận Sửa chữa
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Device Info */}
                <div className="rounded-2xl border border-purple-100 bg-purple-50/40 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-purple-900">Thiết bị</span>
                    <span className="font-bold text-sm text-purple-950">
                      {liveData?.device?.name || transaction.device?.name || "Thiết bị sửa chữa"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">IMEI / Serial:</span>
                    <span className="font-mono font-bold text-slate-800">
                      {liveData?.device?.imei ||
                        liveData?.device?.serialNumber ||
                        transaction.device?.imei ||
                        transaction.device?.serialNumber ||
                        "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Tình trạng máy:</span>
                    <span className="text-slate-700 font-medium">
                      {liveData?.device?.condition || transaction.device?.condition || "Bình thường"}
                    </span>
                  </div>
                  {(liveData?.device?.accessories?.length > 0 || transaction.device?.accessories?.length) && (
                    <div className="text-xs pt-1 border-t border-purple-100">
                      <span className="text-slate-500">Phụ kiện đi kèm: </span>
                      <span className="font-semibold text-slate-700">
                        {(liveData?.device?.accessories || transaction.device?.accessories || []).join(", ")}
                      </span>
                    </div>
                  )}
                </div>

                {/* Symptoms & Diagnosis */}
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 space-y-2.5">
                  <div>
                    <span className="text-[11px] font-bold uppercase text-slate-400">Lỗi khách báo (Hiện tượng):</span>
                    <p className="text-xs font-semibold text-slate-800 mt-0.5">
                      {liveData?.symptom || transaction.symptom || "—"}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-100">
                    <span className="text-[11px] font-bold uppercase text-indigo-500">Chẩn đoán kỹ thuật:</span>
                    <p className="text-xs font-semibold text-indigo-950 mt-0.5">
                      {liveData?.diagnosis || transaction.diagnosis || "Chưa có chẩn đoán cụ thể."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* WARRANTY SPECIFIC: Coverage, Device & Expiry */}
          {recordType === "warranty" && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-teal-700 flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4" />
                Thông tin Bảo hành Thiết bị
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Device & Serial */}
                <div className="rounded-2xl border border-teal-100 bg-teal-50/40 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-teal-900">Thiết bị</span>
                    <span className="font-bold text-sm text-teal-950">
                      {transaction.warrantyInfo?.productName || transaction.device?.name || "Thiết bị bảo hành"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Số Serial / IMEI:</span>
                    <span className="font-mono font-bold text-slate-800">
                      {transaction.warrantyInfo?.serialNumber ||
                        transaction.device?.serialNumber ||
                        transaction.device?.imei ||
                        "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Tình trạng bảo hành:</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold border ${
                      transaction.status === "expired" || transaction.warrantyInfo?.isExpired
                        ? "bg-slate-100 text-slate-600 border-slate-200"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    }`}>
                      {transaction.statusLabel || (transaction.status === "expired" ? "Hết hạn bảo hành" : "Còn bảo hành")}
                    </span>
                  </div>
                </div>

                {/* Coverage & Expiration */}
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Hạn bảo hành:</span>
                    <span className="font-mono font-bold text-slate-800">
                      {transaction.warrantyInfo?.expiresAt
                        ? formatShortDate(String(transaction.warrantyInfo.expiresAt))
                        : transaction.coverage?.customer?.endAt
                        ? formatShortDate(String(transaction.coverage.customer.endAt))
                        : "Theo phiếu xuất bán"}
                    </span>
                  </div>
                  {transaction.salespersonName && (
                    <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                      <span className="text-slate-500">Nguồn gốc:</span>
                      <span className="font-medium text-slate-700">
                        {transaction.salespersonName}
                      </span>
                    </div>
                  )}
                  {transaction.symptom && (
                    <div className="pt-2 border-t border-slate-100 text-xs">
                      <span className="text-slate-500">Hiện tượng / Lỗi bảo hành: </span>
                      <span className="font-semibold text-slate-800">
                        {transaction.symptom}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* BUYBACK / RETURN SPECIFIC: Reason & Source Order */}
          {(recordType === "buyback" || recordType === "return") && (
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div>
                  <span className="text-slate-500">Loại nghiệp vụ: </span>
                  <span className="font-bold text-slate-900">
                    {recordType === "buyback" ? "Thu mua máy cũ" : "Đổi trả hàng / Hoàn tiền"}
                  </span>
                </div>
                {(liveData?.orderCode || transaction.orderCodeRef) && (
                  <div className="flex items-center gap-1.5 font-mono text-xs">
                    <span className="text-slate-500">Đơn bán gốc:</span>
                    <span className="font-bold text-cyan-800 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200">
                      {liveData?.orderCode || transaction.orderCodeRef}
                    </span>
                  </div>
                )}
              </div>
              <div className="text-xs pt-1 border-t border-slate-200/60">
                <span className="text-slate-500">Lý do: </span>
                <span className="font-medium text-slate-800">
                  {liveData?.reason || transaction.reason || "Không ghi chú lý do."}
                </span>
              </div>
            </div>
          )}

          {/* Line Items Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5 text-cyan-600" />
                Danh sách Sản phẩm / Dịch vụ ({items.length || transaction.itemCount || 1})
              </span>
            </h3>

            {items.length > 0 ? (
              <div className="overflow-x-auto rounded-2xl border border-slate-200/90 bg-white">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-2.5 px-3.5">#</th>
                      <th className="py-2.5 px-3.5">Sản phẩm / Mặt hàng</th>
                      <th className="py-2.5 px-3.5 text-center">SL</th>
                      <th className="py-2.5 px-3.5 text-right">Đơn giá</th>
                      {recordType === "purchase" && <th className="py-2.5 px-3.5 text-right">Chiết khấu</th>}
                      <th className="py-2.5 px-3.5 text-right">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {items.map((item: any, idx: number) => {
                      const qty = Number(item.quantity || 1);
                      const unitPrice = Number(item.unitPrice ?? item.unitAmount ?? 0);
                      const lineTotal = Number(item.lineTotal ?? item.lineAmount ?? unitPrice * qty);
                      const cond = item.condition ? CONDITION_LABELS[item.condition] : null;

                      return (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-3 px-3.5 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                          <td className="py-3 px-3.5">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-slate-900 text-xs">
                                  {item.productName || item.sku || `Sản phẩm #${idx + 1}`}
                                </span>
                                {cond && (
                                  <span className={`rounded-full px-2 py-0.2 text-[10px] font-semibold border ${cond.badge}`}>
                                    {cond.label}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 flex-wrap font-mono text-[11px] text-slate-500">
                                {item.sku && <span>SKU: {item.sku}</span>}
                                {item.unit && <span>· ĐVT: {item.unit}</span>}
                              </div>
                              {/* Serial / IMEI list */}
                              {item.serialNumbers && item.serialNumbers.length > 0 && (
                                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase">IMEI/SN:</span>
                                  {item.serialNumbers.map((sn: string, sIdx: number) => (
                                    <span
                                      key={sIdx}
                                      className="inline-flex items-center gap-1 rounded bg-slate-100 border border-slate-200 px-1.5 py-0.2 font-mono text-[10px] font-semibold text-slate-700"
                                    >
                                      {sn}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3.5 text-center font-bold text-slate-900">{qty}</td>
                          <td className="py-3 px-3.5 text-right font-mono text-slate-700">
                            {currency.format(unitPrice)}
                          </td>
                          {recordType === "purchase" && (
                            <td className="py-3 px-3.5 text-right font-mono text-rose-600">
                              {Number(item.discountAmount) > 0 ? `-${currency.format(item.discountAmount)}` : "—"}
                            </td>
                          )}
                          <td className="py-3 px-3.5 text-right font-mono font-bold text-slate-900">
                            {currency.format(lineTotal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 text-center text-xs text-slate-500">
                <p className="font-semibold text-slate-700">{transaction.description || "1 mục giao dịch"}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Số lượng: {transaction.itemCount || 1} · Tổng: {currency.format(grandTotal)}
                </p>
              </div>
            )}
          </div>

          {/* Repair Cost Breakdown */}
          {recordType === "repair" && (
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 space-y-2 text-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Chi tiết Chi phí Sửa chữa
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                <div className="rounded-xl bg-white border border-slate-200/80 p-2.5">
                  <span className="text-[10px] text-slate-400 block">Tiền công thợ</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {currency.format(Number(liveData?.laborFee ?? transaction.laborFee ?? 0))}
                  </span>
                </div>
                <div className="rounded-xl bg-white border border-slate-200/80 p-2.5">
                  <span className="text-[10px] text-slate-400 block">Tiền linh kiện</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {currency.format(Number(liveData?.partCost ?? transaction.partCost ?? 0))}
                  </span>
                </div>
                <div className="rounded-xl bg-white border border-slate-200/80 p-2.5">
                  <span className="text-[10px] text-slate-400 block">Chiết khấu / Giảm</span>
                  <span className="font-mono font-bold text-rose-600 text-sm">
                    {currency.format(Number(liveData?.discountAmount ?? transaction.discountAmount ?? 0))}
                  </span>
                </div>
                <div className="rounded-xl bg-purple-50 border border-purple-200 p-2.5">
                  <span className="text-[10px] text-purple-700 font-bold block">Tổng sửa chữa</span>
                  <span className="font-mono font-black text-purple-950 text-sm">
                    {currency.format(grandTotal)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Retail Financial Summary (Subtotal, Order Discount, Shipping, Grand Total) */}
          {recordType === "purchase" && (
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Tiền hàng (Tạm tính):</span>
                <span className="font-mono font-semibold">
                  {currency.format(Number(liveData?.subtotal ?? transaction.subtotal ?? grandTotal))}
                </span>
              </div>
              {Number(liveData?.orderDiscount ?? transaction.orderDiscount ?? 0) > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>Chiết khấu đơn hàng:</span>
                  <span className="font-mono font-semibold">
                    -{currency.format(Number(liveData?.orderDiscount ?? transaction.orderDiscount))}
                  </span>
                </div>
              )}
              {Number(liveData?.shippingFee ?? transaction.shippingFee ?? 0) > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Phí vận chuyển:</span>
                  <span className="font-mono font-semibold">
                    +{currency.format(Number(liveData?.shippingFee ?? transaction.shippingFee))}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-slate-900 text-sm">
                <span>Tổng giá trị đơn hàng:</span>
                <span className="font-mono font-black text-base text-cyan-700">
                  {currency.format(grandTotal)}
                </span>
              </div>
            </div>
          )}

          {/* Payments List */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Banknote className="h-3.5 w-3.5 text-emerald-600" />
              Lịch sử Thanh toán & Dòng tiền
            </h3>

            {payments.length > 0 ? (
              <div className="rounded-2xl border border-slate-200/80 bg-white divide-y divide-slate-100 overflow-hidden">
                {payments.map((p: any, pIdx: number) => (
                  <div key={pIdx} className="p-3.5 flex items-center justify-between text-xs hover:bg-slate-50/50">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800">
                          {PAYMENT_METHOD_LABELS[p.method] || p.method || "Thanh toán"}
                        </span>
                        {p.reference && (
                          <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded">
                            Mã GD: {p.reference}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {p.receivedByName && `Thu ngân: ${p.receivedByName} · `}
                        {p.paidAt ? formatDate(p.paidAt) : "Đã ghi nhận"}
                      </p>
                    </div>
                    <span className="font-mono font-bold text-emerald-700 text-sm">
                      {currency.format(Number(p.amount || 0))}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200/70 bg-slate-50/50 p-3.5 text-xs text-slate-500 flex items-center justify-between">
                <span>
                  {recordType === "buyback" || recordType === "return"
                    ? `Phương thức chi trả: ${PAYMENT_METHOD_LABELS[liveData?.paymentMethod || transaction.paymentMethod || "cash"] || "Tiền mặt"}`
                    : `Đã thanh toán qua hệ thống: ${currency.format(paidAmount)}`}
                </span>
                <span className="font-mono font-bold text-emerald-700">
                  {currency.format(paidAmount)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="border-t border-slate-100 px-6 py-4 bg-slate-50/70 flex items-center justify-between rounded-b-3xl">
          <div className="text-xs text-slate-400">
            Mã định danh: <span className="font-mono">{transaction._id}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer shadow-2xs"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
