import React, { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { RepairTicket } from "../../services/repairService";
import type { PipelineStageConfig } from "./repairBoardTypes";
import RepairTicketCard from "./RepairTicketCard";

export interface RepairKanbanStageProps {
  stage: PipelineStageConfig;
  tickets: RepairTicket[];
  busyId: string | null;
  hasDragged: React.MutableRefObject<boolean>;
  onSelectTicket: (ticket: RepairTicket) => void;
  onMoveForward: (ticket: RepairTicket) => void;
  onViewAllDelivered?: () => void;
  totalDeliveredCount?: number;
}

export default function RepairKanbanStage({
  stage,
  tickets,
  busyId,
  hasDragged,
  onSelectTicket,
  onMoveForward,
  onViewAllDelivered,
  totalDeliveredCount = 0,
}: RepairKanbanStageProps) {
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
      id={`kanban-stage-${stage.id}`}
      className="w-[335px] sm:w-[365px] shrink-0 flex flex-col rounded-3xl bg-slate-100/80 p-4 border border-slate-200/70 shadow-xs"
    >
      {/* Stage Header */}
      <div className="mb-3 px-1">
        <div className="flex items-center justify-between gap-1.5">
          <h2 className="text-xs font-black uppercase text-slate-800 flex items-center gap-1 min-w-0">
            <span className="whitespace-nowrap">{stage.label}</span>
          </h2>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold border ${stage.colorScheme.badge}`}>
            {tickets.length} máy
          </span>
        </div>
        <p className="mt-1 text-[11px] text-slate-500 font-medium line-clamp-1" title={stage.description}>
          {stage.description}
        </p>
      </div>

      {/* Ticket Cards List */}
      <div className="space-y-3 flex-1 flex flex-col">
        <div className="space-y-3 flex-1">
          {visibleTickets.map((ticket) => (
            <RepairTicketCard
              key={ticket._id}
              ticket={ticket}
              showSubStatus={stage.statuses.length > 1}
              busyId={busyId}
              hasDragged={hasDragged}
              onSelect={onSelectTicket}
              onMoveForward={onMoveForward}
            />
          ))}
        </div>

        {/* Mini Pagination for Column when many tickets exist */}
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

        {stage.id === "stage_delivered" && tickets.length > 0 && onViewAllDelivered && (
          <button
            type="button"
            onClick={onViewAllDelivered}
            className="w-full mt-2 flex items-center justify-center gap-1.5 rounded-xl border border-teal-200 bg-white py-2 text-xs font-bold text-teal-800 hover:bg-teal-50 transition shadow-2xs cursor-pointer"
          >
            <span>Xem toàn bộ lịch sử ({totalDeliveredCount} máy)</span>
          </button>
        )}

        {tickets.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center py-12 text-center rounded-2xl border border-dashed border-slate-200/80 bg-white/50">
            <span className="text-xs text-slate-400 font-medium">Chưa có máy ở bước này</span>
            <span className="text-[11px] text-slate-400/80 mt-0.5">{stage.helperTip}</span>
          </div>
        )}
      </div>
    </section>
  );
}

