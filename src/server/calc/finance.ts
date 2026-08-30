import { Decimal } from "decimal.js";

import type { Numeric } from "./hours";

function d(value: Numeric = 0): Decimal {
  return value instanceof Decimal ? value : new Decimal(value);
}

/**
 * Outstanding = Payable − Payments (§11/§17/§20), derived from the actual
 * payment ledger — never a single stored "paid amount" field. A negative
 * result means the payee was overpaid.
 */
export function calculateOutstanding(payable: Numeric, payments: Numeric[]): Decimal {
  const totalPaid = payments.reduce((sum: Decimal, payment) => sum.plus(d(payment)), new Decimal(0));
  return d(payable).minus(totalPaid);
}

/** Remaining balance on an advance or loan after its repayments so far. */
export function calculateRepayableBalance(principal: Numeric, repayments: Numeric[]): Decimal {
  const totalRepaid = repayments.reduce((sum: Decimal, repayment) => sum.plus(d(repayment)), new Decimal(0));
  return d(principal).minus(totalRepaid);
}
