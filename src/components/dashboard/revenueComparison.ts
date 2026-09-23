export function revenueComparisonRange(filter: "month" | "quarter" | "year", now = new Date()) {
  const to = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const [year, month] = to.split("-").map(Number);
  const startMonth = filter === "year" ? 0 : filter === "quarter" ? Math.floor((month - 1) / 3) * 3 : month - 1;
  const months = filter === "year" ? 12 : filter === "quarter" ? 3 : 1;
  const day = (d: Date) => d.toISOString().slice(0, 10);
  return { from: day(new Date(Date.UTC(year, startMonth, 1))), to,
    previousFrom: day(new Date(Date.UTC(year, startMonth - months, 1))),
    previousTo: day(new Date(Date.UTC(year, startMonth, 0))),
    granularity: (filter === "month" ? "day" : filter === "quarter" ? "week" : "month") as "day" | "week" | "month" };
}
