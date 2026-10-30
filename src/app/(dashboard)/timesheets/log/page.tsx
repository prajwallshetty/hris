import { CalendarRange, ClipboardList, MessageSquareText, MoonStar, Pencil, Plus } from "lucide-react";
import Link from "next/link";

import { AttendanceBadge, AttendanceLegend } from "@/components/shared/attendance-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ExportCsvButton } from "@/components/shared/export-csv-button";
import { MonthFilter } from "@/components/shared/month-filter";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { SearchInput } from "@/components/shared/search-input";
import { SelectFilter } from "@/components/shared/select-filter";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ATTENDANCE_LEGEND_ORDER,
  ATTENDANCE_TONES,
  LEAVE_CATEGORIES,
  LEAVE_CATEGORY_LABELS,
  WORKER_ATTENDANCE_STATUSES,
  leaveTypeLabel,
  type WorkerAttendanceStatusValue,
} from "@/lib/attendance";
import { can } from "@/server/rbac";
import { exportTimesheetLogCsv } from "@/server/actions/timesheets";
import { getAttendancePreviewRule } from "@/server/attendance";
import {
  countTimesheetLogByAttendanceStatus,
  getTimesheetLogFilterOptions,
  listActiveLeaveTypesForSelect,
  listTimesheetLog,
} from "@/server/queries/timesheets";
import { getSessionUser } from "@/server/session";

import { AttendanceEntryDialog } from "../attendance-entry-dialog";
import { formatAttendanceDate, isTimesheetEditable, shiftTime, toEditTarget } from "../_components/edit-target";
import { TimesheetViewTabs } from "../_components/timesheet-view-tabs";

function hours(value: unknown) {
  const n = Number(value);
  return n > 0 ? n.toFixed(2) : "—";
}

function isOneOf<T extends string>(values: readonly T[], value: string | undefined): value is T {
  return value != null && (values as readonly string[]).includes(value);
}

export default async function TimesheetLogPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    month?: string;
    clientId?: string;
    projectId?: string;
    siteId?: string;
    coordinatorId?: string;
    status?: string;
    attendance?: string;
    leave?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const user = await getSessionUser();
  const page = Number(params.page ?? 1) || 1;
  const canCreate = can(user, "create", "timesheet");
  const canUpdate = can(user, "update", "timesheet");

  const filters = {
    search: params.q,
    month: params.month,
    clientId: params.clientId,
    projectId: params.projectId,
    siteId: params.siteId,
    coordinatorId: params.coordinatorId,
    status: (isOneOf(["PENDING", "APPROVED", "REJECTED"] as const, params.status) ? params.status : "ALL") as never,
    attendanceStatus: isOneOf(WORKER_ATTENDANCE_STATUSES, params.attendance) ? params.attendance : ("ALL" as const),
    leave: isOneOf(LEAVE_CATEGORIES, params.leave) ? params.leave : ("ALL" as const),
  };

  const [{ items, total, pageSize }, filterOptions, counts, leaveTypes, rule] = await Promise.all([
    listTimesheetLog(user, { ...filters, page }),
    getTimesheetLogFilterOptions(),
    countTimesheetLogByAttendanceStatus(user, filters),
    canCreate || canUpdate ? listActiveLeaveTypesForSelect() : Promise.resolve([]),
    canCreate || canUpdate ? getAttendancePreviewRule() : Promise.resolve(null),
  ]);

  const projects = params.clientId ? filterOptions.projects.filter((p) => p.clientId === params.clientId) : filterOptions.projects;
  const sites = filterOptions.sites.filter(
    (s) => (!params.clientId || s.clientId === params.clientId) && (!params.projectId || s.projectId === params.projectId),
  );
  const monthQuery = params.month ? `?month=${params.month}` : "";

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Workforce" }, { label: "Attendance" }]}
        title="Daily Attendance"
        description="Every worker-day with worked hours, break, overtime and leave kept in separate columns."
        actions={
          canCreate &&
          rule && (
            <AttendanceEntryDialog
              leaveTypes={leaveTypes}
              rule={rule}
              trigger={
                <Button>
                  <Plus className="size-4" />
                  Record Attendance
                </Button>
              }
            />
          )
        }
      />

      <TimesheetViewTabs active="daily" />

      <div className="data-panel space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput placeholder="Worker name or Iqama…" />
          <MonthFilter />
          <SelectFilter
            paramKey="attendance"
            placeholder="Status"
            options={ATTENDANCE_LEGEND_ORDER.map((s) => ({ label: ATTENDANCE_TONES[s].label, value: s }))}
          />
          <SelectFilter
            paramKey="leave"
            placeholder="Leave type"
            options={LEAVE_CATEGORIES.map((c) => ({ label: LEAVE_CATEGORY_LABELS[c], value: c }))}
          />
          <SelectFilter
            paramKey="clientId"
            placeholder="Client"
            options={filterOptions.clients.map((c) => ({ label: c.companyName, value: c.id }))}
          />
          <SelectFilter paramKey="projectId" placeholder="Project" options={projects.map((p) => ({ label: p.name, value: p.id }))} />
          <SelectFilter paramKey="siteId" placeholder="Site" options={sites.map((s) => ({ label: s.name, value: s.id }))} />
          <SelectFilter
            paramKey="status"
            placeholder="Approval"
            options={[
              { label: "Pending", value: "PENDING" },
              { label: "Approved", value: "APPROVED" },
              { label: "Rejected", value: "REJECTED" },
            ]}
          />
          <div className="ml-auto">
            <ExportCsvButton action={exportTimesheetLogCsv.bind(null, filters)} filename="attendance.csv" label="Export" />
          </div>
        </div>
        <div className="border-t border-slate-100 pt-3">
          <AttendanceLegend counts={counts} />
          <p className="text-muted-foreground mt-2 text-xs">
            Actual hours = check-out − check-in − break. Overtime is the part of actual hours above the daily threshold. Leave
            is never deducted from, or added to, worked hours.
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No attendance found"
          description={canCreate ? "Try other filters, or record a day with Record Attendance." : "Try adjusting your filters."}
        />
      ) : (
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
                  {canUpdate && <TableHead className="text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const site = item.timesheet.site;
                  const leave = leaveTypeLabel(item);
                  const leaveHours =
                    Number(item.sickLeaveHours) + Number(item.annualLeaveHours) + Number(item.unpaidLeaveHours) + Number(item.otherLeaveHours);
                  const overnight = item.loginTime && item.logoutTime && item.logoutTime.toISOString().slice(0, 10) !== item.loginTime.toISOString().slice(0, 10);
                  const editable = canUpdate && rule && isTimesheetEditable(item.timesheet.status);
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="min-w-40">
                        <Link
                          href={`/timesheets/worker/${item.worker.id}${monthQuery || `?month=${item.date.toISOString().slice(0, 7)}`}`}
                          className="text-navy font-semibold hover:underline"
                        >
                          {item.worker.fullName}
                        </Link>
                        {site && (
                          <p className="text-muted-foreground truncate text-xs">
                            {site.project.client.companyName} · {site.name}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">{item.iqamaNumber ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatAttendanceDate(item.date)}</TableCell>
                      <TableCell className="tabular-nums">{shiftTime(item.loginTime) || "—"}</TableCell>
                      <TableCell className="tabular-nums whitespace-nowrap">
                        {shiftTime(item.logoutTime) || "—"}
                        {overnight && (
                          <MoonStar className="ml-1 inline size-3.5 text-indigo-500" aria-label="Overnight shift (next day)" />
                        )}
                      </TableCell>
                      <TableCell className="text-navy text-right font-semibold tabular-nums">{hours(item.totalHours)}</TableCell>
                      <TableCell className="text-right text-slate-600 tabular-nums">
                        {item.loginTime && item.breakMinutes > 0 ? `${(item.breakMinutes / 60).toFixed(2)}` : "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium text-teal-700 tabular-nums">{hours(item.overtimeHours)}</TableCell>
                      <TableCell>
                        <AttendanceBadge status={item.attendanceStatus as WorkerAttendanceStatusValue} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {leave ? (
                          <span className="block leading-tight">
                            {leave}
                            <span className="text-muted-foreground block text-xs tabular-nums">{leaveHours.toFixed(2)}h</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-44">
                        {item.remarks || item.reviewNote ? (
                          <div className="space-y-0.5 text-xs">
                            {item.remarks && <p className="line-clamp-2 text-slate-700">{item.remarks}</p>}
                            {item.reviewNote && (
                              <p className="flex items-start gap-1 text-red-700">
                                <MessageSquareText className="mt-0.5 size-3 shrink-0" />
                                <span className="line-clamp-2">{item.reviewNote}</span>
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={item.status} />
                      </TableCell>
                      {canUpdate && (
                        <TableCell className="text-right">
                          {editable && (
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
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <Pagination page={page} pageSize={pageSize} total={total} />
        </div>
      )}

      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <CalendarRange className="size-3.5" /> Open a worker&rsquo;s name for their monthly timesheet and totals.
      </p>
    </div>
  );
}

