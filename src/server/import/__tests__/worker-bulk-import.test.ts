import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

import { toCsv } from "@/lib/csv";

import {
  WORKER_IMPORT_COLUMNS,
  detectWorkerBulkColumns,
  extractWorkerBulkRows,
  naturalKey,
  summarizeWorkerBulkImport,
  validateWorkerBulkRows,
  type RawWorkerBulkRow,
  type WorkerBulkImportContext,
} from "../worker-bulk-import";

const HEADERS = WORKER_IMPORT_COLUMNS.map((c) => c.header);

function emptyContext(overrides: Partial<WorkerBulkImportContext> = {}): WorkerBulkImportContext {
  return {
    existingByIqama: new Map(),
    existingNaturalKeys: new Set(),
    suppliersByName: new Map([["gulf manpower", [{ id: "sup1", name: "Gulf Manpower" }]]]),
    clientsByName: new Map([["acme", [{ id: "c1", name: "Acme" }]]]),
    projectsByKey: new Map([["c1|tower", [{ id: "p1", name: "Tower" }]]]),
    sitesByKey: new Map([["p1|north gate", [{ id: "s1", name: "North Gate" }]]]),
    ...overrides,
  };
}

function row(overrides: Partial<RawWorkerBulkRow> = {}): RawWorkerBulkRow {
  const base = Object.fromEntries(WORKER_IMPORT_COLUMNS.map((c) => [c.key, null])) as unknown as RawWorkerBulkRow;
  return {
    ...base,
    rowNumber: 2,
    fullName: "Test Worker",
    nationality: "India",
    mobile: "0501234567",
    mobilization: "01/10/2026",
    workerType: "FRL",
    ...overrides,
  };
}

function validate(rows: RawWorkerBulkRow[], ctx = emptyContext()) {
  return validateWorkerBulkRows(rows, ctx);
}

describe("template ↔ importer round trip", () => {
  it("detects every column from an XLSX built from the template headers", () => {
    const sheet = XLSX.utils.aoa_to_sheet([HEADERS, WORKER_IMPORT_COLUMNS.map((c) => c.example)]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Template");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    const { columns, missing } = detectWorkerBulkColumns(buffer);
    expect(missing).toEqual([]);
    expect(Object.values(columns).every((i) => i >= 0)).toBe(true);

    const [example] = validate(extractWorkerBulkRows(buffer, columns));
    expect(example.valid).toBe(true);
  });

  it("reads a CSV with DD/MM/YYYY as day-first, not US month-first", () => {
    const csv = toCsv(["Full Name", "Nationality", "Mobile", "Mobilization", "Worker Type"], [["A Worker", "Nepal", "0551112222", "01/09/2026", "own"]]);
    const buffer = Buffer.from(csv);
    const { columns, missing } = detectWorkerBulkColumns(buffer);
    expect(missing).toEqual([]);
    const [result] = validate(extractWorkerBulkRows(buffer, columns));
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.mobilizationDate).toBe("2026-09-01");
      expect(result.data.workerType).toBe("OWN");
    }
  });

  it("reports missing required columns by their template header", () => {
    const buffer = Buffer.from(toCsv(["Full Name", "Mobile"], [["A", "1"]]));
    expect(detectWorkerBulkColumns(buffer).missing).toEqual(["Nationality", "Mobilization", "Worker Type"]);
  });
});

describe("validateWorkerBulkRows", () => {
  it("accepts an FRL row with only the five required fields (all optional fields empty)", () => {
    const [result] = validate([row()]);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.iqamaNumber).toBe("");
      expect(result.data.supplierId).toBe("");
      expect(result.batchNumber).toBeNull();
    }
  });

  it("requires every one of the five required fields", () => {
    const [result] = validate([row({ fullName: null, nationality: null, mobile: null, mobilization: null, workerType: null })]);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors).toHaveLength(5);
  });

  it("rejects an unknown worker type and an impossible date", () => {
    const [result] = validate([row({ workerType: "CONTRACT", mobilization: "31/02/2026" })]);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("FRL, HRD or OWN"))).toBe(true);
      expect(result.errors.some((e) => e.includes("not a valid date"))).toBe(true);
    }
  });

  it("requires a supplier for HRD and resolves it case-insensitively", () => {
    const [missing] = validate([row({ workerType: "HRD" })]);
    expect(missing.valid).toBe(false);

    const [ok] = validate([row({ workerType: "HRD", supplier: "GULF MANPOWER" })]);
    expect(ok.valid).toBe(true);
    if (ok.valid) expect(ok.data.supplierId).toBe("sup1");
  });

  it("never invents an unknown supplier, and rejects an ambiguous one", () => {
    const [unknown] = validate([row({ workerType: "HRD", supplier: "New Agency" })]);
    expect(unknown.valid).toBe(false);

    const ambiguous = emptyContext({
      suppliersByName: new Map([["dup", [{ id: "a", name: "Dup" }, { id: "b", name: "dup" }]]]),
    });
    const [result] = validate([row({ workerType: "HRD", supplier: "Dup" })], ambiguous);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors[0]).toMatch(/more than one/);
  });

  it("rejects a supplier on an FRL/OWN row instead of silently dropping it", () => {
    const [result] = validate([row({ workerType: "OWN", supplier: "Gulf Manpower" })]);
    expect(result.valid).toBe(false);
  });

  it("flags duplicate and already-registered Iqamas", () => {
    const ctx = emptyContext({ existingByIqama: new Map([["2222222222", { fullName: "Existing Person" }]]) });
    const results = validate(
      [row({ iqama: "1111111111" }), row({ rowNumber: 3, iqama: "1111111111" }), row({ rowNumber: 4, iqama: "2222222222" })],
      ctx,
    );
    expect(results.map((r) => r.valid)).toEqual([true, false, false]);
  });

  it("detects Iqama-less duplicates by name + mobile + mobilization date", () => {
    const ctx = emptyContext({ existingNaturalKeys: new Set([naturalKey("Already Here", "0500000000", "2026-10-01")]) });
    const results = validate([row(), row({ rowNumber: 3 }), row({ rowNumber: 4, fullName: "already here", mobile: "0500000000" })], ctx);
    expect(results.map((r) => r.valid)).toEqual([true, false, false]);
  });

  it("resolves a full client → project → site placement", () => {
    const [result] = validate([
      row({ client: "acme", project: "Tower", site: "North Gate", workerRate: "15", clientBillingRate: "22.5" }),
    ]);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data).toMatchObject({ clientId: "c1", projectId: "p1", siteId: "s1", workerRate: 15, clientBillingRate: 22.5 });
    }
  });

  it("requires the placement to be complete, with both rates", () => {
    const [partial] = validate([row({ client: "Acme" })]);
    expect(partial.valid).toBe(false);
    const [noRates] = validate([row({ client: "Acme", project: "Tower", site: "North Gate" })]);
    expect(noRates.valid).toBe(false);
    const [wrongSite] = validate([
      row({ client: "Acme", project: "Tower", site: "South Gate", workerRate: "15", clientBillingRate: "20" }),
    ]);
    expect(wrongSite.valid).toBe(false);
  });

  it("rejects a negative or non-numeric rate", () => {
    const [result] = validate([row({ workerRate: "-5" })]);
    expect(result.valid).toBe(false);
  });
});

describe("summarizeWorkerBulkImport", () => {
  it("counts valid and invalid rows and carries the issue report", () => {
    const summary = summarizeWorkerBulkImport(validate([row(), row({ rowNumber: 3, workerType: null })]));
    expect(summary).toMatchObject({ totalRows: 2, validRows: 1, invalidRows: 1 });
    expect(summary.errorReport[0]).toMatchObject({ rowNumber: 3, fullName: "Test Worker" });
  });
});
