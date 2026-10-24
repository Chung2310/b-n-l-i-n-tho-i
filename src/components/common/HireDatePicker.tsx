import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface HireDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  id: string;
}

const weekDays = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function pad(number: number): string {
  return String(number).padStart(2, "0");
}

function formatIsoDate(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function initialMonth(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
  const today = new Date();
  return new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1));
}

export function HireDatePicker({ value, onChange, label, id }: HireDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => initialMonth(value));
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const panelHeight = panelRef.current?.offsetHeight || 320;
      const below = window.innerHeight - rect.bottom;
      const top = below >= panelHeight + 8 || below >= rect.top
        ? Math.min(rect.bottom + 6, window.innerHeight - panelHeight - 8)
        : rect.top - panelHeight - 6;
      setPosition({
        top: Math.max(8, top),
        left: Math.max(8, Math.min(rect.left, window.innerWidth - 304)),
      });
    };
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); triggerRef.current?.focus(); }
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const changeMonth = (amount: number) => setMonth((current) =>
    new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + amount, 1)));
  const monthStart = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1));
  const firstWeekday = (monthStart.getUTCDay() + 6) % 7;
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const displayDate = value && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}` : "Chọn ngày";

  return <>
    <button
      ref={triggerRef}
      id={id}
      type="button"
      aria-label={label}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={() => { setMonth(initialMonth(value)); setOpen((current) => !current); }}
      className="flex min-h-10 w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 text-left text-xs text-slate-800 outline-none transition-colors hover:border-blue-300 focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-100"
    >
      <span className="truncate">{displayDate}</span>
      <span className="flex shrink-0 items-center gap-1.5 text-slate-400"><CalendarDays className="h-4 w-4" /><ChevronDown className="h-3.5 w-3.5" /></span>
    </button>
    {open && createPortal(<div
      ref={panelRef}
      role="dialog"
      aria-label={`Lịch chọn ${label.toLowerCase()}`}
      className="fixed z-[110] max-h-[calc(100vh-16px)] w-[296px] max-w-[calc(100vw-16px)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-xl"
      style={{ top: position.top, left: position.left }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <button type="button" aria-label="Năm trước" onClick={() => changeMonth(-12)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><ChevronsLeft className="h-4 w-4" /></button>
        <button type="button" aria-label="Tháng trước" onClick={() => changeMonth(-1)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><ChevronLeft className="h-4 w-4" /></button>
        <span className="flex-1 text-center text-xs text-slate-800">Tháng {month.getUTCMonth() + 1} / {month.getUTCFullYear()}</span>
        <button type="button" aria-label="Tháng sau" onClick={() => changeMonth(1)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><ChevronRight className="h-4 w-4" /></button>
        <button type="button" aria-label="Năm sau" onClick={() => changeMonth(12)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><ChevronsRight className="h-4 w-4" /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {weekDays.map((day) => <span key={day} className="py-1 text-[10px] text-slate-400">{day}</span>)}
        {Array.from({ length: 42 }, (_, index) => {
          const date = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), index - firstWeekday + 1));
          const iso = formatIsoDate(date);
          const inMonth = date.getUTCMonth() === month.getUTCMonth();
          return <button
            key={iso}
            type="button"
            aria-label={`${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}`}
            aria-pressed={value === iso}
            onClick={() => { onChange(iso); setOpen(false); triggerRef.current?.focus(); }}
            className={`flex h-8 items-center justify-center rounded-lg text-xs transition-colors ${value === iso ? "bg-blue-600 text-white" : inMonth ? "text-slate-700 hover:bg-blue-50 hover:text-blue-700" : "text-slate-300 hover:bg-slate-50"} ${todayIso === iso && value !== iso ? "ring-1 ring-inset ring-blue-300" : ""}`}
          >{date.getUTCDate()}</button>;
        })}
      </div>
      <div className="mt-2 flex justify-between border-t border-slate-100 pt-2 text-xs">
        <button type="button" onClick={() => { onChange(""); setOpen(false); }} className="rounded-lg px-2 py-1.5 text-slate-500 hover:bg-slate-100">Xóa ngày</button>
        <button type="button" onClick={() => { onChange(todayIso); setOpen(false); }} className="rounded-lg px-2 py-1.5 text-blue-600 hover:bg-blue-50">Hôm nay</button>
      </div>
    </div>, document.body)}
  </>;
}
