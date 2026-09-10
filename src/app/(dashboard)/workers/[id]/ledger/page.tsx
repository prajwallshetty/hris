import { notFound } from "next/navigation";
import Link from "next/link";

import { Logo } from "@/components/shared/logo";
import { PrintActions } from "@/components/shared/print-actions";
import { formatWorkerCode } from "@/lib/codes";
import { getWorker } from "@/server/queries/workers";
import { getWorkerLedger } from "@/server/queries/worker-ledger";
import { getSessionUser } from "@/server/session";

const TYPE_LABEL: Record<string, string> = {
  SALARY_PAYABLE: "Salary Payable",
  SALARY_PAYMENT: "Salary Payment",
  ADVANCE_ISSUED: "Advance Issued",
  ADVANCE_RECOVERY: "Advance Recovery",
  LOAN_ISSUED: "Loan Issued",
  LOAN_RECOVERY: "Loan Deduction",
  BONUS: "Bonus",
  DEDUCTION: "Deduction",
  CORRECTION: "Correction",
  RECURRING_CHARGE: "Rent / Other Charge",
  FINAL_SETTLEMENT: "Final Settlement",
  VOIDED_PAYMENT: "Voided Payment",
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(date);
}

function formatMoney(value: number) {
  return `SAR ${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export default async function WorkerLedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  const worker = await getWorker(user, id);
  if (!worker) notFound();

  const entries = await getWorkerLedger(user, id);
  const closingBalance = entries.length ? entries[entries.length - 1].balance : 0;
  const totalDebit = entries.reduce((sum, e) => sum + e.debit, 0);
  const totalCredit = entries.reduce((sum, e) => sum + e.credit, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <Link href={`/workers/${worker.id}`} className="text-muted-foreground text-sm hover:underline">
          ← Back to {worker.fullName}
        </Link>
        <PrintActions />
      </div>

      <div className="rounded-xl border bg-white p-8 shadow-sm print:border-none print:shadow-none">
        <div className="flex items-start justify-between border-b pb-6">
          <div>
            <Logo size="document" className="mb-2" />
            <p className="text-muted-foreground text-sm">Worker Financial Ledger</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-medium">{worker.fullName}</p>
            <p className="text-muted-foreground">Worker ID: {formatWorkerCode(worker.sequenceNo)}</p>
            <p className="text-muted-foreground">Iqama: {worker.iqamaNumber}</p>
            <p className="text-muted-foreground">Generated: {formatDate(new Date())}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 py-6 text-sm">
          <div>
            <p className="text-muted-foreground text-xs font-medium uppercase">Total Debit</p>
            <p className="text-lg font-semibold tabular-nums">{formatMoney(totalDebit)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs font-medium uppercase">Total Credit</p>
            <p className="text-lg font-semibold tabular-nums">{formatMoney(totalCredit)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs font-medium uppercase">Closing Balance</p>
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
                <th className="pb-2 pr-2">Type</th>
                <th className="pb-2 pr-2">Description</th>
                <th className="pb-2 pr-2">Reference</th>
                <th className="pb-2 pr-2 text-right">Debit</th>
                <th className="pb-2 pr-2 text-right">Credit</th>
                <th className="pb-2 text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b last:border-0">
                  <td className="py-2 pr-2 whitespace-nowrap">{formatDate(e.date)}</td>
                  <td className="py-2 pr-2 whitespace-nowrap">{TYPE_LABEL[e.type]}</td>
                  <td className="py-2 pr-2">{e.description}</td>
                  <td className="py-2 pr-2">{e.reference ?? "—"}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{e.debit ? formatMoney(e.debit) : "—"}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{e.credit ? formatMoney(e.credit) : "—"}</td>
                  <td className="py-2 text-right font-medium tabular-nums">{formatMoney(e.balance)}</td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-muted-foreground py-6 text-center">
                    No ledger transactions recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="text-muted-foreground mt-8 border-t pt-4 text-center text-xs">
          This ledger was generated automatically from the transaction records on file. Running balances are computed
          from these transactions and are never manually edited.
        </p>
      </div>
    </div>
  );
}
