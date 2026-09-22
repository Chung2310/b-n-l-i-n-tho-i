export type AutoDurationContractType =
  | "Hợp đồng thử việc 3 ngày"
  | "Hợp đồng thử việc 7 ngày"
  | "Hợp đồng thử việc 2 tháng";

function formatUtcDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addCalendarMonths(startDate: string, months: number): string {
  const [year, month, day] = startDate.split("-").map(Number);
  const targetMonthStart = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDayOfTargetMonth = new Date(Date.UTC(
    targetMonthStart.getUTCFullYear(),
    targetMonthStart.getUTCMonth() + 1,
    0,
  )).getUTCDate();
  targetMonthStart.setUTCDate(Math.min(day, lastDayOfTargetMonth));
  return formatUtcDate(targetMonthStart);
}

export function calculateContractEndDate(contractType: string, startDate: string): string {
  if (!startDate) return "";

  if (contractType === "Hợp đồng thử việc 2 tháng") {
    return addCalendarMonths(startDate, 2);
  }

  const days = contractType === "Hợp đồng thử việc 3 ngày"
    ? 3
    : contractType === "Hợp đồng thử việc 7 ngày"
      ? 7
      : 0;
  if (!days) return "";

  const result = new Date(`${startDate}T00:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return formatUtcDate(result);
}
