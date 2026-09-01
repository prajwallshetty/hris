import { Decimal } from "decimal.js";

import { calculateClientBilling, calculateInvoiceTotals } from "@/server/calc";

export type BillableHoursRow = {
  workerId: string;
  siteId: string | null;
  description: string;
  clientBillingRate: string;
  hours: string;
};

export type InvoiceDraftItem = {
  workerId: string;
  siteId: string | null;
  description: string;
  hours: string;
  rate: string;
  amount: string;
};

export type InvoiceDraft = {
  items: InvoiceDraftItem[];
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
};

/**
 * Builds one invoice line per worker/site group from approved hours,
 * billed at each assignment's clientBillingRate — independent of worker
 * payroll, which uses workerHourlyRate on the same Assignment (§20/§21).
 * Rows for the same worker+site are summed first so re-billing the same
 * group across several timesheet uploads still produces one clean line.
 */
export function buildInvoiceDraft(rows: BillableHoursRow[], taxPercent: string): InvoiceDraft {
  const groups = new Map<string, { description: string; siteId: string | null; workerId: string; rate: string; hours: Decimal }>();

  for (const row of rows) {
    const key = `${row.workerId}:${row.siteId ?? "none"}`;
    const existing = groups.get(key);
    if (existing) {
      existing.hours = existing.hours.plus(row.hours);
    } else {
      groups.set(key, {
        description: row.description,
        siteId: row.siteId,
        workerId: row.workerId,
        rate: row.clientBillingRate,
        hours: new Decimal(row.hours),
      });
    }
  }

  const items: InvoiceDraftItem[] = Array.from(groups.values()).map((g) => ({
    workerId: g.workerId,
    siteId: g.siteId,
    description: g.description,
    hours: g.hours.toFixed(2),
    rate: g.rate,
    amount: calculateClientBilling(g.hours, g.rate).toFixed(2),
  }));

  const subtotal = items.reduce((sum, i) => sum.plus(i.amount), new Decimal(0));
  const totals = calculateInvoiceTotals(subtotal, taxPercent);

  return {
    items,
    subtotal: totals.subtotal.toFixed(2),
    taxAmount: totals.taxAmount.toFixed(2),
    totalAmount: totals.totalAmount.toFixed(2),
  };
}
