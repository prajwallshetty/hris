import { CheckCircle2, Send } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ConfirmActionButton } from "@/components/shared/confirm-action-button";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { can } from "@/server/rbac";
import {
  approveEmployeePayroll,
  markEmployeePayrollPaid,
  submitEmployeePayrollForReview,
} from "@/server/actions/employee-payroll";
import { getEmployeePayrollDetail } from "@/server/queries/employee-payroll";
import { getSessionUser } from "@/server/session";

import { EmployeePayrollAdjustmentDialog } from "./employee-payroll-actions";

function formatMoney(value: unknown) {
  return `SAR ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export default async function EmployeePayrollDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  const payroll = await getEmployeePayrollDetail(user, id);
  if (!payroll) notFound();

  const canUpdate = can(user, "update", "employeePayroll");
  const editable = payroll.status === "DRAFT" || payroll.status === "REVIEW";

  return (
    <div className="space-y-6">
      <PageHeader
        title={payroll.employee.fullName}
        description={payroll.payrollPeriod.name}
        actions={
          <>
            <StatusBadge status={payroll.status} />
            {canUpdate && payroll.status === "DRAFT" && (
              <ConfirmActionButton
                trigger={
                  <Button variant="outline">
                    <Send className="size-4" />
                    Submit for Review
                  </Button>
                }
                title="Submit for review?"
                description="The payroll figures should be finalized before submitting."
                confirmLabel="Submit"
                action={submitEmployeePayrollForReview.bind(null, payroll.id)}
                successMessage="Submitted for review."
              />
            )}
            {canUpdate && payroll.status === "REVIEW" && (
              <ConfirmActionButton
                trigger={
                  <Button>
                    <CheckCircle2 className="size-4" />
                    Approve
                  </Button>
                }
                title="Approve this payroll?"
                description="Once approved, no further adjustments can be made."
                confirmLabel="Approve"
                action={approveEmployeePayroll.bind(null, payroll.id)}
                successMessage="Payroll approved."
              />
            )}
            {canUpdate && payroll.status === "APPROVED" && (
              <ConfirmActionButton
                trigger={<Button>Mark Paid</Button>}
                title="Mark this payroll as paid?"
                description="There is no payment ledger for internal employees yet, so this is a direct status change rather than a recorded transaction."
                confirmLabel="Mark Paid"
                action={markEmployeePayrollPaid.bind(null, payroll.id)}
                successMessage="Payroll marked paid."
              />
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border p-4">
          <p className="text-muted-foreground text-xs font-medium">Base Salary</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{formatMoney(payroll.baseSalary)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-muted-foreground text-xs font-medium">Deductions</p>
          <p className="mt-1 text-lg font-medium tabular-nums">
            {formatMoney(
              Number(payroll.advanceDeduction) + Number(payroll.loanDeduction) + Number(payroll.leaveDeduction) + Number(payroll.otherDeductions),
            )}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-muted-foreground text-xs font-medium">Net Payable</p>
          <p className="mt-1 text-lg font-medium tabular-nums">{formatMoney(payroll.netPayable)}</p>
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium">Calculation Breakdown</p>
          {canUpdate && editable && <EmployeePayrollAdjustmentDialog employeePayrollId={payroll.id} />}
        </div>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Base Salary</TableCell>
                <TableCell>—</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(payroll.baseSalary)}</TableCell>
              </TableRow>
              {payroll.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.type.replaceAll("_", " ")}</TableCell>
                  <TableCell>{item.description ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(item.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <Separator className="my-4" />
        <div className="ml-auto max-w-xs space-y-1 text-sm">
          <div className="flex justify-between font-semibold">
            <span>Net Payable</span>
            <span className="tabular-nums">{formatMoney(payroll.netPayable)}</span>
          </div>
        </div>
      </div>

      <Link href={`/payroll/${payroll.payrollPeriodId}`} className="text-muted-foreground text-sm hover:underline">
        ← Back to {payroll.payrollPeriod.name}
      </Link>
    </div>
  );
}
