import React, { useEffect, useMemo, useRef, useState } from "react";
import { repairService, type RepairStatus, type RepairTicket } from "../../services/repairService";
import { Search, X, ChevronLeft, ChevronRight } from "lucide-react";

import {
  columns,
  PIPELINE_STAGES,
  type PipelineStageId,
  type PipelineStageConfig,
  type RepairCreatePrefill,
  type RepairViewMode,
  money,
  date,
  getTicketBadge,
  repairStatusLabels,
  repairStatusLabel,
  STEP_MAP,
  costBearerLabel,
  costBearerBadgeClass,
  getSubStatusBadge,
  nextStatus,
} from "./repairBoardTypes";
import RepairTicketCard from "./RepairTicketCard";
import RepairKanbanStage from "./RepairKanbanStage";
import RepairKanbanColumn from "./RepairKanbanColumn";
import ReceiveTechnicianModal from "./ReceiveTechnicianModal";
import CreateRepairModal from "./CreateRepairModal";
import TicketModal from "./TicketModal";
import { Dropdown } from "../../components/common/Dropdown";
import { TablePagination } from "../../components/common/TablePagination";
import { SearchInput } from "../../components/common/SearchInput";

// Re-export modular components, types, and helpers for backwards compatibility and easy reusability
export {
  columns,
  PIPELINE_STAGES,
  type PipelineStageId,
  type PipelineStageConfig,
  type RepairCreatePrefill,
  type RepairViewMode,
  money,
  date,
  getTicketBadge,
  repairStatusLabels,
  repairStatusLabel,
  STEP_MAP,
  costBearerLabel,
  costBearerBadgeClass,
  getSubStatusBadge,
  nextStatus,
  RepairTicketCard,
  RepairTicketCard as TicketCard,
  RepairKanbanStage,
  RepairKanbanColumn,
  ReceiveTechnicianModal,
  CreateRepairModal,
  TicketModal,
};




export default function RepairBoardPage({
  createPrefill,
  onCreatePrefillConsumed,
}: { createPrefill?: RepairCreatePrefill | null; onCreatePrefillConsumed?: () => void } = {}) {
  const [board, setBoard] = useState<Partial<Record<RepairStatus, RepairTicket[]>>>({});
  const [ticketTypeFilter, setTicketTypeFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "yesterday" | "week" | "month">("all");
  const [technicianFilter, setTechnicianFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<RepairViewMode>("pipeline6");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<RepairTicket | null>(null);
  const [receivingTicket, setReceivingTicket] = useState<RepairTicket | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [activePrefill, setActivePrefill] = useState<RepairCreatePrefill | null>(null);

  // Pagination for Queue & Delivered views
  const [queuePage, setQueuePage] = useState(1);
  const [queuePageSize, setQueuePageSize] = useState(15);
  const [deliveredPage, setDeliveredPage] = useState(1);
  const [deliveredPageSize, setDeliveredPageSize] = useState(15);

  useEffect(() => {
    if (createPrefill) {
      setActivePrefill(createPrefill);
      setCreateOpen(true);
    }
  }, [createPrefill]);

  const loadBoard = () =>
    repairService
      .board(ticketTypeFilter ? { ticketType: ticketTypeFilter } : {})
      .then((data) => {
        setBoard(data);
        setSelected((curr) => {
          if (!curr) return null;
          for (const key of Object.keys(data)) {
            const list = (data as any)[key];
            if (Array.isArray(list)) {
              const match = list.find((t: RepairTicket) => t._id === curr._id);
              if (match) return match;
            }
          }
          return curr;
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Không thể tải board Repair"));

  useEffect(() => {
    void loadBoard();
  }, [ticketTypeFilter]);

  // Reset page to 1 on any filter change
  useEffect(() => {
    setQueuePage(1);
    setDeliveredPage(1);
  }, [searchQuery, dateFilter, technicianFilter, ticketTypeFilter]);

  const moveForward = async (ticket: RepairTicket, technicianId?: string) => {
    setBusyId(ticket._id);
    try {
      const to = nextStatus[ticket.status];
      if (ticket.status === "quoted") await repairService.approveQuote(ticket._id);
      else if (to) await repairService.transition(ticket._id, to, technicianId ? { technicianId } : {});
      await loadBoard();
      setReceivingTicket(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể cập nhật phiếu");
      throw e;
    } finally {
      setBusyId(null);
    }
  };

  const startMoveForward = (ticket: RepairTicket) => {
    if (ticket.status === "received") setReceivingTicket(ticket);
    else if (ticket.status === "diagnosing") setSelected(ticket);
    else if (ticket.status === "done" && ticket.dueAmount > 0) setSelected(ticket);
    else void moveForward(ticket).catch(() => undefined);
  };

  const openNewServiceTicket = () => {
    setActivePrefill({
      ticketType: "service",
      productName: "",
      serialNumber: "",
    });
    setCreateOpen(true);
  };

  // Extract all technician names dynamically from tickets
  const availableTechnicians = useMemo(() => {
    const set = new Set<string>();
    Object.values(board).forEach((tickets) => {
      tickets?.forEach((t) => {
        if (t.technicianName?.trim()) {
          set.add(t.technicianName.trim());
        }
      });
    });
    return Array.from(set).sort();
  }, [board]);

  // Search filter helper
  const matchesSearch = (ticket: RepairTicket) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      ticket.ticketCode.toLowerCase().includes(q) ||
      ticket.customerName.toLowerCase().includes(q) ||
      ticket.customerPhone.toLowerCase().includes(q) ||
      ticket.device.name.toLowerCase().includes(q) ||
      Boolean(ticket.device.serialNumber && ticket.device.serialNumber.toLowerCase().includes(q)) ||
      Boolean(ticket.technicianName && ticket.technicianName.toLowerCase().includes(q))
    );
  };

  // Date filter helper
  const matchesDate = (ticket: RepairTicket) => {
    if (dateFilter === "all") return true;
    const ticketDateStr = ticket.receivedAt || ticket.deliveredAt || ticket.completedAt;
    if (!ticketDateStr) return true;
    const tDate = new Date(ticketDateStr);
    if (isNaN(tDate.getTime())) return true;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
    const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);

    if (dateFilter === "today") {
      return tDate >= startOfToday && tDate < startOfTomorrow;
    }
    if (dateFilter === "yesterday") {
      return tDate >= startOfYesterday && tDate < startOfToday;
    }
    if (dateFilter === "week") {
      const sevenDaysAgo = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);
      return tDate >= sevenDaysAgo;
    }
    if (dateFilter === "month") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return tDate >= startOfMonth;
    }
    return true;
  };

  // Technician filter helper
  const matchesTechnician = (ticket: RepairTicket) => {
    if (technicianFilter === "all" || !technicianFilter) return true;
    if (technicianFilter === "unassigned") return !ticket.technicianName;
    return ticket.technicianName?.toLowerCase() === technicianFilter.toLowerCase();
  };

  // Combined filter
  const matchesFilter = (ticket: RepairTicket) => {
    return matchesSearch(ticket) && matchesDate(ticket) && matchesTechnician(ticket);
  };

  // Helper to extract tickets for a stage
  const getStageTickets = (stageStatuses: RepairStatus[]) => {
    const result: RepairTicket[] = [];
    stageStatuses.forEach((st) => {
      const list = (board[st] || []).filter(matchesFilter);
      result.push(...list);
    });
    return result;
  };

  // Quick statistics calculated from board matching active date & technician filters
  const stats = useMemo(() => {
    const filterFn = (t: RepairTicket) => matchesDate(t) && matchesTechnician(t) && matchesSearch(t);
    const count = (st: RepairStatus) => (board[st] || []).filter(filterFn).length;

    const received = count("received");
    const diagnosing = count("diagnosing");
    const quoted = count("quoted");
    const repairing = count("approved") + count("repairing");
    const waiting = count("waiting_parts") + count("waiting_supplier");
    const done = count("done");
    const delivered = count("delivered");
    const total = received + diagnosing + quoted + repairing + waiting + done;
    return { received, diagnosing, quoted, repairing, waiting, done, delivered, total };
  }, [board, searchQuery, dateFilter, technicianFilter]);

  // Flattened tickets for Queue / List View
  const queueTickets = useMemo(() => {
    const all: RepairTicket[] = [];
    columns.forEach((col) => {
      if (col.status === "delivered") return;
      const tickets = board[col.status] || [];
      tickets.forEach((t) => {
        if (matchesFilter(t)) all.push(t);
      });
    });
    return all;
  }, [board, searchQuery, dateFilter, technicianFilter]);

  // Delivered tickets
  const deliveredTickets = useMemo(() => {
    return (board.delivered || []).filter(matchesFilter);
  }, [board, searchQuery, dateFilter, technicianFilter]);

  // Paginated slices for Queue & Delivered views
  const totalQueuePages = Math.ceil(queueTickets.length / queuePageSize) || 1;
  const validQueuePage = Math.min(queuePage, totalQueuePages);
  const paginatedQueueTickets = queueTickets.slice(
    (validQueuePage - 1) * queuePageSize,
    validQueuePage * queuePageSize
  );

  const totalDeliveredPages = Math.ceil(deliveredTickets.length / deliveredPageSize) || 1;
  const validDeliveredPage = Math.min(deliveredPage, totalDeliveredPages);
  const paginatedDeliveredTickets = deliveredTickets.slice(
    (validDeliveredPage - 1) * deliveredPageSize,
    validDeliveredPage * deliveredPageSize
  );

  // Quick status filter & empty column toggle
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [hideEmptyColumns, setHideEmptyColumns] = useState<boolean>(false);

  // Smooth scroll & mouse drag controls
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const dragStartX = useRef(0);
  const dragStartScrollLeft = useRef(0);
  const hasDragged = useRef(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const updateScrollArrows = () => {
    if (!scrollerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollerRef.current;
    setCanScrollLeft(scrollLeft > 20);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 20);
  };

  const scrollByAmount = (amount: number) => {
    if (!scrollerRef.current) return;
    scrollerRef.current.scrollBy({ left: amount, behavior: "smooth" });
    setTimeout(updateScrollArrows, 350);
  };

  const scrollToColumn = (status: string) => {
    if (!status) {
      scrollerRef.current?.scrollTo({ left: 0, behavior: "smooth" });
      setTimeout(updateScrollArrows, 350);
      return;
    }
    const colEl =
      document.getElementById(`kanban-stage-stage_${status}`) ||
      document.getElementById(`kanban-col-${status}`) ||
      document.getElementById(`kanban-stage-${status}`);
    if (colEl && scrollerRef.current) {
      const containerLeft = scrollerRef.current.getBoundingClientRect().left;
      const colLeft = colEl.getBoundingClientRect().left;
      const targetScrollLeft = scrollerRef.current.scrollLeft + (colLeft - containerLeft) - 20;
      scrollerRef.current.scrollTo({ left: Math.max(0, targetScrollLeft), behavior: "smooth" });
      setTimeout(updateScrollArrows, 350);
    }
  };

  // Convert vertical mouse wheel into horizontal glide
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        if (el.scrollWidth > el.clientWidth) {
          const canLeft = el.scrollLeft > 0 && e.deltaY < 0;
          const canRight = el.scrollLeft < el.scrollWidth - el.clientWidth && e.deltaY > 0;
          if (canLeft || canRight) {
            e.preventDefault();
            el.scrollLeft += e.deltaY * 1.25;
            updateScrollArrows();
          }
        }
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    el.addEventListener("scroll", updateScrollArrows);
    updateScrollArrows();

    const timer = setTimeout(updateScrollArrows, 150);
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => updateScrollArrows());
      resizeObserver.observe(el);
    }

    return () => {
      clearTimeout(timer);
      resizeObserver?.disconnect();
      el.removeEventListener("wheel", handleWheel);
      el.removeEventListener("scroll", updateScrollArrows);
    };
  }, [hideEmptyColumns, statusFilter, viewMode, board]);

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button, a, input, textarea, select")) return;
    if (!scrollerRef.current) return;

    setIsMouseDown(true);
    hasDragged.current = false;
    dragStartX.current = e.pageX;
    dragStartScrollLeft.current = scrollerRef.current.scrollLeft;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDown || !scrollerRef.current) return;
    const diff = e.pageX - dragStartX.current;
    if (Math.abs(diff) > 4) {
      hasDragged.current = true;
      scrollerRef.current.scrollLeft = dragStartScrollLeft.current - diff * 1.3;
      updateScrollArrows();
    }
  };

  const handleMouseUp = () => {
    setIsMouseDown(false);
  };

  // Filtered stages for 6-Stage Pipeline
  const visibleStages = PIPELINE_STAGES.filter((stage) => {
    if (statusFilter) {
      if (statusFilter === "received") return stage.id === "stage_received";
      if (statusFilter === "diagnosing") return stage.id === "stage_diagnosing";
      if (statusFilter === "quoted") return stage.id === "stage_quoted";
      if (statusFilter === "repairing") return stage.id === "stage_repairing";
      if (statusFilter === "waiting") return stage.id === "stage_waiting";
      if (statusFilter === "done") return stage.id === "stage_done";
      if (statusFilter === "delivered") return stage.id === "stage_delivered";
    }
    if (hideEmptyColumns) {
      const tickets = getStageTickets(stage.statuses);
      return tickets.length > 0;
    }
    return true;
  });

  // Filtered columns for 9-Column Detailed view
  const visibleColumns = columns.filter((col) => {
    if (statusFilter) {
      if (statusFilter === "received") return col.status === "received";
      if (statusFilter === "diagnosing") return col.status === "diagnosing" || col.status === "quoted";
      if (statusFilter === "repairing")
        return ["approved", "repairing", "waiting_parts", "waiting_supplier"].includes(col.status);
      if (statusFilter === "done") return col.status === "done" || col.status === "delivered";
    }
    if (hideEmptyColumns) {
      const count = (board[col.status] || []).filter(matchesSearch).length;
      return count > 0;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Header & Quick Action Buttons */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
              Quản lý bảo hành & sửa chữa
            </h1>
            <span className="rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-xs font-bold text-slate-700">
              {stats.total} máy đang xử lý
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Phân tách: <b>Bảo hành (máy hệ thống)</b> vs <b>Sửa chữa dịch vụ (khách ngoài)</b>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode(viewMode === "delivered" ? "pipeline6" : "delivered")}
            className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs sm:text-sm font-bold transition shadow-2xs cursor-pointer ${
              viewMode === "delivered"
                ? "bg-teal-600 text-white border-teal-600 shadow-teal-500/20"
                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <span>Lịch sử đã giao ({stats.delivered})</span>
          </button>
          <button
            type="button"
            onClick={openNewServiceTicket}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-orange-700 transition cursor-pointer"
          >
            Tiếp nhận sửa dịch vụ
          </button>
        </div>
      </div>

      {/* Sleek Interactive Quick Metrics Strip with 1-Click Jump */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => {
              setStatusFilter("");
              if (viewMode === "delivered") setViewMode("pipeline6");
            }}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
              !statusFilter && viewMode !== "delivered"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            Tất cả <span className="rounded-full bg-slate-200/50 px-1.5 py-0.2 text-[10px]">{stats.total}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusFilter(statusFilter === "received" ? "" : "received");
              if (viewMode === "delivered") setViewMode("pipeline6");
              scrollToColumn("received");
            }}
            className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold transition cursor-pointer ${
              statusFilter === "received" && viewMode !== "delivered"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-blue-50/80 text-blue-700 border border-blue-200/70 hover:bg-blue-100/70"
            }`}
          >
            <span>1. Tiếp nhận</span>
            <span className="rounded-full bg-blue-200/60 px-1.5 py-0.2 text-[10px]">{stats.received}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusFilter(statusFilter === "diagnosing" ? "" : "diagnosing");
              if (viewMode === "delivered") setViewMode("pipeline6");
              scrollToColumn("diagnosing");
            }}
            className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold transition cursor-pointer ${
              statusFilter === "diagnosing" && viewMode !== "delivered"
                ? "bg-amber-600 text-white shadow-xs"
                : "bg-amber-50/80 text-amber-800 border border-amber-200/70 hover:bg-amber-100/70"
            }`}
          >
            <span>2. Kiểm tra</span>
            <span className="rounded-full bg-amber-200/60 px-1.5 py-0.2 text-[10px]">{stats.diagnosing}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusFilter(statusFilter === "quoted" ? "" : "quoted");
              if (viewMode === "delivered") setViewMode("pipeline6");
              scrollToColumn("quoted");
            }}
            className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold transition cursor-pointer ${
              statusFilter === "quoted" && viewMode !== "delivered"
                ? "bg-purple-600 text-white shadow-xs"
                : "bg-purple-50/80 text-purple-800 border border-purple-200/70 hover:bg-purple-100/70"
            }`}
          >
            <span>3. Báo giá</span>
            <span className="rounded-full bg-purple-200/60 px-1.5 py-0.2 text-[10px]">{stats.quoted}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusFilter(statusFilter === "repairing" ? "" : "repairing");
              if (viewMode === "delivered") setViewMode("pipeline6");
              scrollToColumn("repairing");
            }}
            className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold transition cursor-pointer ${
              statusFilter === "repairing" && viewMode !== "delivered"
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-indigo-50/80 text-indigo-700 border border-indigo-200/70 hover:bg-indigo-100/70"
            }`}
          >
            <span>4. Đang sửa</span>
            <span className="rounded-full bg-indigo-200/60 px-1.5 py-0.2 text-[10px]">{stats.repairing}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusFilter(statusFilter === "waiting" ? "" : "waiting");
              if (viewMode === "delivered") setViewMode("pipeline6");
              scrollToColumn("waiting_parts");
            }}
            className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold transition cursor-pointer ${
              statusFilter === "waiting" && viewMode !== "delivered"
                ? "bg-orange-600 text-white shadow-xs"
                : "bg-orange-50/80 text-orange-800 border border-orange-200/70 hover:bg-orange-100/70"
            }`}
          >
            <span>5. Chờ phụ tùng</span>
            <span className="rounded-full bg-orange-200/60 px-1.5 py-0.2 text-[10px]">{stats.waiting}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusFilter(statusFilter === "done" ? "" : "done");
              if (viewMode === "delivered") setViewMode("pipeline6");
              scrollToColumn("done");
            }}
            className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold transition cursor-pointer ${
              statusFilter === "done" && viewMode !== "delivered"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-emerald-50/80 text-emerald-800 border border-emerald-200/70 hover:bg-emerald-100/70"
            }`}
          >
            <span>6. Chờ giao</span>
            <span className="rounded-full bg-emerald-200/60 px-1.5 py-0.2 text-[10px]">{stats.done}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (viewMode === "delivered") {
                setViewMode("pipeline6");
                setStatusFilter("");
              } else {
                setStatusFilter(statusFilter === "delivered" ? "" : "delivered");
                scrollToColumn("delivered");
              }
            }}
            className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold transition cursor-pointer ${
              (statusFilter === "delivered" || viewMode === "delivered")
                ? "bg-teal-700 text-white shadow-xs"
                : "bg-teal-50 text-teal-800 border border-teal-200/70 hover:bg-teal-100/70"
            }`}
          >
            <span>7. Đã giao</span>
            <span className="rounded-full bg-teal-200/70 px-1.5 py-0.2 text-[10px] text-teal-900">{stats.delivered}</span>
          </button>
        </div>

      </div>

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 font-medium">{error}</p>}

      {/* Control Bar: Search, Date Presets, Technician Filter, Type Filter, Hide Empty Columns Toggle, View Switcher */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Instant Search Bar */}
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Tìm mã phiếu, khách, SĐT, IMEI..."
            size="sm"
            className="flex-1 min-w-[200px] max-w-sm"
          />

          {/* Quick Date Presets */}
          <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setDateFilter("all")}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                dateFilter === "all" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Tất cả ngày
            </button>
            <button
              type="button"
              onClick={() => setDateFilter("today")}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                dateFilter === "today" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Hôm nay
            </button>
            <button
              type="button"
              onClick={() => setDateFilter("yesterday")}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                dateFilter === "yesterday" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Hôm qua
            </button>
            <button
              type="button"
              onClick={() => setDateFilter("week")}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                dateFilter === "week" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              7 ngày qua
            </button>
            <button
              type="button"
              onClick={() => setDateFilter("month")}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                dateFilter === "month" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Tháng này
            </button>
          </div>
        </div>

        {/* Secondary Filter Row: Ticket Source, Technician Dropdown, Hide Empty Columns */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {/* Ticket Source Filters */}
            <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setTicketTypeFilter("")}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                  !ticketTypeFilter ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Tất cả nguồn
              </button>
              <button
                type="button"
                onClick={() => setTicketTypeFilter("warranty")}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                  ticketTypeFilter === "warranty" ? "bg-blue-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Bảo hành
              </button>
              <button
                type="button"
                onClick={() => setTicketTypeFilter("service")}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                  ticketTypeFilter === "service" ? "bg-orange-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Sửa chữa
              </button>
            </div>

            {/* Technician Filter Dropdown */}
            <Dropdown<string>
              aria-label="Lọc theo kỹ thuật viên"
              value={technicianFilter}
              onChange={(val) => setTechnicianFilter(val)}
              options={[
                { value: "all", label: "Tất cả kỹ thuật viên" },
                { value: "unassigned", label: "Chưa giao KTV" },
                ...availableTechnicians.map((tech) => ({
                  value: tech,
                  label: `KTV: ${tech}`,
                })),
              ]}
              variant="filter"
              size="sm"
            />

            {/* Clear filters button if any active filter */}
            {(dateFilter !== "all" || technicianFilter !== "all" || ticketTypeFilter || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setDateFilter("all");
                  setTechnicianFilter("all");
                  setTicketTypeFilter("");
                  setSearchQuery("");
                }}
                className="text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:underline px-1.5 py-1 cursor-pointer"
              >
                Xóa bộ lọc
              </button>
            )}
          </div>

          {/* Toggle Hide Empty Columns */}
          {(viewMode === "pipeline6" || viewMode === "detailed9") && (
            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-600 select-none hover:text-slate-900 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50">
              <input
                type="checkbox"
                checked={hideEmptyColumns}
                onChange={(e) => setHideEmptyColumns(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
              />
              <span>Ẩn bước trống</span>
            </label>
          )}
        </div>
      </div>

      {/* 6-Stage Standard Pipeline (Default - Recommended) */}
      {viewMode === "pipeline6" && (
        <div className="relative group/kanban">
          {/* Floating Left Navigation Arrow */}
          <button
            type="button"
            aria-label="Cuộn sang trái"
            title="Cuộn sang trái (hoặc lăn chuột lên)"
            disabled={!canScrollLeft}
            onClick={() => scrollByAmount(-370)}
            className={`absolute -left-3 sm:-left-5 top-1/2 -translate-y-1/2 z-20 hidden sm:flex h-12 w-12 items-center justify-center rounded-full border border-slate-200/90 bg-white/95 backdrop-blur-md shadow-2xl transition-all duration-200 ${
              canScrollLeft
                ? "text-slate-700 hover:bg-cyan-600 hover:text-white hover:border-cyan-600 hover:scale-110 active:scale-95 cursor-pointer shadow-cyan-500/20"
                : "text-slate-300 opacity-30 cursor-not-allowed hover:bg-white"
            }`}
          >
            <ChevronLeft className="h-6 w-6 stroke-[2.5]" />
          </button>

          {/* Floating Right Navigation Arrow */}
          <button
            type="button"
            aria-label="Cuộn sang phải"
            title="Cuộn sang phải (hoặc lăn chuột xuống)"
            disabled={!canScrollRight}
            onClick={() => scrollByAmount(370)}
            className={`absolute -right-3 sm:-right-5 top-1/2 -translate-y-1/2 z-20 hidden sm:flex h-12 w-12 items-center justify-center rounded-full border border-slate-200/90 bg-white/95 backdrop-blur-md shadow-2xl transition-all duration-200 ${
              canScrollRight
                ? "text-slate-700 hover:bg-cyan-600 hover:text-white hover:border-cyan-600 hover:scale-110 active:scale-95 cursor-pointer shadow-cyan-500/20"
                : "text-slate-300 opacity-30 cursor-not-allowed hover:bg-white"
            }`}
          >
            <ChevronRight className="h-6 w-6 stroke-[2.5]" />
          </button>

          <div
            ref={scrollerRef}
            data-testid="repair-board-scroll"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className={`-mx-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0 select-none ${
              isMouseDown ? "cursor-grabbing" : "cursor-grab"
            }`}
          >
            <div className="flex min-w-[1250px] gap-4 pb-2">
              {visibleStages.map((stage) => (
                <RepairKanbanStage
                  key={stage.id}
                  stage={stage}
                  tickets={getStageTickets(stage.statuses)}
                  busyId={busyId}
                  hasDragged={hasDragged}
                  onSelectTicket={setSelected}
                  onMoveForward={startMoveForward}
                  onViewAllDelivered={() => setViewMode("delivered")}
                  totalDeliveredCount={deliveredTickets.length}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 9-Column Detailed Kanban View (Classic) */}
      {viewMode === "detailed9" && (
        <div className="relative group/kanban">
          {/* Floating Left Arrow */}
          <button
            type="button"
            aria-label="Cuộn sang trái"
            title="Cuộn sang trái (hoặc lăn chuột lên)"
            disabled={!canScrollLeft}
            onClick={() => scrollByAmount(-350)}
            className={`absolute -left-3 sm:-left-5 top-1/2 -translate-y-1/2 z-20 hidden sm:flex h-12 w-12 items-center justify-center rounded-full border border-slate-200/90 bg-white/95 backdrop-blur-md shadow-2xl transition-all duration-200 ${
              canScrollLeft
                ? "text-slate-700 hover:bg-cyan-600 hover:text-white hover:border-cyan-600 hover:scale-110 active:scale-95 cursor-pointer shadow-cyan-500/20"
                : "text-slate-300 opacity-30 cursor-not-allowed hover:bg-white"
            }`}
          >
            <ChevronLeft className="h-6 w-6 stroke-[2.5]" />
          </button>

          {/* Floating Right Arrow */}
          <button
            type="button"
            aria-label="Cuộn sang phải"
            title="Cuộn sang phải (hoặc lăn chuột xuống)"
            disabled={!canScrollRight}
            onClick={() => scrollByAmount(350)}
            className={`absolute -right-3 sm:-right-5 top-1/2 -translate-y-1/2 z-20 hidden sm:flex h-12 w-12 items-center justify-center rounded-full border border-slate-200/90 bg-white/95 backdrop-blur-md shadow-2xl transition-all duration-200 ${
              canScrollRight
                ? "text-slate-700 hover:bg-cyan-600 hover:text-white hover:border-cyan-600 hover:scale-110 active:scale-95 cursor-pointer shadow-cyan-500/20"
                : "text-slate-300 opacity-30 cursor-not-allowed hover:bg-white"
            }`}
          >
            <ChevronRight className="h-6 w-6 stroke-[2.5]" />
          </button>

          <div
            ref={scrollerRef}
            data-testid="repair-board-scroll-detailed"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className={`-mx-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0 select-none ${
              isMouseDown ? "cursor-grabbing" : "cursor-grab"
            }`}
          >
            <div className="flex min-w-[1250px] gap-4 pb-2">
              {visibleColumns.map((column) => (
                <RepairKanbanColumn
                  key={column.status}
                  column={column}
                  tickets={(board[column.status] || []).filter(matchesFilter)}
                  busyId={busyId}
                  hasDragged={hasDragged}
                  onSelectTicket={setSelected}
                  onMoveForward={startMoveForward}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Non-tech Friendly Queue / List View */}
      {viewMode === "queue" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">
              Danh sách hàng đợi xử lý ({queueTickets.length} phiếu)
            </h3>
            <span className="text-xs text-slate-400">Nhấp vào dòng để xem chi tiết hoặc bóc tách linh kiện</span>
          </div>

          {queueTickets.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <p className="text-sm">Không tìm thấy phiếu nào phù hợp với bộ lọc hiện tại.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 uppercase tracking-wider font-bold">
                    <th className="py-3 px-2">Mã & Loại</th>
                    <th className="py-3 px-2">Thiết bị / IMEI</th>
                    <th className="py-3 px-2">Khách hàng</th>
                    <th className="py-3 px-2">Trạng thái hiện tại</th>
                    <th className="py-3 px-2">Kỹ thuật viên</th>
                    <th className="py-3 px-2 text-right">Chi phí</th>
                    <th className="py-3 px-2 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedQueueTickets.map((ticket) => {
                    const isService = ticket.ticketType === "service";
                    return (
                      <tr
                        key={ticket._id}
                        onClick={() => setSelected(ticket)}
                        className="cursor-pointer hover:bg-slate-50/80 transition"
                      >
                        <td className="py-3 px-2">
                          <span className="font-bold text-cyan-700 block">{ticket.ticketCode}</span>
                          <span
                            className={`inline-block mt-0.5 rounded px-1.5 py-0.2 text-[10px] font-bold border ${
                              getTicketBadge(ticket).badgeClass
                            }`}
                          >
                            {getTicketBadge(ticket).label}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          <span className="font-semibold text-slate-900 block">{ticket.device.name}</span>
                          <span className="font-mono text-[11px] text-slate-400">
                            {ticket.device.serialNumber || "Không có IMEI"}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          <span className="font-medium text-slate-800 block">{ticket.customerName}</span>
                          <span className="text-slate-400">{ticket.customerPhone}</span>
                        </td>
                        <td className="py-3 px-2">
                          <span className="rounded-full bg-slate-100 border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                            {repairStatusLabel(ticket.status)}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-slate-600">
                          {ticket.technicianName || <span className="text-slate-400 italic">Chưa giao</span>}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <span className="font-bold text-slate-900 block">{money(ticket.totalAmount)} đ</span>
                          {ticket.dueAmount > 0 && (
                            <span className="text-[11px] text-rose-600 font-semibold">
                              Nợ {money(ticket.dueAmount)} đ
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                          {(nextStatus[ticket.status] || ticket.status === "quoted") ? (
                            <button
                              type="button"
                              disabled={busyId === ticket._id}
                              onClick={() => startMoveForward(ticket)}
                              className="rounded-lg bg-cyan-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-cyan-700 disabled:opacity-50 transition cursor-pointer"
                            >
                              {ticket.status === "quoted" ? "Duyệt báo giá" : "Chuyển tiếp"}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setSelected(ticket)}
                              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 cursor-pointer"
                            >
                              Chi tiết
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <TablePagination
                currentPage={validQueuePage}
                totalPages={totalQueuePages}
                pageSize={queuePageSize}
                totalItems={queueTickets.length}
                onPageChange={setQueuePage}
                onPageSizeChange={setQueuePageSize}
                itemLabel="phiếu"
              />
            </div>
          )}
        </div>
      )}

      {/* Delivered Machines View */}
      {viewMode === "delivered" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Lịch sử máy đã bàn giao ({deliveredTickets.length} máy)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Các thiết bị đã hoàn tất sửa chữa và bàn giao cho khách hàng.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setViewMode("pipeline6")}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            >
              Quay lại bảng xử lý
            </button>
          </div>

          {deliveredTickets.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <p className="text-sm">Chưa có thiết bị nào trong danh sách đã giao.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 uppercase tracking-wider font-bold">
                    <th className="py-3 px-2">Mã & Loại</th>
                    <th className="py-3 px-2">Thiết bị / IMEI</th>
                    <th className="py-3 px-2">Khách hàng</th>
                    <th className="py-3 px-2">Kỹ thuật viên</th>
                    <th className="py-3 px-2">Thời gian giao</th>
                    <th className="py-3 px-2 text-right">Tổng tiền</th>
                    <th className="py-3 px-2 text-right">Công nợ</th>
                    <th className="py-3 px-2 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedDeliveredTickets.map((ticket) => {
                    const badge = getTicketBadge(ticket);
                    return (
                      <tr
                        key={ticket._id}
                        onClick={() => setSelected(ticket)}
                        className="cursor-pointer hover:bg-slate-50/80 transition"
                      >
                        <td className="py-3 px-2">
                          <span className="font-bold text-cyan-700 block">{ticket.ticketCode}</span>
                          <span className={`inline-block mt-0.5 rounded px-1.5 py-0.2 text-[10px] font-bold border ${badge.badgeClass}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          <span className="font-semibold text-slate-900 block">{ticket.device.name}</span>
                          <span className="font-mono text-[11px] text-slate-400">
                            {ticket.device.serialNumber || "Không có IMEI"}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          <span className="font-medium text-slate-800 block">{ticket.customerName}</span>
                          <span className="text-slate-400">{ticket.customerPhone}</span>
                        </td>
                        <td className="py-3 px-2 text-slate-600">
                          {ticket.technicianName || <span className="text-slate-400 italic">—</span>}
                        </td>
                        <td className="py-3 px-2 text-slate-500 font-medium">
                          {date(ticket.deliveredAt || ticket.completedAt || ticket.receivedAt)}
                        </td>
                        <td className="py-3 px-2 text-right font-bold text-slate-900">
                          {money(ticket.totalAmount)} đ
                        </td>
                        <td className="py-3 px-2 text-right">
                          {ticket.dueAmount > 0 ? (
                            <span className="text-rose-600 font-bold">{money(ticket.dueAmount)} đ</span>
                          ) : (
                            <span className="text-emerald-600 font-semibold">Đã thanh toán</span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setSelected(ticket)}
                            className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-teal-700 bg-teal-50/50 hover:bg-teal-100/70 transition cursor-pointer"
                          >
                            Xem & Hoàn tiền
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <TablePagination
                currentPage={validDeliveredPage}
                totalPages={totalDeliveredPages}
                pageSize={deliveredPageSize}
                totalItems={deliveredTickets.length}
                onPageChange={setDeliveredPage}
                onPageSizeChange={setDeliveredPageSize}
                itemLabel="phiếu"
              />
            </div>
          )}
        </div>
      )}

      {receivingTicket && (
        <ReceiveTechnicianModal
          ticket={receivingTicket}
          onClose={() => setReceivingTicket(null)}
          onSubmit={(technicianId) => moveForward(receivingTicket, technicianId)}
        />
      )}

      {selected && (
        <TicketModal
          ticket={{
            ...selected,
            statusHistory: selected.statusHistory?.map((entry) => ({
              ...entry,
              note: [entry.note, entry.technicianName ? `KT nhận: ${entry.technicianName}` : ""]
                .filter(Boolean)
                .join(" · ") || undefined,
            })),
          }}
          onClose={() => setSelected(null)}
          onChanged={() => void loadBoard()}
        />
      )}

      {createOpen && (
        <CreateRepairModal
          prefill={activePrefill || {}}
          onClose={() => {
            setCreateOpen(false);
            setActivePrefill(null);
            onCreatePrefillConsumed?.();
          }}
          onCreated={() => {
            setCreateOpen(false);
            setActivePrefill(null);
            onCreatePrefillConsumed?.();
            void loadBoard();
          }}
        />
      )}
    </div>
  );
}
