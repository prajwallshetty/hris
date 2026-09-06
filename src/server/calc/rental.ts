import { Decimal } from "decimal.js";

import type { Numeric } from "./hours";

function d(value: Numeric = 0): Decimal {
  return value instanceof Decimal ? value : new Decimal(value);
}

export type RentalRateType = "HOURLY" | "DAILY" | "WEEKLY" | "MONTHLY" | "CUSTOM";

const MS_PER_HOUR = 1000 * 60 * 60;
const MS_PER_DAY = MS_PER_HOUR * 24;

/**
 * Billable units for a rental period, rounded up so a partial unit always
 * bills as a whole one (§4: "rates all backend-computed, never hardcoded in
 * the frontend") — never fewer than 1, since a rental that starts and ends
 * within the same unit still incurs a full unit's charge. CUSTOM always
 * bills exactly 1 unit: its rateAmount already represents the full flat
 * price for the whole engagement, independent of elapsed time.
 */
export function calculateRentalUnits(rateType: RentalRateType, startDate: Date, endDate: Date): number {
  if (rateType === "CUSTOM") return 1;

  const elapsedMs = Math.max(0, endDate.getTime() - startDate.getTime());
  switch (rateType) {
    case "HOURLY":
      return Math.max(1, Math.ceil(elapsedMs / MS_PER_HOUR));
    case "DAILY":
      return Math.max(1, Math.ceil(elapsedMs / MS_PER_DAY));
    case "WEEKLY":
      return Math.max(1, Math.ceil(elapsedMs / (MS_PER_DAY * 7)));
    case "MONTHLY":
      return Math.max(1, Math.ceil(elapsedMs / (MS_PER_DAY * 30)));
  }
}

/** Base rental charge = rateAmount × quantity × billable units. */
export function calculateRentalSubtotal(params: {
  rateType: RentalRateType;
  rateAmount: Numeric;
  quantity: Numeric;
  startDate: Date;
  endDate: Date;
}): Decimal {
  const units = calculateRentalUnits(params.rateType, params.startDate, params.endDate);
  return d(params.rateAmount).times(d(params.quantity)).times(units);
}

/**
 * Total invoiceable amount for a rental = sum of every RentalCharge row
 * (the base rental charge plus any damage/missing-item/late-fee charges
 * added at return) — never a single stored total (§4).
 */
export function calculateRentalTotal(charges: Numeric[]): Decimal {
  return charges.reduce((sum: Decimal, charge) => sum.plus(d(charge)), new Decimal(0));
}
