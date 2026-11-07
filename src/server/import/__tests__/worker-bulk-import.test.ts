import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

import { toCsv } from "@/lib/csv";

import {
  WORKER_IMPORT_COLUMNS,
  detectWorkerBulkColumns,
  extractWorkerBulkRows,
  naturalKey,
  buildPreviewRows,
  summarizeWorkerBulkImport,
  validateWorkerBulkRows,
  type ExistingWorkerRef,
  type RawWorkerBulkRow,
  type WorkerBulkImportContext,
} from "../worker-bulk-import";

const HEADERS = WORKER_IMPORT_COLUMNS.map((c) => c.header);

function emptyContext(overrides: Partial<WorkerBulkImportContext> = {}): WorkerBulkImportContext {
  return {
    existingByIqama: new Map(),
    existingNaturalKeys: new Set(),
    suppliers: [{ id: "sup1", name: "Gulf Manpower" }],
    clients: [{ id: "c1", name: "Acme", coordinatorId: null }],
    projects: [{ id: "p1", name: "Tower", clientId: "c1", coordinatorId: null }],
    sites: [{ id: "s1", name: "North Gate", projectId: "p1" }],
    coordinators: [
      { id: "co1", name: "Faisal Coordinator" },
      { id: "co2", name: "Omar Coordinator" },
    ],
    ...overrides,
  };
}

function existingWorker(overrides: Partial<ExistingWorkerRef> = {}): ExistingWorkerRef {
  return {
    id: "w-existing",
    fullName: "Existing Person",
    iqamaNumber: "2222222222",
    sequenceNo: 123,
    status: "ACTIVE",
    nationality: "India",
    mobile: "0501234567",
    mobilizationDate: "2025-12-01",
    workerType: "FRL",
    supplierId: null,
    supplierName: null,
    designation: "Scaffolder",
    skillCategory: "Skilled",
    hourlyRate: 15,
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
      suppliers: [
        { id: "a", name: "Dup" },
        { id: "b", name: "dup" },
      ],
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
    const ctx = emptyContext({ existingByIqama: new Map([["2222222222", existingWorker()]]) });
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


describe("Excel serial dates", () => {
  function xlsxWithMobilization(cell: unknown) {
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Full Name", "Nationality", "Mobile", "Mobilization", "Worker Type"],
      ["Serial Worker", "India", "0501111111", cell, "FRL"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "S");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const { columns } = detectWorkerBulkColumns(buffer);
    return validate(extractWorkerBulkRows(buffer, columns));
  }

  it.each([
    [46031, "2026-01-09"],
    [46032, "2026-01-10"],
    [46033, "2026-01-11"],
  ])("converts the numeric Excel serial %i to %s", (serial, iso) => {
    const [result] = xlsxWithMobilization(serial);
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.data.mobilizationDate).toBe(iso);
  });

  it("converts a serial that arrives as text (a text-formatted cell or CSV)", () => {
    const [result] = validate([row({ mobilization: "46031" })]);
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.data.mobilizationDate).toBe("2026-01-09");
  });

  it.each([
    ["09/01/2026", "2026-01-09"],
    ["9-1-2026", "2026-01-09"],
    ["09.01.2026", "2026-01-09"],
    ["2026-01-09", "2026-01-09"],
    ["2026/01/09", "2026-01-09"],
  ])("reads %s as %s (day-first, never US month-first)", (text, iso) => {
    const [result] = validate([row({ mobilization: text })]);
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.data.mobilizationDate).toBe(iso);
  });

  it("rejects impossible dates and numbers that are not plausible dates", () => {
    for (const bad of ["31/02/2026", "13/13/2026", "12345", "99999", "soon"]) {
      const [result] = validate([row({ mobilization: bad })]);
      expect(result.valid, bad).toBe(false);
    }
  });
});

describe("site / project / client matching", () => {
  const placement = { client: "Acme", project: "Tower", site: "North Gate", workerRate: "15", clientBillingRate: "22" };

  it("ignores letter case and extra, leading, trailing or non-breaking spaces on every level", () => {
    const [result] = validate([row({ ...placement, client: "  ACME ", project: "tower", site: "  north\u00a0  GATE  " })]);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.siteId).toBe("s1");
      expect(result.display).toMatchObject({ client: "Acme", project: "Tower", site: "North Gate" });
    }
  });

  it("matches a stored name that itself has irregular spacing or case", () => {
    const ctx = emptyContext({ sites: [{ id: "s9", name: " RIG   Site  ", projectId: "p1" }] });
    const [result] = validate([row({ ...placement, site: "rig site" })], ctx);
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.data.siteId).toBe("s9");
  });

  it("does not match a different or merely similar site, and never creates one", () => {
    const ctx = emptyContext({ sites: [{ id: "s1", name: "North Gate", projectId: "p1" }, { id: "s2", name: "North Gate 2", projectId: "p1" }] });
    const [result] = validate([row({ ...placement, site: "North" })], ctx);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors[0]).toMatch(/Site under Tower "North" was not found/);
      expect(result.errors[0]).toMatch(/Available: North Gate, North Gate 2/);
    }
  });

  it("does not pick a same-named site from another project, and says where it is", () => {
    const ctx = emptyContext({
      projects: [
        { id: "p1", name: "Tower", clientId: "c1", coordinatorId: null },
        { id: "p2", name: "Bridge", clientId: "c1", coordinatorId: null },
      ],
      sites: [{ id: "s7", name: "RIG", projectId: "p2" }],
    });
    const [result] = validate([row({ ...placement, site: "RIG" })], ctx);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors[0]).toMatch(/exists under project Bridge/);
  });

  it("rejects two sites that normalize to the same name instead of guessing", () => {
    const ctx = emptyContext({
      sites: [
        { id: "s1", name: "RIG", projectId: "p1" },
        { id: "s2", name: "rig ", projectId: "p1" },
      ],
    });
    const [result] = validate([row({ ...placement, site: "Rig" })], ctx);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors[0]).toMatch(/more than one/);
  });
});

describe("coordinator assignment", () => {
  const placement = { client: "Acme", project: "Tower", site: "North Gate", workerRate: "15", clientBillingRate: "22" };
  const withCoordinators = (project: string | null, client: string | null) =>
    emptyContext({
      clients: [{ id: "c1", name: "Acme", coordinatorId: client }],
      projects: [{ id: "p1", name: "Tower", clientId: "c1", coordinatorId: project }],
    });

  it("uses the project's coordinator", () => {
    const [r] = validate([row(placement)], withCoordinators("co1", "co2"));
    expect(r.valid && r.display).toMatchObject({ coordinator: "Faisal Coordinator", coordinatorSource: "project" });
  });

  it("falls back to the client's coordinator when the project has none", () => {
    const [r] = validate([row(placement)], withCoordinators(null, "co2"));
    expect(r.valid && r.display).toMatchObject({ coordinator: "Omar Coordinator", coordinatorSource: "client" });
  });

  it("leaves the worker unassigned when neither has a coordinator", () => {
    const [r] = validate([row(placement)], withCoordinators(null, null));
    expect(r.valid && r.display).toMatchObject({ coordinator: null, coordinatorSource: "none" });
  });

  it("treats an inactive (unlisted) coordinator as none rather than assigning them", () => {
    const [r] = validate([row(placement)], withCoordinators("inactive-id", null));
    expect(r.valid && r.display).toMatchObject({ coordinator: null, coordinatorSource: "none" });
  });

  it("keeps an explicit Coordinator column over the project's, and stores only that explicit id", () => {
    const [r] = validate([row({ ...placement, coordinator: " omar  COORDINATOR" })], withCoordinators("co1", null));
    expect(r.valid && r.display).toMatchObject({ coordinator: "Omar Coordinator", coordinatorSource: "manual" });
    expect(r.valid && r.data.coordinatorId).toBe("co2");
  });

  it("does not store the automatic coordinator in the row (it is re-resolved at save time)", () => {
    const [r] = validate([row(placement)], withCoordinators("co1", null));
    expect(r.valid && r.data.coordinatorId).toBe("");
  });

  it("rejects an unknown Coordinator column value", () => {
    const [r] = validate([row({ ...placement, coordinator: "Nobody" })], withCoordinators("co1", null));
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.errors[0]).toMatch(/Coordinator "Nobody" was not found/);
  });
});

describe("rejected rows", () => {
  it("keep their original values so they can be corrected and re-uploaded", () => {
    const [r] = validate([row({ fullName: "Bad Date", mobilization: "31/02/2026", iqama: "1234567890" })]);
    expect(r.valid).toBe(false);
    if (!r.valid) {
      expect(r.source["Full Name"]).toBe("Bad Date");
      expect(r.source["Mobilization"]).toBe("31/02/2026");
      expect(r.source["Iqama Number"]).toBe("1234567890");
    }
  });
});


describe("duplicate Iqama handling", () => {
  const withExisting = (existing = existingWorker()) => emptyContext({ existingByIqama: new Map([[existing.iqamaNumber, existing]]) });

  it("reports the existing worker's name, code, status and Iqama — as a duplicate, not a data error", () => {
    const [r] = validate([row({ iqama: "2222222222" })], withExisting());
    expect(r.valid).toBe(false);
    if (r.valid) return;
    expect(r.duplicateOf).toMatchObject({ fullName: "Existing Person", iqamaNumber: "2222222222" });
    expect(r.errors).toEqual([]); // nothing else is wrong with the row
    const [preview] = buildPreviewRows([r]);
    expect(preview.status).toBe("duplicate");
    expect(preview.issues[0]).toBe("Iqama 2222222222 is already registered to Existing Person (W-000123, active).");
    expect(preview.existing?.fullName).toBe("Existing Person");
  });

  it("is counted separately from errors in the summary, and kept in the report", () => {
    const results = validate(
      [row({ iqama: "2222222222" }), row({ rowNumber: 3, mobilization: "soon" }), row({ rowNumber: 4 })],
      withExisting(),
    );
    const summary = summarizeWorkerBulkImport(results);
    expect(summary).toMatchObject({ totalRows: 3, validRows: 1, duplicateRows: 1, invalidRows: 1 });
    expect(summary.errorReport).toHaveLength(2);
    expect(summary.errorReport[0].errors[0]).toMatch(/^Duplicate: Iqama 2222222222 is already registered to Existing Person/);
  });

  it("never produces a new-worker row for a duplicate", () => {
    const results = validate([row({ iqama: "2222222222", fullName: "Someone Else" })], withExisting());
    expect(results.some((r) => r.valid)).toBe(false);
  });

  it("lists exactly the fields an explicit update would change, and ignores blanks", () => {
    const [r] = validate(
      [row({ iqama: "2222222222", fullName: "existing  PERSON", mobile: "0559999999", mobilization: "2026-01-09", designation: "Rigger", craft: null, workerRate: "18" })],
      withExisting(),
    );
    if (r.valid) throw new Error("expected duplicate");
    const changes = Object.fromEntries((r.changes ?? []).map((c) => [c.field, [c.from, c.to]]));
    expect(changes).toEqual({
      mobile: ["0501234567", "0559999999"],
      mobilizationDate: ["2025-12-01", "2026-01-09"],
      designation: ["Scaffolder", "Rigger"],
      hourlyRate: ["15", "18"],
    }); // same name ignoring case/spacing → no change; blank craft → untouched
    expect(buildPreviewRows([r])[0].updatable).toBe(true);
  });

  it("is not updatable when nothing differs, or when the row has other errors", () => {
    const same = validate([row({ iqama: "2222222222", fullName: "Existing Person", nationality: "India", mobile: "0501234567", mobilization: "2025-12-01", workerRate: "15", designation: "Scaffolder", craft: "Skilled" })], withExisting())[0];
    if (same.valid) throw new Error("expected duplicate");
    expect(same.changes).toEqual([]);
    expect(buildPreviewRows([same])[0].updatable).toBe(false);

    const broken = validate([row({ iqama: "2222222222", mobilization: "31/02/2026" })], withExisting())[0];
    if (broken.valid) throw new Error("expected duplicate");
    expect(broken.data).toBeUndefined();
    expect(buildPreviewRows([broken])[0]).toMatchObject({ status: "duplicate", updatable: false });
  });

  it("a worker-type change away from HRD reports the supplier going away", () => {
    const hrd = existingWorker({ workerType: "HRD", supplierId: "sup1", supplierName: "Gulf Manpower" });
    const [r] = validate([row({ iqama: "2222222222", workerType: "OWN" })], withExisting(hrd));
    if (r.valid) throw new Error("expected duplicate");
    expect(r.changes?.map((c) => c.field)).toEqual(expect.arrayContaining(["workerType", "supplier"]));
  });
});

describe("preview rows", () => {
  it("cover every row in file order with the columns the preview shows", () => {
    const placement = { client: "Acme", project: "Tower", site: "North Gate", workerRate: "15", clientBillingRate: "22" };
    const ctx = emptyContext({ existingByIqama: new Map([["2222222222", existingWorker()]]) });
    const rows = buildPreviewRows(
      validate(
        [
          row({ rowNumber: 2, fullName: "Ready One", iqama: "1111111111", ...placement }),
          row({ rowNumber: 3, fullName: "Dup", iqama: "2222222222" }),
          row({ rowNumber: 4, fullName: "Bad Site", ...placement, site: "Nowhere" }),
        ],
        ctx,
      ),
    );
    expect(rows.map((r) => [r.rowNumber, r.status])).toEqual([[2, "ready"], [3, "duplicate"], [4, "error"]]);
    expect(rows[0]).toMatchObject({ fullName: "Ready One", iqamaNumber: "1111111111", mobilizationDate: "2026-10-01", workerType: "FRL", client: "Acme", project: "Tower", site: "North Gate" });
    expect(rows[2].issues[0]).toMatch(/Site under Tower "Nowhere" was not found/);
    expect(rows[2].client).toBe("Acme"); // an error row still shows what was uploaded
  });
});
