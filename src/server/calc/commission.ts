import type { CommissionType } from "@prisma/client";
import { Decimal } from "decimal.js";

import type { Numeric } from "./hours";

function d(value: Numeric = 0): Decimal {
  return value instanceof Decimal ? value : new Decimal(value);
}

export type CommissionRuleConfig = {
  type: CommissionType;
  rateOrAmount: Numeric; // a percentage (0-100) for PERCENT_* types, else a currency amount
};

export type CommissionBase = {
  salesAmount?: Numeric;
  invoiceAmount?: Numeric;
  profitAmount?: Numeric;
  workerCount?: Numeric;
  hours?: Numeric;
};

/**
 * Commission = Revenue × Commission % (§14/§20), or one of the other
 * configurable bases (per invoice, per profit, per worker, per hour, or a
 * flat amount) — never a single hardcoded percentage.
 */
export function calculateCommission(rule: CommissionRuleConfig, base: CommissionBase): Decimal {
  const rate = d(rule.rateOrAmount);

  switch (rule.type) {
    case "PERCENT_OF_SALES":
      return d(base.salesAmount).times(rate).div(100);
    case "PERCENT_OF_INVOICE":
      return d(base.invoiceAmount).times(rate).div(100);
    case "PERCENT_OF_PROFIT":
      return d(base.profitAmount).times(rate).div(100);
    case "PER_WORKER":
      return d(base.workerCount).times(rate);
    case "PER_HOUR":
      return d(base.hours).times(rate);
    case "FIXED_AMOUNT":
      return rate;
    default: {
      const exhaustive: never = rule.type;
      throw new Error(`Unhandled commission type: ${String(exhaustive)}`);
    }
  }
}
