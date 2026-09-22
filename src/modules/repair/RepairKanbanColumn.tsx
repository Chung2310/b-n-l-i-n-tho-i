import React, { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { RepairStatus, RepairTicket } from "../../services/repairService";
import RepairTicketCard from "./RepairTicketCard";

export interface RepairKanbanColumnProps {
  column: {
    status: RepairStatus;
    label: string;
    icon: string;
    description: string;
  };
  tickets: RepairTicket[];
  busyId: string | null;
  hasDragged: React.MutableRefObject<boolean>;
  onSelectTicket: (ticket: RepairTicket) => void;
  onMoveForward: (ticket: RepairTicket) => void;
}

export default function RepairKanbanColumn({
  column,
  tickets,
  busyId,
  hasDragged,
  onSelectTicket,
  onMoveForward,
}: RepairKanbanColumnProps) {
  const [page, setPage] = useState(1);
  const [showAll, setShowAll] = useState(false);
  const PAGE_SIZE = 8;
  const totalPages = Math.ceil(tickets.length / PAGE_SIZE) || 1;
  const validPage = Math.min(page, totalPages);
  const visibleTickets = showAll
    ? tickets
    : tickets.slice((validPage - 1) * PAGE_SIZE, validPage * PAGE_SIZE);

  return (
    <section
      id={`kanban-col-${column.status}`}
      className="w-80 shrink-0 rounded-2xl bg-slate-100/90 p-3.5 border border-slate-200/60 flex flex-col shadow-xs"
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <span>{column.label}</span>
        </h2>
        <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[11px] font-bold text-slate-600">
          {tickets.length}
        </span>
      </div>
      <div className="space-y-2.5 flex-1 flex flex-col">
        <div className="space-y-2.5 flex-1">
          {visibleTickets.map((ticket) => (
            <RepairTicketCard
              key={ticket._id}
              ticket={ticket}
              busyId={busyId}
              hasDragged={hasDragged}
              onSelect={onSelectTicket}
              onMoveForward={onMoveForward}
            />
          ))}
        </div>

        {tickets.length > PAGE_SIZE && (
          <div className="mt-2 flex items-center justify-between rounded-xl border border-slate-200/90 bg-white/95 px-3 py-1.5 text-xs shadow-2xs">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={validPage <= 1 || showAll}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="flex h-6 w-6 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                title="Trang trước"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="font-bold text-slate-700 text-[11px]">
                {showAll ? "Tất cả" : `${validPage}/${totalPages}`}
              </span>
              <button
                type="button"
                disabled={validPage >= totalPages || showAll}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="flex h-6 w-6 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                title="Trang sau"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              className="text-[11px] font-bold text-cyan-700 hover:text-cyan-800 underline cursor-pointer"
            >
              {showAll ? "Thu gọn (8)" : `Xem hết (${tickets.length})`}
            </button>
          </div>
        )}

        {tickets.length === 0 && (
          <div className="flex flex-1 items-center justify-center py-8 text-center text-xs text-slate-400">
            <span>Không có máy</span>
          </div>
        )}
      </div>
    </section>
  );
}
