import { describe, expect, it } from "vitest";

import { calculatePeriodsElapsed, calculateRecurringChargeDue } from "../recurring-charge";

describe("calculatePeriodsElapsed", () => {
  it("owes 0 periods before the start date", () => {
    const start = new Date("2026-03-01T00:00:00Z");
    const asOf = new Date("2026-02-01T00:00:00Z");
    expect(calculatePeriodsElapsed(start, "MONTHLY", asOf)).toBe(0);
  });

  it("owes 1 monthly period on the start date itself", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    expect(calculatePeriodsElapsed(start, "MONTHLY", start)).toBe(1);
  });

  it("counts whole months elapsed for MONTHLY", () => {
    const start = new Date("2026-01-15T00:00:00Z");
    const asOf = new Date("2026-04-10T00:00:00Z");
    // Jan 15 -> Feb 15 -> Mar 15 elapsed; Apr 15 not yet reached by Apr 10.
    expect(calculatePeriodsElapsed(start, "MONTHLY", asOf)).toBe(3);
  });

  it("counts weeks elapsed for WEEKLY", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const asOf = new Date("2026-01-22T00:00:00Z");
    expect(calculatePeriodsElapsed(start, "WEEKLY", asOf)).toBe(4);
  });

  it("counts quarters elapsed for QUARTERLY", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const asOf = new Date("2026-08-01T00:00:00Z");
    expect(calculatePeriodsElapsed(start, "QUARTERLY", asOf)).toBe(3);
  });

  it("always owes exactly 1 period for ONE_TIME regardless of elapsed time", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const asOf = new Date("2027-01-01T00:00:00Z");
    expect(calculatePeriodsElapsed(start, "ONE_TIME", asOf)).toBe(1);
  });
});

describe("calculateRecurringChargeDue", () => {
  it("multiplies rate by periods elapsed", () => {
    const due = calculateRecurringChargeDue({
      startDate: new Date("2026-01-01T00:00:00Z"),
      frequency: "MONTHLY",
      amount: 500,
      asOf: new Date("2026-03-15T00:00:00Z"),
    });
    expect(due.toNumber()).toBe(1500);
  });

  it("adds an unpaid deposit on top of the recurring amount", () => {
    const due = calculateRecurringChargeDue({
      startDate: new Date("2026-01-01T00:00:00Z"),
      frequency: "MONTHLY",
      amount: 500,
      depositAmount: 1000,
      depositPaid: false,
      asOf: new Date("2026-01-01T00:00:00Z"),
    });
    expect(due.toNumber()).toBe(1500);
  });

  it("excludes the deposit once it's marked paid", () => {
    const due = calculateRecurringChargeDue({
      startDate: new Date("2026-01-01T00:00:00Z"),
      frequency: "MONTHLY",
      amount: 500,
      depositAmount: 1000,
      depositPaid: true,
      asOf: new Date("2026-01-01T00:00:00Z"),
    });
    expect(due.toNumber()).toBe(500);
  });
});
