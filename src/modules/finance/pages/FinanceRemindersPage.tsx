import { useEffect, useState } from "react";
import { AlertCircle, BellRing, CheckCircle2, Clock, Loader2, Play, RefreshCw, Send, Smartphone } from "lucide-react";
import {
  financeRemindersApi,
  type ReminderRun,
  type ReminderRunDetail,
} from "../api/financeReminders.api";

const permitted = (permissions: readonly string[]) =>
  permissions.includes("*") || permissions.includes("finance-receivable:manage");

export default function FinanceRemindersPage({
  permissions,
}: {
  permissions: readonly string[];
}) {
  const [runs, setRuns] = useState<ReminderRun[]>([]);
  const [selected, setSelected] = useState<ReminderRunDetail>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canAdjust = permitted(permissions);

  const load = async () => {
    try {
      setRuns(await financeRemindersApi.listRuns());
      setError("");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Không tải được lịch sử nhắc nợ.",
      );
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const open = async (id: string) => {
    try {
      setSelected(await financeRemindersApi.getRun(id));
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không tải được delivery.",
      );
    }
  };

  const runNow = async () => {
    setBusy(true);
    try {
      await financeRemindersApi.runNow();
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không chạy được nhắc nợ.",
      );
    } finally {
      setBusy(false);
    }
  };

  const retry = async (id: string) => {
    setBusy(true);
    try {
      await financeRemindersApi.retry(id);
      if (selected) await open(selected._id);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không retry được delivery.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-600/20">
            <BellRing className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">Nhắc nợ quá hạn</h1>
              <span className="rounded-full bg-cyan-50 px-2.5 py-0.5 text-xs font-semibold text-cyan-700">
                {runs.length} đợt quét
              </span>
            </div>
            <p className="text-sm text-slate-500">
              Lịch sử quét nợ tự động & thủ công, kết quả gửi qua các kênh và gửi lại khi lỗi.
            </p>
          </div>
        </div>

        {canAdjust && (
          <button
            type="button"
            onClick={runNow}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm shadow-cyan-600/25 transition-all hover:shadow-md disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Chạy nhắc nợ
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {/* Runs Table / List */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs">
        <div className="border-b border-slate-200/80 bg-slate-50/75 px-6 py-4">
          <h2 className="text-sm font-bold text-slate-800">Lịch sử các đợt nhắc nợ</h2>
        </div>

        <div className="divide-y divide-slate-100">
          {runs.map((run) => (
            <button
              key={run._id}
              type="button"
              aria-label={`${run.businessDate} ${run.trigger}`}
              onClick={() => void open(run._id)}
              className="grid w-full grid-cols-2 items-center gap-3 p-5 text-left text-sm transition-colors hover:bg-cyan-50/40 sm:grid-cols-6"
            >
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block sm:hidden">Ngày kinh doanh</span>
                <b className="font-bold text-slate-900">{run.businessDate}</b>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block sm:hidden">Kích hoạt</span>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  run.trigger === "manual" ? "bg-amber-50 text-amber-700 border border-amber-200/60" : "bg-cyan-50 text-cyan-700 border border-cyan-200/60"
                }`}>
                  {run.trigger === "manual" ? "Thủ công" : "Tự động"}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block sm:hidden">Trạng thái</span>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700">
                  <span className={`h-2 w-2 rounded-full ${run.status === "completed" ? "bg-emerald-500" : "bg-cyan-500"}`} />
                  {run.status === "completed" ? "Hoàn thành" : run.status}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block sm:hidden">Đủ điều kiện</span>
                <span className="font-semibold text-slate-700">Đủ: {run.eligible}</span>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block sm:hidden">Đang đợi</span>
                <span className="font-medium text-slate-500">Đợi: {run.queued}</span>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block sm:hidden">Lỗi</span>
                <span className={`font-bold ${run.failed > 0 ? "text-red-600" : "text-slate-400"}`}>
                  Lỗi: {run.failed}
                </span>
              </div>
            </button>
          ))}

          {!runs.length && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <BellRing className="h-6 w-6" />
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-700">Chưa có lượt nhắc nợ nào.</p>
              <p className="mt-1 text-xs text-slate-400">Nhấn nút "Chạy nhắc nợ" để quét các khoản công nợ cần gửi tin.</p>
            </div>
          )}
        </div>
      </div>

      {/* Selected Run Delivery Details */}
      {selected && (
        <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-200/80 bg-slate-50/75 p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-cyan-100 p-2 text-cyan-700">
                <Send className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Delivery ngày {selected.businessDate}
                </h2>
                <p className="text-xs text-slate-500">
                  Chi tiết từng lượt gửi thông báo và trạng thái kết nối cổng tin nhắn
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelected(undefined)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-900"
            >
              Đóng chi tiết
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {selected.deliveries.map((delivery) => (
              <div
                key={delivery._id}
                className="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 capitalize">
                      {delivery.channel}
                    </span>
                    <span className="text-slate-300">·</span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                      delivery.status === "failed" ? "bg-red-50 text-red-700 border border-red-200/60" : "bg-emerald-50 text-emerald-700"
                    }`}>
                      {delivery.status}
                    </span>
                    <span className="text-xs text-slate-400">
                      Lần {delivery.attempt}/{delivery.maxAttempts}
                    </span>
                  </div>

                  {delivery.error && (
                    <p className="text-xs font-medium text-red-600">
                      {delivery.error}
                    </p>
                  )}
                </div>

                {canAdjust && delivery.status === "failed" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void retry(delivery._id)}
                    aria-label={`Retry ${delivery._id}`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-2 text-xs font-bold text-cyan-700 transition-colors hover:bg-cyan-100 disabled:opacity-50"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Retry
                  </button>
                )}
              </div>
            ))}

            {!selected.deliveries.length && (
              <p className="p-8 text-center text-sm text-slate-500">
                Không có delivery nào trong đợt quét này.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
