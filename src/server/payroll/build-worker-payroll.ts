import { Decimal } from "decimal.js";

export type AssignmentHoursGroup = {
  siteLabel: string;
  workerHourlyRate: string;
  regularHours: string;
  overtimeHours: string;
};

export type WorkerPayrollDraftItem = {
  type: "REGULAR_HOURS" | "OVERTIME";
  description: string;
  quantity: string;
  rate: string;
  amount: string;
};

export type WorkerPayrollDraft = {
  regularHours: string;
  overtimeHours: string;
  regularRate: string;
  overtimeRate: string;
  items: WorkerPayrollDraftItem[];
};

/**
 * Builds the base-pay breakdown for one worker's payroll row from their
 * approved hours, grouped by assignment (§12: rates are snapshotted on the
 * Assignment, never re-read from the worker's current rate). A worker who
 * worked more than one site/rate within the period gets one item per group;
 * the returned regularRate/overtimeRate are the hours-weighted average of
 * those groups so `regularRate x regularHours` reconciles to the header
 * total even when a worker changed sites mid-period. The common case — one
 * assignment for the whole period — has exactly one group and no averaging.
 *
 * Overtime rate is derived as `workerHourlyRate x overtimeMultiplier`
 * rather than read from the worker's own (mutable, current) overtimeRate
 * field, since only the Assignment's regular rate is historically
 * protected today. A true independent OT-rate snapshot would need its own
 * column on Assignment — a reasonable follow-up, out of scope here.
 */
export function buildWorkerPayrollDraft(groups: AssignmentHoursGroup[], overtimeMultiplier: string): WorkerPayrollDraft {
  const items: WorkerPayrollDraftItem[] = [];
  let totalRegularHours = new Decimal(0);
  let totalOvertimeHours = new Decimal(0);
  let totalRegularPay = new Decimal(0);
  let totalOvertimePay = new Decimal(0);

  for (const group of groups) {
    const regularHours = new Decimal(group.regularHours);
    const overtimeHours = new Decimal(group.overtimeHours);
    const regularRate = new Decimal(group.workerHourlyRate);
    const overtimeRate = regularRate.times(overtimeMultiplier);

    if (regularHours.gt(0)) {
      const amount = regularHours.times(regularRate);
      items.push({
        type: "REGULAR_HOURS",
        description: group.siteLabel,
        quantity: regularHours.toFixed(2),
        rate: regularRate.toFixed(2),
        amount: amount.toFixed(2),
      });
      totalRegularHours = totalRegularHours.plus(regularHours);
      totalRegularPay = totalRegularPay.plus(amount);
    }
    if (overtimeHours.gt(0)) {
      const amount = overtimeHours.times(overtimeRate);
      items.push({
        type: "OVERTIME",
        description: group.siteLabel,
        quantity: overtimeHours.toFixed(2),
        rate: overtimeRate.toFixed(2),
        amount: amount.toFixed(2),
      });
      totalOvertimeHours = totalOvertimeHours.plus(overtimeHours);
      totalOvertimePay = totalOvertimePay.plus(amount);
    }
  }

  const regularRate = totalRegularHours.gt(0) ? totalRegularPay.div(totalRegularHours) : new Decimal(0);
  const overtimeRate = totalOvertimeHours.gt(0) ? totalOvertimePay.div(totalOvertimeHours) : new Decimal(0);

  return {
    regularHours: totalRegularHours.toFixed(2),
    overtimeHours: totalOvertimeHours.toFixed(2),
    regularRate: regularRate.toFixed(2),
    overtimeRate: overtimeRate.toFixed(2),
    items,
  };
}
