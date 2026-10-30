import { ClipboardList, Plus, Upload } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { SelectFilter } from "@/components/shared/select-filter";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatEnumLabel } from "@/lib/format-enum";
import { can } from "@/server/rbac";
import { getAttendancePreviewRule } from "@/server/attendance";
import { listActiveLeaveTypesForSelect, listTimesheets } from "@/server/queries/timesheets";
import { getSessionUser } from "@/server/session";

import { TimesheetViewTabs } from "./_components/timesheet-view-tabs";
import { AttendanceEntryDialog } from "./attendance-entry-dialog";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(date);
}

function formatPeriod(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(date);
}

export default async function TimesheetsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const user = await getSessionUser();
  const page = Number(params.page ?? 1) || 1;
  const canCreate = can(user, "create", "timesheet");

  const [{ timesheets, total, pageSize }, leaveTypes, rule] = await Promise.all([
    listTimesheets(user, { status: (params.status as never) ?? "ALL", page }),
    canCreate ? listActiveLeaveTypesForSelect() : Promise.resolve([]),
    canCreate ? getAttendancePreviewRule() : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Workforce" }, { label: "Timesheets" }]}
        title="Timesheets"
        description="Attendance batches by site and month, from entry through approval and locking for payroll."
        actions={
          <>
            {canCreate && (
              <Button variant="outline" nativeButton={false} render={<Link href="/timesheets/upload" />}>
                <Upload className="size-4" />
                Import Excel
              </Button>
            )}
            {canCreate && rule && (
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
            )}
          </>
        }
      />

      <TimesheetViewTabs active="batches" />

      <SelectFilter
        paramKey="status"
        placeholder="Status"
        options={[
          { label: "Uploaded", value: "UPLOADED" },
          { label: "Pending Review", value: "PENDING_REVIEW" },
          { label: "Approved", value: "APPROVED" },
          { label: "Locked", value: "LOCKED" },
          { label: "Rejected", value: "REJECTED" },
        ]}
      />

      {timesheets.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No timesheets found"
          description={canCreate ? "Add a manual entry to get started." : undefined}
        />
      ) : (
        <div className="data-panel">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Client / Site</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Entries</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Uploaded</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {timesheets.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <Link href={`/timesheets/${t.id}`} className="font-medium hover:underline">
                        {formatPeriod(t.period)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {t.site ? `${t.site.project.client.companyName} / ${t.site.name}` : "—"}
                    </TableCell>
                    <TableCell>{formatEnumLabel(t.uploadSource)}</TableCell>
                    <TableCell>{t._count.items}</TableCell>
                    <TableCell>
                      <StatusBadge status={t.status} />
                    </TableCell>
                    <TableCell>{formatDate(t.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination page={page} pageSize={pageSize} total={total} />
        </div>
      )}
    </div>
  );
}
