import type { LeaveCategory, WorkerAttendanceStatusValue } from "@/lib/attendance";
import { computeAttendanceDay } from "@/server/calc/attendance";

/** Plain-number overtime rule passed from the server for the live breakdown. */
export type AttendancePreviewRule = {
  dailyRegularHoursThreshold: number;
  overtimeMultiplier: number;
  maxDailyHours: number | null;
  minPayableHours: number | null;
};

function hhmmOn(reference: Date, time: string): Date | null {
  if (!/^\d{2}:\d{2}$/.test(time)) return null;
  const [h, m] = time.split(":").map(Number);
  return new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate(), h, m));
}

/**
 * Runs the same engine the server saves with (computeAttendanceDay), so the
 * dialog shows exactly how the day will be stored before it's submitted.
 */
export function buildAttendanceDayPreview(
  input: {
    status: WorkerAttendanceStatusValue;
    loginTime: string;
    logoutTime: string;
    breakMinutes: number;
    halfDayLeave: LeaveCategory | null;
    otherLeaveTypeId: string | null;
  },
  rule: AttendancePreviewRule,
) {
  const reference = new Date(Date.UTC(2026, 0, 5));
  const result = computeAttendanceDay(
    {
      status: input.status,
      loginTime: hhmmOn(reference, input.loginTime),
      logoutTime: hhmmOn(reference, input.logoutTime),
      breakMinutes: input.breakMinutes,
      halfDayLeave: input.halfDayLeave,
      otherLeaveTypeId: input.otherLeaveTypeId,
    },
    { ...rule, maxReasonableHours: 16 },
  );
  if (!result.ok) return { ok: false as const, errors: result.errors };

  const v = result.values;
  return {
    ok: true as const,
    overnight: v.overnight,
    rows: [
      { label: "Actual worked", value: v.totalHours.toNumber(), always: true, className: "text-navy" },
      { label: "Break", value: v.breakMinutes / 60, always: true, className: "text-slate-700" },
      { label: "Overtime", value: v.overtimeHours.toNumber(), always: true, className: "text-teal-700" },
      { label: "Holiday worked", value: v.holidayHours.toNumber(), always: false, className: "text-violet-700" },
      { label: "Sick leave", value: v.sickLeaveHours.toNumber(), always: false, className: "text-red-700" },
      { label: "Annual leave", value: v.annualLeaveHours.toNumber(), always: false, className: "text-blue-700" },
      { label: "Unpaid leave", value: v.unpaidLeaveHours.toNumber(), always: false, className: "text-orange-700" },
      { label: "Other leave", value: v.otherLeaveHours.toNumber(), always: false, className: "text-teal-700" },
    ],
  };
}
