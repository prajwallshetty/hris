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

  // Scenario: a client's site also runs a company vehicle and a rented
  // generator, both of which eat into the site's profitability (§4).
  it("also subtracts vehicle expenses and equipment rental cost when provided", () => {
    const profit = calculateProfitability({
      revenue: 10000,
      workerCost: 4000,
      expenses: 300,
      commission: 200,
      vehicleExpenses: 500,
      equipmentRentalCost: 800,
    });
    expect(profit.toNumber()).toBe(4200);
  });

  it("defaults vehicle expenses and equipment rental cost to zero when omitted", () => {
    const profit = calculateProfitability({ revenue: 5000, workerCost: 3000, expenses: 200, commission: 250 });
    expect(profit.toNumber()).toBe(1550);
  });
});
