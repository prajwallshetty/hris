import { CalendarOff } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { KpiCard } from "@/components/shared/kpi-card";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { SearchInput } from "@/components/shared/search-input";
import { SelectFilter } from "@/components/shared/select-filter";
import { StatusBadge } from "@/components/shared/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { can } from "@/server/rbac";
import { listLeaveRequests } from "@/server/queries/leave";
import { getSessionUser } from "@/server/session";

import { LeaveDecisionButtons } from "../workers/[id]/leave-decision-buttons";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(date);
}

export default async function LeavePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const user = await getSessionUser();
  const page = Number(params.page ?? 1) || 1;

  const { requests, total, pageSize, pendingCount } = await listLeaveRequests(user, {
    status: (params.status as never) ?? "ALL",
    search: params.q,
    page,
  });

  const canDecide = can(user, "update", "leaveRequest");

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Workforce" }, { label: "Leave" }]}
        title="Leave Requests"
        description="Every worker and employee leave request, in one review queue. File or decide an individual request from a worker's own profile."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          href="/leave?status=PENDING"
          label="Awaiting Decision"
          value={pendingCount.toLocaleString()}
          icon={CalendarOff}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SelectFilter
          paramKey="status"
          placeholder="Status"
          options={[
            { label: "Pending", value: "PENDING" },
            { label: "Approved", value: "APPROVED" },
            { label: "Rejected", value: "REJECTED" },
            { label: "Cancelled", value: "CANCELLED" },
          ]}
        />
        <SearchInput placeholder="Search by worker or employee name, Iqama…" />
      </div>

      {requests.length === 0 ? (
        <EmptyState
          icon={CalendarOff}
          title="No leave requests found"
          description="Leave is filed from a worker's or employee's own profile page."
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Worker / Employee</TableHead>
                  <TableHead>Leave Type</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead className="text-right">Days</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  {canDecide && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      {r.worker ? (
                        <Link href={`/workers/${r.worker.id}`} className="font-medium hover:underline">
                          {r.worker.fullName}
                        </Link>
                      ) : r.employee ? (
                        <Link href={`/employees/${r.employee.id}`} className="font-medium hover:underline">
                          {r.employee.fullName}
                        </Link>
                      ) : (
                        "—"
                      )}
                      {r.worker && (
                        <p className="text-muted-foreground text-xs">{r.worker.iqamaNumber}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.leaveType.name}
                      {!r.leaveType.isPaid && <span className="ml-1 text-xs">(Unpaid)</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {formatDate(r.startDate)} – {formatDate(r.endDate)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{Number(r.days)}</TableCell>
                    <TableCell className="text-muted-foreground max-w-xs truncate">{r.reason ?? "—"}</TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                    </TableCell>
                    {canDecide && (
                      <TableCell className="text-right">
                        {r.status === "PENDING" ? (
                          <LeaveDecisionButtons requestId={r.id} />
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="rounded-lg border">
            <Pagination page={page} pageSize={pageSize} total={total} />
          </div>
        </>
      )}
    </div>
  );
}
