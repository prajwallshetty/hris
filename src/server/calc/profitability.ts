import { Decimal } from "decimal.js";

import type { Numeric } from "./hours";

function d(value: Numeric = 0): Decimal {
  return value instanceof Decimal ? value : new Decimal(value);
}

/**
 * Profit = Revenue − Worker Cost − Vehicle Expenses − Equipment Rental Cost
 * − Other Expenses − Commission (§20/§4). vehicleExpenses and
 * equipmentRentalCost default to zero so every existing caller (worker/
 * client profitability computed before the fleet modules existed) keeps
 * working unchanged.
 */
export function calculateProfitability(params: {
  revenue: Numeric;
  workerCost: Numeric;
  expenses?: Numeric;
  commission?: Numeric;
  vehicleExpenses?: Numeric;
  equipmentRentalCost?: Numeric;
}): Decimal {
  return d(params.revenue)
    .minus(d(params.workerCost))
    .minus(d(params.vehicleExpenses))
    .minus(d(params.equipmentRentalCost))
    .minus(d(params.expenses))
    .minus(d(params.commission));
}
