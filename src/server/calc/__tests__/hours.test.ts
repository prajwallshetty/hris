import { describe, expect, it } from "vitest";

import { calculateOvertime, calculateRegularHours, DEFAULT_OVERTIME_RULE } from "../hours";

describe("calculateRegularHours", () => {
  it("computes hours from login/logout minus break", () => {
    const login = new Date("2026-08-01T08:00:00Z");
    const logout = new Date("2026-08-01T17:30:00Z");
    const hours = calculateRegularHours(login, logout, 30);
    expect(hours.toNumber()).toBe(9); // 9.5h shift - 0.5h break
  });

  it("never returns negative hours for a logout before login", () => {
    const login = new Date("2026-08-01T17:00:00Z");
    const logout = new Date("2026-08-01T08:00:00Z");
    expect(calculateRegularHours(login, logout, 0).toNumber()).toBe(0);
  });

  it("returns zero when the break consumes the whole shift", () => {
    const login = new Date("2026-08-01T08:00:00Z");
    const logout = new Date("2026-08-01T09:00:00Z");
    expect(calculateRegularHours(login, logout, 90).toNumber()).toBe(0);
  });
});

describe("calculateOvertime", () => {
  it("splits a 10-hour day into 8 regular + 2 overtime under the default rule", () => {
    const { regularHours, overtimeHours } = calculateOvertime(10, DEFAULT_OVERTIME_RULE);
    expect(regularHours.toNumber()).toBe(8);
    expect(overtimeHours.toNumber()).toBe(2);
  });

  it("reports zero overtime for a day under the threshold", () => {
    const { regularHours, overtimeHours } = calculateOvertime(6, DEFAULT_OVERTIME_RULE);
    expect(regularHours.toNumber()).toBe(6);
    expect(overtimeHours.toNumber()).toBe(0);
  });

  it("respects a configured threshold other than 8", () => {
    const { regularHours, overtimeHours } = calculateOvertime(9, {
      dailyRegularHoursThreshold: 10,
      overtimeMultiplier: 1.5,
    });
    expect(regularHours.toNumber()).toBe(9);
    expect(overtimeHours.toNumber()).toBe(0);
  });

  it("caps total hours at maxDailyHours before splitting", () => {
    const { regularHours, overtimeHours } = calculateOvertime(14, {
      dailyRegularHoursThreshold: 8,
      overtimeMultiplier: 1.5,
      maxDailyHours: 12,
    });
    expect(regularHours.toNumber()).toBe(8);
    expect(overtimeHours.toNumber()).toBe(4);
  });

  it("raises short days to minPayableHours before splitting", () => {
    const { regularHours, overtimeHours } = calculateOvertime(2, {
      dailyRegularHoursThreshold: 8,
      overtimeMultiplier: 1.5,
      minPayableHours: 4,
    });
    expect(regularHours.toNumber()).toBe(4);
    expect(overtimeHours.toNumber()).toBe(0);
  });
});
