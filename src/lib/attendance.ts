// Worker attendance vocabulary (§ attendance) — labels and colors shared by
// the daily table, the monthly calendar, the legend, filters and reports, so
// a status always looks the same wherever it appears. Client-safe: no
// server imports.

export const WORKER_ATTENDANCE_STATUSES = [
  "PRESENT",
  "HALF_DAY",
  "ABSENT",
  "SICK_LEAVE",
  "ANNUAL_LEAVE",
  "UNPAID_LEAVE",
  "OTHER_LEAVE",
  "PUBLIC_HOLIDAY",
  "WEEKLY_OFF",
] as const;
export type WorkerAttendanceStatusValue = (typeof WORKER_ATTENDANCE_STATUSES)[number];

/** Leave categories, each stored in its own hours column on TimesheetItem. */
export const LEAVE_CATEGORIES = ["SICK", "ANNUAL", "UNPAID", "OTHER"] as const;
export type LeaveCategory = (typeof LEAVE_CATEGORIES)[number];

export const LEAVE_CATEGORY_LABELS: Record<LeaveCategory, string> = {
  SICK: "Sick Leave",
  ANNUAL: "Annual Leave",
  UNPAID: "Unpaid Leave",
  OTHER: "Other Leave",
};

/** The full-day status that corresponds to each leave category. */
export const LEAVE_STATUS_BY_CATEGORY: Record<LeaveCategory, WorkerAttendanceStatusValue> = {
  SICK: "SICK_LEAVE",
  ANNUAL: "ANNUAL_LEAVE",
  UNPAID: "UNPAID_LEAVE",
  OTHER: "OTHER_LEAVE",
};

export type AttendanceTone = {
  label: string;
  /** Short code for dense views (calendar cells, legend chips). */
  code: string;
  /** Badge: tinted background, strong text, matching border. */
  badge: string;
  /** Solid dot / swatch. */
  dot: string;
  /** Calendar day cell. */
  cell: string;
};

export const ATTENDANCE_TONES: Record<WorkerAttendanceStatusValue, AttendanceTone> = {
  PRESENT: {
    label: "Present",
    code: "P",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
    cell: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  SICK_LEAVE: {
    label: "Sick Leave",
    code: "SL",
    badge: "border-red-200 bg-red-50 text-red-700",
    dot: "bg-red-500",
    cell: "border-red-200 bg-red-50 text-red-800",
  },
  ANNUAL_LEAVE: {
    label: "Annual Leave",
    code: "AL",
    badge: "border-blue-200 bg-blue-50 text-blue-700",
    dot: "bg-blue-500",
    cell: "border-blue-200 bg-blue-50 text-blue-800",
  },
  UNPAID_LEAVE: {
    label: "Unpaid Leave",
    code: "UL",
    badge: "border-orange-200 bg-orange-50 text-orange-700",
    dot: "bg-orange-500",
    cell: "border-orange-200 bg-orange-50 text-orange-800",
  },
  OTHER_LEAVE: {
    label: "Other Leave",
    code: "OL",
    badge: "border-teal-200 bg-teal-50 text-teal-700",
    dot: "bg-teal-500",
    cell: "border-teal-200 bg-teal-50 text-teal-800",
  },
  PUBLIC_HOLIDAY: {
    label: "Public Holiday",
    code: "PH",
    badge: "border-violet-200 bg-violet-50 text-violet-700",
    dot: "bg-violet-500",
    cell: "border-violet-200 bg-violet-50 text-violet-800",
  },
  WEEKLY_OFF: {
    label: "Weekly Off",
    code: "WO",
    badge: "border-slate-200 bg-slate-100 text-slate-600",
    dot: "bg-slate-400",
    cell: "border-slate-200 bg-slate-100 text-slate-600",
  },
  HALF_DAY: {
    label: "Half Day",
    code: "HD",
    badge: "border-amber-200 bg-amber-50 text-amber-700",
    dot: "bg-amber-400",
    cell: "border-amber-200 bg-amber-50 text-amber-800",
  },
  ABSENT: {
    label: "Absent",
    code: "A",
    badge: "border-rose-200 bg-zinc-100 text-rose-700",
    dot: "bg-rose-400",
    cell: "border-rose-200 bg-zinc-100 text-rose-700",
  },
};

/** Legend / filter order: worked first, then leave, then non-working days. */
export const ATTENDANCE_LEGEND_ORDER: WorkerAttendanceStatusValue[] = [
  "PRESENT",
  "HALF_DAY",
  "SICK_LEAVE",
  "ANNUAL_LEAVE",
  "UNPAID_LEAVE",
  "OTHER_LEAVE",
  "PUBLIC_HOLIDAY",
  "WEEKLY_OFF",
  "ABSENT",
];

/** Statuses where check-in/check-out times are required. */
export const STATUSES_REQUIRING_TIMES: readonly WorkerAttendanceStatusValue[] = ["PRESENT", "HALF_DAY"];
/** Statuses where times are optional (a worker may still work on a holiday/rest day). */
export const STATUSES_ALLOWING_TIMES: readonly WorkerAttendanceStatusValue[] = [
  "PRESENT",
  "HALF_DAY",
  "PUBLIC_HOLIDAY",
  "WEEKLY_OFF",
];

/** Leave category a full-day leave status books its hours into, if any. */
export function leaveCategoryForStatus(status: WorkerAttendanceStatusValue): LeaveCategory | null {
  switch (status) {
    case "SICK_LEAVE":
      return "SICK";
    case "ANNUAL_LEAVE":
      return "ANNUAL";
    case "UNPAID_LEAVE":
      return "UNPAID";
    case "OTHER_LEAVE":
      return "OTHER";
    default:
      return null;
  }
}

type LeaveHoursLike = {
  sickLeaveHours: unknown;
  annualLeaveHours: unknown;
  unpaidLeaveHours: unknown;
  otherLeaveHours: unknown;
};

/** The leave category a recorded day used (full or half day), from its stored hours. */
export function recordedLeaveCategory(item: LeaveHoursLike): LeaveCategory | null {
  if (Number(item.sickLeaveHours) > 0) return "SICK";
  if (Number(item.annualLeaveHours) > 0) return "ANNUAL";
  if (Number(item.unpaidLeaveHours) > 0) return "UNPAID";
  if (Number(item.otherLeaveHours) > 0) return "OTHER";
  return null;
}

/** "Sick Leave", "Emergency Leave" (an OTHER type's own name), or null for no leave. */
export function leaveTypeLabel(item: LeaveHoursLike & { otherLeaveType?: { name: string } | null }): string | null {
  const category = recordedLeaveCategory(item);
  if (!category) return null;
  if (category === "OTHER") return item.otherLeaveType?.name ?? LEAVE_CATEGORY_LABELS.OTHER;
  return LEAVE_CATEGORY_LABELS[category];
}

const STATUS_TEXT: Record<string, { status: WorkerAttendanceStatusValue; halfDayLeave?: LeaveCategory }> = {
  P: { status: "PRESENT" },
  PRESENT: { status: "PRESENT" },
  A: { status: "ABSENT" },
  ABSENT: { status: "ABSENT" },
  SL: { status: "SICK_LEAVE" },
  SICK: { status: "SICK_LEAVE" },
  "SICK LEAVE": { status: "SICK_LEAVE" },
  AL: { status: "ANNUAL_LEAVE" },
  ANNUAL: { status: "ANNUAL_LEAVE" },
  "ANNUAL LEAVE": { status: "ANNUAL_LEAVE" },
  VACATION: { status: "ANNUAL_LEAVE" },
  UL: { status: "UNPAID_LEAVE" },
  UNPAID: { status: "UNPAID_LEAVE" },
  "UNPAID LEAVE": { status: "UNPAID_LEAVE" },
  LWP: { status: "UNPAID_LEAVE" },
  PH: { status: "PUBLIC_HOLIDAY" },
  HOLIDAY: { status: "PUBLIC_HOLIDAY" },
  "PUBLIC HOLIDAY": { status: "PUBLIC_HOLIDAY" },
  WO: { status: "WEEKLY_OFF" },
  OFF: { status: "WEEKLY_OFF" },
  REST: { status: "WEEKLY_OFF" },
  "WEEKLY OFF": { status: "WEEKLY_OFF" },
  HD: { status: "HALF_DAY", halfDayLeave: "UNPAID" },
  "HALF DAY": { status: "HALF_DAY", halfDayLeave: "UNPAID" },
  "HALF DAY SICK": { status: "HALF_DAY", halfDayLeave: "SICK" },
  "HALF DAY ANNUAL": { status: "HALF_DAY", halfDayLeave: "ANNUAL" },
  "HALF DAY UNPAID": { status: "HALF_DAY", halfDayLeave: "UNPAID" },
};

/** Status text accepted in an import's optional Status column (codes from the legend, or the words). */
export const IMPORT_STATUS_HINT =
  "P, A, SL, AL, UL, PH, WO, HD (or Present, Absent, Sick Leave, Annual Leave, Unpaid Leave, Public Holiday, Weekly Off, Half Day [Sick/Annual/Unpaid])";

export function parseAttendanceStatusText(
  text: string | null | undefined,
): { status: WorkerAttendanceStatusValue; halfDayLeave: LeaveCategory | null } | null {
  const key = (text ?? "").trim().toUpperCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  const match = STATUS_TEXT[key];
  return match ? { status: match.status, halfDayLeave: match.halfDayLeave ?? null } : null;
}
