import { notFound } from "next/navigation";
import Link from "next/link";

import { Logo } from "@/components/shared/logo";
import { getClient } from "@/server/queries/clients";
import { getClientStatement } from "@/server/queries/client-statement";
import { getSessionUser } from "@/server/session";

import { StatementActions } from "./statement-actions";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(date);
}

function formatMoney(value: number) {
  return `SAR ${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export default async function ClientStatementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  const client = await getClient(user, id);
  if (!client) notFound();

  const entries = await getClientStatement(user, id);
  const closingBalance = entries.length ? entries[entries.length - 1].balance : 0;
  const totalInvoiced = entries.reduce((sum, e) => sum + e.credit, 0);
  const totalPaid = entries.reduce((sum, e) => sum + e.debit, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <Link href={`/clients/${client.id}`} className="text-muted-foreground text-sm hover:underline">
          ← Back to {client.companyName}
        </Link>
        <StatementActions
          entries={entries}
          clientId={client.id}
          clientName={client.companyName}
          mobileNumber={client.phone}
          closingBalance={closingBalance}
        />
      </div>

      <div className="rounded-xl border bg-white p-8 shadow-sm print:border-none print:shadow-none">
        <div className="flex items-start justify-between border-b pb-6">
          <div>
            <Logo size="document" className="mb-2" />
            <p className="text-muted-foreground text-sm">Statement of Account</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-medium">{client.companyName}</p>
            {client.contactPerson && <p className="text-muted-foreground">{client.contactPerson}</p>}
            {client.address && <p className="text-muted-foreground">{client.address}</p>}
            <p className="text-muted-foreground">Generated: {formatDate(new Date())}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 py-6 text-sm">
          <div>
            <p className="text-muted-foreground text-xs font-medium uppercase">Total Invoiced</p>
            <p className="text-lg font-semibold tabular-nums">{formatMoney(totalInvoiced)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs font-medium uppercase">Total Paid</p>
            <p className="text-lg font-semibold tabular-nums">{formatMoney(totalPaid)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs font-medium uppercase">Outstanding</p>
            <p className={`text-lg font-semibold tabular-nums ${closingBalance > 0 ? "text-warning-foreground" : ""}`}>
              {formatMoney(closingBalance)}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto border-t pt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-left text-xs font-medium uppercase">
                <th className="pb-2 pr-2">Date</th>
                <th className="pb-2 pr-2">Description</th>
                <th className="pb-2 pr-2">Reference</th>
                <th className="pb-2 pr-2 text-right">Debit</th>
                <th className="pb-2 pr-2 text-right">Credit</th>
                <th className="pb-2 text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="py-2 pr-2" colSpan={5}>
                  Opening Balance
                </td>
                <td className="py-2 text-right font-medium tabular-nums">{formatMoney(0)}</td>
              </tr>
              {entries.map((e) => (
                <tr key={e.id} className="border-b last:border-0">
                  <td className="py-2 pr-2 whitespace-nowrap">{formatDate(e.date)}</td>
                  <td className="py-2 pr-2">{e.description}</td>
                  <td className="py-2 pr-2">{e.reference ?? "—"}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{e.debit ? formatMoney(e.debit) : "—"}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{e.credit ? formatMoney(e.credit) : "—"}</td>
                  <td className="py-2 text-right font-medium tabular-nums">{formatMoney(e.balance)}</td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-muted-foreground py-6 text-center">
                    No billing transactions recorded yet.
                  </td>
                </tr>
              )}
              <tr className="border-t-2">
                <td className="py-2 pr-2 font-semibold" colSpan={5}>
                  Closing Balance
                </td>
                <td className={`py-2 text-right font-semibold tabular-nums ${closingBalance > 0 ? "text-warning-foreground" : ""}`}>
                  {formatMoney(closingBalance)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="text-muted-foreground mt-8 border-t pt-4 text-center text-xs">
          This statement was generated automatically from the invoice and payment records on file. Running balances
          are computed from these transactions and are never manually edited.
        </p>
      </div>
    </div>
  );
}
