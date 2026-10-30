import { recordedLeaveCategory, type WorkerAttendanceStatusValue } from "@/lib/attendance";

import type { AttendanceEditTarget } from "../attendance-entry-dialog";

/** Wall-clock HH:MM of a stored shift time (stored as UTC wall time). */
export function shiftTime(date: Date | null): string {
  return date ? date.toISOString().slice(11, 16) : "";
}

export function formatAttendanceDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "2-digit", timeZone: "UTC" }).format(date);
}

type EditableItem = {
  id: string;
  date: Date;
  attendanceStatus: WorkerAttendanceStatusValue;
  loginTime: Date | null;
  logoutTime: Date | null;
  breakMinutes: number;
  sickLeaveHours: unknown;
  annualLeaveHours: unknown;
  unpaidLeaveHours: unknown;
  otherLeaveHours: unknown;
  otherLeaveTypeId: string | null;
  remarks: string | null;
  worker: { fullName: string };
};

export function toEditTarget(item: EditableItem): AttendanceEditTarget {
  return {
    itemId: item.id,
    workerName: item.worker.fullName,
    dateLabel: formatAttendanceDate(item.date),
    attendanceStatus: item.attendanceStatus,
    loginTime: shiftTime(item.loginTime),
    logoutTime: shiftTime(item.logoutTime),
    breakMinutes: item.breakMinutes,
    halfDayLeave: item.attendanceStatus === "HALF_DAY" ? (recordedLeaveCategory(item) ?? "") : "",
    otherLeaveTypeId: item.otherLeaveTypeId ?? "",
    remarks: item.remarks ?? "",
  };
}

/** Entries can be corrected until their timesheet is approved/locked (it then feeds payroll). */
export function isTimesheetEditable(status: string) {
  return status !== "APPROVED" && status !== "LOCKED";
}
