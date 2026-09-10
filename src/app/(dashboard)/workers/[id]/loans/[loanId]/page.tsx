import { Pencil, Receipt, XCircle } from "lucide-react";
import { notFound } from "next/navigation";

import { ConfirmActionButton } from "@/components/shared/confirm-action-button";
import { EmptyState } from "@/components/shared/empty-state";
import { KpiCard } from "@/components/shared/kpi-card";
import { RecordAvatarInitials, RecordHeader } from "@/components/shared/record-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { calculateRepayableBalance } from "@/server/calc";
import { writeOffLoan } from "@/server/actions/finance";
import { can } from "@/server/rbac";
import { getLoanDetail } from "@/server/queries/worker-detail";
import { getSessionUser } from "@/server/session";

import { LoanDialog } from "../../loan-dialog";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(date);
}

function formatMoney(value: unknown) {
  return `SAR ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export default async function LoanDetailPage({ params }: { params: Promise<{ id: string; loanId: string }> }) {
  const { id, loanId } = await params;
  const user = await getSessionUser();
  const loan = await getLoanDetail(user, loanId);
  if (!loan || loan.workerId !== id) notFound();

  const paid = loan.repayments.reduce((sum, r) => sum + Number(r.amount), 0);
  const remaining = calculateRepayableBalance(
    loan.principalAmount.toString(),
    loan.repayments.map((r) => r.amount.toString()),
  ).toNumber();
  const principal = Number(loan.principalAmount);
  const progressPct = principal > 0 ? Math.min(100, Math.round((paid / principal) * 100)) : 0;
  const installmentAmount = loan.installmentAmount ? Number(loan.installmentAmount) : null;
  const installmentsRemaining = installmentAmount && installmentAmount > 0 ? Math.ceil(remaining / installmentAmount) : null;
  const nextDeduction = loan.status === "ACTIVE" && installmentAmount ? formatMoney(Math.min(installmentAmount, remaining)) : "—";
  const canEdit = can(user, "update", "loan") && loan.repayments.length === 0;
  const canWriteOff = can(user, "update", "loan") && loan.status === "ACTIVE";

  return (
    <div className="space-y-6">
      <RecordHeader
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Workforce" },
          { label: "Workers", href: "/workers" },
          { label: loan.worker!.fullName, href: `/workers/${loan.worker!.id}` },
          { label: "Loan" },
        ]}
        avatar={<RecordAvatarInitials name={loan.worker!.fullName} />}
        title={`Loan — ${loan.worker!.fullName}`}
        badges={<StatusBadge status={loan.status} />}
        meta={<span>Given {formatDate(loan.dateGiven)}{loan.reason ? ` · ${loan.reason}` : ""}</span>}
        actions={
          <>
            {canEdit && (
              <LoanDialog
                workerId={loan.workerId ?? undefined}
                loanId={loan.id}
                defaultValues={{
                  workerId: loan.workerId ?? "",
                  employeeId: "",
                  principalAmount: principal,
                  dateGiven: loan.dateGiven.toISOString().slice(0, 10),
                  installments: loan.installments ?? undefined,
                  installmentAmount: installmentAmount ?? undefined,
                  reason: loan.reason ?? "",
                }}
                trigger={
                  <Button variant="outline">
                    <Pencil className="size-4" />
                    Edit
                  </Button>
                }
              />
            )}
            {canWriteOff && (
              <ConfirmActionButton
                trigger={
                  <Button variant="outline">
                    <XCircle className="size-4" />
                    Write Off
                  </Button>
                }
                title="Write off this loan?"
                description={`The remaining ${formatMoney(remaining)} will no longer be recovered from payroll. This cannot be undone.`}
                confirmLabel="Write Off"
                variant="destructive"
                action={writeOffLoan.bind(null, loan.id)}
                successMessage="Loan written off."
              />
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Original Loan" value={formatMoney(loan.principalAmount)} />
        <KpiCard label="Paid" value={formatMoney(paid)} />
        <KpiCard label="Remaining" value={formatMoney(remaining)} className={remaining > 0 ? "text-warning-foreground" : undefined} />
        <KpiCard label="Monthly Deduction" value={installmentAmount ? formatMoney(installmentAmount) : "—"} />
      </div>

      <div className="rounded-lg border p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium">Repayment Progress</span>
          <span className="text-muted-foreground">{progressPct}%</span>
        </div>
        <Progress value={progressPct} />
        <div className="text-muted-foreground mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase">Next Deduction</p>
            <p className="text-foreground font-medium">{nextDeduction}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase">Installments</p>
            <p className="text-foreground font-medium">
              {loan.installments ?? "—"} {installmentsRemaining !== null && `(${installmentsRemaining} remaining)`}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase">Status</p>
            <p className="text-foreground font-medium">{loan.status.replaceAll("_", " ")}</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Payments / Deductions</h3>
        {loan.repayments.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No deductions recorded yet"
            description="Repayments are applied automatically when this loan is deducted during payroll processing."
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Running Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loan.repayments.map((r, i) => {
                  const cumulative = loan.repayments.slice(0, i + 1).reduce((sum, x) => sum + Number(x.amount), 0);
                  return (
                    <TableRow key={r.id}>
                      <TableCell>{formatDate(r.date)}</TableCell>
                      <TableCell className="font-medium">{formatMoney(r.amount)}</TableCell>
                      <TableCell>{formatMoney(Math.max(0, principal - cumulative))}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
