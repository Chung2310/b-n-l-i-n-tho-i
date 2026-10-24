export function todayLocalDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function hireDateInputValue(value?: string | Date | null): string {
  if (!value) return "";
  const date = value instanceof Date ? value.toISOString() : String(value);
  return date.slice(0, 10);
}

export function formatHireDate(value?: string | Date | null): string {
  const iso = hireDateInputValue(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "Chưa cập nhật";
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}
