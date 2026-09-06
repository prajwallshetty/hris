import { describe, expect, it } from "vitest";

import { calculateRentalSubtotal, calculateRentalTotal, calculateRentalUnits } from "../rental";

describe("calculateRentalUnits", () => {
  it("rounds up a partial hour to a full billable hour", () => {
    const start = new Date("2026-01-01T08:00:00Z");
    const end = new Date("2026-01-01T10:30:00Z");
    expect(calculateRentalUnits("HOURLY", start, end)).toBe(3);
  });

  it("bills a minimum of 1 unit even for a same-instant rental", () => {
    const start = new Date("2026-01-01T08:00:00Z");
    expect(calculateRentalUnits("DAILY", start, start)).toBe(1);
  });

  it("rounds up partial days", () => {
    const start = new Date("2026-01-01T08:00:00Z");
    const end = new Date("2026-01-03T08:00:01Z");
    expect(calculateRentalUnits("DAILY", start, end)).toBe(3);
  });

  it("rounds up partial weeks", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const end = new Date("2026-01-10T00:00:00Z");
    expect(calculateRentalUnits("WEEKLY", start, end)).toBe(2);
  });

  it("rounds up partial months", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const end = new Date("2026-02-15T00:00:00Z");
    expect(calculateRentalUnits("MONTHLY", start, end)).toBe(2);
  });

  // Scenario: a CUSTOM rate is a flat price for the whole engagement,
  // independent of how long it actually runs (§4).
  it("always bills exactly 1 unit for a CUSTOM rate regardless of duration", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const end = new Date("2026-06-01T00:00:00Z");
    expect(calculateRentalUnits("CUSTOM", start, end)).toBe(1);
  });
});

describe("calculateRentalSubtotal", () => {
  it("multiplies rate by quantity and billable units", () => {
    const subtotal = calculateRentalSubtotal({
      rateType: "DAILY",
      rateAmount: 150,
      quantity: 2,
      startDate: new Date("2026-01-01T00:00:00Z"),
      endDate: new Date("2026-01-04T00:00:00Z"),
    });
    expect(subtotal.toNumber()).toBe(150 * 2 * 3);
  });

  it("uses the flat rate once for CUSTOM regardless of quantity's time span", () => {
    const subtotal = calculateRentalSubtotal({
      rateType: "CUSTOM",
      rateAmount: 5000,
      quantity: 1,
      startDate: new Date("2026-01-01T00:00:00Z"),
      endDate: new Date("2026-12-01T00:00:00Z"),
    });
    expect(subtotal.toNumber()).toBe(5000);
  });
});

describe("calculateRentalTotal", () => {
  // Scenario: base rental charge plus a damage charge added at return (§4).
  it("sums every charge row into the invoiceable total", () => {
    expect(calculateRentalTotal([900, 250]).toNumber()).toBe(1150);
  });

  it("is zero when there are no charges yet", () => {
    expect(calculateRentalTotal([]).toNumber()).toBe(0);
  });
});
