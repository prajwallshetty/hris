import { Plus, Users } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { SearchInput } from "@/components/shared/search-input";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { can } from "@/server/rbac";
import { listEmployees } from "@/server/queries/employees";
import { getSessionUser } from "@/server/session";

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

  const { employees, total, pageSize } = await listEmployees(user, { search: params.q, page });

  return (
    <div className="space-y-6">
      <PageHeader
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

      <SearchInput placeholder="Search by name..." />

      {employees.length === 0 ? (
        <EmptyState icon={Users} title="No employees yet" description={canCreate ? "Add your first internal employee." : undefined} />
      ) : (
        <div className="rounded-lg border">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Base Salary</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell className="font-medium">
                      <Link href={`/employees/${employee.id}`} className="hover:underline">
                        {employee.fullName}
                      </Link>
                    </TableCell>
                    <TableCell>{employee.department?.name ?? "—"}</TableCell>
                    <TableCell>{employee.designation?.title ?? "—"}</TableCell>
                    <TableCell>{formatMoney(employee.baseSalary)}</TableCell>
                    <TableCell>
                      <StatusBadge status={employee.status} />
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
