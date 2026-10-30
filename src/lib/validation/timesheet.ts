import { z } from "zod";

import { LEAVE_CATEGORIES, WORKER_ATTENDANCE_STATUSES } from "@/lib/attendance";

import { optionalNumber } from "./number";

export const timesheetUploadMetaSchema = z.object({
  siteId: z.string().min(1, "Site is required"),
  period: z.string().min(1, "Period is required"),
});
export type TimesheetUploadMetaInput = z.infer<typeof timesheetUploadMetaSchema>;

const optionalTime = z
  .string()
  .regex(/^(\d{2}:\d{2})?$/, "Use HH:MM")
  .optional()
  .or(z.literal(""));

// The day's attendance (§ attendance) — shared by the manual entry and the
// auditable edit. Which fields are required depends on the status; that rule
// lives in computeAttendanceDay so the form and the server can't disagree.
const attendanceDayFields = {
  attendanceStatus: z.enum(WORKER_ATTENDANCE_STATUSES),
  loginTime: optionalTime,
  logoutTime: optionalTime,
  breakMinutes: optionalNumber(z.coerce.number().int("Whole minutes").nonnegative("Must be 0 or more")),
  halfDayLeave: z.enum(LEAVE_CATEGORIES).optional().or(z.literal("")),
  otherLeaveTypeId: z.string().optional().or(z.literal("")),
  remarks: z.string().trim().max(500).optional().or(z.literal("")),
};

export const manualTimesheetItemFormSchema = z.object({
  workerId: z.string().min(1, "Worker is required"),
  siteId: z.string().min(1, "Site is required"),
  date: z.string().min(1, "Date is required"),
  ...attendanceDayFields,
});
export type ManualTimesheetItemFormInput = z.infer<typeof manualTimesheetItemFormSchema>;
export type ManualTimesheetItemFormValues = z.input<typeof manualTimesheetItemFormSchema>;

/** Correcting a recorded day: never silent — a reason is required and audited. */
export const timesheetItemUpdateSchema = z.object({
  itemId: z.string().min(1),
  ...attendanceDayFields,
  reason: z.string().trim().min(3, "Give a reason for this correction"),
});
export type TimesheetItemUpdateInput = z.infer<typeof timesheetItemUpdateSchema>;
export type TimesheetItemUpdateValues = z.input<typeof timesheetItemUpdateSchema>;

export const timesheetItemDecisionSchema = z.object({
  itemId: z.string().min(1),
  decision: z.enum(["APPROVED", "REJECTED"]),
  reason: z.string().trim().optional().or(z.literal("")),
});
export type TimesheetItemDecisionInput = z.infer<typeof timesheetItemDecisionSchema>;
