import { Lock, Send, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";

import { ConfirmActionButton } from "@/components/shared/confirm-action-button";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { can } from "@/server/rbac";
import { approveTimesheet, lockTimesheet, submitTimesheetForReview } from "@/server/actions/timesheets";
import { getTimesheetDetail } from "@/server/queries/timesheets";
import { getSessionUser } from "@/server/session";

import { TimesheetItemActions } from "./item-decision-dialog";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(date);
}

function formatTime(date: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(date);
}

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
  const itemsEditable = timesheet.status !== "LOCKED" && timesheet.status !== "APPROVED";

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
        <span className="text-muted-foreground">Source: {timesheet.uploadSource}</span>
        <StatusBadge status={timesheet.status} />
        {timesheet.status === "PENDING_REVIEW" && pendingCount > 0 && (
          <span className="text-warning-foreground">
            {pendingCount} entr{pendingCount === 1 ? "y" : "ies"} awaiting decision
          </span>
        )}
      </div>

      <div className="rounded-lg border">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Worker</TableHead>
                <TableHead>Iqama</TableHead>
                <TableHead>Login</TableHead>
                <TableHead>Logout</TableHead>
                <TableHead>Regular</TableHead>
                <TableHead>OT</TableHead>
                <TableHead>Status</TableHead>
                {canUpdate && itemsEditable && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {timesheet.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{formatDate(item.date)}</TableCell>
                  <TableCell>{item.worker.fullName}</TableCell>
                  <TableCell>{item.iqamaNumber}</TableCell>
                  <TableCell>{formatTime(item.loginTime)}</TableCell>
                  <TableCell>{formatTime(item.logoutTime)}</TableCell>
                  <TableCell>{Number(item.regularHours).toFixed(2)}h</TableCell>
                  <TableCell>{Number(item.overtimeHours).toFixed(2)}h</TableCell>
                  <TableCell>
                    <StatusBadge status={item.status} />
                    {item.status === "REJECTED" && item.remarks && (
                      <p className="text-muted-foreground mt-1 text-xs">{item.remarks}</p>
                    )}
                  </TableCell>
                  {canUpdate && itemsEditable && (
                    <TableCell className="text-right">
                      {item.status === "PENDING" && <TimesheetItemActions itemId={item.id} />}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
