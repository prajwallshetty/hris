import { Receipt } from "lucide-react";
import { notFound } from "next/navigation";

import { ConfirmActionButton } from "@/components/shared/confirm-action-button";
import { EmptyState } from "@/components/shared/empty-state";
import { KpiCard } from "@/components/shared/kpi-card";
import { RecordAvatarInitials, RecordHeader } from "@/components/shared/record-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { can } from "@/server/rbac";
import { cancelRecurringCharge } from "@/server/actions/recurring-charges";
import { getRecurringChargeDetail, summarizeRecurringCharge } from "@/server/queries/recurring-charges";
import { getSessionUser } from "@/server/session";

import { RecordDeductionDialog } from "../../record-deduction-dialog";
import { RecurringChargeDialog } from "../../recurring-charge-dialog";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(date);
}

function formatMoney(value: number) {
  return `SAR ${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export default async function RecurringChargeDetailPage({
  params,
}: {
  params: Promise<{ id: string; chargeId: string }>;
}) {
  const { id, chargeId } = await params;
  const user = await getSessionUser();
  const charge = await getRecurringChargeDetail(user, chargeId);
  if (!charge || charge.workerId !== id) notFound();

  const canEdit = can(user, "update", "recurringCharge");
  const canRecordDeduction = can(user, "create", "recurringCharge");
  const canCancel = can(user, "archive", "recurringCharge");

  const { due, paid, outstanding } = summarizeRecurringCharge(charge);

  return (
    <div className="space-y-6">
      <RecordHeader
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Workforce" },
          { label: "Workers", href: "/workers" },
          { label: charge.worker.fullName, href: `/workers/${charge.worker.id}` },
          { label: "Recurring Charge" },
        ]}
        avatar={<RecordAvatarInitials name={charge.worker.fullName} />}
        title={charge.description || `${charge.category} — ${charge.worker.fullName}`}
        badges={<StatusBadge status={charge.status} />}
        meta={
          <span>
            {charge.category} · {charge.frequency.replaceAll("_", " ")} · Started {formatDate(charge.startDate)}
            {charge.endDate ? ` · Ends ${formatDate(charge.endDate)}` : ""}
          </span>
        }
        actions={
          <>
            {canEdit && charge.status === "ACTIVE" && (
              <RecurringChargeDialog
                workerId={charge.workerId}
                charge={{
                  id: charge.id,
                  category: charge.category,
                  description: charge.description,
                  amount: Number(charge.amount),
                  frequency: charge.frequency,
                  startDate: charge.startDate.toISOString().slice(0, 10),
                  endDate: charge.endDate ? charge.endDate.toISOString().slice(0, 10) : null,
                  depositAmount: charge.depositAmount ? Number(charge.depositAmount) : null,
                  depositPaid: charge.depositPaid,
                  notes: charge.notes,
                }}
                trigger={<Button variant="outline">Edit</Button>}
              />
            )}
            {canCancel && charge.status === "ACTIVE" && (
              <ConfirmActionButton
                trigger={<Button variant="outline">Cancel Charge</Button>}
                title="Cancel this recurring charge?"
                description="No further amounts will accrue. Existing deductions remain on record."
                confirmLabel="Cancel Charge"
                variant="destructive"
                action={cancelRecurringCharge.bind(null, charge.id)}
                successMessage="Charge cancelled."
              />
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Rate" value={`${formatMoney(Number(charge.amount))} / ${charge.frequency.toLowerCase().replace("_", "-")}`} />
        <KpiCard label="Due to Date" value={formatMoney(due)} />
        <KpiCard label="Paid" value={formatMoney(paid)} />
        <KpiCard label="Outstanding" value={formatMoney(outstanding)} className={outstanding > 0 ? "text-warning-foreground" : undefined} />
      </div>

      {charge.depositAmount != null && (
        <div className="rounded-lg border p-4 text-sm">
          <span className="text-muted-foreground">Deposit: </span>
          <span className="font-medium">{formatMoney(Number(charge.depositAmount))}</span>
          <span className="ml-2">
            <StatusBadge status={charge.depositPaid ? "PAID" : "PENDING"} />
          </span>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Deduction History</h3>
          {canRecordDeduction && charge.status === "ACTIVE" && <RecordDeductionDialog chargeId={charge.id} />}
        </div>
        {charge.deductions.length === 0 ? (
          <EmptyState icon={Receipt} title="No deductions recorded yet" />
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {charge.deductions.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{formatDate(d.date)}</TableCell>
                    <TableCell className="font-medium">{formatMoney(Number(d.amount))}</TableCell>
                    <TableCell>{d.notes ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
