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
import { writeOffAdvance } from "@/server/actions/finance";
import { can } from "@/server/rbac";
import { getAdvanceDetail } from "@/server/queries/worker-detail";
import { getSessionUser } from "@/server/session";

import { AdvanceDialog } from "../../advance-dialog";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(date);
}

function formatMoney(value: unknown) {
  return `SAR ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export default async function AdvanceDetailPage({ params }: { params: Promise<{ id: string; advanceId: string }> }) {
  const { id, advanceId } = await params;
  const user = await getSessionUser();
  const advance = await getAdvanceDetail(user, advanceId);
  if (!advance || advance.workerId !== id) notFound();

  const paid = advance.repayments.reduce((sum, r) => sum + Number(r.amount), 0);
  const remaining = calculateRepayableBalance(
    advance.amount.toString(),
    advance.repayments.map((r) => r.amount.toString()),
  ).toNumber();
  const amount = Number(advance.amount);
  const progressPct = amount > 0 ? Math.min(100, Math.round((paid / amount) * 100)) : 0;
  const canEdit = can(user, "update", "advance") && advance.repayments.length === 0;
  const canWriteOff = can(user, "update", "advance") && advance.status === "ACTIVE";

  return (
    <div className="space-y-6">
      <RecordHeader
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Workforce" },
          { label: "Workers", href: "/workers" },
          { label: advance.worker!.fullName, href: `/workers/${advance.worker!.id}` },
          { label: "Advance" },
        ]}
        avatar={<RecordAvatarInitials name={advance.worker!.fullName} />}
        title={`Advance — ${advance.worker!.fullName}`}
        badges={<StatusBadge status={advance.status} />}
        meta={<span>Given {formatDate(advance.dateGiven)}{advance.reason ? ` · ${advance.reason}` : ""}</span>}
        actions={
          <>
            {canEdit && (
              <AdvanceDialog
                workerId={advance.workerId ?? undefined}
                advanceId={advance.id}
                defaultValues={{
                  workerId: advance.workerId ?? "",
                  employeeId: "",
                  amount: amount,
                  dateGiven: advance.dateGiven.toISOString().slice(0, 10),
                  reason: advance.reason ?? "",
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
                title="Write off this advance?"
                description={`The remaining ${formatMoney(remaining)} will no longer be recovered from payroll. This cannot be undone.`}
                confirmLabel="Write Off"
                variant="destructive"
                action={writeOffAdvance.bind(null, advance.id)}
                successMessage="Advance written off."
              />
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Original Advance" value={formatMoney(advance.amount)} />
        <KpiCard label="Recovered" value={formatMoney(paid)} />
        <KpiCard
          label="Remaining"
          value={formatMoney(remaining)}
          className={remaining > 0 ? "text-warning-foreground" : undefined}
        />
        <KpiCard label="Status" value={advance.status.replaceAll("_", " ")} />
      </div>

      <div className="rounded-lg border p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium">Recovery Progress</span>
          <span className="text-muted-foreground">{progressPct}%</span>
        </div>
        <Progress value={progressPct} />
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Payroll Deductions</h3>
        {advance.repayments.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No deductions recorded yet"
            description="Recoveries are applied automatically when this advance is deducted during payroll processing."
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
                {advance.repayments.map((r, i) => {
                  const cumulative = advance.repayments.slice(0, i + 1).reduce((sum, x) => sum + Number(x.amount), 0);
                  return (
                    <TableRow key={r.id}>
                      <TableCell>{formatDate(r.date)}</TableCell>
                      <TableCell className="font-medium">{formatMoney(r.amount)}</TableCell>
                      <TableCell>{formatMoney(Math.max(0, amount - cumulative))}</TableCell>
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
