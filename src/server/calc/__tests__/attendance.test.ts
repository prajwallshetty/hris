import { describe, expect, it } from "vitest";

import { computeAttendanceDay, resolveShiftEnd, summarizeAttendance, type AttendanceSummaryItem } from "../attendance";
import { DEFAULT_OVERTIME_RULE } from "../hours";

const rule = { ...DEFAULT_OVERTIME_RULE, dailyRegularHoursThreshold: 8 };
const at = (time: string) => new Date(`2026-10-05T${time}:00Z`);

function values(result: ReturnType<typeof computeAttendanceDay>) {
  if (!result.ok) throw new Error(result.errors.join(" "));
  return result.values;
}

describe("computeAttendanceDay", () => {
  it("records worked hours, break and overtime separately with no leave", () => {
    const v = values(
      computeAttendanceDay({ status: "PRESENT", loginTime: at("07:00"), logoutTime: at("18:00"), breakMinutes: 60 }, rule),
    );
    expect(v.totalHours.toNumber()).toBe(10); // 11h shift − 1h break
    expect(v.regularHours.toNumber()).toBe(8);
    expect(v.overtimeHours.toNumber()).toBe(2);
    expect(v.breakMinutes).toBe(60);
    expect(v.sickLeaveHours.toNumber() + v.annualLeaveHours.toNumber() + v.unpaidLeaveHours.toNumber()).toBe(0);
  });

  it("books a full sick day into sick leave only — never as worked hours or break", () => {
    const v = values(computeAttendanceDay({ status: "SICK_LEAVE" }, rule));
    expect(v.sickLeaveHours.toNumber()).toBe(8);
    expect(v.totalHours.toNumber()).toBe(0);
    expect(v.breakMinutes).toBe(0);
    expect(v.annualLeaveHours.toNumber()).toBe(0);
    expect(v.unpaidLeaveHours.toNumber()).toBe(0);
  });

  it("keeps annual and unpaid leave in their own columns", () => {
    expect(values(computeAttendanceDay({ status: "ANNUAL_LEAVE" }, rule)).annualLeaveHours.toNumber()).toBe(8);
    const unpaid = values(computeAttendanceDay({ status: "UNPAID_LEAVE" }, rule));
    expect(unpaid.unpaidLeaveHours.toNumber()).toBe(8);
    expect(unpaid.annualLeaveHours.toNumber()).toBe(0);
  });

  it("splits a half day into worked hours plus half a day of the chosen leave", () => {
    const v = values(
      computeAttendanceDay(
        { status: "HALF_DAY", loginTime: at("08:00"), logoutTime: at("12:00"), halfDayLeave: "SICK" },
        { ...rule, minPayableHours: 8 },
      ),
    );
    expect(v.totalHours.toNumber()).toBe(4);
    expect(v.regularHours.toNumber()).toBe(4); // min-payable floor not applied to a half day
    expect(v.sickLeaveHours.toNumber()).toBe(4);
  });

  it("requires the half-day leave category and the type for other leave", () => {
    const half = computeAttendanceDay({ status: "HALF_DAY", loginTime: at("08:00"), logoutTime: at("12:00") }, rule);
    expect(half.ok).toBe(false);
    const other = computeAttendanceDay({ status: "OTHER_LEAVE" }, rule);
    expect(other.ok).toBe(false);
    const withType = values(computeAttendanceDay({ status: "OTHER_LEAVE", otherLeaveTypeId: "lt_1" }, rule));
    expect(withType.otherLeaveHours.toNumber()).toBe(8);
    expect(withType.otherLeaveTypeId).toBe("lt_1");
  });

  it("supports overnight shifts that end the next day", () => {
    const v = values(
      computeAttendanceDay({ status: "PRESENT", loginTime: at("22:00"), logoutTime: at("06:00"), breakMinutes: 30 }, rule),
    );
    expect(v.overnight).toBe(true);
    expect(v.totalHours.toNumber()).toBe(7.5);
    expect(v.logoutTime!.toISOString()).toBe("2026-10-06T06:00:00.000Z");
  });

  it("rejects identical times, missing times and times on a leave day", () => {
    expect(computeAttendanceDay({ status: "PRESENT", loginTime: at("08:00"), logoutTime: at("08:00") }, rule).ok).toBe(false);
    expect(computeAttendanceDay({ status: "PRESENT", loginTime: at("08:00") }, rule).ok).toBe(false);
    expect(computeAttendanceDay({ status: "SICK_LEAVE", loginTime: at("08:00"), logoutTime: at("12:00") }, rule).ok).toBe(false);
  });

  it("counts work on a rest day as worked and holiday hours, with no times meaning a plain day off", () => {
    const off = values(computeAttendanceDay({ status: "WEEKLY_OFF" }, rule));
    expect(off.totalHours.toNumber()).toBe(0);
    const worked = values(
      computeAttendanceDay({ status: "PUBLIC_HOLIDAY", loginTime: at("08:00"), logoutTime: at("12:00") }, rule),
    );
    expect(worked.totalHours.toNumber()).toBe(4);
    expect(worked.holidayHours.toNumber()).toBe(4);
  });

  it("flags excessive hours", () => {
    const r = computeAttendanceDay({ status: "PRESENT", loginTime: at("00:00"), logoutTime: at("20:00") }, rule);
    expect(r.ok).toBe(false);
  });
});

describe("resolveShiftEnd", () => {
  it("leaves a same-day shift alone", () => {
    expect(resolveShiftEnd(at("08:00"), at("17:00")).overnight).toBe(false);
  });
});

describe("summarizeAttendance", () => {
  const base: AttendanceSummaryItem = {
    attendanceStatus: "PRESENT",
    loginTime: at("08:00"),
    breakMinutes: 60,
    totalHours: 10,
    regularHours: 8,
    overtimeHours: 2,
    scheduledHours: 8,
    sickLeaveHours: 0,
    annualLeaveHours: 0,
    unpaidLeaveHours: 0,
    otherLeaveHours: 0,
  };

  it("keeps every category separate and never adds leave into worked hours", () => {
    const s = summarizeAttendance([
      base,
      { ...base, attendanceStatus: "SICK_LEAVE", loginTime: null, breakMinutes: 0, totalHours: 0, regularHours: 0, overtimeHours: 0, sickLeaveHours: 8 },
      { ...base, attendanceStatus: "HALF_DAY", totalHours: 4, regularHours: 4, overtimeHours: 0, breakMinutes: 0, annualLeaveHours: 4 },
      { ...base, attendanceStatus: "WEEKLY_OFF", loginTime: null, breakMinutes: 0, totalHours: 0, regularHours: 0, overtimeHours: 0 },
      { ...base, attendanceStatus: "ABSENT", loginTime: null, breakMinutes: 0, totalHours: 0, regularHours: 0, overtimeHours: 0 },
    ]);
    expect(s.actualHours.toNumber()).toBe(14);
    expect(s.overtimeHours.toNumber()).toBe(2);
    expect(s.breakHours.toNumber()).toBe(1);
    expect(s.sickLeave.days.toNumber()).toBe(1);
    expect(s.annualLeave.days.toNumber()).toBe(0.5);
    expect(s.annualLeave.hours.toNumber()).toBe(4);
    expect(s.presentDays.toNumber()).toBe(1.5);
    expect(s.weeklyOffDays).toBe(1);
    expect(s.absentDays).toBe(1);
  });
});
