import { Decimal } from "decimal.js";

export type Numeric = Decimal | number | string;

export type OvertimeRuleConfig = {
  dailyRegularHoursThreshold: Numeric;
  overtimeMultiplier: Numeric;
  maxDailyHours?: Numeric | null;
  minPayableHours?: Numeric | null;
};

// Used whenever no OvertimeRule row is configured (§17: rules live in data,
// not hardcoded — this is only the bootstrap default, not a hidden formula).
export const DEFAULT_OVERTIME_RULE: OvertimeRuleConfig = {
  dailyRegularHoursThreshold: 8,
  overtimeMultiplier: 1.5,
  maxDailyHours: null,
  minPayableHours: null,
};

function d(value: Numeric): Decimal {
  return value instanceof Decimal ? value : new Decimal(value);
}

/**
 * Total Hours = Logout - Login - Break (§8), expressed in decimal hours.
 * Never negative — a logout before login or a break exceeding the shift
 * yields zero rather than a nonsensical negative duration.
 */
export function calculateRegularHours(
  loginTime: Date,
  logoutTime: Date,
  breakMinutes: Numeric = 0,
): Decimal {
  const shiftMinutes = (logoutTime.getTime() - loginTime.getTime()) / 60_000;
  const netMinutes = new Decimal(shiftMinutes).minus(d(breakMinutes));
  if (netMinutes.lte(0)) return new Decimal(0);
  return netMinutes.div(60);
}

/**
 * Splits a day's total hours into regular vs overtime per the active
 * OvertimeRule, applying the configured min-payable floor and max-daily cap.
 */
export function calculateOvertime(
  totalHours: Numeric,
  rule: OvertimeRuleConfig = DEFAULT_OVERTIME_RULE,
): { regularHours: Decimal; overtimeHours: Decimal } {
  let total = d(totalHours);
  if (rule.maxDailyHours != null) {
    const cap = d(rule.maxDailyHours);
    if (total.gt(cap)) total = cap;
  }
  if (rule.minPayableHours != null) {
    const floor = d(rule.minPayableHours);
    if (total.lt(floor)) total = floor;
  }

  const threshold = d(rule.dailyRegularHoursThreshold);
  if (total.lte(threshold)) {
    return { regularHours: total, overtimeHours: new Decimal(0) };
  }
  return { regularHours: threshold, overtimeHours: total.minus(threshold) };
}
