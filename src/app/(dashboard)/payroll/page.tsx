import { Banknote } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { SelectFilter } from "@/components/shared/select-filter";
import { StatusBadge } from "@/components/shared/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { can } from "@/server/rbac";
import { listPayrollPeriods } from "@/server/queries/payroll";
import { getSessionUser } from "@/server/session";

import { PayrollPeriodFormDialog } from "./period-form-dialog";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(date);
}

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const user = await getSessionUser();
  const page = Number(params.page ?? 1) || 1;
  const canCreate = can(user, "create", "payrollPeriod");

  const { periods, total, pageSize } = await listPayrollPeriods(user, {
    status: (params.status as never) ?? "ALL",
    page,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Payroll" }]}
        title="Payroll"
        description="Generate worker payroll from locked timesheets, review, approve, and lock each period."
        actions={canCreate && <PayrollPeriodFormDialog />}
      />

      <SelectFilter
        paramKey="status"
        placeholder="Status"
        options={[
          { label: "Draft", value: "DRAFT" },
          { label: "Review", value: "REVIEW" },
          { label: "Approved", value: "APPROVED" },
          { label: "Paid", value: "PAID" },
          { label: "Partially Paid", value: "PARTIALLY_PAID" },
        ]}
      />

      {periods.length === 0 ? (
        <EmptyState
          icon={Banknote}
          title="No payroll periods yet"
          description={canCreate ? "Create a payroll period to start generating worker payroll." : undefined}
        />
      ) : (
        <div className="rounded-lg border">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Workers</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periods.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link href={`/payroll/${p.id}`} className="font-medium hover:underline">
                        {p.name}
                      </Link>
                    </TableCell>
                    <TableCell>{formatDate(p.periodStart)}</TableCell>
                    <TableCell>{formatDate(p.periodEnd)}</TableCell>
                    <TableCell>{p._count.workerPayrolls}</TableCell>
                    <TableCell>
                      <StatusBadge status={p.status} />
                    </TableCell>
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
