import React from "react";
import { apiFetch } from "../shared/lib/apiFetch";
import { AlertCircle, RotateCcw } from "lucide-react";

export default function RepairRefundForm({
  ticket,
  onChanged,
}: {
  ticket: any;
  onChanged: () => void;
}) {
  const [amount, setAmount] = React.useState("");
  const [laborAmount, setLaborAmount] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [reference, setReference] = React.useState("");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const key = React.useRef(crypto.randomUUID());

  const submit = async () => {
    if (
      !window.confirm(
        "Xác nhận đã hoàn tiền cho khách theo chứng từ này? Hoa hồng CTV sẽ được điều chỉnh tương ứng."
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await apiFetch(`/repair/tickets/${ticket._id}/refunds`, {
        method: "POST",
        body: JSON.stringify({
          amount: Number(amount),
          laborAmount: Number(laborAmount),
          reason,
          reference,
          idempotencyKey: key.current,
        }),
      });
      key.current = crypto.randomUUID();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/30">
      <div className="flex items-center gap-2">
        <RotateCcw className="h-4 w-4 text-rose-600 dark:text-rose-400" />
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
          Hoàn tiền sửa chữa (Điều chỉnh hoa hồng)
        </h3>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Nhập tổng tiền đã hoàn và phần tiền công trong khoản hoàn để thu hồi đúng hoa hồng CTV.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          Tổng tiền hoàn (VND)
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-900 outline-none focus:border-rose-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            type="number"
            min="0"
            placeholder="0"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              key.current = crypto.randomUUID();
            }}
          />
        </label>

        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          Trong đó tiền công (VND)
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-900 outline-none focus:border-rose-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            type="number"
            min="0"
            placeholder="0"
            value={laborAmount}
            onChange={(e) => {
              setLaborAmount(e.target.value);
              key.current = crypto.randomUUID();
            }}
          />
        </label>

        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          Lý do hoàn tiền
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-900 outline-none focus:border-rose-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            type="text"
            placeholder="VD: Không sửa được, khách đổi ý..."
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              key.current = crypto.randomUUID();
            }}
          />
        </label>

        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          Chứng từ hoàn tiền
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-900 outline-none focus:border-rose-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            type="text"
            placeholder="Mã phiếu chi, UNC ngân hàng..."
            value={reference}
            onChange={(e) => {
              setReference(e.target.value);
              key.current = crypto.randomUUID();
            }}
          />
        </label>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex justify-end pt-1">
        <button
          type="button"
          disabled={busy || !amount || laborAmount === "" || !reason.trim() || !reference.trim()}
          onClick={() => void submit()}
          className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-500 disabled:opacity-40 transition cursor-pointer"
        >
          {busy ? "Đang ghi nhận..." : "Ghi nhận đã hoàn tiền"}
        </button>
      </div>

      {(ticket.commissionRefunds || []).length > 0 && (
        <div className="border-t border-slate-200/80 pt-2 dark:border-slate-700/80 space-y-1">
          <p className="text-[11px] font-semibold text-slate-500">Lịch sử hoàn tiền:</p>
          {(ticket.commissionRefunds || []).map((r: any) => (
            <p key={r.key} className="text-xs text-slate-600 dark:text-slate-400">
              {new Date(r.at).toLocaleDateString("vi-VN")} ·{" "}
              <b className="text-rose-600 dark:text-rose-400">
                {r.amount.toLocaleString("vi-VN")}đ
              </b>{" "}
              · {r.reason} · <span className="font-mono text-[11px]">{r.reference}</span>
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
