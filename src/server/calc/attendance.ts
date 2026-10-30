import { Decimal } from "decimal.js";

import {
  STATUSES_ALLOWING_TIMES,
  STATUSES_REQUIRING_TIMES,
  leaveCategoryForStatus,
  type LeaveCategory,
  type WorkerAttendanceStatusValue,
} from "@/lib/attendance";

import { calculateOvertime, calculateRegularHours, type Numeric, type OvertimeRuleConfig } from "./hours";

function d(value: Numeric = 0): Decimal {
  return value instanceof Decimal ? value : new Decimal(value);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Overnight shifts (§ attendance): a check-out at or before the check-in time
 * is read as the next calendar day — 22:00 → 06:00 is an 8-hour shift, not a
 * negative one. Identical times are rejected by the caller, not wrapped.
 */
export function resolveShiftEnd(loginTime: Date, logoutTime: Date): { logoutTime: Date; overnight: boolean } {
  if (logoutTime.getTime() > loginTime.getTime()) return { logoutTime, overnight: false };
  return { logoutTime: new Date(logoutTime.getTime() + DAY_MS), overnight: true };
}

export type AttendanceDayInput = {
  status: WorkerAttendanceStatusValue;
  /** Already combined with the attendance date; check-out may be earlier (overnight). */
  loginTime?: Date | null;
  logoutTime?: Date | null;
  breakMinutes?: number;
  /** HALF_DAY only: which leave category the other half is booked to. */
  halfDayLeave?: LeaveCategory | null;
  /** OTHER leave (full or half day): the approved LeaveType it is. */
  otherLeaveTypeId?: string | null;
};

export type AttendanceDayValues = {
  attendanceStatus: WorkerAttendanceStatusValue;
  loginTime: Date | null;
  logoutTime: Date | null;
  overnight: boolean;
  breakMinutes: number;
  /** Hours actually worked: check-out − check-in − break. Leave never enters here. */
  totalHours: Decimal;
  regularHours: Decimal;
  overtimeHours: Decimal;
  /** Hours worked on a public holiday / weekly rest day (also included in totalHours). */
  holidayHours: Decimal;
  scheduledHours: Decimal;
  sickLeaveHours: Decimal;
  annualLeaveHours: Decimal;
  unpaidLeaveHours: Decimal;
  otherLeaveHours: Decimal;
  otherLeaveTypeId: string | null;
};

export type AttendanceDayResult = { ok: true; values: AttendanceDayValues } | { ok: false; errors: string[] };

export type AttendanceRuleConfig = OvertimeRuleConfig & {
  /** Worked hours above this are rejected as a likely data-entry error. Default 16. */
  maxReasonableHours?: number;
};

/**
 * Turns one recorded day into stored hours (§ attendance rules):
 * - PRESENT / HALF_DAY need check-in and check-out; worked hours are split
 *   into regular/overtime by the active overtime rule.
 * - HALF_DAY books the other half of the scheduled day (half of the
 *   overtime threshold) into exactly one leave category.
 * - SICK / ANNUAL / UNPAID / OTHER leave books a full scheduled day into its
 *   own category and records no worked hours.
 * - PUBLIC_HOLIDAY / WEEKLY_OFF may carry times if the worker still worked;
 *   those hours count as worked (and as holiday hours).
 * - ABSENT records nothing.
 * Leave hours are never subtracted from worked hours, and breaks are only
 * ever recorded against worked time.
 */
export function computeAttendanceDay(input: AttendanceDayInput, rule: AttendanceRuleConfig): AttendanceDayResult {
  const errors: string[] = [];
  const status = input.status;
  const scheduledHours = d(rule.dailyRegularHoursThreshold);
  const maxHours = rule.maxReasonableHours ?? 16;
  const hasLogin = Boolean(input.loginTime);
  const hasLogout = Boolean(input.logoutTime);
  const hasTimes = hasLogin || hasLogout;
  const breakMinutes = input.breakMinutes ?? 0;

  if (breakMinutes < 0) errors.push("Break can't be negative.");

  if (STATUSES_REQUIRING_TIMES.includes(status)) {
    if (!hasLogin) errors.push("Missing check-in time.");
    if (!hasLogout) errors.push("Missing check-out time.");
  } else if (hasTimes && !STATUSES_ALLOWING_TIMES.includes(status)) {
    errors.push(
      status === "ABSENT"
        ? "An absent day can't have check-in/check-out times."
        : "A full-day leave can't have check-in/check-out times — record it as a Half Day instead.",
    );
  } else if (hasTimes && (!hasLogin || !hasLogout)) {
    errors.push("Enter both check-in and check-out, or neither.");
  }

  const halfDayLeave = status === "HALF_DAY" ? (input.halfDayLeave ?? null) : null;
  if (status === "HALF_DAY" && !halfDayLeave) errors.push("Choose which leave the other half of the day is.");
  const leaveCategory = leaveCategoryForStatus(status) ?? halfDayLeave;
  const otherLeaveTypeId = leaveCategory === "OTHER" ? (input.otherLeaveTypeId ?? null) : null;
  if (leaveCategory === "OTHER" && !otherLeaveTypeId) errors.push("Choose the leave type for Other Leave.");

  let loginTime: Date | null = null;
  let logoutTime: Date | null = null;
  let overnight = false;
  let totalHours = new Decimal(0);
  let regularHours = new Decimal(0);
  let overtimeHours = new Decimal(0);

  if (input.loginTime && input.logoutTime && errors.length === 0) {
    if (input.loginTime.getTime() === input.logoutTime.getTime()) {
      errors.push("Check-out can't be the same as check-in.");
    } else {
      const shift = resolveShiftEnd(input.loginTime, input.logoutTime);
      loginTime = input.loginTime;
      logoutTime = shift.logoutTime;
      overnight = shift.overnight;
      const shiftMinutes = (logoutTime.getTime() - loginTime.getTime()) / 60_000;
      if (breakMinutes >= shiftMinutes) {
        errors.push("Break is as long as the whole shift.");
      } else {
        totalHours = calculateRegularHours(loginTime, logoutTime, breakMinutes);
        if (totalHours.gt(maxHours)) {
          errors.push(`Excessive hours: ${totalHours.toFixed(2)}h exceeds the ${maxHours}h daily maximum.`);
        } else {
          // A half day is paid as worked — the minimum-payable floor would
          // otherwise inflate it to a full day's hours.
          const split = calculateOvertime(totalHours, status === "HALF_DAY" ? { ...rule, minPayableHours: null } : rule);
          regularHours = split.regularHours;
          overtimeHours = split.overtimeHours;
        }
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  const leaveHours = leaveCategory ? (status === "HALF_DAY" ? scheduledHours.div(2) : scheduledHours) : new Decimal(0);
  const zero = new Decimal(0);
  const isRestDay = status === "PUBLIC_HOLIDAY" || status === "WEEKLY_OFF";

  return {
    ok: true,
    values: {
      attendanceStatus: status,
      loginTime,
      logoutTime,
      overnight,
      breakMinutes: loginTime ? breakMinutes : 0,
      totalHours,
      regularHours,
      overtimeHours,
      holidayHours: isRestDay ? totalHours : zero,
      scheduledHours,
      sickLeaveHours: leaveCategory === "SICK" ? leaveHours : zero,
      annualLeaveHours: leaveCategory === "ANNUAL" ? leaveHours : zero,
      unpaidLeaveHours: leaveCategory === "UNPAID" ? leaveHours : zero,
      otherLeaveHours: leaveCategory === "OTHER" ? leaveHours : zero,
      otherLeaveTypeId,
    },
  };
}

export type AttendanceSummaryItem = {
  attendanceStatus: WorkerAttendanceStatusValue;
  loginTime: Date | null;
  breakMinutes: number;
  totalHours: Numeric;
  regularHours: Numeric;
  overtimeHours: Numeric;
  scheduledHours: Numeric;
  sickLeaveHours: Numeric;
  annualLeaveHours: Numeric;
  unpaidLeaveHours: Numeric;
  otherLeaveHours: Numeric;
};

type HoursAndDays = { hours: Decimal; days: Decimal };

export type AttendanceSummary = {
  actualHours: Decimal;
  regularHours: Decimal;
  overtimeHours: Decimal;
  breakHours: Decimal;
  sickLeave: HoursAndDays;
  annualLeave: HoursAndDays;
  unpaidLeave: HoursAndDays;
  otherLeave: HoursAndDays;
  /** Full present days + half days counted as ½. */
  presentDays: Decimal;
  halfDays: number;
  absentDays: number;
  publicHolidays: number;
  weeklyOffDays: number;
  recordedDays: number;
};

/**
 * Month totals for one worker (§ monthly timesheet). Each category is summed
 * on its own: leave days come from leave hours ÷ that day's scheduled hours,
 * and never feed the worked-hours totals.
 */
export function summarizeAttendance(items: AttendanceSummaryItem[]): AttendanceSummary {
  const zero = () => ({ hours: new Decimal(0), days: new Decimal(0) });
  const summary: AttendanceSummary = {
    actualHours: new Decimal(0),
    regularHours: new Decimal(0),
    overtimeHours: new Decimal(0),
    breakHours: new Decimal(0),
    sickLeave: zero(),
    annualLeave: zero(),
    unpaidLeave: zero(),
    otherLeave: zero(),
    presentDays: new Decimal(0),
    halfDays: 0,
    absentDays: 0,
    publicHolidays: 0,
    weeklyOffDays: 0,
    recordedDays: items.length,
  };

  const addLeave = (bucket: HoursAndDays, hours: Numeric, scheduled: Numeric) => {
    const h = d(hours);
    if (h.lte(0)) return;
    bucket.hours = bucket.hours.plus(h);
    const s = d(scheduled);
    bucket.days = bucket.days.plus(s.gt(0) ? h.div(s) : 0);
  };

  for (const item of items) {
    summary.actualHours = summary.actualHours.plus(d(item.totalHours));
    summary.regularHours = summary.regularHours.plus(d(item.regularHours));
    summary.overtimeHours = summary.overtimeHours.plus(d(item.overtimeHours));
    if (item.loginTime) summary.breakHours = summary.breakHours.plus(new Decimal(item.breakMinutes).div(60));

    addLeave(summary.sickLeave, item.sickLeaveHours, item.scheduledHours);
    addLeave(summary.annualLeave, item.annualLeaveHours, item.scheduledHours);
    addLeave(summary.unpaidLeave, item.unpaidLeaveHours, item.scheduledHours);
    addLeave(summary.otherLeave, item.otherLeaveHours, item.scheduledHours);

    switch (item.attendanceStatus) {
      case "PRESENT":
        summary.presentDays = summary.presentDays.plus(1);
        break;
      case "HALF_DAY":
        summary.presentDays = summary.presentDays.plus(0.5);
        summary.halfDays += 1;
        break;
      case "ABSENT":
        summary.absentDays += 1;
        break;
      case "PUBLIC_HOLIDAY":
        summary.publicHolidays += 1;
        break;
      case "WEEKLY_OFF":
        summary.weeklyOffDays += 1;
        break;
      default:
        break;
    }
  }

  return summary;
}
