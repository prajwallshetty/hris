import { FileText } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { SelectFilter } from "@/components/shared/select-filter";
import { StatusBadge } from "@/components/shared/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { can } from "@/server/rbac";
import { listClientHierarchyForSelect } from "@/server/queries/clients";
import { listInvoices } from "@/server/queries/invoices";
import { getSessionUser } from "@/server/session";

import { GenerateInvoiceDialog } from "./generate-invoice-dialog";

function formatDate(date: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(date);
}

function formatMoney(value: unknown) {
  return `SAR ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const user = await getSessionUser();
  const page = Number(params.page ?? 1) || 1;
  const canCreate = can(user, "create", "invoice");

  const [{ invoices, total, pageSize }, clients] = await Promise.all([
    listInvoices(user, { status: (params.status as never) ?? "ALL", page }),
    canCreate ? listClientHierarchyForSelect() : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Clients" }, { label: "Invoices" }]}
        title="Invoices"
        description="Client billing generated from approved, locked timesheet hours — independent of worker payroll."
        actions={canCreate && <GenerateInvoiceDialog clients={clients} />}
      />

      <SelectFilter
        paramKey="status"
        placeholder="Status"
        options={[
          { label: "Draft", value: "DRAFT" },
          { label: "Approved", value: "APPROVED" },
          { label: "Issued", value: "ISSUED" },
          { label: "Partially Paid", value: "PARTIALLY_PAID" },
          { label: "Paid", value: "PAID" },
          { label: "Overdue", value: "OVERDUE" },
          { label: "Cancelled", value: "CANCELLED" },
        ]}
      />

      {invoices.length === 0 ? (
        <EmptyState icon={FileText} title="No invoices yet" description={canCreate ? "Generate one from approved hours." : undefined} />
      ) : (
        <div className="rounded-lg border">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Billing Period</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => {
                  const paid = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0);
                  const isOverdue =
                    invoice.dueDate &&
                    invoice.dueDate < new Date() &&
                    (invoice.status === "ISSUED" || invoice.status === "PARTIALLY_PAID");
                  return (
                    <TableRow key={invoice.id}>
                      <TableCell className="text-muted-foreground font-mono text-xs">
                        <Link href={`/invoices/${invoice.id}`} className="hover:underline">
                          #{invoice.sequenceNo}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/invoices/${invoice.id}`} className="font-medium hover:underline">
                          {invoice.client.companyName}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {formatDate(invoice.billingPeriodStart)} – {formatDate(invoice.billingPeriodEnd)}
                      </TableCell>
                      <TableCell className="font-medium">{formatMoney(invoice.totalAmount)}</TableCell>
                      <TableCell>{formatMoney(paid)}</TableCell>
                      <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                      <TableCell>
                        <StatusBadge status={isOverdue ? "OVERDUE" : invoice.status} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <Pagination page={page} pageSize={pageSize} total={total} />
        </div>
      )}
    </div>
  );
}
