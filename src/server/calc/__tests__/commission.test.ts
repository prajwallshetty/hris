import { describe, expect, it } from "vitest";

import { calculateCommission } from "../commission";

describe("calculateCommission", () => {
  // Scenario: coordinator receives a percentage commission (§31).
  it("calculates a percentage of sales", () => {
    const commission = calculateCommission({ type: "PERCENT_OF_SALES", rateOrAmount: 5 }, { salesAmount: 10_000 });
    expect(commission.toNumber()).toBe(500);
  });

  it("calculates a percentage of invoice value", () => {
    const commission = calculateCommission({ type: "PERCENT_OF_INVOICE", rateOrAmount: 10 }, { invoiceAmount: 5000 });
    expect(commission.toNumber()).toBe(500);
  });

  it("calculates a percentage of profit", () => {
    const commission = calculateCommission({ type: "PERCENT_OF_PROFIT", rateOrAmount: 20 }, { profitAmount: 2000 });
    expect(commission.toNumber()).toBe(400);
  });

  it("calculates a flat amount per worker", () => {
    const commission = calculateCommission({ type: "PER_WORKER", rateOrAmount: 50 }, { workerCount: 8 });
    expect(commission.toNumber()).toBe(400);
  });

  it("calculates a flat amount per hour", () => {
    const commission = calculateCommission({ type: "PER_HOUR", rateOrAmount: 0.5 }, { hours: 1000 });
    expect(commission.toNumber()).toBe(500);
  });

  it("returns a fixed amount regardless of base figures", () => {
    const commission = calculateCommission({ type: "FIXED_AMOUNT", rateOrAmount: 1000 }, {});
    expect(commission.toNumber()).toBe(1000);
  });
});
