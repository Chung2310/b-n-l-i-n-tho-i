import { useEffect, useState } from "react";
import { payrollService } from "../../../services/payrollService";
import type { PayrollReconciliation } from "../../../shared/payrollReconciliation";
import { PayrollReconciliationConversation } from "./PayrollReconciliationConversation";
type Status = { runVersion: number; runStatus: string; employeeCount: number; items: PayrollReconciliation[] };
export function PayrollReconciliationPanel({ runId, runVersion, canManage, onChanged, onEdit }: {
  runId: string; runVersion: number; canManage: boolean; onChanged: () => void | Promise<void>; onEdit: (employeeId: string, field: string) => void;
}) {
  const [data, setData] = useState<Status | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = async () => { const result = await payrollService.getReconciliation(runId); setData(result); setError(""); };
  useEffect(() => { setData(null); void load().catch(e => setError(e.message || "Không tải được đối soát.")); }, [runId, runVersion]);
  const publish = async () => {
    if (!data) return;
    setBusy(true);
    try { await payrollService.publishReconciliation(runId, data.runVersion); await load(); await onChanged(); }
    catch (e) { setError(e instanceof Error ? e.message : "Không phát hành được bảng tạm tính."); }
    finally { setBusy(false); }
  };
  const confirmed = data?.items.filter(item => !item.stale && item.confirmedChecksum === item.snapshot.checksum && !item.issues.some(issue => issue.status === "open")).length ?? 0;
  const open = data?.items.reduce((count, item) => count + item.issues.filter(issue => issue.status === "open").length, 0) ?? 0;
  return <section className="my-4 space-y-3 rounded-xl border border-cyan-200 bg-white p-4">
    <h3 className="font-semibold">Đối soát lương tạm tính</h3>
    <button type="button" className="text-sm text-cyan-700 underline" onClick={() => void load().then(() => onChanged()).catch(e => setError(e.message))}>Tải lại phản hồi nhân viên</button>
    <p className="text-sm text-slate-600">Bảng lương được phát hành tự động theo lịch đã bật hoặc chủ động bằng nút bên dưới. Kế toán tiếp tục sửa trên kỳ Nháp; quản lý chốt sau khi mọi người xác nhận và giải quyết hết khiếu nại.</p>
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    {data && <>
      <p className="text-sm">Đã xác nhận: {confirmed}/{data.employeeCount} · Khiếu nại chưa giải quyết: {open}</p>
      {canManage && data.runStatus === "draft" && <button type="button" disabled={busy} onClick={() => void publish()} className="rounded bg-cyan-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Đang phát hành..." : data.items.length ? "Cập nhật bản gửi nhân viên" : "Phát hành bảng lương tạm tính"}</button>}
      {data.items.map(record => <details key={record.employeeId} className="rounded-lg border p-3"><summary className="cursor-pointer font-medium">{record.employeeName || record.employeeId} · {record.stale ? "Cần phát hành lại" : record.issues.some(issue => issue.status === "open") ? "Có khiếu nại" : record.confirmedChecksum === record.snapshot.checksum ? "Đã xác nhận" : "Chờ xác nhận"}</summary>
        <PayrollReconciliationConversation record={record} staff onEdit={canManage ? field => onEdit(record.employeeId, field) : undefined} onAction={canManage ? async action => {
          await payrollService.replyReconciliation(runId, record.employeeId, { ...action, expectedVersion: record.version });
          await load(); await onChanged();
        } : undefined} />
      </details>)}
    </>}
  </section>;
}
