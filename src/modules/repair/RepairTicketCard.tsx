import React from "react";
import type { RepairTicket } from "../../services/repairService";
import { getSubStatusBadge, getTicketBadge, money, nextStatus } from "./repairBoardTypes";

export interface RepairTicketCardProps {
  ticket: RepairTicket;
  showSubStatus?: boolean;
  busyId: string | null;
  hasDragged: React.MutableRefObject<boolean>;
  onSelect: (ticket: RepairTicket) => void;
  onMoveForward: (ticket: RepairTicket) => void;
}

export default function RepairTicketCard({
  ticket,
  showSubStatus = false,
  busyId,
  hasDragged,
  onSelect,
  onMoveForward,
}: RepairTicketCardProps) {
  const badge = getTicketBadge(ticket);
  const subStatus = showSubStatus ? getSubStatusBadge(ticket.status) : null;

  return (
    <article
      onClick={() => {
        if (hasDragged.current) return;
        onSelect(ticket);
      }}
      className="cursor-pointer rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-xs hover:border-cyan-400 hover:shadow-md transition space-y-2.5"
    >
      {/* Top Row: Smart Type Badge + SubStatus Badge + Loyalty Discount */}
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold border ${badge.badgeClass}`}>
            {badge.label}
          </span>
          {subStatus && (
            <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold border ${subStatus.color}`}>
              {subStatus.label}
            </span>
          )}
        </div>

        {ticket.loyaltyDiscount?.rate ? (
          <span className="rounded-md bg-purple-50 border border-purple-200 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700">
            Giảm {ticket.loyaltyDiscount.rate}%
          </span>
        ) : ticket.coverage?.customer?.covered ? (
          <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700 font-semibold border border-emerald-200">
            Còn BH
          </span>
        ) : null}
      </div>

      {/* Ticket Code & Device Name */}
      <div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-cyan-700 tracking-wide">{ticket.ticketCode}</span>
          {ticket.device.serialNumber ? (
            <span
              className="text-[11px] text-slate-400 font-mono truncate max-w-[130px]"
              title={ticket.device.serialNumber}
            >
              {ticket.device.serialNumber}
            </span>
          ) : null}
        </div>
        <p className="text-sm font-bold text-slate-900 line-clamp-1 mt-0.5">{ticket.device.name}</p>
        {ticket.symptom && (
          <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5" title={ticket.symptom}>
            Lỗi: {ticket.symptom}
          </p>
        )}
      </div>

      {/* Customer & Technician */}
      <div className="flex items-center justify-between gap-2 text-xs text-slate-600 border-t border-slate-100 pt-2">
        <p className="font-semibold text-slate-800 truncate flex-1" title={ticket.customerName}>{ticket.customerName}</p>
        <p className="text-[11px] text-slate-400 truncate max-w-[150px] text-right shrink-0" title={ticket.technicianName || "Chưa giao KT"}>
          {ticket.technicianName ? `KT: ${ticket.technicianName}` : <span className="italic">Chưa giao KT</span>}
        </p>
      </div>

      {/* Total Amount & Due */}
      <div className="flex items-center justify-between text-xs border-t border-slate-100 pt-2">
        <span className="text-slate-500">
          Tổng: <b className="text-slate-800 font-bold">{money(ticket.totalAmount)} đ</b>
        </span>
        {ticket.dueAmount > 0 ? (
          <span className="text-xs font-black text-rose-600">
            Nợ: {money(ticket.dueAmount)} đ
          </span>
        ) : (
          <span className="text-[11px] font-bold text-emerald-600">Đã thanh toán</span>
        )}
      </div>

      {/* Action Button */}
      {(nextStatus[ticket.status] || ticket.status === "quoted") && (
        <button
          type="button"
          disabled={busyId === ticket._id}
          onClick={(e) => {
            e.stopPropagation();
            onMoveForward(ticket);
          }}
          className={`mt-1 flex w-full items-center justify-center gap-1 rounded-xl py-2 text-xs font-semibold text-white shadow-xs transition disabled:opacity-50 ${
            ticket.status === "quoted"
              ? "bg-emerald-600 hover:bg-emerald-700"
              : ticket.status === "done"
              ? ticket.dueAmount > 0
                ? "bg-amber-600 hover:bg-amber-700"
                : "bg-blue-600 hover:bg-blue-700"
              : "bg-cyan-600 hover:bg-cyan-700"
          }`}
        >
          {ticket.status === "quoted"
            ? "Duyệt báo giá"
            : ticket.status === "done"
            ? ticket.dueAmount > 0
              ? "Thu tiền để giao máy"
              : "Giao máy"
            : "Chuyển bước tiếp"}
        </button>
      )}

      {ticket.status === "delivered" && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(ticket);
          }}
          className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50/90 py-2 text-xs font-bold text-teal-800 hover:bg-teal-100 transition shadow-2xs cursor-pointer"
        >
          <span>Xem chi tiết & Hoàn tiền</span>
        </button>
      )}
    </article>
  );
}
