"use client";

import { Download } from "lucide-react";

import { PrintActions } from "@/components/shared/print-actions";
import { SendDocumentDialog } from "@/components/shared/send-document-dialog";
import { Button } from "@/components/ui/button";
import type { ClientStatementEntry } from "@/server/queries/client-statement";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(date);
}

function toCsv(rows: ClientStatementEntry[]): string {
  const header = ["Date", "Type", "Description", "Reference", "Debit", "Credit", "Balance"];
  const lines = rows.map((r) =>
    [
      formatDate(r.date),
      r.type,
      r.description,
      r.reference ?? "",
      r.debit ? r.debit.toFixed(2) : "",
      r.credit ? r.credit.toFixed(2) : "",
      r.balance.toFixed(2),
    ]
      .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

export function StatementActions({
  entries,
  clientId,
  clientName,
  mobileNumber,
  closingBalance,
}: {
  entries: ClientStatementEntry[];
  clientId: string;
  clientName: string;
  mobileNumber?: string | null;
  closingBalance: number;
}) {
  function handleExport() {
    const csv = toCsv(entries);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `client-${clientId}-statement.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex items-center gap-2 print:hidden">
      <Button variant="outline" onClick={handleExport}>
        <Download className="size-4" />
        Export CSV
      </Button>
      <SendDocumentDialog
        documentLabel="Statement of Account"
        documentUrl={`/clients/${clientId}/statement`}
        recipientName={clientName}
        mobileNumber={mobileNumber ?? undefined}
        emailSubject={`Statement of Account — ${clientName}`}
        message={`Hello ${clientName}, please find your statement of account. Current Outstanding: SAR ${closingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}.`}
      />
      <PrintActions />
    </div>
  );
}
