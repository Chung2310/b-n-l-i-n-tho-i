import type { PayrollAttendanceLog, PayrollOvertime } from "./attendance-payroll.service";

type Shift = {
  startTime: string;
  endTime: string;
  standardDailyMinutes: number;
  breakStart?: string;
  breakEnd?: string;
  breakPeriods?: { startTime: string; endTime: string; paid?: boolean }[];
};
const clock = (value?: string) => {
  if (!value || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return undefined;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
};

/** Split recorded attendance once: regular minutes never include overtime. */
export function splitPayrollAttendance(log: PayrollAttendanceLog, shift: Shift, category: PayrollOvertime["category"]) {
  let start = clock(log.checkIn);
  let end = clock(log.checkOut);
  const shiftStart = clock(shift.startTime);
  let shiftEnd = clock(shift.endTime);
  if (start === undefined || end === undefined || shiftStart === undefined || shiftEnd === undefined
    || log.status === "Absent" || log.status === "Approved-Leave") {
    return { regularWorkedMinutes: 0, overtime: [] as PayrollOvertime[] };
  }
  const overnight = shiftEnd <= shiftStart;
  if (overnight) {
    shiftEnd += 1440;
    if (start < shiftEnd - 1440) start += 1440;
  }
  while (end < start) end += 1440;
  const breaks = (shift.breakPeriods ?? [{ startTime: shift.breakStart, endTime: shift.breakEnd }])
    .filter(item => !("paid" in item && item.paid))
    .map(item => ({ start: clock(item.startTime), end: clock(item.endTime) }));
  const inBreak = (minute: number) => {
    const time = minute % 1440;
    return breaks.some(({ start, end }) => start !== undefined && end !== undefined
      && (end < start ? time >= start || time < end : time >= start && time < end));
  };
  let regularWorkedMinutes = 0;
  let dayOvertime = 0;
  let nightOvertime = 0;
  for (let minute = start; minute < end; minute += 1) {
    if (inBreak(minute)) continue;
    if (category === "weekday" && minute >= shiftStart && minute < shiftEnd) regularWorkedMinutes += 1;
    else if (minute % 1440 >= 22 * 60 || minute % 1440 < 6 * 60) nightOvertime += 1;
    else dayOvertime += 1;
  }
  const overtime: PayrollOvertime[] = [];
  if (dayOvertime) overtime.push({ minutes: dayOvertime, category });
  if (nightOvertime) overtime.push({ minutes: nightOvertime, category, night: true });
  return { regularWorkedMinutes: Math.min(regularWorkedMinutes, shift.standardDailyMinutes), overtime };
}
