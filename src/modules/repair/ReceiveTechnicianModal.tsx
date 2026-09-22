import React, { useEffect, useState } from "react";
import { authService } from "../../services/authService";
import { Dropdown } from "../../components/common/Dropdown";
import type { RepairTicket } from "../../services/repairService";

export interface ReceiveTechnicianModalProps {
  ticket: RepairTicket;
  onClose: () => void;
  onSubmit: (technicianId: string) => Promise<void>;
}

export default function ReceiveTechnicianModal({
  ticket,
  onClose,
  onSubmit,
}: ReceiveTechnicianModalProps) {
  const [people, setPeople] = useState<Array<{ uid: string; displayName?: string; email?: string }>>([]);
  const [technicianId, setTechnicianId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void authService
      .getColleagues()
      .then((items) => setPeople(items))
      .catch((e) => setError(e instanceof Error ? e.message : "Không thể tải danh sách kỹ thuật viên."));
  }, []);

  const submit = async () => {
    if (!technicianId) return;
    setBusy(true);
    setError("");
    try {
      await onSubmit(technicianId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể cập nhật phiếu.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="receive-technician-title"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100"
      >
        <div>
          <h2 id="receive-technician-title" className="text-lg font-bold text-slate-900">
            Chọn kỹ thuật viên tiếp nhận
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Phiếu <b>{ticket.ticketCode}</b> sẽ được chuyển sang bước Kiểm tra.
          </p>
        </div>

        {error && <p className="mt-3 rounded-lg bg-red-50 p-2.5 text-xs text-red-700">{error}</p>}

        <div className="mt-4 flex flex-col gap-1.5 text-sm font-medium text-slate-700">
          <label htmlFor="receive-tech-select" className="font-semibold text-slate-700">
            Kỹ thuật viên tiếp nhận
          </label>
          {/* Accessible select for screen readers and automated tests */}
          <select
            id="receive-tech-select"
            aria-label="Kỹ thuật viên tiếp nhận"
            value={technicianId}
            onChange={(e) => setTechnicianId(e.target.value)}
            className="sr-only pointer-events-none absolute h-0 w-0 opacity-0"
            tabIndex={-1}
          >
            <option value="">— Chọn kỹ thuật viên —</option>
            {people.map((person) => (
              <option key={person.uid} value={person.uid}>
                {person.displayName || person.email || person.uid}
              </option>
            ))}
          </select>
          <Dropdown<string>
            value={technicianId}
            onChange={setTechnicianId}
            options={[
              { value: "", label: "— Chọn kỹ thuật viên —" },
              ...people.map((person) => ({
                value: person.uid,
                label: person.displayName || person.email || person.uid,
                sublabel: person.displayName && person.email ? person.email : undefined,
              })),
            ]}
            placeholder="— Chọn kỹ thuật viên —"
            variant="default"
            size="md"
            searchable={people.length > 4}
            searchPlaceholder="Tìm kiếm kỹ thuật viên..."
            className="w-full"
            triggerClassName="w-full justify-between py-2.5 rounded-xl border border-slate-300 bg-white hover:border-slate-400 text-slate-800 shadow-2xs font-normal"
            menuClassName="w-full min-w-[260px] shadow-xl"
          />
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy || !technicianId}
            className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-cyan-700 disabled:opacity-50"
          >
            Chuyển bước tiếp
          </button>
        </div>
      </div>
    </div>
  );
}
