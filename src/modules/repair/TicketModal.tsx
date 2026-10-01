import React, { useEffect, useRef, useState } from "react";
import { Sparkles, Calculator, CheckCircle2, RotateCw, FileText, Check, AlertTriangle } from "lucide-react";
import RepairRefundForm from "../partners/RepairRefundForm";
import { customerApi } from "../customer-management/customerApi";
import { repairService, type RepairTicket } from "../../services/repairService";
import RepairPaymentForm from "./RepairPaymentForm";
import RepairTicketExtras from "./RepairTicketExtras";
import {
  costBearerBadgeClass,
  costBearerLabel,
  date,
  money,
  repairStatusLabel,
  STEP_MAP,
} from "./repairBoardTypes";

export interface TicketModalProps {
  ticket: RepairTicket;
  onClose: () => void;
  onChanged: () => void;
}

const parseDigits = (val: string | number | undefined | null): number => {
  if (val === undefined || val === null) return 0;
  const clean = String(val).replace(/\D/g, "");
  return clean ? Number(clean) : 0;
};

const formatCurrencyInput = (val: string | number | undefined | null): string => {
  if (val === undefined || val === null || val === "") return "";
  const clean = String(val).replace(/\D/g, "");
  if (!clean) return "";
  return Number(clean).toLocaleString("vi-VN");
};

const handleCurrencyChange = (
  e: React.ChangeEvent<HTMLInputElement>,
  setter: (val: string) => void
) => {
  const input = e.target;
  const rawVal = input.value;
  const cursorPos = input.selectionStart ?? rawVal.length;

  const digitsBeforeCursor = rawVal.slice(0, cursorPos).replace(/\D/g, "").length;
  const formatted = formatCurrencyInput(rawVal);
  setter(formatted);

  if (typeof input.setSelectionRange === "function") {
    requestAnimationFrame(() => {
      let newPos = 0;
      let countedDigits = 0;
      for (let i = 0; i < formatted.length; i++) {
        if (/\d/.test(formatted[i])) {
          countedDigits++;
        }
        if (countedDigits === digitsBeforeCursor) {
          newPos = i + 1;
          break;
        }
      }
      if (countedDigits < digitsBeforeCursor) {
        newPos = formatted.length;
      }
      input.setSelectionRange(newPos, newPos);
    });
  }
};

function isHexObjectId(str?: string): boolean {
  if (!str) return false;
  return /^[0-9a-fA-F]{24}$/.test(str.trim());
}

function getFriendlyCustomerCode(ticket: RepairTicket): string {
  if (ticket.customerCode && !isHexObjectId(ticket.customerCode)) {
    return ticket.customerCode;
  }
  if (ticket.customerId && !isHexObjectId(ticket.customerId)) {
    return ticket.customerId;
  }
  if (ticket.customerPhone) {
    return `KH-${ticket.customerPhone.trim()}`;
  }
  return "";
}

export default function TicketModal({
  ticket,
  onClose,
  onChanged,
}: TicketModalProps) {
  const [customerCode, setCustomerCode] = useState<string>(() =>
    getFriendlyCustomerCode(ticket)
  );

  useEffect(() => {
    let active = true;
    const initial = getFriendlyCustomerCode(ticket);
    setCustomerCode(initial);

    const phone = ticket.customerPhone?.replace(/\D/g, "");
    if ((isHexObjectId(ticket.customerId) || !initial) && phone) {
      void customerApi
        .list({ q: phone, limit: 1, status: "active" })
        .then((res) => {
          if (!active) return;
          const matched = res.items.find(
            (c) => c.phone?.replace(/\D/g, "") === phone
          );
          if (matched?.customerCode) {
            setCustomerCode(matched.customerCode);
          }
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [ticket.customerId, ticket.customerCode, ticket.customerPhone]);

  const initialQuote = ticket.quotedAmount ?? ticket.totalAmount ?? 0;
  const [quote, setQuote] = useState(
    initialQuote > 0 ? initialQuote.toLocaleString("vi-VN") : "0"
  );
  const [quoteNote, setQuoteNote] = useState("");
  const [laborFee, setLaborFee] = useState(
    ticket.laborFee ? ticket.laborFee.toLocaleString("vi-VN") : ""
  );
  const [quoteSaved, setQuoteSaved] = useState(false);
  const [actionBusy, setBusy] = useState(false);
  const [paymentLocked, setPaymentLocked] = useState(false);
  const [errorAlert, setErrorAlert] = useState<string | null>(null);
  const busy = actionBusy || paymentLocked;
  const quoteSavePending = useRef(false);

  useEffect(() => {
    if (!errorAlert) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setErrorAlert(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [errorAlert]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      onChanged();
      onClose();
    } catch (e) {
      setErrorAlert(e instanceof Error ? e.message : "Không thể cập nhật phiếu.");
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
      const numQuote = parseDigits(quote);
      const numLabor = laborFee !== "" ? parseDigits(laborFee) : undefined;
      await (numLabor === undefined
        ? repairService.quote(ticket._id, numQuote, quoteNote.trim())
        : repairService.quote(ticket._id, numQuote, quoteNote.trim(), numLabor));
      onChanged();
      setQuoteSaved(true);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Không thể cập nhật phiếu.");
    } finally {
      quoteSavePending.current = false;
      setBusy(false);
    }
  };

  const isService = ticket.ticketType === "service";
  const currentStepNumber = STEP_MAP[ticket.status] || 1;
  const isTerminated = ticket.status === "cancelled" || ticket.status === "returned";

  const STEPS = [
    { step: 1, label: "Tiếp nhận" },
    { step: 2, label: "Kiểm tra & Báo giá" },
    { step: 3, label: "Đang sửa" },
    { step: 4, label: "Chờ giao máy" },
    { step: 5, label: "Đã giao" },
  ];

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-slate-950/40 p-3 backdrop-blur-xs sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="repair-ticket-title"
        className="my-3 max-h-[calc(100vh-1.5rem)] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:my-6 sm:max-h-[calc(100vh-3rem)] sm:p-5"
      >
        <div className="flex justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="repair-ticket-title" className="text-xl font-bold text-slate-900">
                {ticket.ticketCode}
              </h2>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  isService
                    ? "bg-orange-100 text-orange-800 border border-orange-200"
                    : "bg-blue-100 text-blue-800 border border-blue-200"
                }`}
              >
                {isService ? "Sửa chữa dịch vụ" : "Bảo hành hệ thống"}
              </span>
              <span className={`rounded px-2 py-0.5 text-xs font-semibold ${costBearerBadgeClass(ticket.coverage.costBearer)}`}>
                {costBearerLabel(ticket.coverage.costBearer)}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {ticket.device.name} · <span className="font-mono">{ticket.device.serialNumber || "Không có IMEI/serial"}</span>
            </p>
            {ticket.loyaltyDiscount?.rate ? (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700 border border-purple-200">
                <span>Ưu đãi khách mua máy tại shop: Giảm {ticket.loyaltyDiscount.rate}%</span>
                {ticket.loyaltyDiscount.amount ? <span>(-{money(ticket.loyaltyDiscount.amount)} đ)</span> : null}
              </div>
            ) : null}
          </div>
          <button
            onClick={onClose}
            className="min-h-11 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            Đóng
          </button>
        </div>

        {/* Visual Progress Stepper for Non-tech Users */}
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">
            Tiến trình xử lý thiết bị
          </div>
          <div className="flex items-center justify-between gap-1 overflow-x-auto pb-1">
            {STEPS.map((s, idx) => {
              const isCompleted = !isTerminated && currentStepNumber > s.step;
              const isCurrent = !isTerminated && currentStepNumber === s.step;
              return (
                <React.Fragment key={s.step}>
                  <div className="flex flex-col items-center gap-1 min-w-[72px] text-center">
                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition ${
                        isTerminated
                          ? "bg-slate-200 text-slate-500"
                          : isCompleted
                          ? "bg-emerald-600 text-white shadow-xs"
                          : isCurrent
                          ? "bg-cyan-600 text-white ring-4 ring-cyan-100 shadow-xs"
                          : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      {isCompleted ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : s.step}
                    </div>
                    <span
                      className={`text-[11px] font-medium leading-tight ${
                        isCurrent ? "font-bold text-cyan-800" : isCompleted ? "text-emerald-700" : "text-slate-400"
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div
                      className={`h-0.5 flex-1 min-w-4 transition ${
                        !isTerminated && currentStepNumber > s.step ? "bg-emerald-500" : "bg-slate-200"
                      }`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 text-sm">
            <b className="font-semibold text-slate-900">Khách hàng</b>
            <p className="mt-1 font-medium text-slate-800">
              {ticket.customerName} · {ticket.customerPhone}
            </p>
            {customerCode ? (
              <p className="text-xs text-slate-500">Mã: {customerCode}</p>
            ) : null}
            <p className="text-xs text-slate-500">Tiếp nhận: {date(ticket.receivedAt)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 text-sm">
            <b className="font-semibold text-slate-900">Diện bảo hành</b>
            {isService ? (
              <p className="text-slate-600 mt-1">
                Sửa chữa dịch vụ (khách thanh toán chi phí sửa & linh kiện không nằm trong bảo hành).
              </p>
            ) : (
              <>
                <p className="mt-1">
                  Khách: {ticket.coverage.customer.covered ? `Còn ${ticket.coverage.customer.daysLeft || 0} ngày` : "Hết hạn"}
                </p>
                <p>
                  NCC: {ticket.coverage.supplier.covered ? `Còn ${ticket.coverage.supplier.daysLeft || 0} ngày` : "Hết hạn"}
                </p>
              </>
            )}
            <p className="mt-1.5">
              Bên chịu phí:{" "}
              <span className={`rounded px-2 py-0.5 text-xs font-semibold ${costBearerBadgeClass(ticket.coverage.costBearer)}`}>
                {costBearerLabel(ticket.coverage.costBearer)}
              </span>
            </p>
          </div>
        </div>

        {/* Problem description & technical diagnosis */}
        <div className="mt-4 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs space-y-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Mô tả lỗi khách báo khi tiếp nhận
            </div>
            <div className="mt-1.5 rounded-xl bg-slate-50 p-3 border border-slate-200/70 text-sm text-slate-800 font-medium leading-relaxed">
              {ticket.symptom || "Chưa có mô tả chi tiết khi nhận máy"}
            </div>
          </div>
          {ticket.diagnosis && (
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-indigo-700">
                Kết quả chẩn đoán kỹ thuật viên
              </div>
              <div className="mt-1.5 rounded-xl bg-indigo-50/60 p-3 border border-indigo-200/70 text-sm text-indigo-950 font-medium leading-relaxed">
                {ticket.diagnosis}
              </div>
            </div>
          )}
        </div>

        {/* 4 Financial Stat Cards with xx.xxx.xxx Currency Format */}
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-4">
          <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/80 p-3.5 shadow-2xs text-xs text-slate-500 font-medium">
            Nhân công<br />
            <b className="mt-1.5 inline-block text-base sm:text-lg font-black tracking-tight text-slate-900">
              {money(ticket.laborFee)} <span className="text-xs font-bold text-slate-500">đ</span>
            </b>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/80 p-3.5 shadow-2xs text-xs text-slate-500 font-medium">
            Linh kiện<br />
            <b className="mt-1.5 inline-block text-base sm:text-lg font-black tracking-tight text-slate-900">
              {money(ticket.partRevenue ?? 0)} <span className="text-xs font-bold text-slate-500">đ</span>
            </b>
          </div>

          <div className="rounded-2xl border border-cyan-200/90 bg-gradient-to-b from-cyan-50/40 to-white p-3.5 shadow-2xs text-xs text-cyan-800 font-semibold">
            Tổng<br />
            <b className="mt-1.5 inline-block text-lg sm:text-xl font-black tracking-tight text-cyan-700">
              {money(ticket.totalAmount)} <span className="text-xs font-bold text-cyan-600">đ</span>
            </b>
          </div>

          <div className={`rounded-2xl border p-3.5 shadow-2xs text-xs font-semibold ${
            ticket.dueAmount > 0
              ? "border-rose-200/90 bg-gradient-to-b from-rose-50/40 to-white text-rose-800"
              : "border-emerald-200/90 bg-gradient-to-b from-emerald-50/40 to-white text-emerald-800"
          }`}>
            Còn nợ<br />
            <b className="mt-1.5 inline-block text-base sm:text-lg font-black tracking-tight">
              {ticket.dueAmount > 0 ? (
                <span className="text-rose-600">{money(ticket.dueAmount)} đ</span>
              ) : (
                <span className="text-emerald-600">0 đ (Đã tất toán)</span>
              )}
            </b>
          </div>
        </div>

        {ticket.status === "diagnosing" && (
          <div className="mt-4 space-y-3.5 rounded-2xl border border-cyan-200/90 bg-gradient-to-b from-cyan-50/50 to-white p-4 sm:p-5 shadow-2xs">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-cyan-100/90 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-600 text-white shadow-xs">
                  <Calculator className="h-4 w-4" />
                </span>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">
                    Nhập báo giá cho khách hàng
                  </h4>
                  <span className="text-[11px] text-slate-500 font-medium">Định dạng số rõ ràng: xx.xxx.xxx đ</span>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-full bg-cyan-100/80 px-2.5 py-0.5 text-xs font-semibold text-cyan-800 border border-cyan-200/60">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-600 animate-pulse" />
                Bước 2: Báo giá
              </span>
            </div>

            {/* 2-Column Grid for Amounts */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 text-xs">
                    Số tiền báo giá (VNĐ) <span className="text-rose-500">*</span>
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    aria-label="Số tiền báo giá"
                    value={quote}
                    onChange={(e) => handleCurrencyChange(e, setQuote)}
                    placeholder="VD: 500.000"
                    className="w-full rounded-xl border border-slate-300 bg-white pl-3.5 pr-8 py-2.5 text-sm font-bold text-slate-900 shadow-2xs focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none transition"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                    đ
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1 mt-0.5">
                  <span className="text-[10px] text-slate-400 font-medium">Cộng nhanh:</span>
                  {[
                    { label: "+50k", add: 50000 },
                    { label: "+100k", add: 100000 },
                    { label: "+200k", add: 200000 },
                    { label: "+500k", add: 500000 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setQuote(formatCurrencyInput(parseDigits(quote) + preset.add))}
                      className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold bg-white text-slate-600 border border-slate-200 hover:border-cyan-300 hover:bg-cyan-50/50 transition cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                  {parseDigits(quote) > 0 && (
                    <button
                      type="button"
                      onClick={() => setQuote("0")}
                      className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-rose-500 hover:bg-rose-50 transition cursor-pointer"
                    >
                      Xóa
                    </button>
                  )}
                </div>
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 text-xs">
                    Tiền công trong báo giá (VNĐ)
                  </span>
                </div>
                <div className="relative">
                  <input
                    aria-label="Tiền công trong báo giá"
                    type="text"
                    inputMode="numeric"
                    value={laborFee}
                    onChange={(e) => handleCurrencyChange(e, setLaborFee)}
                    placeholder="VD: 150.000"
                    className="w-full rounded-xl border border-slate-300 bg-white pl-3.5 pr-8 py-2.5 text-sm font-bold text-slate-900 shadow-2xs focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none transition"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                    đ
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1 mt-0.5">
                  <span className="text-[10px] text-slate-400 font-medium">Chọn công:</span>
                  {[
                    { label: "0đ (Free)", val: 0 },
                    { label: "50k", val: 50000 },
                    { label: "100k", val: 100000 },
                    { label: "150k", val: 150000 },
                    { label: "200k", val: 200000 },
                  ].map((preset) => (
                    <button
                      key={preset.val}
                      type="button"
                      onClick={() => setLaborFee(preset.val === 0 ? "0" : preset.val.toLocaleString("vi-VN"))}
                      className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold transition cursor-pointer border ${
                        laborFee !== "" && parseDigits(laborFee) === preset.val
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                          : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </label>
            </div>

            {/* Warning if labor fee exceeds quote */}
            {parseDigits(laborFee) > parseDigits(quote) && parseDigits(quote) > 0 && (
              <div className="rounded-xl bg-amber-50 border border-amber-200/90 px-3 py-2 text-xs text-amber-800 font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <span>Tiền công ({parseDigits(laborFee).toLocaleString("vi-VN")} đ) lớn hơn tổng số tiền báo giá ({parseDigits(quote).toLocaleString("vi-VN")} đ). Vui lòng kiểm tra lại.</span>
              </div>
            )}

            {/* Smart Parts Breakdown Pill */}
            {parseDigits(quote) > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-cyan-50/80 border border-cyan-200/70 px-3.5 py-2 text-xs">
                <span className="text-slate-600 font-medium">
                  • Linh kiện dự tính: <strong className="text-slate-900 font-bold">{Math.max(0, parseDigits(quote) - parseDigits(laborFee)).toLocaleString("vi-VN")} đ</strong>
                </span>
                <span className="text-slate-600 font-medium">
                  • Tiền công thợ: <strong className="text-indigo-900 font-bold">{parseDigits(laborFee).toLocaleString("vi-VN")} đ</strong>
                </span>
                <span className="text-cyan-800 font-bold">
                  Tổng thu khách: {parseDigits(quote).toLocaleString("vi-VN")} đ
                </span>
              </div>
            )}

            {/* Ghi chú báo giá with Quick Suggestion Chips */}
            <label className="flex flex-col gap-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 text-xs">
                  Ghi chú báo giá <span className="text-rose-500">*</span>
                </span>
                <span className="text-[11px] text-slate-400">Nội dung gửi cho khách hàng xem</span>
              </div>
              <textarea
                required
                aria-label="Ghi chú báo giá"
                value={quoteNote}
                onChange={(e) => setQuoteNote(e.target.value)}
                placeholder="VD: Thay màn hình OLED zin và cáp sạc, bảo hành 6 tháng..."
                className="min-h-20 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-2xs focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none transition leading-relaxed"
              />
            </label>

            {/* Quick Chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-400">Gợi ý nhanh:</span>
              {[
                "Thay màn hình OLED zin",
                "Thay pin chính hãng",
                "Ép kính màn hình",
                "Sửa nguồn / IC",
                "Vệ sinh & sấy máy",
                "Thay chân sạc",
                "BH 3 tháng",
                "BH 6 tháng",
              ].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setQuoteNote((prev) => (prev ? `${prev}, ${chip}` : chip))}
                  className="rounded-lg border border-slate-200/90 bg-white hover:border-cyan-400 hover:bg-cyan-50 hover:text-cyan-800 px-2 py-0.5 text-[11px] font-medium text-slate-600 transition shadow-2xs cursor-pointer"
                >
                  + {chip}
                </button>
              ))}
            </div>

            {/* Status notification */}
            {quoteSaved && (
              <p role="status" className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700 font-semibold shadow-2xs">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Đã lưu báo giá</span>
              </p>
            )}

            {/* Action button */}
            <div className="pt-1 flex items-center justify-between gap-3">
              <button
                disabled={busy || quoteSaved || !quoteNote.trim()}
                onClick={() => void saveQuote()}
                aria-label="Lưu báo giá"
                className="min-h-11 w-full rounded-xl bg-cyan-600 px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-xs transition hover:bg-cyan-700 disabled:opacity-50 sm:w-auto cursor-pointer flex items-center justify-center gap-2"
              >
                {quoteSavePending.current ? "Đang lưu..." : "Lưu báo giá"}
              </button>
              {!quoteNote.trim() && !quoteSaved && (
                <span className="text-xs text-amber-600 font-medium hidden sm:inline">
                  * Vui lòng nhập ghi chú báo giá để lưu
                </span>
              )}
            </div>
          </div>
        )}

        <RepairPaymentForm ticket={ticket} onPendingChange={setPaymentLocked} onComplete={() => { onChanged(); onClose(); }} />

        <div className="mt-5 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:flex-wrap">
          {ticket.status === "done" && (
            <button
              disabled={busy}
              onClick={() => void run(() => repairService.deliver(ticket._id))}
              className="min-h-11 w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 sm:w-auto"
            >
              Giao máy
            </button>
          )}
          {["received", "diagnosing", "quoted", "approved", "repairing"].includes(ticket.status) && (
            <>
              <input
                placeholder="Lý do hủy"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm sm:w-auto focus:border-rose-400 focus:outline-none"
              />
              <button
                disabled={busy || !reason.trim()}
                onClick={() => void run(() => repairService.cancel(ticket._id, reason))}
                className="min-h-11 w-full rounded-xl border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 sm:w-auto"
              >
                Hủy phiếu
              </button>
            </>
          )}
        </div>

        <RepairRefundForm
          ticket={ticket}
          onChanged={() => {
            onChanged();
            onClose();
          }}
        />
        <RepairTicketExtras ticket={ticket} onChanged={onChanged} />

        <div className="mt-5 border-t border-slate-100 pt-4">
          <h3 className="font-semibold text-slate-900">Lịch sử xử lý</h3>
          <div className="mt-2 space-y-1">
            {ticket.statusHistory?.map((entry, index) => (
              <p key={index} className="text-xs text-slate-500">
                {date(entry.at)} · {repairStatusLabel(entry.from)} → {repairStatusLabel(entry.to)} · {entry.byName}
                {entry.note ? ` · ${entry.note}` : ""}
              </p>
            ))}
          </div>
        </div>

        {errorAlert && (
          <div
            className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs animate-in fade-in duration-150"
            role="presentation"
            onClick={(e) => {
              if (e.target === e.currentTarget) setErrorAlert(null);
            }}
          >
            <div
              role="alertdialog"
              aria-modal="true"
              className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 text-center animate-in zoom-in-95 duration-150"
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 mb-3 ring-8 ring-rose-50">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1.5">Thông báo</h3>
              <p className="text-sm text-slate-600 mb-5 leading-relaxed">{errorAlert}</p>
              <button
                type="button"
                onClick={() => setErrorAlert(null)}
                autoFocus
                className="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
