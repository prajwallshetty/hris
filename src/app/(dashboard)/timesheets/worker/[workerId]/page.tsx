import { ArrowLeft, MoonStar, UserRound } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AttendanceBadge, AttendanceLegend } from "@/components/shared/attendance-badge";
import { MonthFilter } from "@/components/shared/month-filter";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ATTENDANCE_TONES, leaveTypeLabel, type WorkerAttendanceStatusValue } from "@/lib/attendance";
import { formatIqama } from "@/lib/codes";
import { cn } from "@/lib/utils";
import { summarizeAttendance } from "@/server/calc";
import { getWorkerMonthlyTimesheet } from "@/server/queries/timesheets";
import { getSessionUser } from "@/server/session";

import { formatAttendanceDate, shiftTime } from "../../_components/edit-target";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function fmt(value: { toNumber(): number } | number, digits = 2) {
  const n = typeof value === "number" ? value : value.toNumber();
  return n.toLocaleString("en", { minimumFractionDigits: digits === 0 ? 0 : digits, maximumFractionDigits: digits });
}

function SummaryTile({
  label,
  value,
  unit,
  detail,
  tone,
}: {
  label: string;
  value: string;
  unit?: string;
  detail?: string;
  tone: string;
}) {
  return (
    <div className="data-panel relative overflow-hidden p-4">
      <span className={cn("absolute inset-y-0 left-0 w-1", tone)} aria-hidden />
      <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">{label}</p>
      <p className="text-navy mt-1 text-2xl font-bold tabular-nums">
        {value}
        {unit && <span className="ml-1 text-sm font-semibold text-slate-500">{unit}</span>}
      </p>
      {detail && <p className="text-muted-foreground mt-0.5 text-xs tabular-nums">{detail}</p>}
    </div>
  );
}

export default async function WorkerMonthlyTimesheetPage({
  params,
  searchParams,
}: {
  params: Promise<{ workerId: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { workerId } = await params;
  const { month } = await searchParams;
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    redirect(`/timesheets/worker/${workerId}?month=${new Date().toISOString().slice(0, 7)}`);
  }

  const user = await getSessionUser();
  const data = await getWorkerMonthlyTimesheet(user, workerId, month);
  if (!data) notFound();
  const { worker, items, start, end } = data;

  // Rejected entries are shown but never counted.
  const counted = items.filter((i) => i.status !== "REJECTED");
  const rejectedCount = items.length - counted.length;
  const summary = summarizeAttendance(
    counted.map((i) => ({
      attendanceStatus: i.attendanceStatus,
      loginTime: i.loginTime,
      breakMinutes: i.breakMinutes,
      totalHours: i.totalHours.toString(),
      regularHours: i.regularHours.toString(),
      overtimeHours: i.overtimeHours.toString(),
      scheduledHours: i.scheduledHours.toString(),
      sickLeaveHours: i.sickLeaveHours.toString(),
      annualLeaveHours: i.annualLeaveHours.toString(),
      unpaidLeaveHours: i.unpaidLeaveHours.toString(),
      otherLeaveHours: i.otherLeaveHours.toString(),
    })),
  );
  const counts: Partial<Record<WorkerAttendanceStatusValue, number>> = {};
  for (const i of counted) counts[i.attendanceStatus] = (counts[i.attendanceStatus] ?? 0) + 1;

  const byDay = new Map(items.map((i) => [i.date.toISOString().slice(0, 10), i]));
  const daysInMonth = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  const leadingBlanks = start.getUTCDay();
  const monthLabel = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(start);
  const leave = (b: { days: { toNumber(): number }; hours: { toNumber(): number } }) => ({
    value: fmt(b.days, 1),
    detail: `${fmt(b.hours)} hours`,
  });

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Attendance", href: "/timesheets/log" },
          { label: worker.fullName },
        ]}
        title={`${worker.fullName}`}
        description={`Monthly timesheet · ${monthLabel} · Iqama ${formatIqama(worker.iqamaNumber)}${worker.designation ? ` · ${worker.designation.title}` : ""}`}
        actions={
          <>
            <Button variant="outline" nativeButton={false} render={<Link href={`/timesheets/log?month=${month}`} />}>
              <ArrowLeft className="size-4" />
              Daily Attendance
            </Button>
            <Button variant="outline" nativeButton={false} render={<Link href={`/workers/${worker.id}`} />}>
              <UserRound className="size-4" />
              Worker Profile
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <MonthFilter />
        {rejectedCount > 0 && (
          <span className="text-muted-foreground text-xs">
            {rejectedCount} rejected entr{rejectedCount === 1 ? "y is" : "ies are"} shown below but not counted.
          </span>
        )}
      </div>

      <section aria-label="Working hours" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryTile label="Actual working hours" value={fmt(summary.actualHours)} unit="h" detail={`${fmt(summary.regularHours)}h regular`} tone="bg-navy" />
        <SummaryTile label="Overtime" value={fmt(summary.overtimeHours)} unit="h" detail="Included in actual hours" tone="bg-teal-500" />
        <SummaryTile label="Break hours" value={fmt(summary.breakHours)} unit="h" detail="Not counted as worked" tone="bg-slate-400" />
      </section>

      <section aria-label="Leave and days" className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <SummaryTile label="Present days" value={fmt(summary.presentDays, 1)} detail={summary.halfDays ? `incl. ${summary.halfDays} half day(s)` : undefined} tone={ATTENDANCE_TONES.PRESENT.dot} />
        <SummaryTile label="Sick leave" unit="days" {...leave(summary.sickLeave)} tone={ATTENDANCE_TONES.SICK_LEAVE.dot} />
        <SummaryTile label="Annual leave" unit="days" {...leave(summary.annualLeave)} tone={ATTENDANCE_TONES.ANNUAL_LEAVE.dot} />
        <SummaryTile label="Unpaid leave" unit="days" {...leave(summary.unpaidLeave)} tone={ATTENDANCE_TONES.UNPAID_LEAVE.dot} />
        <SummaryTile label="Other leave" unit="days" {...leave(summary.otherLeave)} tone={ATTENDANCE_TONES.OTHER_LEAVE.dot} />
        <SummaryTile label="Public holidays" value={String(summary.publicHolidays)} tone={ATTENDANCE_TONES.PUBLIC_HOLIDAY.dot} />
        <SummaryTile label="Weekly rest days" value={String(summary.weeklyOffDays)} tone={ATTENDANCE_TONES.WEEKLY_OFF.dot} />
        <SummaryTile label="Absent days" value={String(summary.absentDays)} tone={ATTENDANCE_TONES.ABSENT.dot} />
      </section>

      <section aria-label={`${monthLabel} calendar`} className="data-panel space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-navy text-base font-bold">{monthLabel}</h2>
          <AttendanceLegend counts={counts} />
        </div>
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-1 text-center text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
              {d}
            </div>
          ))}
          {Array.from({ length: leadingBlanks }, (_, i) => (
            <div key={`blank-${i}`} aria-hidden />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), i + 1));
            const item = byDay.get(date.toISOString().slice(0, 10));
            const tone = item ? ATTENDANCE_TONES[item.attendanceStatus] : null;
            const worked = item ? Number(item.totalHours) : 0;
            return (
              <div
                key={i}
                title={item ? `${tone!.label}${worked ? ` · ${worked.toFixed(2)}h worked` : ""}` : "Not recorded"}
                className={cn(
                  "flex min-h-14 flex-col justify-between rounded-md border p-1 text-xs sm:min-h-16 sm:p-1.5",
                  tone ? tone.cell : "border-dashed border-slate-200 bg-white text-slate-400",
                  item?.status === "REJECTED" && "opacity-50 line-through",
                )}
              >
                <span className="font-semibold tabular-nums">{i + 1}</span>
                {item && (
                  <span className="flex flex-wrap items-baseline justify-between gap-x-1">
                    <span className="font-bold">{tone!.code}</span>
                    {worked > 0 && <span className="hidden tabular-nums sm:inline">{worked.toFixed(1)}h</span>}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section aria-label="Daily entries" className="data-panel">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Site</TableHead>
                <TableHead>Check-in</TableHead>
                <TableHead>Check-out</TableHead>
                <TableHead className="text-right">Actual Hrs</TableHead>
                <TableHead className="text-right">Break</TableHead>
                <TableHead className="text-right">OT Hrs</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Leave Type</TableHead>
                <TableHead>Remarks</TableHead>
                <TableHead>Approval</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-muted-foreground py-10 text-center">
                    No attendance recorded for {monthLabel}.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => {
                  const leaveLabel = leaveTypeLabel(item);
                  const overnight = item.loginTime && item.logoutTime && item.logoutTime.getUTCDate() !== item.loginTime.getUTCDate();
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="whitespace-nowrap">
                        <Link href={`/timesheets/${item.timesheet.id}`} className="hover:underline">
                          {formatAttendanceDate(item.date)}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs">
                        {item.timesheet.site ? `${item.timesheet.site.project.client.companyName} · ${item.timesheet.site.name}` : "—"}
                      </TableCell>
                      <TableCell className="tabular-nums">{shiftTime(item.loginTime) || "—"}</TableCell>
                      <TableCell className="tabular-nums whitespace-nowrap">
                        {shiftTime(item.logoutTime) || "—"}
                        {overnight && <MoonStar className="ml-1 inline size-3.5 text-indigo-500" aria-label="Overnight shift (next day)" />}
                      </TableCell>
                      <TableCell className="text-navy text-right font-semibold tabular-nums">
                        {Number(item.totalHours) > 0 ? Number(item.totalHours).toFixed(2) : "—"}
                      </TableCell>
                      <TableCell className="text-right text-slate-600 tabular-nums">
                        {item.loginTime && item.breakMinutes > 0 ? (item.breakMinutes / 60).toFixed(2) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium text-teal-700 tabular-nums">
                        {Number(item.overtimeHours) > 0 ? Number(item.overtimeHours).toFixed(2) : "—"}
                      </TableCell>
                      <TableCell>
                        <AttendanceBadge status={item.attendanceStatus} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{leaveLabel ?? <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="max-w-56 text-xs">
                        {item.remarks ?? (item.reviewNote ? <span className="text-red-700">Rejected: {item.reviewNote}</span> : "—")}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={item.status} />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </section>

    </div>
  );
}
