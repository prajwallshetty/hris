import { Decimal } from "decimal.js";

import type { Numeric } from "./hours";

function d(value: Numeric = 0): Decimal {
  return value instanceof Decimal ? value : new Decimal(value);
}

export type BillingFrequency = "WEEKLY" | "MONTHLY" | "QUARTERLY" | "ANNUALLY" | "ONE_TIME";

/**
 * Number of full billing periods elapsed between a charge's start date and
 * a reference date (default now) — the basis for "how much is due so far"
 * on a recurring deduction (§ rent/housing tracking). ONE_TIME always owes
 * exactly 1 period. Never negative; a future start date owes 0.
 */
export function calculatePeriodsElapsed(startDate: Date, frequency: BillingFrequency, asOf: Date = new Date()): number {
  if (asOf < startDate) return 0;
  if (frequency === "ONE_TIME") return 1;

  const months =
    (asOf.getFullYear() - startDate.getFullYear()) * 12 +
    (asOf.getMonth() - startDate.getMonth()) +
    (asOf.getDate() >= startDate.getDate() ? 0 : -1);
  const wholeMonths = Math.max(0, months);

  switch (frequency) {
    case "WEEKLY": {
      const days = Math.floor((asOf.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      return Math.max(0, Math.floor(days / 7) + 1);
    }
    case "MONTHLY":
      return wholeMonths + 1;
    case "QUARTERLY":
      return Math.floor(wholeMonths / 3) + 1;
    case "ANNUALLY":
      return Math.floor(wholeMonths / 12) + 1;
  }
}

/**
 * Total amount due-to-date on a recurring charge = periods elapsed × rate,
 * plus any unpaid deposit. Outstanding = due − sum(deductions), the same
 * outstanding-is-always-derived discipline as every other ledger in the app.
 */
export function calculateRecurringChargeDue(params: {
  startDate: Date;
  frequency: BillingFrequency;
  amount: Numeric;
  depositAmount?: Numeric;
  depositPaid?: boolean;
  asOf?: Date;
}): Decimal {
  const periods = calculatePeriodsElapsed(params.startDate, params.frequency, params.asOf ?? new Date());
  const recurring = d(params.amount).times(periods);
  const deposit = !params.depositPaid && params.depositAmount ? d(params.depositAmount) : new Decimal(0);
  return recurring.plus(deposit);
}
