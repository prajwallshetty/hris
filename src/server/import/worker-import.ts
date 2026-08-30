import { cleanString, parseExcelDate, readWorksheetRows } from "./excel-utils";

// Column layout of the reference workbook (DEMO IN.xlsx, "PAYMENT
// SUMMARY-SUPPLIERS" sheet), header row at Excel row 3 (0-based index 2),
// first data row at Excel row 4 (index 3). Column order: SL.NO / NAME /
// CL-BATCH NO / IQAMA NO / CLIENT / SITE / DESIGNATION / MOB / DEMOB /
// STATUS / MONTH / RPH-MONTH / NO OF HRS-MONTH / TOTAL / ADV-BC TAKEN /
// TOTAL DUE / PAID AMOUNT / PENDING AMOUNT / REMARKS.
const DATA_START_ROW_INDEX = 3;

export type RawWorkerImportRow = {
  rowNumber: number; // 1-based Excel row number, for error reporting
  slNo: number | null;
  name: string | null;
  batchNo: string | null;
  iqama: string | null;
  client: string | null;
  site: string | null;
  designation: string | null;
  mob: Date | null;
  demob: Date | null;
  status: string | null;
  month: Date | null;
  ratePerHour: number | null;
};

/**
 * Maps raw Excel cells to typed rows (§7: "detect headers -> map columns"),
 * skipping fully-blank separator rows. Does not validate — see
 * `validateWorkerImportRows`.
 */
export function extractWorkerRows(buffer: Buffer): RawWorkerImportRow[] {
  const rawRows = readWorksheetRows(buffer, DATA_START_ROW_INDEX);
  const rows: RawWorkerImportRow[] = [];

  rawRows.forEach((row, index) => {
    const name = cleanString(row[1]);
    const iqamaRaw = row[3];
    const iqama = iqamaRaw === null || iqamaRaw === undefined ? null : cleanString(String(iqamaRaw));
    if (!name && !iqama) return; // blank/separator row

    rows.push({
      rowNumber: DATA_START_ROW_INDEX + index + 1, // +1 for 1-based Excel rows
      slNo: typeof row[0] === "number" ? row[0] : null,
      name,
      batchNo: cleanString(row[2]),
      iqama,
      client: cleanString(row[4]),
      site: cleanString(row[5]),
      designation: cleanString(row[6]),
      mob: parseExcelDate(row[7]),
      demob: parseExcelDate(row[8]),
      status: cleanString(row[9]),
      month: parseExcelDate(row[10]),
      ratePerHour: typeof row[11] === "number" ? row[11] : null,
    });
  });

  return rows;
}

export type WorkerImportRowResult =
  | { rowNumber: number; valid: true; row: RawWorkerImportRow }
  | { rowNumber: number; valid: false; row: RawWorkerImportRow; errors: string[] };

/**
 * Validates each extracted row (§7: "validate records -> match Iqama
 * numbers -> detect duplicates -> detect invalid values"). `existingIqamas`
 * should contain every Iqama number already in the database, so imports
 * can flag collisions before anything is written.
 */
export function validateWorkerImportRows(
  rows: RawWorkerImportRow[],
  existingIqamas: ReadonlySet<string>,
): WorkerImportRowResult[] {
  const seenInBatch = new Set<string>();

  return rows.map((row) => {
    const errors: string[] = [];

    if (!row.name) errors.push("Missing worker name.");
    if (!row.iqama) {
      errors.push("Missing Iqama number.");
    } else if (!/^\d{10}$/.test(row.iqama)) {
      errors.push(`Iqama number "${row.iqama}" must be exactly 10 digits.`);
    } else if (existingIqamas.has(row.iqama)) {
      errors.push(`Iqama number ${row.iqama} already exists in the system.`);
    } else if (seenInBatch.has(row.iqama)) {
      errors.push(`Iqama number ${row.iqama} is duplicated within this file.`);
    }
    if (!row.client) errors.push("Missing client.");
    if (!row.site) errors.push("Missing site.");
    if (row.ratePerHour !== null && row.ratePerHour < 0) errors.push("Rate per hour cannot be negative.");

    if (row.iqama) seenInBatch.add(row.iqama);

    if (errors.length > 0) {
      return { rowNumber: row.rowNumber, valid: false, row, errors };
    }
    return { rowNumber: row.rowNumber, valid: true, row };
  });
}

export type WorkerImportSummary = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errorReport: { rowNumber: number; errors: string[] }[];
};

/** Preview summary (§7: total/valid/invalid rows + a downloadable error report). */
export function summarizeWorkerImport(results: WorkerImportRowResult[]): WorkerImportSummary {
  const invalid = results.filter((r): r is Extract<WorkerImportRowResult, { valid: false }> => !r.valid);
  return {
    totalRows: results.length,
    validRows: results.length - invalid.length,
    invalidRows: invalid.length,
    errorReport: invalid.map((r) => ({ rowNumber: r.rowNumber, errors: r.errors })),
  };
}
