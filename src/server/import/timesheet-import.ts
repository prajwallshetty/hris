import { Decimal } from "decimal.js";

import { calculateOvertime, calculateRegularHours, type OvertimeRuleConfig } from "@/server/calc";

import { cleanString, combineDateAndTime, findColumnIndex, parseExcelDate, readWorksheetRows } from "./excel-utils";

// Daily login-sheet layout: header on the first row, one column per field
// (§6/§7). Unlike the legacy worker master workbook, there's no fixed
// reference file for this format — columns are located by header name so a
// client's sheet can reorder them without breaking the import.
const HEADER_ROW_INDEX = 0;
const DATA_START_ROW_INDEX = 1;

const COLUMN_ALIASES = {
  iqama: ["IQAMA", "IQAMA NO", "IQAMA NUMBER", "IQAMA NO."],
  name: ["NAME", "WORKER NAME", "WORKER"],
  date: ["DATE"],
  login: ["LOGIN", "LOGIN TIME", "TIME IN", "CHECK IN", "IN"],
  logout: ["LOGOUT", "LOGOUT TIME", "TIME OUT", "CHECK OUT", "OUT"],
  breakMinutes: ["BREAK", "BREAK MINUTES", "BREAK (MIN)", "BREAK MIN"],
} as const;

type ColumnKey = keyof typeof COLUMN_ALIASES;
// "name" and "breakMinutes" are optional — everything else is required to
// locate a row's worker, date and hours at all.
const OPTIONAL_COLUMNS: ColumnKey[] = ["name", "breakMinutes"];

export type TimesheetColumnMap = Record<ColumnKey, number>;

/** Locates each expected column by header text; reports any that are missing. */
export function detectTimesheetColumns(buffer: Buffer): { columns: TimesheetColumnMap; missing: ColumnKey[] } {
  const headerRow = readWorksheetRows(buffer, HEADER_ROW_INDEX)[0] ?? [];
  const columns = {} as TimesheetColumnMap;
  const missing: ColumnKey[] = [];

  (Object.keys(COLUMN_ALIASES) as ColumnKey[]).forEach((key) => {
    const index = findColumnIndex(headerRow, [...COLUMN_ALIASES[key]]);
    columns[key] = index;
    if (index === -1 && !OPTIONAL_COLUMNS.includes(key)) missing.push(key);
  });

  return { columns, missing };
}

export type RawTimesheetImportRow = {
  rowNumber: number; // 1-based Excel row number, for error reporting
  iqama: string | null;
  name: string | null;
  date: Date | null;
  loginTime: Date | null;
  logoutTime: Date | null;
  breakMinutes: number;
};

/** Maps raw Excel cells to typed rows (§6: "Upload -> Read -> Map"). Does not validate. */
export function extractTimesheetRows(buffer: Buffer, columns: TimesheetColumnMap): RawTimesheetImportRow[] {
  const rawRows = readWorksheetRows(buffer, DATA_START_ROW_INDEX);
  const rows: RawTimesheetImportRow[] = [];

  rawRows.forEach((row, index) => {
    const iqamaRaw = columns.iqama >= 0 ? row[columns.iqama] : null;
    const iqama = iqamaRaw === null || iqamaRaw === undefined ? null : cleanString(String(iqamaRaw));
    const name = columns.name >= 0 ? cleanString(row[columns.name]) : null;
    const date = columns.date >= 0 ? parseExcelDate(row[columns.date]) : null;
    if (!iqama && !name && !date) return; // blank/separator row

    const loginTime = columns.login >= 0 ? combineDateAndTime(row[columns.login], date) : null;
    const logoutTime = columns.logout >= 0 ? combineDateAndTime(row[columns.logout], date) : null;
    const breakRaw = columns.breakMinutes >= 0 ? row[columns.breakMinutes] : null;
    const breakMinutes = typeof breakRaw === "number" && breakRaw > 0 ? breakRaw : 0;

    rows.push({
      rowNumber: DATA_START_ROW_INDEX + index + 1,
      iqama,
      name,
      date,
      loginTime,
      logoutTime,
      breakMinutes,
    });
  });

  return rows;
}

export type TimesheetImportContext = {
  /** Every worker currently in the DB, keyed by Iqama (§7: match by Iqama, never name). */
  workersByIqama: ReadonlyMap<string, { id: string; fullName: string }>;
  /** Iqamas of workers with an ACTIVE assignment at the target site. */
  assignedIqamas: ReadonlySet<string>;
  /** `${workerId}:${yyyy-mm-dd}` keys already present in TimesheetItem. */
  existingKeys: ReadonlySet<string>;
  overtimeRule: OvertimeRuleConfig;
  /** Daily hours above this are flagged for review rather than silently accepted. Default 16. */
  maxReasonableHours?: number;
};

export type ValidTimesheetImportRow = {
  rowNumber: number;
  valid: true;
  workerId: string;
  workerName: string;
  iqamaNumber: string;
  date: Date;
  loginTime: Date;
  logoutTime: Date;
  breakMinutes: number;
  regularHours: string;
  overtimeHours: string;
  totalHours: string;
};

export type InvalidTimesheetImportRow = {
  rowNumber: number;
  valid: false;
  iqamaNumber: string | null;
  errors: string[];
};

export type TimesheetImportRowResult = ValidTimesheetImportRow | InvalidTimesheetImportRow;

/**
 * Validates each extracted row against every check in §8: unknown Iqama,
 * duplicate record (in-file and in-DB), missing/invalid date, missing
 * login/logout, invalid/negative time, excessive hours, and worker-not-
 * assigned-to-site. Valid rows come back with regular/overtime hours already
 * split by the centralized hours-calculation engine (§10) — nothing here
 * reimplements that math.
 */
export function validateTimesheetImportRows(
  rows: RawTimesheetImportRow[],
  ctx: TimesheetImportContext,
): TimesheetImportRowResult[] {
  const maxHours = ctx.maxReasonableHours ?? 16;
  const seenInBatch = new Set<string>();

  return rows.map((row) => {
    const errors: string[] = [];
    const worker = row.iqama ? ctx.workersByIqama.get(row.iqama) : undefined;

    if (!row.iqama) {
      errors.push("Missing Iqama number.");
    } else if (!worker) {
      errors.push(`Unknown Iqama: no worker found with Iqama ${row.iqama}.`);
    }

    if (!row.date) errors.push("Missing or invalid date.");

    if (row.iqama && row.date) {
      const batchKey = `${row.iqama}:${row.date.toISOString().slice(0, 10)}`;
      if (seenInBatch.has(batchKey)) {
        errors.push("Duplicate record: this Iqama and date already appear earlier in this file.");
      }
      seenInBatch.add(batchKey);
    }

    if (!row.loginTime) errors.push("Missing login time.");
    if (!row.logoutTime) errors.push("Missing logout time.");

    let regularHours = new Decimal(0);
    let overtimeHours = new Decimal(0);
    let totalHours = new Decimal(0);

    if (row.loginTime && row.logoutTime) {
      const netMinutes = (row.logoutTime.getTime() - row.loginTime.getTime()) / 60_000 - row.breakMinutes;
      if (netMinutes <= 0) {
        errors.push("Invalid time: logout (after break) is not after login.");
      } else {
        totalHours = calculateRegularHours(row.loginTime, row.logoutTime, row.breakMinutes);
        if (totalHours.gt(maxHours)) {
          errors.push(`Excessive hours: ${totalHours.toFixed(2)}h exceeds the ${maxHours}h daily maximum.`);
        } else {
          const split = calculateOvertime(totalHours, ctx.overtimeRule);
          regularHours = split.regularHours;
          overtimeHours = split.overtimeHours;
        }
      }
    }

    if (row.iqama && worker && !ctx.assignedIqamas.has(row.iqama)) {
      errors.push("Worker is not assigned to the selected site.");
    }

    if (row.date && worker) {
      const dbKey = `${worker.id}:${row.date.toISOString().slice(0, 10)}`;
      if (ctx.existingKeys.has(dbKey)) {
        errors.push("Duplicate attendance: an entry for this worker and date already exists.");
      }
    }

    if (errors.length > 0 || !worker || !row.date || !row.loginTime || !row.logoutTime) {
      return { rowNumber: row.rowNumber, valid: false, iqamaNumber: row.iqama, errors };
    }

    return {
      rowNumber: row.rowNumber,
      valid: true,
      workerId: worker.id,
      workerName: worker.fullName,
      iqamaNumber: row.iqama!,
      date: row.date,
      loginTime: row.loginTime,
      logoutTime: row.logoutTime,
      breakMinutes: row.breakMinutes,
      regularHours: regularHours.toFixed(2),
      overtimeHours: overtimeHours.toFixed(2),
      totalHours: totalHours.toFixed(2),
    };
  });
}

export type TimesheetImportSummary = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errorReport: { rowNumber: number; iqamaNumber: string | null; errors: string[] }[];
};

/** Preview summary (§7: total/valid/invalid rows + a reviewable error list). */
export function summarizeTimesheetImport(results: TimesheetImportRowResult[]): TimesheetImportSummary {
  const invalid = results.filter((r): r is InvalidTimesheetImportRow => !r.valid);
  return {
    totalRows: results.length,
    validRows: results.length - invalid.length,
    invalidRows: invalid.length,
    errorReport: invalid.map((r) => ({ rowNumber: r.rowNumber, iqamaNumber: r.iqamaNumber, errors: r.errors })),
  };
}
