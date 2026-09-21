import CollaboratorPicker from "../partners/CollaboratorPicker";
import RepairRefundForm from "../partners/RepairRefundForm";
import React, { useEffect, useRef, useState } from "react";
import {
  Wrench,
  Clock,
  CheckCircle2,
  AlertTriangle,
  User,
  Smartphone,
  Coins,
  ShieldCheck,
  ChevronRight,
  X,
  Plus,
  Loader2,
  DollarSign,
  AlertCircle,
  FileText,
  UserCheck,
} from "lucide-react";
import { authService } from "../../services/authService";
import {
  repairService,
  type RepairStatus,
  type RepairTicket,
} from "../../services/repairService";
import RepairTicketExtras from "./RepairTicketExtras";

const columns: Array<{
  status: RepairStatus;
  label: string;
  badgeColor: string;
}> = [
  { status: "received", label: "Tiếp nhận", badgeColor: "bg-slate-100 text-slate-700" },
  { status: "diagnosing", label: "Kiểm tra", badgeColor: "bg-blue-50 text-blue-700" },
  { status: "quoted", label: "Báo giá", badgeColor: "bg-amber-50 text-amber-700" },
  { status: "approved", label: "Đã duyệt", badgeColor: "bg-indigo-50 text-indigo-700" },
  { status: "repairing", label: "Đang sửa", badgeColor: "bg-cyan-50 text-cyan-700" },
  { status: "waiting_parts", label: "Chờ linh kiện", badgeColor: "bg-purple-50 text-purple-700" },
  { status: "waiting_supplier", label: "Chờ NCC", badgeColor: "bg-orange-50 text-orange-700" },
  { status: "done", label: "Xong", badgeColor: "bg-emerald-50 text-emerald-700" },
  { status: "delivered", label: "Đã giao", badgeColor: "bg-teal-50 text-teal-700" },
];

const nextStatus: Partial<Record<RepairStatus, RepairStatus>> = {
  received: "diagnosing",
  diagnosing: "quoted",
  approved: "repairing",
  repairing: "done",
  waiting_parts: "repairing",
  waiting_supplier: "repairing",
  done: "delivered",
};

const repairStatusLabels: Record<RepairStatus, string> = {
  received: "Tiếp nhận",
  diagnosing: "Kiểm tra",
  quoted: "Báo giá",
  approved: "Đã duyệt",
  repairing: "Đang sửa",
  waiting_parts: "Chờ linh kiện",
  waiting_supplier: "Chờ nhà cung cấp",
  done: "Hoàn tất",
  delivered: "Đã giao",
  cancelled: "Đã hủy",
  returned: "Đã trả",
};

const money = (value: number) => Number(value || 0).toLocaleString("vi-VN");
const date = (value?: string) =>
  value ? new Date(value).toLocaleString("vi-VN") : "—";
const repairStatusLabel = (status?: string) =>
  status && status in repairStatusLabels
    ? repairStatusLabels[status as RepairStatus]
    : "Chưa tiếp nhận";

const COST_BEARER_LABEL: Record<string, string> = {
  customer: "Sửa chữa (khách trả phí)",
  shop: "Bảo hành cửa hàng",
  supplier: "Bảo hành nhà cung cấp",
};
const COST_BEARER_BADGE_CLASS: Record<string, string> = {
  customer: "bg-amber-50 text-amber-700 border-amber-200",
  shop: "bg-emerald-50 text-emerald-700 border-emerald-200",
  supplier: "bg-sky-50 text-sky-700 border-sky-200",
};
const costBearerLabel = (costBearer?: string) =>
  (costBearer && COST_BEARER_LABEL[costBearer]) || "Sửa chữa (khách trả phí)";
const costBearerBadgeClass = (costBearer?: string) =>
  (costBearer && COST_BEARER_BADGE_CLASS[costBearer]) ||
  COST_BEARER_BADGE_CLASS.customer;

function ReceiveTechnicianModal({
  ticket,
  onClose,
  onSubmit,
}: {
  ticket: RepairTicket;
  onClose: () => void;
  onSubmit: (technicianId: string) => Promise<void>;
}) {
  const [people, setPeople] = useState<
    Array<{ uid: string; displayName?: string; email?: string }>
  >([]);
  const [technicianId, setTechnicianId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void authService
      .getColleagues()
      .then((items) => setPeople(items))
      .catch((e) =>
        setError(
          e instanceof Error
            ? e.message
            : "Không thể tải danh sách kỹ thuật viên."
        )
      );
  }, []);

  const submit = async () => {
    if (!technicianId) return;
    setBusy(true);
    setError("");
    try {
      await onSubmit(technicianId);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Không thể cập nhật phiếu."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="receive-technician-title"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h2 id="receive-technician-title" className="text-base sm:text-lg font-bold text-slate-900">
            Chọn kỹ thuật viên tiếp nhận
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-3 text-xs sm:text-sm text-slate-500">
          Phiếu <strong className="font-mono text-cyan-700">{ticket.ticketCode}</strong> sẽ được chuyển sang giai đoạn Kiểm tra.
        </p>

        <label className="mt-4 flex flex-col gap-1.5 text-xs sm:text-sm font-semibold text-slate-700">
          Kỹ thuật viên tiếp nhận
          <select
            value={technicianId}
            onChange={(e) => setTechnicianId(e.target.value)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 font-normal text-slate-800 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100 cursor-pointer"
          >
            <option value="">— Chọn kỹ thuật viên —</option>
            {people.map((person) => (
              <option key={person.uid} value={person.uid}>
                {person.displayName || person.email || person.uid}
              </option>
            ))}
          </select>
        </label>

        {error && (
          <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs font-semibold text-rose-700">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2.5 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy || !technicianId}
            className="rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 px-5 py-2 text-xs font-bold text-white shadow-sm shadow-cyan-600/20 active:scale-95 disabled:opacity-50 cursor-pointer transition-all"
          >
            {busy ? "Đang chuyển..." : "Chuyển bước tiếp"}
          </button>
        </div>
      </div>
    </div>
  );
}

export type RepairCreatePrefill = {
  productId?: string;
  serialNumber?: string;
  productName: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  coverage: RepairTicket["coverage"];
};

function CreateRepairModal({
  prefill,
  onClose,
  onCreated,
}: {
  prefill: RepairCreatePrefill;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    collaboratorId: "",
    customerId: prefill.customerId || "",
    customerName: prefill.customerName || "",
    customerPhone: prefill.customerPhone || "",
    symptom: "",
    condition: "Ngoại hình bình thường",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm((current) => ({
      ...current,
      customerId: prefill.customerId || current.customerId,
      customerName: prefill.customerName || current.customerName,
      customerPhone: prefill.customerPhone || current.customerPhone,
    }));
  }, [prefill.customerId, prefill.customerName, prefill.customerPhone]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await repairService.create({
        collaboratorId: form.collaboratorId,
        ticketCode: `REP-${Date.now()}`,
        customerId: form.customerId,
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        device: {
          productId: prefill.productId,
          serialNumber: prefill.serialNumber,
          name: prefill.productName,
          condition: form.condition,
          accessories: [],
          imeiVerified: Boolean(prefill.serialNumber),
        },
        coverage: prefill.coverage,
        symptom: form.symptom,
        laborFee: 0,
        partCost: 0,
        discountAmount: 0,
        totalAmount: 0,
        paidAmount: 0,
        dueAmount: 0,
        paymentStatus: "unpaid",
        receivedAt: new Date().toISOString(),
      });
      onCreated();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Không thể tạo phiếu sửa chữa."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <form
        onSubmit={submit}
        className="max-h-[92vh] w-full max-w-4xl space-y-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Tạo phiếu sửa chữa/bảo hành
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {prefill.productName} · {prefill.serialNumber || "Không có IMEI/Serial"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700 border border-red-200">
            {error}
          </p>
        )}

        <CollaboratorPicker
          value={form.collaboratorId}
          onChange={(collaboratorId) =>
            setForm({ ...form, collaboratorId })
          }
        />

        <div className="grid gap-3 sm:grid-cols-3">
          {(["customerId", "customerName", "customerPhone"] as const).map(
            (key) => (
              <label key={key} className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
                <span>
                  {{
                    customerId: "Mã khách hàng",
                    customerName: "Tên khách hàng",
                    customerPhone: "Số điện thoại",
                  }[key]}
                </span>
                <input
                  value={form[key]}
                  onChange={(e) =>
                    setForm({ ...form, [key]: e.target.value })
                  }
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3.5 text-xs sm:text-sm font-medium outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                />
              </label>
            )
          )}
        </div>

        <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
          <span>Tình trạng thiết bị khi tiếp nhận</span>
          <textarea
            value={form.condition}
            onChange={(e) =>
              setForm({ ...form, condition: e.target.value })
            }
            placeholder="Ngoại hình, phụ kiện kèm theo, vết xước, tình trạng nguồn/màn hình..."
            className="min-h-28 w-full resize-y rounded-xl border border-slate-200 bg-white p-3 text-xs sm:text-sm font-medium outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
          <span>Mô tả lỗi / yêu cầu bảo hành</span>
          <textarea
            required
            value={form.symptom}
            onChange={(e) =>
              setForm({ ...form, symptom: e.target.value })
            }
            placeholder="Mô tả chi tiết lỗi, thời điểm phát sinh, yêu cầu của khách..."
            className="min-h-36 w-full resize-y rounded-xl border border-slate-200 bg-white p-3 text-xs sm:text-sm font-medium outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
          />
        </label>

        <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs"
          >
            Hủy
          </button>
          <button
            disabled={busy}
            className="rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 px-5 py-2 text-xs font-bold text-white shadow-sm shadow-cyan-600/20 active:scale-95 disabled:opacity-50 cursor-pointer transition-all"
          >
            {busy ? "Đang tạo..." : "Tạo phiếu"}
          </button>
        </div>
      </form>
    </div>
  );
}

function TicketModal({
  ticket,
  onClose,
  onChanged,
}: {
  ticket: RepairTicket;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [quote, setQuote] = useState(
    String(ticket.quotedAmount ?? ticket.totalAmount ?? 0)
  );
  const [quoteNote, setQuoteNote] = useState("");
  const [laborFee, setLaborFee] = useState(
    ticket.laborFee ? String(ticket.laborFee) : ""
  );
  const [quoteSaved, setQuoteSaved] = useState(false);
  const [payment, setPayment] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const quoteSavePending = useRef(false);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      onChanged();
      onClose();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Không thể cập nhật phiếu.");
    } finally {
      setBusy(false);
    }
  };

  const saveQuote = async () => {
    if (quoteSavePending.current || busy || !quoteNote.trim()) return;
    quoteSavePending.current = true;
    setBusy(true);
    setQuoteSaved(false);
    try {
      await (laborFee === ""
        ? repairService.quote(ticket._id, Number(quote), quoteNote.trim())
        : repairService.quote(
            ticket._id,
            Number(quote),
            quoteNote.trim(),
            Number(laborFee)
          ));
      onChanged();
      setQuoteSaved(true);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Không thể cập nhật phiếu.");
    } finally {
      quoteSavePending.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="repair-ticket-title"
        className="my-3 max-h-[calc(100vh-1.5rem)] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl border border-slate-100 sm:my-6 sm:max-h-[calc(100vh-3rem)] sm:p-6 animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex justify-between items-start gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 id="repair-ticket-title" className="text-lg sm:text-xl font-bold text-slate-900">
                {ticket.ticketCode}
              </h2>
              <span
                className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold border ${costBearerBadgeClass(
                  ticket.coverage.costBearer
                )}`}
              >
                {costBearerLabel(ticket.coverage.costBearer)}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              {ticket.device.name} · {ticket.device.serialNumber || "Không có serial"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs"
          >
            Đóng
          </button>
        </div>

        {/* Customer & Warranty Info */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 text-xs sm:text-sm space-y-1">
            <b className="text-slate-800 font-bold block mb-1">Khách hàng</b>
            <p className="text-slate-700 font-medium">
              {ticket.customerName} · {ticket.customerPhone}
            </p>
            <p className="text-slate-500">Mã: {ticket.customerId}</p>
            <p className="text-slate-500">Tiếp nhận: {date(ticket.receivedAt)}</p>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 text-xs sm:text-sm space-y-1">
            <b className="text-slate-800 font-bold block mb-1">Bảo hành</b>
            <p className="text-slate-700 font-medium">
              Khách:{" "}
              <span className={ticket.coverage.customer.covered ? "text-emerald-700 font-bold" : "text-rose-600 font-bold"}>
                {ticket.coverage.customer.covered
                  ? `Còn ${ticket.coverage.customer.daysLeft || 0} ngày`
                  : "Hết hạn"}
              </span>
            </p>
            <p className="text-slate-700 font-medium">
              NCC:{" "}
              <span className={ticket.coverage.supplier.covered ? "text-emerald-700 font-bold" : "text-slate-500"}>
                {ticket.coverage.supplier.covered
                  ? `Còn ${ticket.coverage.supplier.daysLeft || 0} ngày`
                  : "Hết hạn"}
              </span>
            </p>
            <p className="text-slate-500 pt-0.5">
              Bên chịu phí:{" "}
              <span
                className={`rounded px-2 py-0.5 text-xs font-semibold ${costBearerBadgeClass(
                  ticket.coverage.costBearer
                )}`}
              >
                {costBearerLabel(ticket.coverage.costBearer)}
              </span>
            </p>
          </div>
        </div>

        {/* Symptom & Diagnosis */}
        <div className="mt-4 rounded-xl border border-slate-200/80 bg-white p-4 text-xs sm:text-sm space-y-2">
          <div>
            <b className="text-slate-800 font-bold">Mô tả lỗi</b>
            <p className="mt-1 text-slate-700 leading-relaxed">{ticket.symptom}</p>
          </div>
          {ticket.diagnosis && (
            <div className="pt-2 border-t border-slate-100">
              <b className="block text-slate-800 font-bold">Chẩn đoán</b>
              <p className="mt-1 text-slate-700 leading-relaxed">{ticket.diagnosis}</p>
            </div>
          )}
        </div>

        {/* Financial Totals */}
        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-4 rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 text-xs sm:text-sm">
          <div className="text-slate-600">
            Nhân công<br />
            <b className="text-slate-900 font-bold text-sm">{money(ticket.laborFee)}</b>
          </div>
          <div className="text-slate-600">
            Linh kiện<br />
            <b className="text-slate-900 font-bold text-sm">{money(ticket.partRevenue ?? 0)}</b>
          </div>
          <div className="text-slate-600">
            Tổng<br />
            <b className="text-cyan-800 font-bold text-sm">{money(ticket.totalAmount)}</b>
          </div>
          <div className="text-slate-600">
            Còn nợ<br />
            <b className="text-rose-600 font-bold text-sm">{money(ticket.dueAmount)}</b>
          </div>
        </div>

        {/* Diagnosing state quote controls */}
        {ticket.status === "diagnosing" && (
          <div className="mt-4 space-y-3 rounded-xl border border-cyan-200/80 bg-cyan-50/30 p-4">
            <label className="flex flex-col gap-1 text-xs sm:text-sm font-semibold text-slate-700">
              <span>Số tiền báo giá</span>
              <input
                type="number"
                min="0"
                value={quote}
                onChange={(e) => setQuote(e.target.value)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 font-medium outline-none focus:border-cyan-600"
              />
            </label>

            <label className="flex flex-col gap-1 text-xs sm:text-sm font-semibold text-slate-700">
              <span>Tiền công trong báo giá</span>
              <input
                aria-label="Tiền công trong báo giá"
                type="number"
                min="0"
                max={quote}
                value={laborFee}
                onChange={(e) => setLaborFee(e.target.value)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 font-medium outline-none focus:border-cyan-600"
              />
            </label>

            <label className="flex flex-col gap-1 text-xs sm:text-sm font-semibold text-slate-700">
              <span>Ghi chú báo giá</span>
              <textarea
                required
                value={quoteNote}
                onChange={(e) => setQuoteNote(e.target.value)}
                className="min-h-20 rounded-xl border border-slate-200 bg-white p-3 font-medium outline-none focus:border-cyan-600"
              />
            </label>

            {quoteSaved && (
              <p
                role="status"
                className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs sm:text-sm font-semibold text-emerald-700"
              >
                Đã lưu báo giá
              </p>
            )}

            <button
              disabled={busy || quoteSaved || !quoteNote.trim()}
              onClick={() => void saveQuote()}
              className="min-h-11 w-full rounded-xl bg-cyan-600 px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-cyan-700 disabled:opacity-50 sm:w-auto cursor-pointer transition-all"
            >
              {quoteSavePending.current ? "Đang lưu..." : "Lưu báo giá"}
            </button>
          </div>
        )}

        {/* Done state payment controls */}
        {ticket.status === "done" && ticket.dueAmount > 0 && (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row items-center rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-3.5">
            <input
              type="number"
              min="1"
              max={ticket.dueAmount}
              value={payment}
              onChange={(e) => setPayment(e.target.value)}
              placeholder="Số tiền thu"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs sm:text-sm font-medium outline-none sm:w-auto flex-1"
            />
            <button
              disabled={busy}
              onClick={() =>
                void run(() => repairService.pay(ticket._id, Number(payment)))
              }
              className="min-h-11 w-full rounded-xl bg-emerald-600 px-5 py-2 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-emerald-700 sm:w-auto cursor-pointer transition-all"
            >
              Ghi nhận thanh toán
            </button>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-5 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:flex-wrap">
          {ticket.status === "done" && (
            <button
              disabled={busy}
              onClick={() => void run(() => repairService.deliver(ticket._id))}
              className="min-h-11 w-full rounded-xl bg-blue-600 px-5 py-2 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-blue-700 sm:w-auto cursor-pointer transition-all"
            >
              Giao máy
            </button>
          )}

          {[
            "received",
            "diagnosing",
            "quoted",
            "approved",
            "repairing",
          ].includes(ticket.status) && (
            <div className="flex flex-col sm:flex-row gap-2 flex-1">
              <input
                placeholder="Lý do hủy"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs sm:text-sm font-medium outline-none sm:w-auto flex-1"
              />
              <button
                disabled={busy || !reason.trim()}
                onClick={() =>
                  void run(() => repairService.cancel(ticket._id, reason))
                }
                className="min-h-11 w-full rounded-xl border border-rose-300 bg-rose-50/60 px-5 py-2 text-xs sm:text-sm font-bold text-rose-700 hover:bg-rose-100 sm:w-auto cursor-pointer transition-all"
              >
                Hủy phiếu
              </button>
            </div>
          )}
        </div>

        {ticket.status === "delivered" && (
          <RepairRefundForm
            ticket={ticket}
            onChanged={() => {
              onChanged();
              onClose();
            }}
          />
        )}

        <RepairTicketExtras ticket={ticket} onChanged={onChanged} />

        {/* Status History */}
        <div className="mt-5 border-t border-slate-100 pt-4">
          <h3 className="font-bold text-sm text-slate-800">
            Lịch sử xử lý
          </h3>
          <div className="mt-2 space-y-1.5">
            {ticket.statusHistory?.map((entry, index) => (
              <p
                key={index}
                className="text-xs text-slate-500 font-medium"
              >
                {date(entry.at)} · {repairStatusLabel(entry.from)} →{" "}
                {repairStatusLabel(entry.to)} · {entry.byName}
                {entry.note ? ` · ${entry.note}` : ""}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RepairBoardPage({
  createPrefill,
  onCreatePrefillConsumed,
}: {
  createPrefill?: RepairCreatePrefill | null;
  onCreatePrefillConsumed?: () => void;
} = {}) {
  const [board, setBoard] = useState<
    Partial<Record<RepairStatus, RepairTicket[]>>
  >({});
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<RepairTicket | null>(null);
  const [receivingTicket, setReceivingTicket] =
    useState<RepairTicket | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (createPrefill) setCreateOpen(true);
  }, [createPrefill]);

  const loadBoard = () =>
    repairService
      .board()
      .then(setBoard)
      .catch((e) =>
        setError(
          e instanceof Error ? e.message : "Không thể tải board Repair"
        )
      );

  useEffect(() => {
    void loadBoard();
  }, []);

  const moveForward = async (ticket: RepairTicket, technicianId?: string) => {
    setBusyId(ticket._id);
    try {
      const to = nextStatus[ticket.status];
      if (ticket.status === "quoted")
        await repairService.approveQuote(ticket._id);
      else if (to)
        await repairService.transition(
          ticket._id,
          to,
          technicianId ? { technicianId } : {}
        );
      await loadBoard();
      setReceivingTicket(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể cập nhật phiếu");
      throw e;
    } finally {
      setBusyId(null);
    }
  };

  const startMoveForward = (ticket: RepairTicket) => {
    if (ticket.status === "received") setReceivingTicket(ticket);
    else if (ticket.status === "diagnosing") setSelected(ticket);
    else void moveForward(ticket).catch(() => undefined);
  };

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
          {error}
        </p>
      )}

      {/* Kanban Board Container with horizontal scroller for mobile */}
      <div
        data-testid="repair-board-scroll"
        className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0"
      >
        <div className="grid min-w-[1250px] grid-cols-9 gap-3">
          {columns.map((column) => {
            const list = board[column.status] || [];
            return (
              <section
                key={column.status}
                className="min-h-48 rounded-2xl border border-slate-200/80 bg-slate-100/70 p-2.5 flex flex-col"
              >
                <div className="mb-2.5 flex items-center justify-between px-1.5">
                  <h2 className="text-xs font-bold text-slate-800">
                    {column.label}
                  </h2>
                  <span
                    className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${column.badgeColor}`}
                  >
                    {list.length}
                  </span>
                </div>

                <div className="space-y-2.5 flex-1">
                  {list.map((ticket) => (
                    <article
                      key={ticket._id}
                      onClick={() => setSelected(ticket)}
                      className="group cursor-pointer rounded-xl border border-slate-200/90 bg-white p-3 shadow-xs hover:border-cyan-400 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <p className="text-xs font-mono font-bold text-cyan-700">
                          {ticket.ticketCode}
                        </p>
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold border ${costBearerBadgeClass(
                            ticket.coverage.costBearer
                          )}`}
                        >
                          {costBearerLabel(ticket.coverage.costBearer)}
                        </span>
                      </div>

                      <p className="mt-1.5 text-xs font-bold text-slate-800 group-hover:text-cyan-700 transition-colors line-clamp-1">
                        {ticket.device.name}
                      </p>
                      <p className="text-[11px] font-mono text-slate-400 truncate">
                        {ticket.device.serialNumber || "Không có serial"}
                      </p>

                      <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1 text-xs">
                        <div className="flex items-center gap-1 text-slate-700 font-medium">
                          <User className="h-3 w-3 text-slate-400" />
                          <span className="truncate">{ticket.customerName}</span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          KT: {ticket.technicianName || "chưa phân công"}
                        </p>
                        <div className="flex items-center justify-between text-[11px] pt-0.5">
                          <span className="text-slate-500">
                            Tổng: <strong>{money(ticket.totalAmount)}</strong>
                          </span>
                          <span className="text-rose-600 font-bold">
                            Nợ: {money(ticket.dueAmount)}
                          </span>
                        </div>
                      </div>

                      {ticket.coverage.customer.covered && (
                        <span className="mt-2 inline-block rounded-md bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                          Còn bảo hành
                        </span>
                      )}

                      {(nextStatus[ticket.status] || ticket.status === "quoted") && (
                        <button
                          type="button"
                          disabled={busyId === ticket._id}
                          onClick={(e) => {
                            e.stopPropagation();
                            startMoveForward(ticket);
                          }}
                          className="mt-2.5 w-full rounded-lg bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 px-2.5 py-1.5 text-xs font-bold text-white shadow-2xs active:scale-95 disabled:opacity-50 cursor-pointer transition-all"
                        >
                          {ticket.status === "quoted"
                            ? "Duyệt báo giá"
                            : "Chuyển bước tiếp"}
                        </button>
                      )}
                    </article>
                  ))}

                  {list.length === 0 && (
                    <div className="flex items-center justify-center py-8 text-center text-[11px] text-slate-400 italic">
                      Trống
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {receivingTicket && (
        <ReceiveTechnicianModal
          ticket={receivingTicket}
          onClose={() => setReceivingTicket(null)}
          onSubmit={(technicianId) =>
            moveForward(receivingTicket, technicianId)
          }
        />
      )}

      {selected && (
        <TicketModal
          ticket={{
            ...selected,
            statusHistory: selected.statusHistory?.map((entry) => ({
              ...entry,
              note:
                [
                  entry.note,
                  entry.technicianName
                    ? `KT nhận: ${entry.technicianName}`
                    : "",
                ]
                  .filter(Boolean)
                  .join(" · ") || undefined,
            })),
          }}
          onClose={() => setSelected(null)}
          onChanged={() => void loadBoard()}
        />
      )}

      {createOpen && createPrefill && (
        <CreateRepairModal
          prefill={createPrefill}
          onClose={() => {
            setCreateOpen(false);
            onCreatePrefillConsumed?.();
          }}
          onCreated={() => {
            setCreateOpen(false);
            onCreatePrefillConsumed?.();
            void loadBoard();
          }}
        />
      )}
    </div>
  );
}
