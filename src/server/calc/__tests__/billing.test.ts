import { describe, expect, it } from "vitest";

import { calculateAssignmentMargin, calculateClientBilling, calculateInvoiceTotals } from "../billing";

describe("calculateClientBilling", () => {
  // Scenario: client billing rate differs from worker rate (§13/§31).
  it("bills the client at the client rate, independent of the worker rate", () => {
    const workerCost = 200 * 15; // worker rate 15/h
    const clientRevenue = calculateClientBilling(200, 25); // client rate 25/h

    expect(clientRevenue.toNumber()).toBe(5000);
    expect(clientRevenue.toNumber()).not.toBe(workerCost);
  });
});

describe("calculateAssignmentMargin", () => {
  it("computes margin as client revenue minus worker cost", () => {
    const margin = calculateAssignmentMargin(5000, 3000);
    expect(margin.toNumber()).toBe(2000);
  });
});

describe("calculateInvoiceTotals", () => {
  it("applies a tax percentage to the subtotal", () => {
    const totals = calculateInvoiceTotals(5000, 15);
    expect(totals.subtotal.toNumber()).toBe(5000);
    expect(totals.taxAmount.toNumber()).toBe(750);
    expect(totals.totalAmount.toNumber()).toBe(5750);
  });

  it("defaults to zero tax when no rate is given", () => {
    const totals = calculateInvoiceTotals(1000);
    expect(totals.totalAmount.toNumber()).toBe(1000);
  });
});
