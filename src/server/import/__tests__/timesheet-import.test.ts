import { describe, expect, it } from "vitest";

import { DEFAULT_OVERTIME_RULE } from "@/server/calc";

import {
  validateTimesheetImportRows,
  type RawTimesheetImportRow,
  type TimesheetImportContext,
} from "../timesheet-import";

function row(overrides: Partial<RawTimesheetImportRow>): RawTimesheetImportRow {
  return {
    rowNumber: 2,
    iqama: "1234567890",
    name: "Test Worker",
    date: new Date("2026-08-01T00:00:00Z"),
    loginTime: new Date("2026-08-01T06:00:00Z"),
    logoutTime: new Date("2026-08-01T14:00:00Z"),
    breakMinutes: 0,
    ...overrides,
  };
}

function context(overrides: Partial<TimesheetImportContext> = {}): TimesheetImportContext {
  return {
    workersByIqama: new Map([["1234567890", { id: "worker-1", fullName: "Test Worker" }]]),
    assignedIqamas: new Set(["1234567890"]),
    existingKeys: new Set(),
    overtimeRule: DEFAULT_OVERTIME_RULE,
    ...overrides,
  };
}

describe("validateTimesheetImportRows", () => {
  it("accepts a well-formed row and computes regular/overtime hours via the shared engine", () => {
    const [result] = validateTimesheetImportRows([row({})], context());
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.workerId).toBe("worker-1");
      expect(result.regularHours).toBe("8.00");
      expect(result.overtimeHours).toBe("0.00");
    }
  });

  it("flags an unknown Iqama and does not create a worker", () => {
    const [result] = validateTimesheetImportRows([row({ iqama: "9999999999" })], context());
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors[0]).toMatch(/Unknown Iqama/);
  });

  it("flags a missing date", () => {
    const [result] = validateTimesheetImportRows([row({ date: null })], context());
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors).toContain("Missing or invalid date.");
  });

  it("flags missing login and logout times separately", () => {
    const [result] = validateTimesheetImportRows([row({ loginTime: null, logoutTime: null })], context());
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toContain("Missing login time.");
      expect(result.errors).toContain("Missing logout time.");
    }
  });

  it("flags negative/invalid hours when logout is not after login", () => {
    const [result] = validateTimesheetImportRows(
      [row({ loginTime: new Date("2026-08-01T14:00:00Z"), logoutTime: new Date("2026-08-01T06:00:00Z") })],
      context(),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors[0]).toMatch(/Invalid time/);
  });

  it("flags excessive hours above the configured daily maximum", () => {
    const [result] = validateTimesheetImportRows(
      [row({ loginTime: new Date("2026-08-01T00:00:00Z"), logoutTime: new Date("2026-08-01T20:00:00Z") })],
      context({ maxReasonableHours: 16 }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors[0]).toMatch(/Excessive hours/);
  });

  it("splits overtime once the daily threshold is exceeded", () => {
    const [result] = validateTimesheetImportRows(
      [row({ loginTime: new Date("2026-08-01T06:00:00Z"), logoutTime: new Date("2026-08-01T16:00:00Z") })],
      context(),
    );
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.regularHours).toBe("8.00");
      expect(result.overtimeHours).toBe("2.00");
    }
  });

  it("flags a duplicate record within the same file", () => {
    const results = validateTimesheetImportRows([row({}), row({})], context());
    expect(results[0].valid).toBe(true);
    expect(results[1].valid).toBe(false);
    if (!results[1].valid) expect(results[1].errors[0]).toMatch(/Duplicate record/);
  });

  it("flags duplicate attendance already recorded in the database", () => {
    const [result] = validateTimesheetImportRows(
      [row({})],
      context({ existingKeys: new Set(["worker-1:2026-08-01"]) }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors).toContain("Duplicate attendance: an entry for this worker and date already exists.");
  });

  it("flags a worker who is not assigned to the selected site", () => {
    const [result] = validateTimesheetImportRows([row({})], context({ assignedIqamas: new Set() }));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors).toContain("Worker is not assigned to the selected site.");
  });
});
