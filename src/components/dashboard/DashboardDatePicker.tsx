import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import "./dashboard-date-picker.css";

interface DashboardDatePickerProps {
  value: string;
  onChange: (date: string) => void;
}

const weekdays = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function DashboardDatePicker({ value, onChange }: DashboardDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(`${value}T12:00:00`));
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = new Date(`${value}T12:00:00`);
  const firstDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(firstDay.getFullYear(), firstDay.getMonth() + 1, 0).getDate();
  const today = formatDate(new Date());

  useEffect(() => {
    setVisibleMonth(new Date(`${value}T12:00:00`));
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, [open]);

  const moveMonth = (offset: number) => {
    setVisibleMonth(current => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  return (
    <div ref={rootRef} className="dashboard-date-picker">
      <button
        type="button"
        aria-label="Chọn ngày tổng quan"
        aria-expanded={open}
        aria-haspopup="dialog"
        className="dashboard-date-trigger"
        onClick={() => setOpen(current => !current)}
      >
        <CalendarDays size={16} aria-hidden="true" />
        <span>{selected.toLocaleDateString("vi-VN", { day: "numeric", month: "long", year: "numeric" })}</span>
        <ChevronDown size={14} aria-hidden="true" className={open ? "dashboard-date-chevron-open" : ""} />
      </button>
      {open && (
        <div role="dialog" aria-label="Lịch chọn ngày tổng quan" className="dashboard-date-popover">
          <div className="dashboard-date-month">
            <button type="button" aria-label="Tháng trước" onClick={() => moveMonth(-1)}><ChevronLeft size={16} /></button>
            <strong>Tháng {visibleMonth.getMonth() + 1}, {visibleMonth.getFullYear()}</strong>
            <button type="button" aria-label="Tháng sau" onClick={() => moveMonth(1)}><ChevronRight size={16} /></button>
          </div>
          <div className="dashboard-date-grid">
            {weekdays.map(day => <span key={day} className="dashboard-date-weekday">{day}</span>)}
            {Array.from({ length: startOffset }, (_, index) => <span key={`blank-${index}`} />)}
            {Array.from({ length: daysInMonth }, (_, index) => {
              const date = new Date(firstDay.getFullYear(), firstDay.getMonth(), index + 1);
              const isoDate = formatDate(date);
              return (
                <button
                  key={isoDate}
                  type="button"
                  aria-label={date.toLocaleDateString("vi-VN")}
                  aria-pressed={isoDate === value}
                  className={`dashboard-date-day${isoDate === today ? " dashboard-date-today" : ""}`}
                  onClick={() => { onChange(isoDate); setOpen(false); }}
                >{index + 1}</button>
              );
            })}
          </div>
          <button type="button" className="dashboard-date-go-today" onClick={() => { onChange(today); setOpen(false); }}>Hôm nay</button>
        </div>
      )}
    </div>
  );
}
