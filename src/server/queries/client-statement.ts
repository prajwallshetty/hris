import { db } from "@/lib/db";
import { assertCan, type SessionUser } from "@/server/rbac";

// A client's complete billing history in one chronological, transaction-
// based statement — the same "never a stored balance, always derived from
// transactions" principle as the worker ledger. Invoices only count once
// formally issued to the client (DRAFT/APPROVED aren't billed yet, and a
// CANCELLED invoice was never actually billed), and there's no
// credit/debit-adjustment model for clients in this schema — this reflects
// exactly the two transaction types that exist (Invoice, ClientPayment)
// rather than fabricating a third.
export type ClientStatementType = "INVOICE" | "PAYMENT";

export type ClientStatementEntry = {
  id: string;
  date: Date;
  type: ClientStatementType;
  description: string;
  debit: number;
  credit: number;
  reference: string | null;
  invoiceId: string | null;
  invoiceNumber: number | null;
  balance: number;
};

const BILLED_INVOICE_STATUSES = new Set(["ISSUED", "PARTIALLY_PAID", "PAID", "OVERDUE"]);

export async function getClientStatement(user: SessionUser, clientId: string): Promise<ClientStatementEntry[]> {
  assertCan(user, "view", "invoice");

  const [invoices, payments] = await Promise.all([
    db.invoice.findMany({
      where: { clientId, status: { in: Array.from(BILLED_INVOICE_STATUSES) } as never },
    }),
    db.clientPayment.findMany({
      where: { clientId },
      include: { invoice: true },
    }),
  ]);

  const entries: Omit<ClientStatementEntry, "balance">[] = [];

  for (const inv of invoices) {
    entries.push({
      id: `invoice-${inv.id}`,
      date: inv.issuedAt ?? inv.createdAt,
      type: "INVOICE",
      description: `Invoice #${inv.sequenceNo} issued`,
      debit: 0,
      credit: Number(inv.totalAmount),
      reference: `INV-${String(inv.sequenceNo).padStart(6, "0")}`,
      invoiceId: inv.id,
      invoiceNumber: inv.sequenceNo,
    });
  }

  for (const p of payments) {
    entries.push({
      id: `payment-${p.id}`,
      date: p.date,
      type: "PAYMENT",
      description: `Payment received${p.invoice ? ` — Invoice #${p.invoice.sequenceNo}` : ""}`,
      debit: Number(p.amount),
      credit: 0,
      reference: p.referenceNumber,
      invoiceId: p.invoiceId,
      invoiceNumber: p.invoice?.sequenceNo ?? null,
    });
  }

  entries.sort((a, b) => a.date.getTime() - b.date.getTime());

  let running = 0;
  return entries.map((e) => {
    running += e.credit - e.debit;
    return { ...e, balance: running };
  });
}
