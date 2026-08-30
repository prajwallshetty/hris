import { Decimal } from "decimal.js";

import type { Numeric } from "./hours";

function d(value: Numeric = 0): Decimal {
  return value instanceof Decimal ? value : new Decimal(value);
}

/** Profit = Revenue − Worker Cost − Expenses − Commission (§20). */
export function calculateProfitability(params: {
  revenue: Numeric;
  workerCost: Numeric;
  expenses?: Numeric;
  commission?: Numeric;
}): Decimal {
  return d(params.revenue).minus(d(params.workerCost)).minus(d(params.expenses)).minus(d(params.commission));
}
