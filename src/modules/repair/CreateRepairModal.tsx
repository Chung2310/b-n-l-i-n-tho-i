import React, { useEffect, useState } from "react";
import {
  X,
  ShieldCheck,
  Wrench,
  Smartphone,
  QrCode,
  User,
  Phone,
  Tag,
  AlertCircle,
  Check,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import CollaboratorPicker from "../partners/CollaboratorPicker";
import { repairService } from "../../services/repairService";
import type { RepairCreatePrefill } from "./repairBoardTypes";

export interface CreateRepairModalProps {
  prefill: RepairCreatePrefill;
  onClose: () => void;
  onCreated: () => void;
}

const CONDITION_PRESETS = [
  "Máy đẹp 99%",
  "Xước nhẹ viền/lưng",
  "Móp viền góc",
  "Kính nứt/vỡ",
  "Mất FaceID/Vân tay",
  "Kèm củ sạc theo máy",
];

const SYMPTOM_PRESETS = [
  "Mất nguồn / Không lên nguồn",
  "Hỏng màn hình / Liệt cảm ứng",
  "Chai / Phồng pin",
  "Chân sạc lỏng / Không vào điện",
  "Loa rè / Mic hỏng",
  "Rơi nước / Ẩm bo mạch",
  "Lỗi Camera trước/sau",
];

export default function CreateRepairModal({
  prefill,
  onClose,
  onCreated,
}: CreateRepairModalProps) {
  const [form, setForm] = useState({
    ticketType: (prefill.ticketType || (prefill.serialNumber ? "warranty" : "service")) as "warranty" | "service",
    productName: prefill.productName || "",
    serialNumber: prefill.serialNumber || "",
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
      productName: prefill.productName || current.productName,
      serialNumber: prefill.serialNumber || current.serialNumber,
      ticketType: prefill.ticketType || current.ticketType,
    }));
  }, [
    prefill.customerId,
    prefill.customerName,
    prefill.customerPhone,
    prefill.productName,
    prefill.serialNumber,
    prefill.ticketType,
  ]);

  const addPresetToCondition = (preset: string) => {
    setForm((curr) => {
      if (!curr.condition || curr.condition === "Ngoại hình bình thường") {
        return { ...curr, condition: preset };
      }
      if (curr.condition.includes(preset)) return curr;
      return { ...curr, condition: `${curr.condition}; ${preset}` };
    });
  };

  const addPresetToSymptom = (preset: string) => {
    setForm((curr) => {
      if (!curr.symptom.trim()) {
        return { ...curr, symptom: preset };
      }
      if (curr.symptom.includes(preset)) return curr;
      return { ...curr, symptom: `${curr.symptom}; ${preset}` };
    });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (form.ticketType === "warranty" && !form.serialNumber.trim()) {
      setError("Phiếu bảo hành bắt buộc phải có IMEI / Serial để kiểm tra điều kiện.");
      return;
    }
    if (!form.productName.trim()) {
      setError("Tên thiết bị là bắt buộc.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const isService = form.ticketType === "service";
      await repairService.create({
        ticketType: form.ticketType,
        collaboratorId: form.collaboratorId,
        ticketCode: `${isService ? "SRV" : "WAR"}-${Date.now().toString().slice(-8)}`,
        customerId:
          form.customerId.trim() ||
          `KH-${form.customerPhone.trim() || Date.now().toString().slice(-6)}`,
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        device: {
          productId: prefill.productId,
          serialNumber: form.serialNumber.trim() || undefined,
          name: form.productName.trim(),
          condition: form.condition,
          accessories: [],
          imeiVerified: Boolean(form.serialNumber.trim()),
        },
        coverage: isService
          ? {
              customer: { covered: false },
              supplier: { covered: false },
              costBearer: "customer",
              checkedAt: new Date().toISOString(),
            }
          : prefill.coverage,
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
      setError(e instanceof Error ? e.message : "Không thể tạo phiếu.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/50 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <form
        onSubmit={submit}
        className="my-auto max-h-[94vh] w-full max-w-4xl flex flex-col rounded-3xl bg-white shadow-2xl border border-slate-200/80 overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4.5 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                form.ticketType === "warranty"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-orange-100 text-orange-700"
              }`}
            >
              {form.ticketType === "warranty" ? (
                <ShieldCheck className="h-5 w-5" />
              ) : (
                <Wrench className="h-5 w-5" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-slate-900">
                Tiếp nhận thiết bị sửa chữa & bảo hành
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Chọn đúng luồng để hệ thống tự động áp dụng chính sách chi phí và quyền lợi ưu đãi.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition cursor-pointer"
            title="Đóng (Esc)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="space-y-4.5 overflow-y-auto p-6 flex-1 text-xs sm:text-sm">
          {/* 2-Card Flow Selection */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Warranty Flow Card */}
            <button
              type="button"
              onClick={() => setForm({ ...form, ticketType: "warranty" })}
              className={`group flex items-start gap-3.5 rounded-2xl border-2 p-4 text-left transition cursor-pointer ${
                form.ticketType === "warranty"
                  ? "border-blue-600 bg-blue-50/50 shadow-sm ring-4 ring-blue-500/10"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
              }`}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${
                  form.ticketType === "warranty"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
                }`}
              >
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-bold text-slate-900 text-sm">
                    Bảo hành chính hãng
                  </span>
                  {form.ticketType === "warranty" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-2xs">
                      <Check className="h-3 w-3" />
                      <span>Đang chọn</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Dành cho máy mua tại hệ thống còn hạn bảo hành (Bắt buộc IMEI/Serial). Linh kiện bảo hành tính 0 đ.
                </p>
              </div>
            </button>

            {/* Service Flow Card */}
            <button
              type="button"
              onClick={() => setForm({ ...form, ticketType: "service" })}
              className={`group flex items-start gap-3.5 rounded-2xl border-2 p-4 text-left transition cursor-pointer ${
                form.ticketType === "service"
                  ? "border-orange-600 bg-orange-50/50 shadow-sm ring-4 ring-orange-500/10"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
              }`}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${
                  form.ticketType === "service"
                    ? "bg-orange-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
                }`}
              >
                <Wrench className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-bold text-slate-900 text-sm">
                    Sửa chữa dịch vụ
                  </span>
                  {form.ticketType === "service" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-orange-600 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-2xs">
                      <Check className="h-3 w-3" />
                      <span>Đang chọn</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Máy khách ngoài hoặc máy đã hết hạn bảo hành. Tự động áp dụng chiết khấu ưu đãi nếu khách từng mua máy tại shop!
                </p>
              </div>
            </button>
          </div>

          {/* Error Notice */}
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 p-3 text-xs font-semibold text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Row 1: Device Information (2 columns) */}
          <div className="grid gap-3.5 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <Smartphone className="h-3.5 w-3.5 text-cyan-600" />
                <span>Tên thiết bị *</span>
              </span>
              <input
                required
                value={form.productName}
                onChange={(e) => setForm({ ...form, productName: e.target.value })}
                placeholder="VD: iPhone 13 Pro Max 128GB, Samsung S22..."
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition shadow-2xs"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="font-semibold text-slate-700 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <QrCode className="h-3.5 w-3.5 text-cyan-600" />
                  <span>IMEI / Serial</span>
                </span>
                <span
                  className={`text-[11px] font-bold ${
                    form.ticketType === "warranty" ? "text-blue-600" : "text-slate-400"
                  }`}
                >
                  {form.ticketType === "warranty" ? "(Bắt buộc đối với BH)" : "(Tùy chọn)"}
                </span>
              </span>
              <input
                required={form.ticketType === "warranty"}
                value={form.serialNumber}
                onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
                placeholder="VD: 356891234567890 (hoặc số Serial máy)"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 font-mono text-sm text-slate-800 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition shadow-2xs"
              />
            </label>
          </div>

          {/* Row 2: Customer Information (2 columns - spacious and clean) */}
          <div className="grid gap-3.5 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-cyan-600" />
                <span>Tên khách hàng *</span>
              </span>
              <input
                required
                value={form.customerName}
                onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                placeholder="VD: Nguyễn Văn A"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition shadow-2xs"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-cyan-600" />
                <span>Số điện thoại *</span>
              </span>
              <input
                required
                type="tel"
                value={form.customerPhone}
                onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                placeholder="VD: 0912 345 678"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 font-mono text-sm text-slate-800 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition shadow-2xs"
              />
            </label>
          </div>

          {/* Row 3: Collaborator & Customer ID (2 columns - balanced pair) */}
          <div className="grid gap-3.5 sm:grid-cols-2">
            <CollaboratorPicker
              value={form.collaboratorId}
              onChange={(collaboratorId) => setForm({ ...form, collaboratorId })}
            />

            <label className="flex flex-col gap-1.5">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-slate-400" />
                <span>Mã khách hàng (tùy chọn)</span>
              </span>
              <input
                value={form.customerId}
                onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                placeholder="VD: KH-00124 (tự tạo nếu trống)"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition shadow-2xs"
              />
            </label>
          </div>

          {/* Section: Condition with Quick Presets */}
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <span className="font-semibold text-slate-700">
                Tình trạng ngoại quan khi nhận
              </span>
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[11px] text-slate-400 mr-0.5">Chọn nhanh:</span>
                {CONDITION_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => addPresetToCondition(preset)}
                    className="rounded-lg bg-slate-100 hover:bg-slate-200 px-2 py-0.5 text-[11px] text-slate-600 transition cursor-pointer"
                  >
                    + {preset}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={form.condition}
              onChange={(e) => setForm({ ...form, condition: e.target.value })}
              placeholder="VD: Máy xước nhẹ lưng, kính không nứt vỡ, kèm củ sạc theo máy..."
              rows={2}
              className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition shadow-2xs"
            />
          </div>

          {/* Section: Symptom Description with Quick Presets */}
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <span className="font-semibold text-slate-700">
                Mô tả lỗi của khách hàng *
              </span>
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[11px] text-slate-400 mr-0.5">Lỗi phổ biến:</span>
                {SYMPTOM_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => addPresetToSymptom(preset)}
                    className="rounded-lg bg-slate-100 hover:bg-slate-200 px-2 py-0.5 text-[11px] text-slate-600 transition cursor-pointer"
                  >
                    + {preset}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              required
              value={form.symptom}
              onChange={(e) => setForm({ ...form, symptom: e.target.value })}
              placeholder="VD: Rơi nước không lên nguồn, sạc không vào điện, loa trong rè..."
              rows={3}
              className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition shadow-2xs"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 px-6 py-4 bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer shadow-2xs"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={busy}
            className={`inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md transition disabled:opacity-50 cursor-pointer active:scale-[0.99] ${
              form.ticketType === "service"
                ? "bg-orange-600 hover:bg-orange-700 shadow-orange-600/20"
                : "bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-blue-600/20"
            }`}
          >
            {form.ticketType === "warranty" ? (
              <ShieldCheck className="h-4 w-4" />
            ) : (
              <Wrench className="h-4 w-4" />
            )}
            <span>
              {busy
                ? "Đang tạo phiếu..."
                : form.ticketType === "service"
                ? "Tạo phiếu sửa chữa dịch vụ"
                : "Tạo phiếu bảo hành chính hãng"}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}
