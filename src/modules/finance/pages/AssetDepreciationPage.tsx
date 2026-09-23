import { exportCsv } from "../components/ManagementUI";
import { useEffect, useState } from "react";
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
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Khấu hao tài sản</h1>
          <p className="text-sm text-slate-500">Lập kế hoạch theo kỳ, soát lại rồi ghi sổ.</p>
        </div>
        <div className="flex items-end gap-3">
          <label className="text-sm font-semibold text-slate-700">
            Kỳ
            <input
              type="month"
              aria-label="Kỳ khấu hao"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              className="mt-1 block rounded-xl border border-slate-300 px-3 py-2 font-normal"
            />
          </label>
          {canManage && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => void act("run")}
                className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                Lập kế hoạch
              </button>
              <button
                type="button"
                disabled={busy || posted || !lines.length}
                onClick={() => void act("post")}
                className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                Ghi sổ
              </button>
            </>
          )}
        </div>
      </div>

      {error && <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {notice && <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}

      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b p-4 text-sm">
          <b>
            Kỳ {period} · {lines.length} dòng {posted ? "(đã ghi sổ)" : ""}
          </b>
          <b>Tổng khấu hao: {vnd(total)}</b>
        </div>
        <div className="flex flex-wrap gap-3 border-b p-3 text-sm"><select aria-label="Trạng thái ghi sổ" className="rounded-lg border border-slate-300 p-2" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="">Tất cả trạng thái</option><option value="planned">Kế hoạch</option><option value="posted">Đã ghi sổ</option></select><button className="text-cyan-700" onClick={() => exportCsv("khau-hao-" + period, ["Tài sản", "Kỳ", "Khấu hao", "Lũy kế", "Còn lại", "Trạng thái", "Ngày ghi sổ"], lines.map(l => [l.assetName || l.assetCode, l.period, l.amount, l.accumulatedAfter, l.netBookValueAfter, l.status, l.postedAt]))}>Xuất CSV</button></div>
        <div className="divide-y">
          {lines.filter(line => !statusFilter || line.status === statusFilter).map((line) => (
            <div key={line._id} className="grid grid-cols-2 gap-2 p-4 text-sm sm:grid-cols-4">
              <span>{line.assetName || line.assetCode || "Tài sản chưa có tên"}<small className="block text-slate-500">{line.assetCode}</small></span>
              <span>Nguyên giá: {vnd(line.originalCost || 0)}<br />Kỳ này: {vnd(line.amount)}</span>
              <span>Luỹ kế: {vnd(line.accumulatedAfter)}<br />Còn lại: {vnd(line.netBookValueAfter)}</span>
              <span>{line.status === "posted" ? "Đã ghi sổ" : "Kế hoạch"}{line.postedAt && <small className="block">{new Date(line.postedAt).toLocaleString("vi-VN")}</small>}</span>
            </div>
          ))}
          {!lines.length && (
            <p className="p-6 text-center text-sm text-slate-500">Kỳ này chưa có dòng khấu hao nào.</p>
          )}
        </div>
      </div>
    </section>
  );
}
