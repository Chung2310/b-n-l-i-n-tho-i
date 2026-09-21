import { describe, expect, it } from "vitest";
import { splitPayrollAttendance } from "./payroll-attendance-overtime.service";
import { summarizeAttendanceForPayroll } from "./attendance-payroll.service";
import { calculatePayroll } from "./payroll-calculation.service";
const shift = { startTime: "08:00", endTime: "17:00", standardDailyMinutes: 480, breakStart: "12:00", breakEnd: "13:00" };
const log = { date: "2026-07-01", status: "Present" as const, checkIn: "08:00", checkOut: "19:00" };

describe("automatic payroll overtime", () => {
  it("pays two extra hours without adding them to regular pay", () => {
    const split = splitPayrollAttendance(log, shift, "weekday");
    expect(split).toEqual({ regularWorkedMinutes: 480, overtime: [{ minutes: 120, category: "weekday" }] });
    const attendance = summarizeAttendanceForPayroll({ ...shift, logs: [{ ...log, regularWorkedMinutes: split.regularWorkedMinutes }], paidLeaves: [], overtime: split.overtime });
    const pay = calculatePayroll({ ...attendance, monthlySalary: 20800000, standardDays: 26, standardHours: 208, allowances: 0, bonuses: 0, deductions: 0, adjustments: 0 });
    expect(pay.adjustedBase).toBe(800000);
    expect(pay.overtime).toBe(300000);
    expect(pay.net).toBe(1100000);
  });
  it("does not let late arrival consume overtime or hide missing regular hours", () => {
    expect(splitPayrollAttendance({ ...log, checkIn: "10:00", checkOut: "18:00" }, shift, "weekday"))
      .toEqual({ regularWorkedMinutes: 360, overtime: [{ minutes: 60, category: "weekday" }] });
  });
  it.each(["restDay", "holiday"] as const)("counts all recorded work on %s separately from base pay", category => {
    expect(splitPayrollAttendance({ ...log, checkOut: "17:00" }, shift, category))
      .toEqual({ regularWorkedMinutes: 0, overtime: [{ minutes: 480, category }] });
  });
  it("separates night overtime and excludes the unpaid break", () => {
    expect(splitPayrollAttendance({ ...log, checkOut: "23:00" }, shift, "weekday"))
      .toEqual({ regularWorkedMinutes: 480, overtime: [{ minutes: 300, category: "weekday" }, { minutes: 60, category: "weekday", night: true }] });
  });
  it("handles a night shift and late arrival after midnight", () => {
    const night = { startTime: "22:00", endTime: "06:00", standardDailyMinutes: 480 };
    expect(splitPayrollAttendance({ ...log, checkIn: "22:00", checkOut: "08:00" }, night, "weekday"))
      .toEqual({ regularWorkedMinutes: 480, overtime: [{ minutes: 120, category: "weekday" }] });
    expect(splitPayrollAttendance({ ...log, checkIn: "01:00", checkOut: "06:00" }, night, "weekday"))
      .toEqual({ regularWorkedMinutes: 300, overtime: [] });
  });
  it("does not invent overtime from incomplete or invalid attendance", () => {
    for (const checkOut of [undefined, "invalid", "25:00"]) {
      expect(splitPayrollAttendance({ ...log, checkOut }, shift, "weekday")).toEqual({ regularWorkedMinutes: 0, overtime: [] });
    }
  });
});
