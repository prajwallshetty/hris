import { describe, expect, it } from "vitest";

import { calculateFinalSettlement, calculateLeaveDeduction, calculateWorkerPayroll } from "../payroll";

describe("calculateWorkerPayroll", () => {
  it("computes gross/net pay from hours, rates, allowances and deductions", () => {
    const result = calculateWorkerPayroll({
      regularHours: 200,
      overtimeHours: 10,
      regularRate: 15,
      overtimeRate: 22.5,
      allowances: 100,
      bonuses: 50,
      advanceDeduction: 300,
      loanDeduction: 0,
      leaveDeduction: 0,
      otherDeductions: 0,
    });

    expect(result.regularPay.toNumber()).toBe(3000);
    expect(result.overtimePay.toNumber()).toBe(225);
    expect(result.grossPay.toNumber()).toBe(3375);
    expect(result.totalDeductions.toNumber()).toBe(300);
    expect(result.netPayable.toNumber()).toBe(3075);
  });

  // Scenario: worker's rate changes from 15 (January) to 17 (March). The
  // function has no notion of a "current" rate — it only ever uses what the
  // caller passes for that period — so historical payroll is architecturally
  // incapable of drifting when the worker's rate later changes (§8).
  it("never re-derives pay from anything but the rate passed in for that period", () => {
    const january = calculateWorkerPayroll({
      regularHours: 160,
      overtimeHours: 0,
      regularRate: 15,
      overtimeRate: 22.5,
    });
    const march = calculateWorkerPayroll({
      regularHours: 160,
      overtimeHours: 0,
      regularRate: 17,
      overtimeRate: 25.5,
    });

    expect(january.regularPay.toNumber()).toBe(2400);
    expect(march.regularPay.toNumber()).toBe(2720);

    // Recomputing January again, after "the rate changed", with the same
    // snapshot input still yields the original January figure.
    const januaryRecomputed = calculateWorkerPayroll({
      regularHours: 160,
      overtimeHours: 0,
      regularRate: 15,
      overtimeRate: 22.5,
    });
    expect(januaryRecomputed.regularPay.toNumber()).toBe(january.regularPay.toNumber());
  });

  it("handles a worker with no allowances/bonuses/deductions", () => {
    const result = calculateWorkerPayroll({ regularHours: 100, overtimeHours: 0, regularRate: 10, overtimeRate: 15 });
    expect(result.grossPay.toNumber()).toBe(1000);
    expect(result.netPayable.toNumber()).toBe(1000);
  });
});

describe("calculateLeaveDeduction", () => {
  it("deducts unpaid leave days at the given daily rate", () => {
    // Worker takes 3 days of unpaid leave; daily rate derived as 8h * 15/h.
    const deduction = calculateLeaveDeduction(3, 120);
    expect(deduction.toNumber()).toBe(360);
  });

  it("returns zero for zero unpaid leave days", () => {
    expect(calculateLeaveDeduction(0, 120).toNumber()).toBe(0);
  });
});

describe("calculateFinalSettlement", () => {
  // Scenario: worker leaves with pending salary + advance balance (§31/§19).
  it("nets pending pay and leave encashment against outstanding advances/loans", () => {
    const settlement = calculateFinalSettlement({
      pendingRegularPay: 1500,
      pendingOvertimePay: 200,
      leaveEncashment: 300,
      advanceBalance: 500,
      loanBalance: 100,
    });

    expect(settlement.totalDue.toNumber()).toBe(2000);
    expect(settlement.totalDeductions.toNumber()).toBe(600);
    expect(settlement.netSettlement.toNumber()).toBe(1400);
  });

  it("can settle negative when outstanding advances exceed what's owed", () => {
    const settlement = calculateFinalSettlement({ pendingRegularPay: 200, advanceBalance: 500 });
    expect(settlement.netSettlement.toNumber()).toBe(-300);
  });
});
