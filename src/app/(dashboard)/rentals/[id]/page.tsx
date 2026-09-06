import { notFound } from "next/navigation";
import Link from "next/link";

import { KpiCard } from "@/components/shared/kpi-card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatRentalCode } from "@/lib/codes";
import { calculateOutstanding } from "@/server/calc/finance";
import { calculateRentalTotal } from "@/server/calc/rental";
import { can } from "@/server/rbac";
import { getRental } from "@/server/queries/equipment";
import { getSessionUser } from "@/server/session";

import { ExtendRentalDialog } from "../extend-rental-dialog";
import { RecordChargeDialog } from "../record-charge-dialog";
import { RecordPaymentDialog } from "../record-payment-dialog";
import { ActivateRentalButton, CancelRentalButton, CloseRentalButton } from "../rental-lifecycle-buttons";
import { ReturnRentalDialog } from "../return-rental-dialog";

function formatDate(date: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(date);
}

function formatMoney(value: unknown) {
  return `SAR ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export default async function RentalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  const rental = await getRental(user, id);
  if (!rental) notFound();

  const canUpdate = can(user, "update", "equipmentRental");
  const canRecordPayment = can(user, "create", "rentalPayment");

  const total = calculateRentalTotal(rental.charges.map((c) => c.amount.toString()));
  const paid = rental.payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const outstanding = calculateOutstanding(total, rental.payments.map((p) => p.amount.toString()));

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Operations" },
          { label: "Rentals", href: "/rentals" },
          { label: formatRentalCode(rental.sequenceNo) },
        ]}
        title={rental.equipment.name}
        description={`${formatRentalCode(rental.sequenceNo)} · Rented to ${rental.client.companyName}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={rental.status} />
            {canUpdate && rental.status === "RESERVED" && (
              <>
                <ActivateRentalButton rentalId={rental.id} />
                <CancelRentalButton rentalId={rental.id} />
              </>
            )}
            {canUpdate && (rental.status === "ACTIVE" || rental.status === "EXTENDED") && (
              <>
                <ExtendRentalDialog rentalId={rental.id} trigger={<Button size="sm" variant="outline">Extend</Button>} />
                <ReturnRentalDialog rentalId={rental.id} trigger={<Button size="sm">Return</Button>} />
              </>
            )}
            {canUpdate && rental.status === "RETURNED" && <CloseRentalButton rentalId={rental.id} />}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Total" value={formatMoney(total)} />
        <KpiCard label="Paid" value={formatMoney(paid)} />
        <KpiCard
          label="Outstanding"
          value={formatMoney(outstanding)}
          className={outstanding.toNumber() > 0 ? "text-warning-foreground" : undefined}
        />
        <KpiCard label="Rate" value={`${formatMoney(rental.rateAmount)} / ${rental.rateType.toLowerCase()}`} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 text-sm">
        <div className="rounded-lg border p-4">
          <p className="text-muted-foreground mb-2 text-xs font-medium uppercase">Equipment</p>
          <Link href={`/equipment/${rental.equipmentId}`} className="font-medium hover:underline">
            {rental.equipment.name} — {rental.equipment.serialNumber}
          </Link>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-muted-foreground mb-2 text-xs font-medium uppercase">Deployment</p>
          <p>
            {rental.client.companyName}
            {rental.site ? ` / ${rental.site.name}` : ""}
          </p>
          <p className="text-muted-foreground">
            {formatDate(rental.startDate)} → {formatDate(rental.actualReturnDate ?? rental.expectedEndDate)}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Charges</h3>
          {canUpdate && <RecordChargeDialog rentalId={rental.id} />}
        </div>
        {rental.charges.length === 0 ? (
          <p className="text-muted-foreground text-sm">No charges recorded yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rental.charges.map((charge) => (
                  <TableRow key={charge.id}>
                    <TableCell>{formatDate(charge.date)}</TableCell>
                    <TableCell>
                      <StatusBadge status={charge.type} />
                    </TableCell>
                    <TableCell>{charge.description ?? "—"}</TableCell>
                    <TableCell className="font-medium">{formatMoney(charge.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Payments</h3>
          {canRecordPayment && <RecordPaymentDialog rentalId={rental.id} />}
        </div>
        {rental.payments.length === 0 ? (
          <p className="text-muted-foreground text-sm">No payments recorded yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rental.payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{formatDate(payment.date)}</TableCell>
                    <TableCell>{payment.method.replaceAll("_", " ")}</TableCell>
                    <TableCell>{payment.referenceNumber ?? "—"}</TableCell>
                    <TableCell className="font-medium">{formatMoney(payment.amount)}</TableCell>
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
