import React, { useEffect, useState } from "react";
import type { HRTask } from "../../types/hr";
import { apiFetch } from "../../modules/shared/lib/apiFetch";
import "./kanban-task-progress.css";

function progressOf(task: HRTask) {
  return ["Done", "done"].includes(task.status) ? 100 : task.progress ?? (["In Progress", "doing", "Review/Testing"].includes(task.status) ? 1 : 0);
}

export function TaskProgressSummary({ task }: { task: HRTask }) {
  return <div className="my-2 text-xs space-y-1">
    <span>Tiến độ: {progressOf(task)}%</span>
    <progress aria-label="Tiến độ công việc" className="block w-full h-1.5 accent-indigo-600" value={progressOf(task)} max={100} />
    {task.progressNote && <p className="text-slate-600 line-clamp-2">{task.progressNote}</p>}
    {task.helpRequested && <p className="font-bold text-red-700" role="status">● Cần trợ giúp: {task.helpReason}</p>}
  </div>;
}

export function KanbanTaskProgress({ task, uid, manager, onSaved, onReload }: {
  task: HRTask; uid: string; manager: boolean; onSaved: (task: HRTask) => void; onReload: () => void;
}) {
  const [progress, setProgress] = useState(progressOf(task));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => { setProgress(progressOf(task)); }, [task.id, task.progress, task.status]);
  const owner = manager || uid === task.assigneeUid;
  const closed = task.status === "Archived";
  async function save(action: string) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await apiFetch<{ data: HRTask & { _id: string } }>(`/kanban/tasks/${task.id}/activity`, {
        method: "PATCH", body: JSON.stringify({ action, progress, note, revision: task.revision || 0 }),
      });
      onSaved({ ...response.data, id: response.data._id });
      setNote(""); setMessage("Đã lưu cập nhật.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể cập nhật công việc.");
      if ((err as any)?.status === 409) onReload();
    } finally { setBusy(false); }
  }
  return <section className={`p-4 mb-5 rounded-xl border ${task.helpRequested ? "task-needs-help" : "border-indigo-200 bg-indigo-50/40"}`}>
    <h3 className="font-bold text-sm">Tiến độ & trợ giúp</h3>
    <TaskProgressSummary task={task} />
    <p className="text-xs mb-2">Phụ trách chính / KPI: <strong>{task.assignee}</strong></p>
    {!!task.helpers?.length && <p className="text-xs mb-2">Người hỗ trợ: {task.helpers.map(helper => helper.name).join(", ")}</p>}
    {owner && !closed && <>
      <label className="block text-sm" htmlFor={`progress-${task.id}`}>Tiến độ báo cáo: {progress}% — {progress === 100 ? "Hoàn thành" : progress > 0 ? "Đang làm" : "Chưa bắt đầu"}</label>
      <input id={`progress-${task.id}`} aria-label="Cập nhật tiến độ" className="w-full accent-indigo-600" type="range" min={0} max={100} step={1} value={progress} disabled={busy} onChange={event => setProgress(Number(event.target.value))} />
      <textarea aria-label="Ghi chú báo cáo hoặc lý do trợ giúp" className="block w-full border rounded-lg p-2 my-2 text-sm bg-white" rows={3} maxLength={2000} value={note} disabled={busy} onChange={event => setNote(event.target.value)} placeholder="Đã kiểm tra bo mạch, đang đợi linh kiện…" />
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy || !note.trim()} className="px-3 py-2 rounded bg-indigo-600 text-white text-xs disabled:opacity-50" onClick={() => save("progress")}>Lưu báo cáo tiến độ</button>
        {!task.helpRequested && progressOf(task) < 100 && <button type="button" disabled={busy || !note.trim()} className="px-3 py-2 rounded bg-red-600 text-white text-xs disabled:opacity-50" onClick={() => save("help")}>Gửi trợ giúp</button>}
        {task.helpRequested && <button type="button" disabled={busy} className="px-3 py-2 border rounded text-xs bg-white" onClick={() => save("resolve")}>Đã giải quyết trợ giúp</button>}
      </div>
    </>}
    {!closed && task.helpRequested && uid !== task.assigneeUid && !task.helpers?.some(helper => helper.uid === uid) && <button type="button" disabled={busy} className="px-3 py-2 mt-2 rounded bg-red-600 text-white text-xs" onClick={() => save("join")}>Tham gia hỗ trợ</button>}
    {error && <p role="alert" className="text-red-700 text-sm mt-2">{error}</p>}
    {message && <p role="status" className="text-green-700 text-sm mt-2">{message}</p>}
  </section>;
}
