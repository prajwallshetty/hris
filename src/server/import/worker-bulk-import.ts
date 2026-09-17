import { cleanString, findColumnIndex, parseExcelDate, readWorksheetRows } from "./excel-utils";
import { WORKER_STATUSES } from "@/lib/validation/worker";

// Worker Bulk Upload (Workers list -> Bulk Upload -> Download Template ->
// fill -> upload): header on the first row, one column per field, located
// by header text (not position) so a reordered sheet still imports
// correctly. This is a distinct format/module from prisma/seed.ts's
// one-off `worker-import.ts`, which replays a specific legacy reference
// workbook with a fixed column layout — the two are not interchangeable.
const HEADER_ROW_INDEX = 0;
const DATA_START_ROW_INDEX = 1;

const COLUMN_ALIASES = {
  name: ["NAME", "FULL NAME", "WORKER NAME"],
  iqama: ["IQAMA", "IQAMA NO", "IQAMA NUMBER", "IQAMA NO."],
  mobile: ["MOBILE", "MOBILE NUMBER", "PHONE"],
  designation: ["DESIGNATION", "JOB TITLE", "ROLE"],
  workerType: ["WORKER TYPE", "SKILL CATEGORY", "TYPE"],
  joiningDate: ["JOINING DATE", "JOIN DATE", "DATE OF JOINING"],
  status: ["STATUS"],
  batchNumber: ["BATCH NUMBER", "BATCH NO", "BATCH"],
  remarks: ["REMARKS", "NOTES"],
} as const;

type ColumnKey = keyof typeof COLUMN_ALIASES;
// Only name and Iqama are required to locate/identify a worker at all —
// everything else (§1: "Do not block import if they are empty") is optional.
const OPTIONAL_COLUMNS: ColumnKey[] = [
  "mobile",
  "designation",
  "workerType",
  "joiningDate",
  "status",
  "batchNumber",
  "remarks",
];

export type WorkerBulkColumnMap = Record<ColumnKey, number>;

export function detectWorkerBulkColumns(buffer: Buffer): { columns: WorkerBulkColumnMap; missing: ColumnKey[] } {
  const headerRow = readWorksheetRows(buffer, HEADER_ROW_INDEX)[0] ?? [];
  const columns = {} as WorkerBulkColumnMap;
  const missing: ColumnKey[] = [];

  (Object.keys(COLUMN_ALIASES) as ColumnKey[]).forEach((key) => {
    const index = findColumnIndex(headerRow, [...COLUMN_ALIASES[key]]);
    columns[key] = index;
    if (index === -1 && !OPTIONAL_COLUMNS.includes(key)) missing.push(key);
  });

  return { columns, missing };
}

export type RawWorkerBulkRow = {
  rowNumber: number;
  name: string | null;
  iqama: string | null;
  mobile: string | null;
  designation: string | null;
  workerType: string | null;
  joiningDate: Date | null;
  status: string | null;
  batchNumber: string | null;
  remarks: string | null;
};

export function extractWorkerBulkRows(buffer: Buffer, columns: WorkerBulkColumnMap): RawWorkerBulkRow[] {
  const rawRows = readWorksheetRows(buffer, DATA_START_ROW_INDEX);
  const rows: RawWorkerBulkRow[] = [];

  rawRows.forEach((row, index) => {
    const name = columns.name >= 0 ? cleanString(row[columns.name]) : null;
    const iqamaRaw = columns.iqama >= 0 ? row[columns.iqama] : null;
    const iqama = iqamaRaw === null || iqamaRaw === undefined ? null : cleanString(String(iqamaRaw));
    if (!name && !iqama) return; // blank/separator row

    rows.push({
      rowNumber: DATA_START_ROW_INDEX + index + 1,
      name,
      iqama,
      mobile: columns.mobile >= 0 ? cleanString(row[columns.mobile]) : null,
      designation: columns.designation >= 0 ? cleanString(row[columns.designation]) : null,
      workerType: columns.workerType >= 0 ? cleanString(row[columns.workerType]) : null,
      joiningDate: columns.joiningDate >= 0 ? parseExcelDate(row[columns.joiningDate]) : null,
      status: columns.status >= 0 ? cleanString(row[columns.status]) : null,
      batchNumber: columns.batchNumber >= 0 ? cleanString(row[columns.batchNumber]) : null,
      remarks: columns.remarks >= 0 ? cleanString(row[columns.remarks]) : null,
    });
  });

  return rows;
}

export type WorkerBulkImportContext = {
  /** Iqama -> existing worker, for duplicate detection (§1: "If an Iqama
   * already exists, show the row as duplicate ... do NOT automatically
   * create a worker"). */
  existingByIqama: ReadonlyMap<string, { id: string; fullName: string }>;
};

export type ValidWorkerBulkRow = {
  rowNumber: number;
  valid: true;
  fullName: string;
  iqamaNumber: string;
  mobile: string | null;
  designation: string | null;
  skillCategory: string | null;
  joiningDate: string | null;
  status: string;
  batchNumber: string | null;
  remarks: string | null;
};

export type InvalidWorkerBulkRow = {
  rowNumber: number;
  valid: false;
  fullName: string | null;
  iqamaNumber: string | null;
  errors: string[];
};

export type WorkerBulkRowResult = ValidWorkerBulkRow | InvalidWorkerBulkRow;

const IQAMA_PATTERN = /^\d{10}$/;

/** Validates each row: missing name/Iqama, malformed Iqama, duplicate Iqama
 * (in-file or already in the database), and an unrecognized status value.
 * Never silently creates or overwrites a worker whose Iqama already
 * exists — that row is always reported, never imported. */
export function validateWorkerBulkRows(
  rows: RawWorkerBulkRow[],
  ctx: WorkerBulkImportContext,
): WorkerBulkRowResult[] {
  const seenInBatch = new Set<string>();

  return rows.map((row) => {
    const errors: string[] = [];

    if (!row.name) errors.push("Missing name.");
    if (!row.iqama) {
      errors.push("Missing Iqama number.");
    } else if (!IQAMA_PATTERN.test(row.iqama)) {
      errors.push("Iqama number must be exactly 10 digits.");
    } else {
      if (seenInBatch.has(row.iqama)) {
        errors.push("Duplicate Iqama: this number already appears earlier in this file.");
      }
      seenInBatch.add(row.iqama);

      const existing = ctx.existingByIqama.get(row.iqama);
      if (existing) {
        errors.push(`Duplicate Iqama: already registered to ${existing.fullName}.`);
      }
    }

    let status = "AVAILABLE";
    if (row.status) {
      const normalized = row.status.trim().toUpperCase().replace(/\s+/g, "_");
      if ((WORKER_STATUSES as readonly string[]).includes(normalized)) {
        status = normalized;
      } else {
        errors.push(`Unrecognized status "${row.status}" — expected one of ${WORKER_STATUSES.join(", ")}.`);
      }
    }

    if (errors.length > 0 || !row.name || !row.iqama) {
      return { rowNumber: row.rowNumber, valid: false, fullName: row.name, iqamaNumber: row.iqama, errors };
    }

    return {
      rowNumber: row.rowNumber,
      valid: true,
      fullName: row.name,
      iqamaNumber: row.iqama,
      mobile: row.mobile,
      designation: row.designation,
      skillCategory: row.workerType,
      joiningDate: row.joiningDate ? row.joiningDate.toISOString().slice(0, 10) : null,
      status,
      batchNumber: row.batchNumber,
      remarks: row.remarks,
    };
  });
}

export type WorkerBulkImportSummary = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errorReport: { rowNumber: number; iqamaNumber: string | null; errors: string[] }[];
};

export function summarizeWorkerBulkImport(results: WorkerBulkRowResult[]): WorkerBulkImportSummary {
  const invalid = results.filter((r): r is InvalidWorkerBulkRow => !r.valid);
  return {
    totalRows: results.length,
    validRows: results.length - invalid.length,
    invalidRows: invalid.length,
    errorReport: invalid.map((r) => ({ rowNumber: r.rowNumber, iqamaNumber: r.iqamaNumber, errors: r.errors })),
  };
}
