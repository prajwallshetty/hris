import { describe, expect, it } from "vitest";

import { calculateProfitability } from "../profitability";

describe("calculateProfitability", () => {
  it("computes profit as revenue minus cost, expenses, and commission", () => {
    const profit = calculateProfitability({
      revenue: 5000,
      workerCost: 3000,
      expenses: 200,
      commission: 250,
    });
    expect(profit.toNumber()).toBe(1550);
  });

  it("defaults expenses and commission to zero when omitted", () => {
    const profit = calculateProfitability({ revenue: 5000, workerCost: 3000 });
    expect(profit.toNumber()).toBe(2000);
  });
});
