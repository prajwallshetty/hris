import { notFound } from "next/navigation";
import Link from "next/link";

import { Logo } from "@/components/shared/logo";
import { PrintActions } from "@/components/shared/print-actions";
import { formatInvoiceNumber } from "@/lib/codes";
import { calculateOutstanding } from "@/server/calc";
import { getInvoiceDetail } from "@/server/queries/invoices";
import { getSessionUser } from "@/server/session";

function formatDate(date: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(date);
}

function formatMoney(value: unknown) {
  return `SAR ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export default async function InvoiceDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  const invoice = await getInvoiceDetail(user, id);
  if (!invoice) notFound();

  const paid = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const outstanding = calculateOutstanding(
    invoice.totalAmount.toString(),
    invoice.payments.map((p) => p.amount.toString()),
  ).toNumber();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <Link href={`/invoices/${invoice.id}`} className="text-muted-foreground text-sm hover:underline">
          ← Back to Invoice #{invoice.sequenceNo}
        </Link>
        <PrintActions />
      </div>

      <div className="rounded-xl border bg-white p-8 shadow-sm print:border-none print:shadow-none">
        <div className="flex items-start justify-between border-b pb-6">
          <div>
            <Logo size="document" className="mb-2" />
            <p className="text-muted-foreground text-sm">Tax Invoice</p>
          </div>
          <div className="text-right">
            <p className="text-muted-foreground text-xs font-medium uppercase">Invoice No.</p>
            <p className="font-mono text-lg font-semibold">{formatInvoiceNumber(invoice.sequenceNo)}</p>
            <p className="text-muted-foreground text-xs">Issued: {formatDate(invoice.issuedAt)}</p>
            <p className="text-muted-foreground text-xs">Due: {formatDate(invoice.dueDate)}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 py-6 text-sm">
          <div>
            <p className="text-muted-foreground text-xs font-medium uppercase">Bill To</p>
            <p className="font-medium">{invoice.client.companyName}</p>
            {invoice.client.contactPerson && <p className="text-muted-foreground">{invoice.client.contactPerson}</p>}
            {invoice.client.address && <p className="text-muted-foreground">{invoice.client.address}</p>}
            {invoice.client.phone && <p className="text-muted-foreground">{invoice.client.phone}</p>}
            {invoice.client.email && <p className="text-muted-foreground">{invoice.client.email}</p>}
          </div>
          <div>
            <p className="text-muted-foreground text-xs font-medium uppercase">Billing Details</p>
            {invoice.project && <p className="text-muted-foreground">Project: {invoice.project.name}</p>}
            <p className="text-muted-foreground">
              Period: {formatDate(invoice.billingPeriodStart)} – {formatDate(invoice.billingPeriodEnd)}
            </p>
            {invoice.client.paymentTerms && <p className="text-muted-foreground">Terms: {invoice.client.paymentTerms}</p>}
            {invoice.client.contractRef && <p className="text-muted-foreground">Contract Ref: {invoice.client.contractRef}</p>}
          </div>
        </div>

        <div className="border-t pt-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-left text-xs font-medium uppercase">
                <th className="pb-2">Description</th>
                <th className="pb-2">Hours</th>
                <th className="pb-2">Rate</th>
                <th className="pb-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="py-2">{item.description}</td>
                  <td className="py-2">{item.hours ? Number(item.hours).toFixed(2) : "—"}</td>
                  <td className="py-2">{item.rate ? formatMoney(item.rate) : "—"}</td>
                  <td className="py-2 text-right tabular-nums">{formatMoney(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="ml-auto mt-4 max-w-xs space-y-1 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums">{formatMoney(invoice.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Tax</span>
              <span className="tabular-nums">{formatMoney(invoice.taxAmount)}</span>
            </div>
            <div className="flex items-center justify-between border-t pt-1 font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatMoney(invoice.totalAmount)}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-2 border-t pt-6">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Amount Paid to Date</span>
            <span className="font-medium tabular-nums">{formatMoney(paid)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Balance Due</span>
            <span className={`text-xl font-semibold tabular-nums ${outstanding > 0 ? "text-warning-foreground" : "text-success"}`}>
              {formatMoney(outstanding)}
            </span>
          </div>
        </div>

        {invoice.payments.length > 0 && (
          <div className="mt-6 border-t pt-4 text-sm">
            <p className="text-muted-foreground mb-2 text-xs font-medium uppercase">Payment History</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-left text-xs font-medium uppercase">
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Method</th>
                  <th className="pb-2">Reference</th>
                  <th className="pb-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.payments.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-2">{formatDate(p.date)}</td>
                    <td className="py-2">{p.method.replaceAll("_", " ")}</td>
                    <td className="py-2">{p.referenceNumber ?? "—"}</td>
                    <td className="py-2 text-right tabular-nums">{formatMoney(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-10 grid grid-cols-2 gap-6 text-sm">
          <div>
            <div className="border-foreground/40 h-12 border-b" />
            <p className="text-muted-foreground mt-1 text-xs">Client Signature</p>
          </div>
          <div>
            <div className="border-foreground/40 h-12 border-b" />
            <p className="text-muted-foreground mt-1 text-xs">Authorized Signature</p>
          </div>
        </div>

        <p className="text-muted-foreground mt-8 border-t pt-4 text-center text-xs">
          This invoice was generated automatically and reflects the billing record on file.
        </p>
      </div>
    </div>
  );
}
