import { Lock, Pencil, Send, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AttendanceBadge, AttendanceLegend } from "@/components/shared/attendance-badge";

import { ConfirmActionButton } from "@/components/shared/confirm-action-button";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { can } from "@/server/rbac";
import { approveTimesheet, lockTimesheet, submitTimesheetForReview } from "@/server/actions/timesheets";
import { leaveTypeLabel, type WorkerAttendanceStatusValue } from "@/lib/attendance";
import { formatEnumLabel } from "@/lib/format-enum";
import { getAttendancePreviewRule } from "@/server/attendance";
import { getTimesheetDetail, listActiveLeaveTypesForSelect } from "@/server/queries/timesheets";
import { getSessionUser } from "@/server/session";

import { AttendanceEntryDialog } from "../attendance-entry-dialog";
import { formatAttendanceDate, isTimesheetEditable, shiftTime, toEditTarget } from "../_components/edit-target";
import { TimesheetItemActions } from "./item-decision-dialog";

function formatPeriod(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(date);
}

export default async function TimesheetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  const timesheet = await getTimesheetDetail(user, id);
  if (!timesheet) notFound();

  const canUpdate = can(user, "update", "timesheet");
  const pendingCount = timesheet.items.filter((i) => i.status === "PENDING").length;
  const itemsEditable = isTimesheetEditable(timesheet.status);
  const [leaveTypes, rule] = canUpdate && itemsEditable
    ? await Promise.all([listActiveLeaveTypesForSelect(), getAttendancePreviewRule()])
    : [[], null];
  const counts: Partial<Record<WorkerAttendanceStatusValue, number>> = {};
  for (const item of timesheet.items) counts[item.attendanceStatus] = (counts[item.attendanceStatus] ?? 0) + 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${formatPeriod(timesheet.period)} Timesheet`}
        description={
          timesheet.site
            ? `${timesheet.site.project.client.companyName} / ${timesheet.site.project.name} / ${timesheet.site.name}`
            : undefined
        }
        actions={
          canUpdate && (
            <>
              {timesheet.status === "UPLOADED" && (
                <ConfirmActionButton
                  trigger={
                    <Button variant="outline">
                      <Send className="size-4" />
                      Submit for Review
                    </Button>
                  }
                  title="Submit this timesheet for review?"
                  description="Reviewers will be able to approve or reject each entry."
                  confirmLabel="Submit"
                  action={submitTimesheetForReview.bind(null, timesheet.id)}
                  successMessage="Timesheet submitted for review."
                />
              )}
              {timesheet.status === "PENDING_REVIEW" && (
                <ConfirmActionButton
                  trigger={
                    <Button disabled={pendingCount > 0}>
                      <ShieldCheck className="size-4" />
                      Approve Timesheet
                    </Button>
                  }
                  title="Approve this timesheet?"
                  description="All entries have been decided. This marks the timesheet approved and ready to lock."
                  confirmLabel="Approve"
                  action={approveTimesheet.bind(null, timesheet.id)}
                  successMessage="Timesheet approved."
                />
              )}
              {timesheet.status === "APPROVED" && (
                <ConfirmActionButton
                  trigger={
                    <Button>
                      <Lock className="size-4" />
                      Lock Timesheet
                    </Button>
                  }
                  title="Lock this timesheet?"
                  description="Locked timesheets can no longer be edited and become available to payroll."
                  confirmLabel="Lock"
                  action={lockTimesheet.bind(null, timesheet.id)}
                  successMessage="Timesheet locked."
                />
              )}
            </>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span className="text-muted-foreground">Source: {formatEnumLabel(timesheet.uploadSource)}</span>
        <StatusBadge status={timesheet.status} />
        {timesheet.status === "PENDING_REVIEW" && pendingCount > 0 && (
          <span className="text-warning-foreground">
            {pendingCount} entr{pendingCount === 1 ? "y" : "ies"} awaiting decision
          </span>
        )}
      </div>

      <div className="data-panel space-y-2 px-4 py-3">
        <AttendanceLegend counts={counts} />
      </div>

      <div className="data-panel">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Worker</TableHead>
                <TableHead>Iqama</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Check-in</TableHead>
                <TableHead>Check-out</TableHead>
                <TableHead className="text-right">Actual Hrs</TableHead>
                <TableHead className="text-right">Break</TableHead>
                <TableHead className="text-right">OT Hrs</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Leave Type</TableHead>
                <TableHead>Remarks</TableHead>
                <TableHead>Approval</TableHead>
                {canUpdate && itemsEditable && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {timesheet.items.map((item) => {
                const leave = leaveTypeLabel(item);
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Link
                        href={`/timesheets/worker/${item.workerId}?month=${item.date.toISOString().slice(0, 7)}`}
                        className="text-navy font-semibold hover:underline"
                      >
                        {item.worker.fullName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">{item.iqamaNumber ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatAttendanceDate(item.date)}</TableCell>
                    <TableCell className="tabular-nums">{shiftTime(item.loginTime) || "—"}</TableCell>
                    <TableCell className="tabular-nums">{shiftTime(item.logoutTime) || "—"}</TableCell>
                    <TableCell className="text-navy text-right font-semibold tabular-nums">{Number(item.totalHours).toFixed(2)}</TableCell>
                    <TableCell className="text-right text-slate-600 tabular-nums">
                      {item.loginTime ? (item.breakMinutes / 60).toFixed(2) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium text-teal-700 tabular-nums">{Number(item.overtimeHours).toFixed(2)}</TableCell>
                    <TableCell>
                      <AttendanceBadge status={item.attendanceStatus} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{leave ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="max-w-56 text-xs">
                      {item.remarks && <p className="line-clamp-2 text-slate-700">{item.remarks}</p>}
                      {item.reviewNote && <p className="line-clamp-2 text-red-700">Rejected: {item.reviewNote}</p>}
                      {!item.remarks && !item.reviewNote && <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={item.status} />
                    </TableCell>
                    {canUpdate && itemsEditable && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {rule && (
                            <AttendanceEntryDialog
                              leaveTypes={leaveTypes}
                              rule={rule}
                              edit={toEditTarget(item)}
                              trigger={
                                <Button variant="ghost" size="icon-sm" aria-label={`Correct ${item.worker.fullName} on ${formatAttendanceDate(item.date)}`}>
                                  <Pencil className="size-4" />
                                </Button>
                              }
                            />
                          )}
                          {item.status === "PENDING" && <TimesheetItemActions itemId={item.id} />}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
