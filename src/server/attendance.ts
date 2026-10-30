import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { LEAVE_CATEGORY_LABELS, leaveCategoryForStatus, type LeaveCategory, type WorkerAttendanceStatusValue } from "@/lib/attendance";
import { computeAttendanceDay, type AttendanceDayResult, type AttendanceDayValues, type AttendanceRuleConfig } from "@/server/calc";
import { getActiveOvertimeRule, toOvertimeRuleConfig } from "@/server/queries/settings";

// Shared by the manual entry, the auditable edit and the Excel import so a
// worker-day is always built and checked the same way (§ attendance).

type DbClient = Prisma.TransactionClient | typeof db;

export async function getAttendanceRule(): Promise<AttendanceRuleConfig> {
  return { ...toOvertimeRuleConfig(await getActiveOvertimeRule()), maxReasonableHours: 16 };
}

/** "HH:MM" on the attendance date, in the same UTC wall-clock convention the rest of the app stores. */
export function combineDateAndHhmm(date: Date, time: string | undefined | null): Date | null {
  if (!time) return null;
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hours, minutes));
}

export type AttendanceFormFields = {
  attendanceStatus: WorkerAttendanceStatusValue;
  loginTime?: string;
  logoutTime?: string;
  breakMinutes?: number;
  halfDayLeave?: LeaveCategory | "";
  otherLeaveTypeId?: string;
};

export function buildAttendanceDayFromForm(date: Date, fields: AttendanceFormFields, rule: AttendanceRuleConfig): AttendanceDayResult {
  return computeAttendanceDay(
    {
      status: fields.attendanceStatus,
      loginTime: combineDateAndHhmm(date, fields.loginTime),
      logoutTime: combineDateAndHhmm(date, fields.logoutTime),
      breakMinutes: fields.breakMinutes ?? 0,
      halfDayLeave: fields.halfDayLeave || null,
      otherLeaveTypeId: fields.otherLeaveTypeId || null,
    },
    rule,
  );
}

/** The stored TimesheetItem columns for a computed day. */
export function attendanceItemData(values: AttendanceDayValues) {
  return {
    attendanceStatus: values.attendanceStatus,
    loginTime: values.loginTime,
    logoutTime: values.logoutTime,
    breakMinutes: values.breakMinutes,
    regularHours: values.regularHours.toFixed(2),
    overtimeHours: values.overtimeHours.toFixed(2),
    holidayHours: values.holidayHours.toFixed(2),
    totalHours: values.totalHours.toFixed(2),
    scheduledHours: values.scheduledHours.toFixed(2),
    sickLeaveHours: values.sickLeaveHours.toFixed(2),
    annualLeaveHours: values.annualLeaveHours.toFixed(2),
    unpaidLeaveHours: values.unpaidLeaveHours.toFixed(2),
    otherLeaveHours: values.otherLeaveHours.toFixed(2),
    otherLeaveTypeId: values.otherLeaveTypeId,
  };
}

/**
 * An approved leave request covering this date must not be contradicted by
 * the attendance record: a worker can't be marked present/absent for a day
 * they're on approved leave, and the day's leave category must match the
 * request's paid/unpaid type. Returns the problem, or null.
 */
export async function findLeaveRequestConflict(
  client: DbClient,
  workerId: string,
  date: Date,
  status: WorkerAttendanceStatusValue,
  halfDayLeave: LeaveCategory | null,
): Promise<string | null> {
  const request = await client.leaveRequest.findFirst({
    where: { workerId, status: "APPROVED", startDate: { lte: date }, endDate: { gte: date } },
    include: { leaveType: { select: { name: true, isPaid: true } } },
  });
  if (!request) return null;

  const recordedCategory = leaveCategoryForStatus(status) ?? (status === "HALF_DAY" ? halfDayLeave : null);
  const range = `${request.startDate.toISOString().slice(0, 10)} – ${request.endDate.toISOString().slice(0, 10)}`;
  if (!recordedCategory) {
    return `This worker has approved ${request.leaveType.name} (${range}) covering this date. Record the day as leave, or cancel the leave request first.`;
  }
  if (!request.leaveType.isPaid && recordedCategory !== "UNPAID") {
    return `The approved ${request.leaveType.name} (${range}) is unpaid — record this day as ${LEAVE_CATEGORY_LABELS.UNPAID}.`;
  }
  if (request.leaveType.isPaid && recordedCategory === "UNPAID") {
    return `The approved ${request.leaveType.name} (${range}) is paid leave — it can't be recorded as ${LEAVE_CATEGORY_LABELS.UNPAID}.`;
  }
  return null;
}

/** An OTHER leave must point at an active leave type. */
export async function assertActiveLeaveType(client: DbClient, leaveTypeId: string | null): Promise<string | null> {
  if (!leaveTypeId) return null;
  const type = await client.leaveType.findUnique({ where: { id: leaveTypeId }, select: { status: true } });
  return type && type.status === "ACTIVE" ? null : "That leave type isn't available.";
}

/** The active overtime rule as plain numbers, for the dialog's live breakdown. */
export async function getAttendancePreviewRule() {
  const rule = toOvertimeRuleConfig(await getActiveOvertimeRule());
  const n = (v: unknown) => (v == null ? null : Number(v));
  return {
    dailyRegularHoursThreshold: Number(rule.dailyRegularHoursThreshold),
    overtimeMultiplier: Number(rule.overtimeMultiplier),
    maxDailyHours: n(rule.maxDailyHours),
    minPayableHours: n(rule.minPayableHours),
  };
}
