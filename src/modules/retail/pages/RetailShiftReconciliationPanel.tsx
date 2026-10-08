import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { getApiErrorMessage } from "../../../utils/errorMessage";
import { socketService } from "../../../services/socketService";
import { CurrencyInput as SharedCurrencyInput } from "../../../components/common/CurrencyInput";
import { retailShiftsApi } from "../api/retailShifts.api";
import { useRetailScope } from "../hooks/useRetailScope";
import type { RetailShift } from "../types";

const money = (value = 0) => `${new Intl.NumberFormat("vi-VN").format(value)} ₫`;

export default function RetailShiftReconciliationPanel() {
  const { scope } = useRetailScope();
  const [items, setItems] = React.useState<RetailShift[]>([]);
  const [selected, setSelected] = React.useState<RetailShift | null>(null);
  const [countedCash, setCountedCash] = React.useState(0);
  const [varianceReason, setVarianceReason] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  const refresh = React.useCallback(async () => {
    if (!scope) return;
    setLoading(true);
    try {
      const result = await retailShiftsApi.list(scope, { pendingReconciliation: "true", limit: 20, page });
      setItems(result.items.filter((shift) => shift.status === "closed"));
      setTotal(result.total);
      setError("");
    } catch (cause) {
      setError(getApiErrorMessage(cause, "Không tải được phiên POS cần đối soát."));
    } finally {
      setLoading(false);
    }
  }, [scope?.companyCode, scope?.branchId, scope?.terminalId, page]);

  React.useEffect(() => { void refresh(); }, [refresh]);
  React.useEffect(() => {
    if (!scope) return;
    const sync = (event: any) => { if (!event?.branchId || event.branchId === scope.branchId) void refresh(); };
    const offClosed = socketService.on("pos:session:closed", sync);
    const offReconciled = socketService.on("pos:session:reconciled", sync);
    const offStatus = socketService.onStatusChange((connected) => { if (connected) void refresh(); });
    return () => { offClosed(); offReconciled(); offStatus(); };
  }, [scope?.companyCode, scope?.branchId, scope?.terminalId, refresh]);

  const reconcile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!scope || !selected || !Number.isSafeInteger(countedCash) || countedCash < 0) return;
    setBusy(true);
    setError("");
    try {
      await retailShiftsApi.reconcile(scope, selected._id, { countedCash, varianceReason: varianceReason.trim() || undefined });
      setSelected(null);
      setCountedCash(0);
      setVarianceReason("");
      await refresh();
    } catch (cause) {
      setError(getApiErrorMessage(cause, "Không đối soát được phiên POS."));
    } finally {
      setBusy(false);
    }
  };

  if (!scope) return null;
  return <section className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="flex items-center gap-2 font-bold text-slate-900"><AlertTriangle className="h-4 w-4 text-amber-600" />Phiên chờ kiểm đếm / đối soát</h2><p className="mt-1 text-sm text-slate-500">Duyệt phiên đóng thủ công hoặc tự đóng lúc 00:00. Tiền kiểm đếm đã gửi được giữ nguyên.</p></div>
      <button type="button" disabled={loading} onClick={() => void refresh()} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Làm mới</button>
    </div>
    {error && <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    {items.length ? <div className="mt-4 divide-y rounded-xl border">{items.map((item) => <div key={item._id} className="flex flex-wrap items-center justify-between gap-3 p-3">
      <div><p className="font-semibold">{item.shiftCode} <span className="font-normal text-slate-500">· {item.businessDate}</span></p><p className="text-sm text-slate-500">{item.cashierName} · quỹ đầu phiên {money(item.openingFloat)} · kỳ vọng {money(item.expectedCash || 0)}</p></div>
      <button type="button" onClick={() => { setSelected(item); setCountedCash(item.countedCash ?? 0); setVarianceReason(item.varianceReason || ""); setError(""); }} className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-bold text-white hover:bg-amber-700">Đối soát</button>
    </div>)}</div> : <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">{loading ? "Đang tải phiên…" : "Không có phiên đang chờ đối soát."}</p>}
    {total > 20 && <div className="mt-4 flex justify-end gap-3 text-sm"><button disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Trang trước</button><span>{page} · {total} phiên</span><button disabled={page * 20 >= total} onClick={() => setPage((value) => value + 1)}>Trang sau</button></div>}
    {selected && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4">
      <form role="dialog" aria-modal="true" aria-label="Đối soát phiên POS" onSubmit={(event) => void reconcile(event)} className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
        <h3 className="text-lg font-black">Đối soát {selected.shiftCode}</h3>
        <p className="mt-1 text-sm text-slate-500">Tiền kỳ vọng: <b className="text-slate-800">{money(selected.expectedCash || 0)}</b></p>
        <div className="mt-4 space-y-4"><label className="block text-sm font-semibold">Tiền mặt thực đếm<SharedCurrencyInput aria-label="Tiền mặt thực đếm" readOnly={selected.countedCash != null} value={countedCash} onChange={(value) => { if (selected.countedCash == null) setCountedCash(value); }} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm font-bold text-slate-900 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20" /></label>{selected.countedCash != null && <p className="text-xs text-slate-500">Tiền kiểm đếm đã gửi không được sửa khi duyệt.</p>}<label className="block text-sm font-semibold">Lý do chênh lệch (nếu có)<textarea rows={3} value={varianceReason} onChange={(event) => setVarianceReason(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 font-normal" /></label></div>
        {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
        <div className="mt-5 flex justify-end gap-2"><button type="button" disabled={busy} onClick={() => setSelected(null)} className="rounded-xl border px-4 py-2 font-semibold">Đóng</button><button disabled={busy || !Number.isSafeInteger(countedCash) || countedCash < 0} className="rounded-xl bg-slate-900 px-4 py-2 font-bold text-white disabled:opacity-50">{busy ? "Đang lưu…" : "Xác nhận đối soát"}</button></div>
      </form>
    </div>}
  </section>;
}
