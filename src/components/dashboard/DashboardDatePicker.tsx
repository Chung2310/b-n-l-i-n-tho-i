import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import "./dashboard-date-picker.css";

export function DashboardDatePicker() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const options: Intl.DateTimeFormatOptions = { timeZone: "Asia/Ho_Chi_Minh" };
  const weekday = new Intl.DateTimeFormat("vi-VN", { ...options, weekday: "long" }).format(now);
  const date = new Intl.DateTimeFormat("vi-VN", { ...options, day: "numeric", month: "long", year: "numeric" }).format(now);

  return (
    <div className="dashboard-date-trigger" aria-label="Ngày hôm nay">
      <CalendarDays size={16} aria-hidden="true" />
      <span>{weekday}, {date}</span>
    </div>
  );
}
