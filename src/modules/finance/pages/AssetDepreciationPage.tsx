import { exportCsv } from "../components/ManagementUI";
import { useEffect, useState } from "react";
import { AlertCircle, Calendar, CheckCircle2, FileSpreadsheet, Loader2, Sparkles, TrendingDown } from "lucide-react";
import { financeAssetsApi, type AssetDepreciation } from "../api/financeAssets.api";
import { canManageAssets } from "./FixedAssetsPage";

const vnd = (value: number) => value.toLocaleString("vi-VN");
const message = (reason: unknown, fallback: string) =>
  reason instanceof Error ? reason.message : fallback;

function currentPeriod() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default function AssetDepreciationPage({
  permissions,
}: {
  permissions: readonly string[];
}) {
  const [period, setPeriod] = useState(currentPeriod);
  const [lines, setLines] = useState<AssetDepreciation[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [notice, setNotice] = useState("");
  const canManage = canManageAssets(permissions);
  const total = lines.reduce((sum, line) => sum + line.amount, 0);
  const posted = lines.length > 0 && lines.every((line) => line.status === "posted");

  const load = async (target = period) => {
    try {
      setLines(await financeAssetsApi.listDepreciations(target));
      setError("");
    } catch (reason) {
      setError(message(reason, "Không tải được kỳ khấu hao."));
    }
  };

  useEffect(() => {
    void load(period);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const act = async (action: "run" | "post") => {
    setBusy(true);
    setNotice("");
    try {
      const result = action === "run"
        ? await financeAssetsApi.runDepreciation(period)
        : await financeAssetsApi.postDepreciation(period);
      setNotice(
        action === "run"
          ? `Đã lập kế hoạch ${(result as { planned: number }).planned} dòng.`
          : `Đã ghi sổ ${(result as { posted: number }).posted} dòng.`,
      );
      await load(period);
    } catch (reason) {
      setError(message(reason, "Không thực hiện được thao tác khấu hao."));
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
            <TrendingDown className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">Khấu hao tài sản</h1>
              <span className="rounded-full bg-cyan-50 px-2.5 py-0.5 text-xs font-semibold text-cyan-700">
                Kỳ {period}
              </span>
            </div>
            <p className="text-sm text-slate-500">
              Lập kế hoạch theo kỳ, soát lại rồi ghi sổ.
            </p>
          </div>
        </div>

        {/* Toolbar Period and Actions */}
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-semibold text-slate-700">
            <span>Kỳ</span>
            <input
              type="month"
              aria-label="Kỳ khấu hao"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              className="mt-1 block rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-900 outline-none transition-all focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
            />
          </label>

          {canManage && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void act("run")}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition-all hover:bg-slate-50 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Lập kế hoạch
              </button>

              <button
                type="button"
                disabled={busy || posted || !lines.length}
                onClick={() => void act("post")}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm shadow-cyan-600/20 transition-all hover:shadow-md disabled:opacity-50"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Ghi sổ
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {notice && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
          {notice}
        </div>
      )}

      {/* Overview Card */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-slate-50/75 px-6 py-4 text-sm">
          <b className="font-bold text-slate-900">
            Kỳ {period} · {lines.length} dòng {posted ? "(đã ghi sổ)" : ""}
          </b>
          <b className="font-bold text-cyan-800">Tổng khấu hao: {vnd(total)}</b>
        </div>
        {/* Bộ lọc trạng thái & Xuất CSV */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 text-sm bg-slate-50/50">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Lọc:</span>
            <select
              aria-label="Trạng thái ghi sổ"
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-cyan-500"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="planned">Kế hoạch</option>
              <option value="posted">Đã ghi sổ</option>
            </select>
          </div>
          <button
            type="button"
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-cyan-700 hover:bg-slate-50 shadow-3xs transition cursor-pointer"
            onClick={() =>
              exportCsv(
                "khau-hao-" + period,
                ["Tài sản", "Kỳ", "Khấu hao", "Lũy kế", "Còn lại", "Trạng thái", "Ngày ghi sổ"],
                lines.map((l: any) => [
                  l.assetName || l.assetCode || l.assetId,
                  l.period,
                  l.amount,
                  l.accumulatedAfter,
                  l.netBookValueAfter,
                  l.status,
                  l.postedAt,
                ])
              )
            }
          >
            Xuất CSV
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {lines
            .filter((line) => !statusFilter || line.status === statusFilter)
            .map((line: any) => (
              <div
                key={line._id}
                className="grid grid-cols-2 items-center gap-3 p-5 text-sm transition-colors hover:bg-slate-50/50 sm:grid-cols-4"
              >
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block sm:hidden">Mã tài sản</span>
                  <b className="font-bold text-slate-900">{line.assetName || line.assetCode || line.assetId}</b>
                  {line.assetCode && <small className="block text-slate-400">{line.assetCode}</small>}
                </div>

                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block sm:hidden">Số tiền khấu hao</span>
                  <span className="font-black text-cyan-700">{vnd(line.amount)}</span>
                  {line.originalCost && <small className="block text-slate-400">Nguyên giá: {vnd(line.originalCost)}</small>}
                </div>

                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block sm:hidden">Lũy kế sau trích</span>
                  <span className="text-xs text-slate-600 block">Lũy kế: {vnd(line.accumulatedAfter)}</span>
                  <span className="text-xs text-slate-400 block">Còn lại: {vnd(line.netBookValueAfter)}</span>
                </div>

                <div className="flex items-center sm:justify-end">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    line.status === "posted"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                      : "bg-amber-50 text-amber-700 border border-amber-200/60"
                  }`}>
                    {line.status === "posted" ? "Đã ghi sổ" : "Kế hoạch"}
                  </span>
                </div>
              </div>
            ))}

          {!lines.length && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-700">Kỳ này chưa có dòng khấu hao nào.</p>
              <p className="mt-1 text-xs text-slate-400">Nhấn nút "Lập kế hoạch" để hệ thống tự động tính toán mức trích khấu hao.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
