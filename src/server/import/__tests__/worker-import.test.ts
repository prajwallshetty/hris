import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { extractWorkerRows, summarizeWorkerImport, validateWorkerImportRows, type RawWorkerImportRow } from "../worker-import";

function row(overrides: Partial<RawWorkerImportRow>): RawWorkerImportRow {
  return {
    rowNumber: 4,
    slNo: 1,
    name: "Test Worker",
    batchNo: null,
    iqama: "1234567890",
    client: "Acme Co",
    site: "Main Site",
    designation: "Scaffolder",
    mob: null,
    demob: null,
    status: "MOBILIZED",
    month: null,
    ratePerHour: 15,
    ...overrides,
  };
}

describe("extractWorkerRows", () => {
  it("parses the real reference workbook and skips blank rows", () => {
    const filePath = path.join(process.cwd(), "reference", "DEMO IN.xlsx");
    const buffer = fs.readFileSync(filePath);
    const rows = extractWorkerRows(buffer);

    expect(rows).toHaveLength(8);
    expect(rows[0].name).toBe("MD LIPON MOLLA");
    expect(rows[0].iqama).toBe("2540267560");
    expect(rows[0].client).toBe("ANB");
    expect(rows[0].site).toBe("AR RAZI");
    expect(rows[0].ratePerHour).toBe(16);
  });
});

describe("validateWorkerImportRows", () => {
  it("accepts a well-formed row with no collisions", () => {
    const [result] = validateWorkerImportRows([row({})], new Set());
    expect(result.valid).toBe(true);
  });

  it("flags a missing name", () => {
    const [result] = validateWorkerImportRows([row({ name: null })], new Set());
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors).toContain("Missing worker name.");
  });

  it("flags an Iqama number that isn't exactly 10 digits", () => {
    const [result] = validateWorkerImportRows([row({ iqama: "123" })], new Set());
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors[0]).toMatch(/10 digits/);
  });

  it("flags an Iqama that already exists in the database", () => {
    const [result] = validateWorkerImportRows([row({ iqama: "1234567890" })], new Set(["1234567890"]));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors[0]).toMatch(/already exists/);
  });

  it("flags an Iqama duplicated within the same import file", () => {
    const results = validateWorkerImportRows(
      [row({ iqama: "1111111111" }), row({ iqama: "1111111111" })],
      new Set(),
    );
    expect(results[0].valid).toBe(true);
    expect(results[1].valid).toBe(false);
    if (!results[1].valid) expect(results[1].errors[0]).toMatch(/duplicated within this file/);
  });

  it("flags a missing client or site", () => {
    const results = validateWorkerImportRows([row({ client: null, site: null })], new Set());
    expect(results[0].valid).toBe(false);
    if (!results[0].valid) {
      expect(results[0].errors).toContain("Missing client.");
      expect(results[0].errors).toContain("Missing site.");
    }
  });

  it("flags a negative rate", () => {
    const [result] = validateWorkerImportRows([row({ ratePerHour: -5 })], new Set());
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors).toContain("Rate per hour cannot be negative.");
  });
});

describe("summarizeWorkerImport", () => {
  it("counts valid/invalid rows and builds a downloadable error report", () => {
    const results = validateWorkerImportRows(
      [row({ iqama: "1111111111" }), row({ iqama: "2222222222", name: null })],
      new Set(),
    );
    const summary = summarizeWorkerImport(results);

    expect(summary.totalRows).toBe(2);
    expect(summary.validRows).toBe(1);
    expect(summary.invalidRows).toBe(1);
    expect(summary.errorReport).toHaveLength(1);
    expect(summary.errorReport[0].errors).toContain("Missing worker name.");
  });
});
