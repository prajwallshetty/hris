import { Lock } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ConfirmActionButton } from "@/components/shared/confirm-action-button";
import { EmptyState } from "@/components/shared/empty-state";
import { KpiCard } from "@/components/shared/kpi-card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { can } from "@/server/rbac";
import { lockPayrollPeriod } from "@/server/actions/payroll";
import { listClientHierarchyForSelect } from "@/server/queries/clients";
import { listEmployeesForSelect } from "@/server/queries/employees";
import { getPayrollPeriod } from "@/server/queries/payroll";
import { listWorkersForSelect } from "@/server/queries/workers";
import { getSessionUser } from "@/server/session";

import { GenerateEmployeePayrollForm } from "./generate-employee-form";
import { GeneratePayrollForm } from "./generate-form";

function formatMoney(value: unknown) {
  return `SAR ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export default async function PayrollPeriodPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  const period = await getPayrollPeriod(user, id);
  if (!period) notFound();

  const canGenerate = can(user, "create", "workerPayroll");
  const canGenerateEmployeePayroll = can(user, "create", "employeePayroll");
  const canLock = can(user, "update", "payrollPeriod");
  const notApprovedCount =
    period.workerPayrolls.filter((p) => p.status !== "APPROVED" && p.status !== "PAID" && p.status !== "PARTIALLY_PAID").length +
    period.employeePayrolls.filter((p) => p.status !== "APPROVED" && p.status !== "PAID" && p.status !== "PARTIALLY_PAID").length;

  const [clients, workers, employees] = await Promise.all([
    canGenerate ? listClientHierarchyForSelect() : Promise.resolve([]),
    canGenerate ? listWorkersForSelect(user) : Promise.resolve([]),
    canGenerateEmployeePayroll ? listEmployeesForSelect(user) : Promise.resolve([]),
  ]);

  // §20 payroll-period summary strip.
  const totalWorkers = period.workerPayrolls.length + period.employeePayrolls.length;
  const grossTotal =
    period.workerPayrolls.reduce((sum, p) => sum + Number(p.grossPay), 0) +
    period.employeePayrolls.reduce((sum, p) => sum + Number(p.baseSalary), 0);
  const netTotal =
    period.workerPayrolls.reduce((sum, p) => sum + Number(p.netPayable), 0) +
    period.employeePayrolls.reduce((sum, p) => sum + Number(p.netPayable), 0);
  const deductionsTotal = grossTotal - netTotal;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Payroll", href: "/payroll" }, { label: period.name }]}
        title={period.name}
        description={`${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(period.periodStart)} – ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(period.periodEnd)}`}
        actions={
          <>
            <StatusBadge status={period.status} />
            {canLock && !period.lockedAt && (
              <ConfirmActionButton
                trigger={
                  <Button disabled={notApprovedCount > 0}>
                    <Lock className="size-4" />
                    Lock Period
                  </Button>
                }
                title="Lock this payroll period?"
                description="All worker payroll rows must be approved first. Locking is the final sign-off for the period."
                confirmLabel="Lock Period"
                action={lockPayrollPeriod.bind(null, period.id)}
                successMessage="Payroll period locked."
              />
            )}
          </>
        }
      />

      {totalWorkers > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard label="Workers" value={totalWorkers.toLocaleString()} />
          <KpiCard label="Gross" value={formatMoney(grossTotal)} />
          <KpiCard label="Deductions" value={formatMoney(deductionsTotal)} />
          <KpiCard label="Net" value={formatMoney(netTotal)} />
        </div>
      )}

      {canGenerate && !period.lockedAt && (
        <GeneratePayrollForm payrollPeriodId={period.id} clients={clients} workers={workers} />
      )}
      {canGenerateEmployeePayroll && !period.lockedAt && (
        <GenerateEmployeePayrollForm payrollPeriodId={period.id} employees={employees} />
      )}

      {period.workerPayrolls.length === 0 ? (
        <EmptyState icon={Lock} title="No worker payroll generated yet" />
      ) : (
        <div className="rounded-lg border">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Worker</TableHead>
                  <TableHead>Regular Hrs</TableHead>
                  <TableHead>OT Hrs</TableHead>
                  <TableHead>Gross</TableHead>
                  <TableHead>Net Payable</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {period.workerPayrolls.map((p) => {
                  const paid = p.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Link href={`/payroll/worker/${p.id}`} className="font-medium hover:underline">
                          {p.worker.fullName}
                        </Link>
                      </TableCell>
                      <TableCell>{Number(p.regularHours).toFixed(1)}</TableCell>
                      <TableCell>{Number(p.overtimeHours).toFixed(1)}</TableCell>
                      <TableCell>{formatMoney(p.grossPay)}</TableCell>
                      <TableCell className="font-medium">{formatMoney(p.netPayable)}</TableCell>
                      <TableCell>{formatMoney(paid)}</TableCell>
                      <TableCell>
                        <StatusBadge status={p.status} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {period.employeePayrolls.length > 0 && (
        <div className="rounded-lg border">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Base Salary</TableHead>
                  <TableHead>Net Payable</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {period.employeePayrolls.map((p) => {
                  const paid = p.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Link href={`/payroll/employee/${p.id}`} className="font-medium hover:underline">
                          {p.employee.fullName}
                        </Link>
                      </TableCell>
                      <TableCell>{formatMoney(p.baseSalary)}</TableCell>
                      <TableCell className="font-medium">{formatMoney(p.netPayable)}</TableCell>
                      <TableCell>{formatMoney(paid)}</TableCell>
                      <TableCell>
                        <StatusBadge status={p.status} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
