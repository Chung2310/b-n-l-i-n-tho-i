import { Stats } from "../components/ManagementUI";
import { useEffect, useState } from "react";
import { Barcode, CheckCircle2, ClipboardCheck, FolderPlus, Loader2, Plus, QrCode, Search, X } from "lucide-react";
import {
  financeAssetInventoriesApi,
  type AssetInventorySession,
  type AssetInventoryVariance,
} from "../api/financeAssets.api";
import { canManageAssets } from "./FixedAssetsPage";

const RESULT_LABELS: Record<string, string> = {
  pending: "Chưa kiểm",
  present: "Khớp",
  damaged: "Hư hỏng",
  missing: "Thiếu",
  surplus: "Thừa",
};

const message = (reason: unknown, fallback: string) =>
  reason instanceof Error ? reason.message : fallback;

const EMPTY_OPENING = { sessionCode: "", name: "", branchIds: "", inventoryDate: "" };

export default function AssetInventoryPage({
  permissions,
}: {
  permissions: readonly string[];
}) {
  const [sessions, setSessions] = useState<AssetInventorySession[]>([]);
  const [selected, setSelected] = useState<AssetInventorySession>();
  const [variance, setVariance] = useState<AssetInventoryVariance>();
  const [barcode, setBarcode] = useState("");
  const [result, setResult] = useState<"present" | "damaged" | "surplus">("present");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [opening, setOpening] = useState(false);
  const [openForm, setOpenForm] = useState(EMPTY_OPENING);
  const canManage = canManageAssets(permissions);

  const load = async () => {
    try {
      setSessions(await financeAssetInventoriesApi.list());
      setError("");
    } catch (reason) {
      setError(message(reason, "Không tải được phiên kiểm kê."));
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const open = async (session: AssetInventorySession) => {
    try {
      const [detail, summary] = await Promise.all([
        financeAssetInventoriesApi.detail(session._id),
        financeAssetInventoriesApi.variance(session._id),
      ]);
      setSelected(detail);
      setVariance(summary);
    } catch (reason) {
      setError(message(reason, "Không tải được chi tiết phiên kiểm kê."));
    }
  };

  /** Company-wide sessions leave branchIds empty; the server derives them from the assets in scope. */
  const openSession = async () => {
    const branchIds = openForm.branchIds
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (!openForm.sessionCode.trim() || !openForm.name.trim() || !openForm.inventoryDate) {
      setError("Cần nhập mã phiên, tên phiên và ngày kiểm kê.");
      return;
    }
    setBusy(true);
    try {
      const session = await financeAssetInventoriesApi.open({
        sessionCode: openForm.sessionCode.trim(),
        name: openForm.name.trim(),
        scope: branchIds.length ? "branch" : "company",
        branchIds,
        inventoryDate: new Date(`${openForm.inventoryDate}T00:00:00.000Z`).toISOString(),
      });
      setOpenForm(EMPTY_OPENING);
      setOpening(false);
      setError("");
      await load();
      await open(session);
    } catch (reason) {
      setError(message(reason, "Không mở được phiên kiểm kê."));
    } finally {
      setBusy(false);
    }
  };

  const scan = async () => {
    if (!selected || !barcode.trim()) return;
    setBusy(true);
    try {
      await financeAssetInventoriesApi.count(selected._id, { barcode: barcode.trim(), result });
      setBarcode("");
      await open(selected);
    } catch (reason) {
      setError(message(reason, "Không ghi nhận được kết quả kiểm kê."));
    } finally {
      setBusy(false);
    }
  };

  const finalize = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const outcome = await financeAssetInventoriesApi.finalize(selected._id);
      setSelected(outcome.session);
      setVariance(outcome.variance);
      await load();
    } catch (reason) {
      setError(message(reason, "Không chốt được phiên kiểm kê."));
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
            <ClipboardCheck className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">Kiểm kê tài sản</h1>
              <span className="rounded-full bg-cyan-50 px-2.5 py-0.5 text-xs font-semibold text-cyan-700">
                {sessions.length} phiên
              </span>
            </div>
            <p className="text-sm text-slate-500">
              Quét mã vạch theo phiên, đối chiếu thực tế và chốt bảng lệch tài sản cố định.
            </p>
          </div>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={() => setOpening((value) => !value)}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm shadow-cyan-600/25 transition-all hover:shadow-md"
          >
            <Plus className="h-4 w-4" />
            Mở phiên kiểm kê
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {/* Opening New Session Form Card */}
      {opening && canManage && (
        <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-md">
          <div className="flex items-center justify-between border-b border-slate-200/80 bg-slate-50/75 px-6 py-4">
            <div className="flex items-center gap-2">
              <FolderPlus className="h-5 w-5 text-cyan-700" />
              <h2 className="text-base font-bold text-slate-900">Thiết lập phiên kiểm kê mới</h2>
            </div>
            <button
              type="button"
              onClick={() => setOpening(false)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ["sessionCode", "Mã phiên", "text", "VD: KK-2026-03"],
                ["name", "Tên phiên", "text", "VD: Kiểm kê quý 1 - Kho tổng"],
                ["branchIds", "Chi nhánh (để trống = toàn công ty)", "text", "VD: CN01, CN02"],
                ["inventoryDate", "Ngày kiểm kê", "date", ""],
              ].map(([field, label, type, placeholder]) => (
                <label key={field} className="block text-xs font-semibold text-slate-700">
                  <span>{label}</span>
                  <input
                    type={type}
                    aria-label={label}
                    placeholder={placeholder}
                    value={(openForm as Record<string, string>)[field]}
                    onChange={(event) => setOpenForm((current) => ({ ...current, [field]: event.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-normal outline-none transition-all focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                  />
                </label>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                disabled={busy}
                onClick={() => void openSession()}
                className="rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm shadow-cyan-600/20 transition-all hover:shadow-md disabled:opacity-50"
              >
                {busy ? "Đang tạo..." : "Tạo phiên"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sessions List */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs">
        <div className="border-b border-slate-200/80 bg-slate-50/75 px-6 py-4">
          <h2 className="text-sm font-bold text-slate-800">Danh sách phiên kiểm kê</h2>
        </div>

        <div className="divide-y divide-slate-100">
          {sessions.map((session) => (
            <button
              key={session._id}
              type="button"
              aria-label={`Phiên ${session.sessionCode}`}
              onClick={() => void open(session)}
              className="grid w-full grid-cols-2 items-center gap-3 p-5 text-left text-sm transition-colors hover:bg-cyan-50/40 sm:grid-cols-4"
            >
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block sm:hidden">Mã phiên</span>
                <b className="font-bold text-cyan-700">{session.sessionCode}</b>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block sm:hidden">Tên phiên</span>
                <span className="font-semibold text-slate-900">{session.name}</span>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block sm:hidden">Ngày kiểm</span>
                <span className="text-slate-600">{session.inventoryDate?.slice(0, 10)}</span>
              </div>

              <div className="flex items-center sm:justify-end">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  session.status === "open"
                    ? "bg-cyan-50 text-cyan-700 border border-cyan-200/60"
                    : "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                }`}>
                  {session.status === "open" ? "Đang mở" : "Đã chốt"}
                </span>
              </div>
            </button>
          ))}

          {!sessions.length && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <ClipboardCheck className="h-6 w-6" />
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-700">Chưa có phiên kiểm kê nào.</p>
              <p className="mt-1 text-xs text-slate-400">Nhấn nút "Mở phiên kiểm kê" để bắt đầu đợt kiểm kê mới.</p>
            </div>
          )}
        </div>
      </div>

      {/* Selected Session Details Panel */}
      {selected && (
        <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-200/80 bg-slate-50/75 p-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-cyan-100 px-3 py-0.5 text-xs font-bold text-cyan-800">
                  {selected.sessionCode}
                </span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  selected.status === "open" ? "bg-cyan-50 text-cyan-700" : "bg-emerald-50 text-emerald-700"
                }`}>
                  {selected.status === "open" ? "Đang mở" : "Đã chốt"}
                </span>
              </div>
              <h2 className="mt-2 text-xl font-bold text-slate-900">
                {selected.sessionCode} · {selected.name}
              </h2>
            </div>

            <button
              type="button"
              onClick={() => setSelected(undefined)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50"
            >
              Đóng
            </button>
          </div>

          {/* Barcode scan input bar */}
          {canManage && selected.status === "open" && (
            <div className="flex flex-wrap items-end gap-3 border-b border-slate-200/80 bg-cyan-50/30 p-6">
              <div className="flex-1 min-w-[240px]">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                  Mã vạch tài sản
                </label>
                <div className="relative">
                  <Barcode className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    aria-label="Mã vạch"
                    value={barcode}
                    onChange={(event) => setBarcode(event.target.value)}
                    onKeyDown={(event) => event.key === "Enter" && void scan()}
                    placeholder="Quét hoặc nhập mã vạch..."
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm font-medium outline-none transition-all focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                  />
                </div>
              </div>

              <div className="w-44">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                  Kết quả
                </label>
                <select
                  aria-label="Kết quả kiểm kê"
                  value={result}
                  onChange={(event) => setResult(event.target.value as typeof result)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 outline-none transition-all focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                >
                  <option value="present">Khớp</option>
                  <option value="damaged">Hư hỏng</option>
                  <option value="surplus">Thừa</option>
                </select>
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={() => void scan()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-800 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-slate-900 disabled:opacity-50"
              >
                Ghi nhận
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => void finalize()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm shadow-cyan-600/20 transition-all hover:shadow-md disabled:opacity-50"
              >
                Chốt phiên
              </button>
            </div>
          )}

          {/* Variance Summary Stats */}
          {variance && (
            <div className="flex flex-wrap gap-4 border-b border-slate-200/80 bg-slate-50/50 p-6 text-sm">
              <span className="font-bold text-slate-900">Tổng: {variance.total}</span>
              {Object.entries(variance.counts).map(([key, count]) => (
                <span
                  key={key}
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    key === "present"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                      : key === "damaged"
                      ? "bg-amber-50 text-amber-700 border border-amber-200/60"
                      : key === "missing"
                      ? "bg-rose-50 text-rose-700 border border-rose-200/60"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {RESULT_LABELS[key] || key}: {count}
                </span>
              ))}
            </div>
          )}

          {/* Items Table */}
          <div className="divide-y divide-slate-100">
            {selected.items.map((item) => (
              <div
                key={item.barcode}
                className="grid grid-cols-2 items-center gap-3 p-5 text-sm transition-colors hover:bg-slate-50/50 sm:grid-cols-4"
              >
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block sm:hidden">Mã tài sản</span>
                  <b className="font-bold text-cyan-700">{item.assetCode}</b>
                  <p className="text-xs text-slate-400">{item.barcode}</p>
                </div>

                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block sm:hidden">Tên tài sản</span>
                  <span className="font-semibold text-slate-900">{item.name}</span>
                </div>

                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block sm:hidden">Chi nhánh kỳ vọng</span>
                  <span className="text-slate-600">{item.expectedBranchId}</span>
                </div>

                <div className="flex items-center sm:justify-end">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    item.result === "present"
                      ? "bg-emerald-50 text-emerald-700"
                      : item.result === "damaged"
                      ? "bg-amber-50 text-amber-700"
                      : item.result === "missing"
                      ? "bg-rose-50 text-rose-700"
                      : item.result === "surplus"
                      ? "bg-purple-50 text-purple-700"
                      : "bg-slate-100 text-slate-500"
                  }`}>
                    {RESULT_LABELS[item.result] || item.result}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
