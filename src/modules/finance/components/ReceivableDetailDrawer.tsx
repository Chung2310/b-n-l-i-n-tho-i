import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ArrowDownLeft, ArrowUpRight, Calendar, CheckCircle2, Clock, ExternalLink, History, X } from "lucide-react";
import {
  financeReceivablesApi,
  type ReceivableDetail,
  type ReceivableEntry,
} from "../api/financeReceivables.api";

const money = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const permitted = (permissions: readonly string[], code: string) =>
  permissions.includes("*") || permissions.includes(code);

function CommandField({ label, description, children }: { label: string; description?: string; children: ReactNode }) {
  return (
    <label className="block text-xs font-semibold text-slate-700">
      <span>{label}</span>
      {description && <span className="mt-0.5 block text-[11px] font-normal text-slate-500">{description}</span>}
      {children}
    </label>
  );
}

function VndCommandInput({
  label,
  value,
  onChange,
  max,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  max?: number;
}) {
  return (
    <CommandField label={label}>
      <input
        required
        aria-label={label}
        name="amount"
        type="text"
        inputMode="numeric"
        min={1}
        max={max}
        value={value ? new Intl.NumberFormat("vi-VN").format(value) : ""}
        onChange={(event) => onChange(Number(event.target.value.replace(/\D/g, "")))}
        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
        placeholder="0 ₫"
      />
    </CommandField>
  );
}

export default function ReceivableDetailDrawer({
  id,
  permissions,
  onClose,
  onChanged,
}: {
  id: string;
  permissions: readonly string[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<ReceivableDetail>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [collectAmount, setCollectAmount] = useState(0);
  const [adjustmentAmount, setAdjustmentAmount] = useState(0);

  const load = async () => {
    try {
      setDetail(await financeReceivablesApi.detail(id));
      setError("");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không tải được chi tiết.",
      );
    }
  };

  useEffect(() => {
    void load();
  }, [id]);

  const mutate = async (command: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await command();
      await load();
      onChanged();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Không thể cập nhật công nợ.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (!detail)
    return (
      <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-xs">
        <aside className="w-full max-w-2xl border-l border-slate-200 bg-white p-8 shadow-2xl">
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-cyan-200 border-t-cyan-600" />
              <p className="mt-4 text-sm font-semibold text-slate-600">{error || "Đang tải chi tiết công nợ..."}</p>
            </div>
          </div>
        </aside>
      </div>
    );

  const { receivable, entries } = detail;
  const canCollect = permitted(permissions, "finance-receivable:manage");
  const canAdjust = permitted(permissions, "finance-receivable:manage");
  const isActive = receivable.status === "open" || receivable.status === "partially_paid";
  const minimumExtensionDate = new Date(receivable.dueDate);
  minimumExtensionDate.setUTCDate(minimumExtensionDate.getUTCDate() + 1);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-xs">
      <aside
        aria-label="Chi tiết công nợ"
        className="flex h-full w-full max-w-2xl flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="border-b border-slate-200/80 bg-slate-50/75 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-bold text-cyan-800">
                  {receivable.receivableCode}
                </span>
                {receivable.status === "settled" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" /> Đã tất toán
                  </span>
                ) : receivable.daysOverdue > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                    <Clock className="h-3 w-3" /> Quá hạn {receivable.daysOverdue} ngày
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                    Đang mở
                  </span>
                )}
              </div>
              <h2 className="mt-2 text-xl font-bold text-slate-900">{receivable.customerName}</h2>
              {receivable.sourceCode && (
                <a
                  href={`/ban-le?sub=don-hang&orderId=${encodeURIComponent(receivable.sourceId || "")}`}
                  className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-700 hover:text-cyan-800 hover:underline"
                >
                  {receivable.sourceCode}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>

            <button
              type="button"
              aria-label="Đóng chi tiết"
              onClick={onClose}
              className="rounded-xl border border-slate-200 p-2 text-slate-400 transition-colors hover:bg-white hover:text-slate-700 hover:shadow-xs"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* 4 Financial Stat Cards */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Phát sinh</p>
              <p className="mt-1 text-sm font-bold text-slate-800">{money.format(receivable.originalAmount)}</p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-3.5 shadow-2xs">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Đã thu</p>
              <p className="mt-1 text-sm font-bold text-emerald-700">{money.format(receivable.paidAmount)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Điều chỉnh</p>
              <p className="mt-1 text-sm font-bold text-slate-800">{money.format(receivable.adjustedAmount)}</p>
            </div>
            <div className="rounded-2xl border border-cyan-200 bg-cyan-50/70 p-3.5 shadow-2xs">
              <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-800">Còn nợ</p>
              <p className="mt-1 text-sm font-bold text-cyan-800">{money.format(receivable.balance)}</p>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          {/* Actions Forms */}
          {(canCollect || canAdjust) && isActive && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Thao tác công nợ</h3>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Form Thu tiền */}
                {canCollect && receivable.balance > 0 && (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (collectAmount < 1 || collectAmount > receivable.balance) {
                        setError("Số tiền thu phải lớn hơn 0 và không vượt quá số dư công nợ.");
                        return;
                      }
                      const form = new FormData(event.currentTarget);
                      void mutate(() =>
                        financeReceivablesApi.collect(id, {
                          amount: collectAmount,
                          paymentMethod: "transfer",
                          reference: String(form.get("reference") || ""),
                          idempotencyKey: crypto.randomUUID(),
                        }),
                      );
                    }}
                    className="flex flex-col justify-between rounded-2xl border border-cyan-200/80 bg-cyan-50/30 p-4 shadow-xs"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-cyan-800">
                        <ArrowDownLeft className="h-4 w-4" />
                        <h4 className="font-bold">Thu tiền</h4>
                      </div>
                      <VndCommandInput label="Số tiền thu" value={collectAmount} onChange={setCollectAmount} max={receivable.balance} />
                      <CommandField label="Mã tham chiếu" description="Không bắt buộc, dùng để đối soát giao dịch.">
                        <input
                          aria-label="Mã tham chiếu"
                          name="reference"
                          placeholder="VD: UNC123456"
                          className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                        />
                      </CommandField>
                    </div>
                    <button
                      disabled={busy}
                      className="mt-4 w-full rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 py-2.5 text-xs font-bold text-white shadow-sm shadow-cyan-600/20 transition-all hover:shadow-md disabled:opacity-50"
                    >
                      {busy ? "Đang xử lý..." : "Thu tiền"}
                    </button>
                  </form>
                )}

                {/* Form Điều chỉnh */}
                {canAdjust && (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      const form = new FormData(event.currentTarget);
                      void mutate(() =>
                        financeReceivablesApi.adjust(id, {
                          amount: adjustmentAmount,
                          direction: String(form.get("direction")) as
                            "increase" | "decrease",
                          reason: String(form.get("reason")),
                          idempotencyKey: crypto.randomUUID(),
                        }),
                      );
                    }}
                    className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-slate-800">
                        <ArrowUpRight className="h-4 w-4" />
                        <h4 className="font-bold">Điều chỉnh</h4>
                      </div>
                      <VndCommandInput label="Số tiền điều chỉnh" value={adjustmentAmount} onChange={setAdjustmentAmount} />
                      <CommandField label="Hướng điều chỉnh">
                        <select
                          aria-label="Hướng điều chỉnh"
                          name="direction"
                          className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-900 outline-none transition-all focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                        >
                          <option value="increase">Tăng nợ</option>
                          <option value="decrease">Giảm nợ</option>
                        </select>
                      </CommandField>
                      <CommandField label="Lý do điều chỉnh">
                        <input
                          required
                          aria-label="Lý do điều chỉnh"
                          name="reason"
                          placeholder="Lý do điều chỉnh số dư..."
                          className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                        />
                      </CommandField>
                    </div>
                    <button
                      disabled={busy}
                      className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-xs font-bold text-slate-700 transition-all hover:bg-slate-100 disabled:opacity-50"
                    >
                      {busy ? "Đang xử lý..." : "Điều chỉnh"}
                    </button>
                  </form>
                )}

                {/* Form Gia hạn công nợ */}
                {canAdjust && (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      const form = new FormData(event.currentTarget);
                      void mutate(() =>
                        financeReceivablesApi.extend(id, {
                          dueDate: new Date(
                            `${form.get("dueDate")}T23:59:59.999Z`,
                          ).toISOString(),
                          reason: String(form.get("reason")),
                          idempotencyKey: crypto.randomUUID(),
                        }),
                      );
                    }}
                    className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs sm:col-span-2"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-slate-800">
                        <Calendar className="h-4 w-4" />
                        <h4 className="font-bold">Gia hạn công nợ</h4>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <CommandField label="Gia hạn đến ngày">
                          <input
                            required
                            aria-label="Gia hạn đến ngày"
                            name="dueDate"
                            type="date"
                            min={minimumExtensionDate.toISOString().slice(0, 10)}
                            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-900 outline-none transition-all focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                          />
                        </CommandField>
                        <CommandField label="Lý do gia hạn">
                          <input
                            required
                            aria-label="Lý do gia hạn"
                            name="reason"
                            placeholder="Lý do gia hạn thanh toán..."
                            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                          />
                        </CommandField>
                      </div>
                    </div>
                    <button
                      disabled={busy}
                      className="mt-4 rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-xs font-bold text-slate-700 transition-all hover:bg-slate-100 disabled:opacity-50"
                    >
                      {busy ? "Đang xử lý..." : "Gia hạn công nợ"}
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* Sổ chi tiết bất biến (Immutable Audit Ledger) */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-slate-500" />
              <h3 className="font-bold text-slate-900">Sổ chi tiết bất biến</h3>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                {entries.length} bút toán
              </span>
            </div>

            <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200/80 bg-white shadow-xs">
              {[...entries].reverse().map((entry) => (
                <LedgerRow
                  key={entry._id}
                  entry={entry}
                  canReverse={canAdjust && (isActive || receivable.status === "settled" && entry.type === "payment") && !entries.some(e => e.reversalOfEntryId === entry._id)}
                  onReverse={(reason) =>
                    mutate(() => financeReceivablesApi.reverse(id, entry._id, reason))
                  }
                />
              ))}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function LedgerRow({
  entry,
  canReverse,
  onReverse,
}: {
  entry: ReceivableEntry;
  canReverse: boolean;
  onReverse: (reason: string) => void;
}) {
  const entryLabel = (() => {
    if (entry.type === "adjustment") return entry.amount >= 0 ? "Điều chỉnh tăng" : "Điều chỉnh giảm";
    return {
      charge: "Phát sinh công nợ",
      payment: "Thu tiền",
      refund: "Hoàn tiền",
      write_off: "Xóa nợ",
      reversal: "Đảo bút toán",
      due_date_extension: "Gia hạn công nợ",
    }[entry.type] || entry.type;
  })();

  const extensionDates = entry.previousDueDate && entry.newDueDate
    ? `${new Date(entry.previousDueDate).toLocaleDateString("vi-VN")} → ${new Date(entry.newDueDate).toLocaleDateString("vi-VN")}`
    : "";

  return (
    <div className="flex flex-col gap-3 p-4 transition-colors hover:bg-slate-50/50 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-900">
            {entryLabel}
          </span>
          <span className="text-slate-400">·</span>
          <span className="font-bold text-cyan-700">
            {entry.type === "due_date_extension" ? (extensionDates || "—") : money.format(entry.amount)}
          </span>
        </div>
        <p className="text-xs text-slate-500">
          {entry.reason || "Không có lý do"} ·{" "}
          {new Date(entry.createdAt).toLocaleString("vi-VN")} · {entry.createdByName || "Hệ thống"}
        </p>
      </div>

      {canReverse && entry.type !== "reversal" && entry.type !== "due_date_extension" && !entry.reversalOfEntryId && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onReverse(String(new FormData(event.currentTarget).get("reason")));
          }}
          className="flex flex-wrap items-end gap-2 pt-2 sm:pt-0"
        >
          <CommandField label="Lý do đảo bút toán" description="Được lưu vào lịch sử kiểm toán.">
            <input
              required
              name="reason"
              aria-label="Lý do đảo bút toán"
              placeholder="Nhập lý do đảo..."
              className="mt-1 w-44 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none transition-all placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10"
            />
          </CommandField>
          <button
            type="submit"
            className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 transition-colors hover:bg-amber-100 hover:text-amber-800"
            aria-label={`Đảo bút toán ${entry._id}`}
          >
            Đảo bút toán
          </button>
        </form>
      )}
    </div>
  );
}
