import { ATTENDANCE_LEGEND_ORDER, ATTENDANCE_TONES, type WorkerAttendanceStatusValue } from "@/lib/attendance";
import { cn } from "@/lib/utils";

/** Color-coded attendance status (§ attendance) — the same tones everywhere it's shown. */
export function AttendanceBadge({ status, className }: { status: WorkerAttendanceStatusValue; className?: string }) {
  const tone = ATTENDANCE_TONES[status];
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-md border px-2 text-xs font-semibold whitespace-nowrap",
        tone.badge,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", tone.dot)} aria-hidden />
      {tone.label}
    </span>
  );
}

/** The legend shown above attendance tables and calendars; optional counts per status. */
export function AttendanceLegend({
  counts,
  className,
}: {
  counts?: Partial<Record<WorkerAttendanceStatusValue, number>>;
  className?: string;
}) {
  return (
    <ul aria-label="Attendance legend" className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 text-xs", className)}>
      {ATTENDANCE_LEGEND_ORDER.map((status) => {
        const tone = ATTENDANCE_TONES[status];
        const count = counts ? (counts[status] ?? 0) : undefined;
        return (
          <li key={status} className="flex items-center gap-1.5 text-slate-600">
            <span className={cn("inline-flex h-5 min-w-7 items-center justify-center rounded border px-1 text-[10px] font-bold", tone.cell)}>
              {tone.code}
            </span>
            <span className="font-medium">{tone.label}</span>
            {count != null && <span className="text-slate-400 tabular-nums">({count})</span>}
          </li>
        );
      })}
    </ul>
  );
}
