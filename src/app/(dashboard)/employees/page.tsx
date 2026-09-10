import { Plus, Users } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { ExportCsvButton } from "@/components/shared/export-csv-button";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { SearchInput } from "@/components/shared/search-input";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatEmployeeCode } from "@/lib/codes";
import { can } from "@/server/rbac";
import { exportEmployeesCsv } from "@/server/actions/employees";
import { listEmployees } from "@/server/queries/employees";
import { getSessionUser } from "@/server/session";

import { EmployeeRowActions } from "./employee-row-actions";

function formatMoney(value: unknown) {
  return `SAR ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const user = await getSessionUser();
  const page = Number(params.page ?? 1) || 1;
  const canCreate = can(user, "create", "employee");
  const canEdit = can(user, "update", "employee");
  const canArchive = can(user, "archive", "employee");

  const { employees, total, pageSize } = await listEmployees(user, { search: params.q, page });

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "HR" }, { label: "Employees" }]}
        title="Employees"
        description="Internal staff on fixed monthly salary — kept separate from hourly manpower workers."
        actions={
          canCreate && (
            <Button render={<Link href="/employees/new" />}>
              <Plus className="size-4" />
              Add Employee
            </Button>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput placeholder="Search by name..." />
        <ExportCsvButton
          action={exportEmployeesCsv.bind(null, params.q)}
          filename="employees.csv"
          label="Export"
        />
      </div>

      {employees.length === 0 ? (
        <EmptyState icon={Users} title="No employees yet" description={canCreate ? "Add your first internal employee." : undefined} />
      ) : (
        <div className="rounded-lg border">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Base Salary</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((employee) => (
                  <TableRow key={employee.id} className={employee.deletedAt ? "opacity-60" : undefined}>
                    <TableCell className="text-muted-foreground font-mono text-xs">
                      {formatEmployeeCode(employee.sequenceNo)}
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link href={`/employees/${employee.id}`} className="hover:underline">
                        {employee.fullName}
                      </Link>
                    </TableCell>
                    <TableCell>{employee.department?.name ?? "—"}</TableCell>
                    <TableCell>{employee.designation?.title ?? "—"}</TableCell>
                    <TableCell>{formatMoney(employee.baseSalary)}</TableCell>
                    <TableCell>
                      {employee.deletedAt ? <Badge variant="secondary">Archived</Badge> : <StatusBadge status={employee.status} />}
                    </TableCell>
                    <TableCell className="text-right">
                      <EmployeeRowActions
                        employeeId={employee.id}
                        employeeName={employee.fullName}
                        deletedAt={employee.deletedAt}
                        canEdit={canEdit}
                        canArchive={canArchive}
                      />
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
