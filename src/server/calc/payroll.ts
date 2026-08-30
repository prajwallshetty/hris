import { Decimal } from "decimal.js";

import type { Numeric } from "./hours";

function d(value: Numeric = 0): Decimal {
  return value instanceof Decimal ? value : new Decimal(value);
}

export type WorkerPayrollInput = {
  regularHours: Numeric;
  overtimeHours: Numeric;
  // Rate snapshots at calculation time — the caller is responsible for
  // reading these from the Assignment/Worker active *at the time the hours
  // were worked*, never the worker's current rate (§8: a later rate change
  // must never recalculate historical payroll).
  regularRate: Numeric;
  overtimeRate: Numeric;
  allowances?: Numeric;
  bonuses?: Numeric;
  advanceDeduction?: Numeric;
  loanDeduction?: Numeric;
  leaveDeduction?: Numeric;
  otherDeductions?: Numeric;
};

export type WorkerPayrollResult = {
  regularPay: Decimal;
  overtimePay: Decimal;
  grossPay: Decimal;
  totalDeductions: Decimal;
  netPayable: Decimal;
};

/**
 * Worker Salary = Approved Hours × Worker Rate, plus OT, allowances and
 * bonuses, minus advances/loans/leave/other deductions (§9/§20).
 */
export function calculateWorkerPayroll(input: WorkerPayrollInput): WorkerPayrollResult {
  const regularPay = d(input.regularHours).times(d(input.regularRate));
  const overtimePay = d(input.overtimeHours).times(d(input.overtimeRate));
  const grossPay = regularPay.plus(overtimePay).plus(d(input.allowances)).plus(d(input.bonuses));

  const totalDeductions = d(input.advanceDeduction)
    .plus(d(input.loanDeduction))
    .plus(d(input.leaveDeduction))
    .plus(d(input.otherDeductions));

  const netPayable = grossPay.minus(totalDeductions);

  return { regularPay, overtimePay, grossPay, totalDeductions, netPayable };
}

export type EmployeePayrollInput = {
  baseSalary: Numeric;
  allowances?: Numeric;
  bonuses?: Numeric;
  advanceDeduction?: Numeric;
  loanDeduction?: Numeric;
  leaveDeduction?: Numeric;
  otherDeductions?: Numeric;
};

/** Fixed/monthly internal-employee payroll — never mixed with worker payroll (§15). */
export function calculateEmployeePayroll(input: EmployeePayrollInput): WorkerPayrollResult {
  const grossPay = d(input.baseSalary).plus(d(input.allowances)).plus(d(input.bonuses));
  const totalDeductions = d(input.advanceDeduction)
    .plus(d(input.loanDeduction))
    .plus(d(input.leaveDeduction))
    .plus(d(input.otherDeductions));
  const netPayable = grossPay.minus(totalDeductions);

  return { regularPay: d(input.baseSalary), overtimePay: new Decimal(0), grossPay, totalDeductions, netPayable };
}

/**
 * Deduction for unpaid leave days taken within the payroll period.
 * `dailyRate` is the caller's responsibility (e.g. monthly salary / 30, or
 * hourly rate × standard daily hours) — kept out of this function so it
 * stays reusable for both hourly workers and monthly employees.
 */
export function calculateLeaveDeduction(unpaidLeaveDays: Numeric, dailyRate: Numeric): Decimal {
  return d(unpaidLeaveDays).times(d(dailyRate));
}

export type FinalSettlementInput = {
  pendingRegularPay: Numeric;
  pendingOvertimePay?: Numeric;
  leaveEncashment?: Numeric;
  otherDues?: Numeric; // additional amounts owed TO the worker
  advanceBalance?: Numeric; // amounts owed BY the worker
  loanBalance?: Numeric;
  otherDeductions?: Numeric;
};

export type FinalSettlementResult = {
  totalDue: Decimal;
  totalDeductions: Decimal;
  netSettlement: Decimal;
};

/** Final settlement when a worker leaves (§19): pending pay + leave encashment - advances/loans. */
export function calculateFinalSettlement(input: FinalSettlementInput): FinalSettlementResult {
  const totalDue = d(input.pendingRegularPay)
    .plus(d(input.pendingOvertimePay))
    .plus(d(input.leaveEncashment))
    .plus(d(input.otherDues));

  const totalDeductions = d(input.advanceBalance).plus(d(input.loanBalance)).plus(d(input.otherDeductions));

  return { totalDue, totalDeductions, netSettlement: totalDue.minus(totalDeductions) };
}
