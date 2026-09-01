import { Ban, CheckCircle2, Send } from "lucide-react";
import { notFound } from "next/navigation";

import { ConfirmActionButton } from "@/components/shared/confirm-action-button";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Timeline, type TimelineItem } from "@/components/shared/timeline";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { auditActionLabel, auditActionTone } from "@/lib/audit-log-format";
import { calculateOutstanding } from "@/server/calc";
import { can } from "@/server/rbac";
import { approveInvoice, cancelInvoice } from "@/server/actions/invoices";
import { getEntityAuditLog } from "@/server/queries/dashboard";
import { getInvoiceDetail } from "@/server/queries/invoices";
import { getSessionUser } from "@/server/session";

import { ClientPaymentDialog } from "../client-payment-dialog";
import { IssueInvoiceDialog } from "./issue-invoice-dialog";

function formatDate(date: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(date);
}

function formatMoney(value: unknown) {
  return `SAR ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  const invoice = await getInvoiceDetail(user, id);
  if (!invoice) notFound();

  const canUpdate = can(user, "update", "invoice");
  const canPay = can(user, "create", "clientPayment");
  const canViewActivity = can(user, "view", "auditLog");
  const paid = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const outstanding = calculateOutstanding(
    invoice.totalAmount.toString(),
    invoice.payments.map((p) => p.amount.toString()),
  ).toNumber();

  const activity = canViewActivity ? await getEntityAuditLog("Invoice", invoice.id) : [];
  const activityItems: TimelineItem[] = activity.map((entry) => ({
    id: entry.id,
    title: `${auditActionLabel(entry.action)} by ${entry.user?.name ?? "System"}`,
    timestamp: entry.createdAt,
    tone: auditActionTone(entry.action),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Clients" },
          { label: "Invoices", href: "/invoices" },
          { label: `#${invoice.sequenceNo}` },
        ]}
        title={`Invoice #${invoice.sequenceNo} — ${invoice.client.companyName}`}
        description={`${formatDate(invoice.billingPeriodStart)} – ${formatDate(invoice.billingPeriodEnd)}`}
        actions={
          <>
            <StatusBadge status={invoice.status} />
            {canUpdate && invoice.status === "DRAFT" && (
              <>
                <ConfirmActionButton
                  trigger={
                    <Button variant="outline">
                      <CheckCircle2 className="size-4" />
                      Approve
                    </Button>
                  }
                  title="Approve this invoice?"
                  description="Approved invoices can then be issued to the client."
                  confirmLabel="Approve"
                  action={approveInvoice.bind(null, invoice.id)}
                  successMessage="Invoice approved."
                />
                <ConfirmActionButton
                  trigger={
                    <Button variant="outline">
                      <Ban className="size-4" />
                      Cancel
                    </Button>
                  }
                  title="Cancel this invoice?"
                  description="This invoice will no longer be billable."
                  confirmLabel="Cancel Invoice"
                  variant="destructive"
                  action={cancelInvoice.bind(null, invoice.id)}
                  successMessage="Invoice cancelled."
                />
              </>
            )}
            {canUpdate && invoice.status === "APPROVED" && (
              <>
                <IssueInvoiceDialog invoiceId={invoice.id} trigger={<Button><Send className="size-4" />Issue</Button>} />
                <ConfirmActionButton
                  trigger={
                    <Button variant="outline">
                      <Ban className="size-4" />
                      Cancel
                    </Button>
                  }
                  title="Cancel this invoice?"
                  description="This invoice will no longer be billable."
                  confirmLabel="Cancel Invoice"
                  variant="destructive"
                  action={cancelInvoice.bind(null, invoice.id)}
                  successMessage="Invoice cancelled."
                />
              </>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border p-4">
          <p className="text-muted-foreground text-xs font-medium">Total</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{formatMoney(invoice.totalAmount)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-muted-foreground text-xs font-medium">Paid</p>
          <p className="mt-1 text-lg font-medium tabular-nums">{formatMoney(paid)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-muted-foreground text-xs font-medium">Outstanding</p>
          <p className={`mt-1 text-lg font-medium tabular-nums ${outstanding > 0 ? "text-warning-foreground" : ""}`}>
            {formatMoney(outstanding)}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-muted-foreground text-xs font-medium">Due Date</p>
          <p className="mt-1 text-lg font-medium">{formatDate(invoice.dueDate)}</p>
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <p className="mb-3 text-sm font-medium">Line Items</p>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.description}</TableCell>
                  <TableCell>{item.hours ? Number(item.hours).toFixed(2) : "—"}</TableCell>
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
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">{formatMoney(invoice.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tax</span>
            <span className="tabular-nums">{formatMoney(invoice.taxAmount)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatMoney(invoice.totalAmount)}</span>
          </div>
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium">Payments</p>
          {canPay && (invoice.status === "ISSUED" || invoice.status === "PARTIALLY_PAID") && (
            <ClientPaymentDialog clientId={invoice.clientId} invoiceId={invoice.id} />
          )}
        </div>
        {invoice.payments.length === 0 ? (
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
                {invoice.payments.map((p) => (
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
          <Timeline items={activityItems} emptyMessage="No recorded changes for this invoice yet" />
        </div>
      )}
    </div>
  );
}
