import { Decimal } from "decimal.js";

import type { Numeric } from "./hours";

function d(value: Numeric = 0): Decimal {
  return value instanceof Decimal ? value : new Decimal(value);
}

/**
 * Client Billing = Approved Hours × Client Rate (§13/§20). The client rate
 * is never assumed to equal the worker rate — each Assignment stores both
 * independently.
 */
export function calculateClientBilling(hours: Numeric, billingRate: Numeric): Decimal {
  return d(hours).times(d(billingRate));
}

export type InvoiceTotals = {
  subtotal: Decimal;
  taxAmount: Decimal;
  totalAmount: Decimal;
};

/** Applies a configurable tax percentage (BillingRule) to an invoice subtotal. */
export function calculateInvoiceTotals(subtotal: Numeric, taxPercent: Numeric = 0): InvoiceTotals {
  const subtotalDecimal = d(subtotal);
  const taxAmount = subtotalDecimal.times(d(taxPercent)).div(100);
  return { subtotal: subtotalDecimal, taxAmount, totalAmount: subtotalDecimal.plus(taxAmount) };
}

/**
 * Margin before other costs = Client Revenue - Worker Cost (§13), for a
 * single assignment/period. Company-wide profitability lives in profitability.ts.
 */
export function calculateAssignmentMargin(clientRevenue: Numeric, workerCost: Numeric): Decimal {
  return d(clientRevenue).minus(d(workerCost));
}
