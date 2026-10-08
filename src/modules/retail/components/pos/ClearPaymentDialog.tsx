import React from "react";
import {
  Banknote,
  Building2,
  Calendar,
  CheckCircle2,
  CreditCard,
  Plus,
  Receipt,
  Smartphone,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { buildPaymentSummary, type RetailPaymentMode } from "../../hooks/retailPayment";
import type { RetailInstallment, RetailPaymentInput } from "../../types";
import CurrencyInput from "./CurrencyInput";
import { Dropdown } from "../../../../components/common/Dropdown";
import { getApiErrorMessage } from "../../../../utils/errorMessage";

const money = (value: number) =>
  new Intl.NumberFormat("vi-VN").format(value) + " ₫";

type Props = {
  installment?: RetailInstallment | null;
  children?: React.ReactNode;
  total: number;
  busy: boolean;
  customerId?: string;
  onClose: () => void;
  onSubmit: (payments: RetailPaymentInput[], dueDate?: string) => Promise<void>;
};

const modes: Array<{
  value: RetailPaymentMode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tag: string;
}> = [
  {
    value: "full",
    label: "Thanh toán đủ",
    icon: CheckCircle2,
    tag: "100%",
  },
  {
    value: "partial",
    label: "Thanh toán một phần",
    icon: Wallet,
    tag: "Một phần",
  },
  {
    value: "debt",
    label: "Ghi nợ toàn bộ",
    icon: Calendar,
    tag: "Ghi nợ",
  },
];

const paymentMethodOptions = [
  {
    value: "cash",
    label: "Tiền mặt",
    icon: <Banknote className="h-4 w-4 text-emerald-600" />,
  },
  {
    value: "transfer",
    label: "Chuyển khoản",
    icon: <Building2 className="h-4 w-4 text-cyan-600" />,
  },
  {
    value: "card",
    label: "Thẻ POS",
    icon: <CreditCard className="h-4 w-4 text-blue-600" />,
  },
  {
    value: "ewallet",
    label: "Ví điện tử",
    icon: <Smartphone className="h-4 w-4 text-violet-600" />,
  },
];

export default function ClearPaymentDialog({
  total,
  busy,
  customerId,
  onClose,
  onSubmit,
  installment,
  children,
}: Props) {
  const fullCash = (): RetailPaymentInput[] => [
    { method: "cash", amount: total, tenderedAmount: total },
  ];
  const [mode, setMode] = React.useState<RetailPaymentMode>(installment ? (installment.prepayPercent === 0 ? "debt" : installment.prepayPercent === 100 ? "full" : "partial") : "full");
  const [payments, setPayments] = React.useState<RetailPaymentInput[]>(() => installment ? [{ method: "cash", amount: Math.round(total * installment.prepayPercent / 100), tenderedAmount: Math.round(total * installment.prepayPercent / 100) }] : fullCash());
  const [dueDate, setDueDate] = React.useState("");
  const [error, setError] = React.useState("");

  const submitted =
    mode === "debt" ? [] : payments.filter((item) => item.amount > 0);
  const collected = submitted.reduce(
    (sum, item) => sum + Math.max(0, item.amount || 0),
    0,
  );
  const summary = React.useMemo(() => {
    try {
      return buildPaymentSummary(total, submitted, {
        mode,
        customerId,
        dueDate,
      });
    } catch {
      return {
        collected,
        due: mode === "debt" ? total : Math.max(0, total - collected),
        change: 0,
      };
    }
  }, [total, payments, mode, customerId, dueDate]);

  const showAmountInput = mode === "partial" || payments.length > 1;

  React.useEffect(() => {
    if (mode === "full" && payments.length === 1 && payments[0].amount !== total) {
      setPayments((rows) => [
        {
          ...rows[0],
          amount: total,
          tenderedAmount:
            rows[0].method === "cash"
              ? (rows[0].tenderedAmount || total)
              : undefined,
        },
      ]);
    }
  }, [total, mode, payments.length]);

  const selectMode = (next: RetailPaymentMode) => {
    setMode(next);
    setError("");
    if (next === "full") setPayments(fullCash());
    else if (next !== "debt" && payments.length === 0) setPayments(fullCash());
  };

  const update = (index: number, patch: Partial<RetailPaymentInput>) =>
    setPayments((rows) => {
      if (patch.amount !== undefined && mode === "full" && rows.length > 1) {
        const newAmount = Math.max(0, patch.amount);
        const updated = rows.map((row, i) =>
          i === index ? { ...row, ...patch, amount: newAmount } : row,
        );

        // Adjust the companion row so the sum always equals total
        const targetIndex = index === rows.length - 1 ? 0 : rows.length - 1;
        const sumOthers = updated.reduce(
          (sum, row, i) => (i === targetIndex ? sum : sum + row.amount),
          0,
        );
        const targetAmount = Math.max(0, total - sumOthers);

        return updated.map((row, i) => {
          if (i === targetIndex) {
            const shouldSyncTendered =
              row.method === "cash" &&
              (row.tenderedAmount === undefined ||
                row.tenderedAmount === rows[targetIndex].amount);
            return {
              ...row,
              amount: targetAmount,
              tenderedAmount: shouldSyncTendered
                ? targetAmount
                : row.tenderedAmount,
            };
          }
          if (
            i === index &&
            row.method === "cash" &&
            (row.tenderedAmount === undefined ||
              row.tenderedAmount === rows[index].amount)
          ) {
            return {
              ...row,
              tenderedAmount: newAmount,
            };
          }
          return row;
        });
      }

      return rows.map((row, i) => (i === index ? { ...row, ...patch } : row));
    });

  const removePayment = (index: number) => {
    setPayments((rows) => {
      const next = rows.filter((_, i) => i !== index);
      if (mode === "full" && next.length > 0) {
        if (next.length === 1) {
          return [
            {
              ...next[0],
              amount: total,
              tenderedAmount:
                next[0].method === "cash" ? total : undefined,
            },
          ];
        }
        const sumOthers = next.slice(0, -1).reduce((s, r) => s + r.amount, 0);
        const last = next[next.length - 1];
        const lastAmount = Math.max(0, total - sumOthers);
        return [
          ...next.slice(0, -1),
          {
            ...last,
            amount: lastAmount,
            tenderedAmount:
              last.method === "cash" ? lastAmount : undefined,
          },
        ];
      }
      return next;
    });
  };

  const submit = async () => {
    try {
      buildPaymentSummary(total, submitted, { mode, customerId, dueDate });
      setError("");
      await onSubmit(submitted, mode === "full" ? undefined : dueDate || undefined);
    } catch (cause) {
      setError(getApiErrorMessage(cause, "Thanh toán không hợp lệ."));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-x-hidden bg-slate-950/60 backdrop-blur-xs p-0 sm:items-center sm:p-4 animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-label="Thanh toán"
        className="max-h-[95vh] w-full min-w-0 max-w-2xl overflow-x-hidden overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6 text-slate-800"
      >
        {/* Header */}
        <div className="flex min-w-0 items-start justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700 shadow-2xs">
                <Receipt className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Thanh toán
              </h2>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Cần thu</span>
              <span className="font-mono text-base font-black text-cyan-700 bg-cyan-50 px-2.5 py-0.5 rounded-lg border border-cyan-200/80">
                {money(total)}
              </span>
            </div>
          </div>

          <button
            type="button"
            aria-label="Đóng"
            className="rounded-xl p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer shrink-0"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {children}
        {installment && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm">{installment.partner} · {installment.months} tháng · Trả trước {installment.prepayPercent}%. Phần còn lại chờ đối tác thanh toán cho cửa hàng.</p>}
        {/* 3 Payment Modes Segmented Controls */}
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/80">
          {(installment ? modes.filter((item) => item.value === mode) : modes).map((item) => {
            const Icon = item.icon;
            const isSelected = mode === item.value;
            return (
              <button
                key={item.value}
                type="button"
                aria-pressed={isSelected}
                className={`min-w-0 flex items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-bold transition cursor-pointer select-none ${
                  isSelected
                    ? "bg-white text-cyan-800 shadow-sm border border-slate-200/80"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                }`}
                onClick={() => selectMode(item.value)}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    isSelected ? "text-cyan-600" : "text-slate-400"
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Sources List (when not full debt) */}
        {mode !== "debt" && (
          <div className="mt-4 space-y-3">
            {payments.map((payment, index) => (
              <section
                data-testid={`payment-source-${index + 1}`}
                key={index}
                className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-2xs hover:border-slate-300 transition"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-white border border-slate-200 px-2.5 py-0.5 text-xs font-bold text-slate-700 shadow-2xs">
                      Nguồn tiền {index + 1}
                    </span>
                  </div>

                  <button
                    type="button"
                    aria-label={`Xóa phương thức ${index + 1}`}
                    disabled={payments.length === 1}
                    onClick={() => removePayment(index)}
                    className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Xóa nguồn tiền này"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div
                  className={`grid min-w-0 grid-cols-1 gap-3 ${
                    showAmountInput ? "sm:grid-cols-3" : "sm:grid-cols-2"
                  }`}
                >
                  {/* Column 1: Payment Method */}
                  <div className="min-w-0">
                    <div className="h-9 flex flex-col justify-start overflow-hidden">
                      <label className="block text-xs font-bold text-slate-700 truncate">
                        Phương thức thanh toán
                      </label>
                      <span
                        className="mt-0.5 block text-[11px] font-normal text-slate-400 truncate"
                        title="Hình thức nhận từ khách."
                      >
                        Hình thức nhận từ khách.
                      </span>
                    </div>
                    <div className="relative mt-1.5 block min-w-0">
                      <Dropdown<string>
                        name={`paymentMethod_${index}`}
                        aria-label="Phương thức thanh toán"
                        value={payment.method}
                        onChange={(methodVal) => {
                          const nextMethod =
                            methodVal as RetailPaymentInput["method"];
                          update(index, {
                            method: nextMethod,
                            amount: !showAmountInput ? total : payment.amount,
                            tenderedAmount:
                              nextMethod === "cash"
                                ? (!showAmountInput ? total : payment.amount)
                                : undefined,
                          });
                        }}
                        options={paymentMethodOptions}
                        variant="form"
                        size="sm"
                        className="w-full"
                        triggerClassName="w-full h-11 bg-white border-slate-200 text-slate-800 font-semibold shadow-2xs hover:border-slate-300 px-3.5"
                      />
                    </div>
                  </div>

                  {/* Column 2: Collected Amount (Only in partial debt mode or multi-tender) */}
                  {showAmountInput && (
                    <div className="min-w-0">
                      <CurrencyInput
                        label="Số tiền thu"
                        description="Khoản được ghi nhận vào đơn."
                        value={payment.amount}
                        onChange={(amount) => update(index, { amount })}
                      />
                    </div>
                  )}

                  {/* Column 2 or 3: Tendered Amount or Reference Code */}
                  <div className="min-w-0">
                    {payment.method === "cash" ? (
                      <CurrencyInput
                        label="Tiền khách đưa"
                        description="Dùng để tính tiền trả lại."
                        value={
                          payment.tenderedAmount ??
                          (!showAmountInput ? total : payment.amount)
                        }
                        onChange={(tenderedAmount) =>
                          update(index, {
                            tenderedAmount,
                            ...(!showAmountInput ? { amount: total } : {}),
                          })
                        }
                      />
                    ) : (
                      <label className="block min-w-0">
                        <div className="h-9 flex flex-col justify-start overflow-hidden">
                          <span className="block text-xs font-bold text-slate-700 truncate">
                            Mã giao dịch
                          </span>
                          <span
                            className="mt-0.5 block text-[11px] font-normal text-slate-400 truncate"
                            title="Mã tham chiếu hoặc số chuẩn chi POS."
                          >
                            Mã tham chiếu / số POS.
                          </span>
                        </div>
                        <span className="relative mt-1.5 block min-w-0">
                          <input
                            aria-label="Mã giao dịch"
                            className="w-full h-11 min-w-0 rounded-xl border border-slate-200 bg-white px-3.5 pr-3 font-mono text-sm font-semibold text-slate-900 shadow-2xs hover:border-slate-300 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition"
                            placeholder="Nhập mã tham chiếu..."
                            value={payment.reference || ""}
                            onChange={(event) =>
                              update(index, { reference: event.target.value })
                            }
                          />
                        </span>
                      </label>
                    )}
                  </div>
                </div>

                {/* Quick cash denomination chips in dedicated balanced row */}
                {payment.method === "cash" && (
                  <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-semibold text-slate-500 mr-1">
                      Gợi ý tiền khách đưa:
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        update(index, {
                          tenderedAmount: !showAmountInput
                            ? total
                            : payment.amount,
                        })
                      }
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-cyan-700 transition cursor-pointer shadow-2xs"
                    >
                      Đủ tiền
                    </button>
                    {[50_000, 100_000, 200_000, 500_000].map((step) => {
                      const effectiveAmount = !showAmountInput
                        ? total
                        : payment.amount;
                      const rounded =
                        Math.ceil(effectiveAmount / step) * step;
                      if (rounded <= effectiveAmount) return null;
                      return (
                        <button
                          key={step}
                          type="button"
                          onClick={() =>
                            update(index, { tenderedAmount: rounded })
                          }
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-cyan-700 transition cursor-pointer shadow-2xs"
                        >
                          {money(rounded)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            ))}

            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-slate-300 hover:border-cyan-500 bg-white hover:bg-cyan-50/50 px-3.5 py-2 text-xs font-bold text-slate-700 hover:text-cyan-700 shadow-2xs transition cursor-pointer"
              onClick={() =>
                setPayments((rows) => [
                  ...rows,
                  {
                    method: "transfer",
                    amount: Math.max(
                      0,
                      total -
                        rows.reduce(
                          (sum, row) => sum + row.amount,
                          0,
                        ),
                    ),
                  },
                ])
              }
            >
              <Plus className="h-4 w-4 shrink-0 text-cyan-600" />
              <span>Thêm phương thức</span>
            </button>
          </div>
        )}

        {/* 3 Summary Cards */}
        <div
          data-testid="payment-summary"
          className="mt-4 grid grid-cols-1 gap-2.5 text-sm sm:grid-cols-3"
        >
          <div className="min-w-0 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3.5 shadow-2xs">
            <p className="break-words text-xs font-bold text-emerald-800">Đã thu</p>
            <p className="break-words text-lg sm:text-xl font-black font-mono text-emerald-700 mt-0.5">
              {money(summary.collected)}
            </p>
          </div>

          <div
            className={`min-w-0 rounded-2xl border p-3.5 shadow-2xs ${
              summary.due > 0
                ? "border-amber-300 bg-amber-50/70 text-amber-900"
                : "border-slate-200 bg-slate-50 text-slate-700"
            }`}
          >
            <p
              className={`break-words text-xs font-bold ${
                summary.due > 0 ? "text-amber-800" : "text-slate-500"
              }`}
            >
              {installment ? "Khoản đối tác tài trợ" : "Công nợ phát sinh"}
            </p>
            <p
              className={`break-words text-lg sm:text-xl font-black font-mono mt-0.5 ${
                summary.due > 0 ? "text-amber-700" : "text-slate-800"
              }`}
            >
              {money(summary.due)}
            </p>
          </div>

          <div
            className={`min-w-0 rounded-2xl border p-3.5 shadow-2xs ${
              summary.change > 0
                ? "border-cyan-300 bg-cyan-50/80 text-cyan-900"
                : "border-slate-200 bg-slate-50 text-slate-700"
            }`}
          >
            <p
              className={`break-words text-xs font-bold ${
                summary.change > 0 ? "text-cyan-800" : "text-slate-500"
              }`}
            >
              Tiền thừa
            </p>
            <p
              className={`break-words text-lg sm:text-xl font-black font-mono mt-0.5 ${
                summary.change > 0 ? "text-cyan-700" : "text-slate-800"
              }`}
            >
              {money(summary.change)}
            </p>
          </div>
        </div>

        {/* Due Date & Debt Notification (when mode !== "full") */}
        {mode !== "full" && (
          <div className="mt-4 min-w-0 rounded-2xl border border-amber-200 bg-amber-50/60 p-3.5 space-y-2">
            {!customerId && (
              <p className="text-xs font-bold text-amber-800">
                ⚠️ Khách hàng chưa được chọn. Hãy chọn khách hàng trên giỏ hàng để ghi nhận công nợ.
              </p>
            )}
            <label className="block text-xs font-bold text-slate-700">
              <span>{installment ? "Hạn đối tác thanh toán" : "Hạn thanh toán công nợ"}</span>
              <span className="mt-0.5 block text-[11px] font-normal text-slate-500">
                Ngày khách hàng cần thanh toán phần công nợ còn lại.
              </span>
              <span className="relative mt-1.5 block min-w-0">
                <input
                  aria-label={installment ? "Hạn đối tác thanh toán" : "Hạn thanh toán công nợ"}
                  type="date"
                  className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-800 shadow-2xs hover:border-slate-300 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                />
              </span>
            </label>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div
            role="alert"
            className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700"
          >
            {error}
          </div>
        )}

        {/* Big Submit Button */}
        <button
          type="button"
          disabled={busy}
          className="mt-5 w-full min-w-0 rounded-2xl bg-cyan-600 hover:bg-cyan-700 active:scale-[0.99] py-3.5 text-base font-extrabold text-white shadow-lg shadow-cyan-600/20 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          onClick={() => void submit()}
        >
          <CheckCircle2 className="h-5 w-5" />
          <span>Xác nhận thanh toán</span>
        </button>
      </div>
    </div>
  );
}
