import { Send, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ConfirmActionButton } from "@/components/shared/confirm-action-button";
import { KpiCard } from "@/components/shared/kpi-card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Timeline, type TimelineItem } from "@/components/shared/timeline";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { auditActionLabel, auditActionTone } from "@/lib/audit-log-format";
import { calculateOutstanding } from "@/server/calc";
import { can } from "@/server/rbac";
import { approveWorkerPayroll, submitWorkerPayrollForReview } from "@/server/actions/payroll";
import { getEntityAuditLog } from "@/server/queries/dashboard";
import { getWorkerPayrollDetail, listActiveAdvancesForWorker, listActiveLoansForWorker } from "@/server/queries/payroll";
import { getSessionUser } from "@/server/session";

import { PaymentDialog } from "../../../workers/[id]/payment-dialog";
import { PayrollAdjustmentDialog, RepaymentDialog } from "./payroll-actions";

function formatMoney(value: unknown) {
  return `SAR ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(date);
}

export default async function WorkerPayrollDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  const payroll = await getWorkerPayrollDetail(user, id);
  if (!payroll) notFound();

  const canUpdate = can(user, "update", "workerPayroll");
  const canPay = can(user, "create", "workerPayment");
  const canViewActivity = can(user, "view", "auditLog");
  const editable = payroll.status === "DRAFT" || payroll.status === "REVIEW";

  const [advances, loans, activity] = await Promise.all([
    editable && canUpdate ? listActiveAdvancesForWorker(payroll.workerId) : Promise.resolve([]),
    editable && canUpdate ? listActiveLoansForWorker(payroll.workerId) : Promise.resolve([]),
    canViewActivity ? getEntityAuditLog("WorkerPayroll", payroll.id) : Promise.resolve([]),
  ]);

  const activityItems: TimelineItem[] = activity.map((entry) => ({
    id: entry.id,
    title: `${auditActionLabel(entry.action)} by ${entry.user?.name ?? "System"}`,
    timestamp: entry.createdAt,
    tone: auditActionTone(entry.action),
  }));

  const paid = payroll.payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const outstanding = calculateOutstanding(
    payroll.netPayable.toString(),
    payroll.payments.map((p) => p.amount.toString()),
  ).toNumber();

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Payroll", href: "/payroll" },
          { label: payroll.payrollPeriod.name, href: `/payroll/${payroll.payrollPeriodId}` },
          { label: payroll.worker.fullName },
        ]}
        title={payroll.worker.fullName}
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
                action={submitWorkerPayrollForReview.bind(null, payroll.id)}
                successMessage="Submitted for review."
              />
            )}
            {canUpdate && payroll.status === "REVIEW" && (
              <ConfirmActionButton
                trigger={
                  <Button>
                    <ShieldCheck className="size-4" />
                    Approve
                  </Button>
                }
                title="Approve this payroll?"
                description="Once approved, no further adjustments can be made to this worker's payroll for this period."
                confirmLabel="Approve"
                action={approveWorkerPayroll.bind(null, payroll.id)}
                successMessage="Payroll approved."
              />
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Net Payable" value={formatMoney(payroll.netPayable)} />
        <KpiCard label="Paid" value={formatMoney(paid)} />
        <KpiCard
          label="Outstanding"
          value={formatMoney(outstanding)}
          className={outstanding > 0 ? "text-warning-foreground" : undefined}
        />
        <KpiCard label="Hours" value={`${Number(payroll.regularHours).toFixed(1)} reg / ${Number(payroll.overtimeHours).toFixed(1)} OT`} />
      </div>

      <div className="rounded-lg border p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium">Calculation Breakdown</p>
          {canUpdate && editable && <PayrollAdjustmentDialog workerPayrollId={payroll.id} />}
        </div>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payroll.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.type.replaceAll("_", " ")}</TableCell>
                  <TableCell>{item.description ?? "—"}</TableCell>
                  <TableCell>{item.quantity ? Number(item.quantity).toFixed(2) : "—"}</TableCell>
                  <TableCell>{item.rate ? formatMoney(item.rate) : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(item.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Separator className="my-4" />
        <div className="ml-auto max-w-xs space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Gross Pay</span>
            <span className="tabular-nums">{formatMoney(payroll.grossPay)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Net Payable</span>
            <span className="tabular-nums">{formatMoney(payroll.netPayable)}</span>
          </div>
        </div>

        {canUpdate && editable && (advances.length > 0 || loans.length > 0) && (
          <>
            <Separator className="my-4" />
            <div className="flex flex-wrap gap-2">
              <RepaymentDialog
                workerPayrollId={payroll.id}
                kind="ADVANCE"
                sources={advances.map((a) => ({
                  id: a.id,
                  label: formatDate(a.dateGiven),
                  remaining: formatMoney(a.remaining.toNumber()),
                }))}
              />
              <RepaymentDialog
                workerPayrollId={payroll.id}
                kind="LOAN"
                sources={loans.map((l) => ({
                  id: l.id,
                  label: formatDate(l.dateGiven),
                  remaining: formatMoney(l.remaining.toNumber()),
                }))}
              />
            </div>
          </>
        )}
      </div>

      <div className="rounded-lg border p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium">Payments</p>
          {canPay && (payroll.status === "APPROVED" || payroll.status === "PARTIALLY_PAID") && (
            <PaymentDialog
              workerId={payroll.workerId}
              workerPayrollId={payroll.id}
              trigger={<Button size="sm">Record Payment</Button>}
            />
          )}
        </div>
        {payroll.payments.length === 0 ? (
          <p className="text-muted-foreground text-sm">No payments recorded yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payroll.payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{formatDate(p.date)}</TableCell>
                    <TableCell className="font-medium">{formatMoney(p.amount)}</TableCell>
                    <TableCell>{p.method.replaceAll("_", " ")}</TableCell>
                    <TableCell>{p.referenceNumber ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {canViewActivity && (
        <div className="rounded-lg border p-4">
          <p className="mb-3 text-sm font-medium">Activity</p>
          <Timeline items={activityItems} emptyMessage="No recorded changes for this payroll record yet" />
        </div>
      )}

      <Link href={`/payroll/${payroll.payrollPeriodId}`} className="text-muted-foreground text-sm hover:underline">
        ← Back to {payroll.payrollPeriod.name}
      </Link>
    </div>
  );
}
