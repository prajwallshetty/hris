import { describe, expect, it } from "vitest";

import { calculateOutstanding, calculateRepayableBalance } from "../finance";

describe("calculateOutstanding", () => {
  // Scenario: worker receives partial salary (§31).
  it("computes what's left after a single partial payment", () => {
    expect(calculateOutstanding(3000, [1000]).toNumber()).toBe(2000);
  });

  it("sums multiple payments against the payable amount", () => {
    expect(calculateOutstanding(3000, [1000, 1000]).toNumber()).toBe(1000);
  });

  // Scenario: client partially pays an invoice (§31) — same primitive, a
  // different semantic caller (client payments vs worker payments).
  it("computes remaining invoice balance after a partial client payment", () => {
    expect(calculateOutstanding(5750, [2000]).toNumber()).toBe(3750);
  });

  it("is fully settled when payments equal the payable amount", () => {
    expect(calculateOutstanding(1000, [400, 600]).toNumber()).toBe(0);
  });

  it("goes negative to signal an overpayment", () => {
    expect(calculateOutstanding(1000, [1200]).toNumber()).toBe(-200);
  });

  it("treats no payments as fully outstanding", () => {
    expect(calculateOutstanding(500, []).toNumber()).toBe(500);
  });
});

describe("calculateRepayableBalance", () => {
  // Scenario: worker takes an advance and repays it over multiple payroll
  // periods (§31).
  it("reduces the balance as repayments accumulate across periods", () => {
    const afterMonth1 = calculateRepayableBalance(900, [300]);
    expect(afterMonth1.toNumber()).toBe(600);

    const afterMonth2 = calculateRepayableBalance(900, [300, 300]);
    expect(afterMonth2.toNumber()).toBe(300);

    const afterMonth3 = calculateRepayableBalance(900, [300, 300, 300]);
    expect(afterMonth3.toNumber()).toBe(0);
  });
});
