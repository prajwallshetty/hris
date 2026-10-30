import {
  IMPORT_STATUS_HINT,
  parseAttendanceStatusText,
  type LeaveCategory,
  type WorkerAttendanceStatusValue,
} from "@/lib/attendance";
import { computeAttendanceDay, type OvertimeRuleConfig } from "@/server/calc";

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
  status: ["STATUS", "ATTENDANCE", "ATTENDANCE STATUS", "LEAVE"],
  remarks: ["REMARKS", "REMARK", "NOTES", "NOTE", "COMMENTS"],
} as const;

type ColumnKey = keyof typeof COLUMN_ALIASES;
// Only Iqama and Date are required to place a row. Login/Logout columns are
// still expected for worked days, but leave/off days legitimately leave them
// blank; a sheet without a Status column is read as all Present (as before).
const OPTIONAL_COLUMNS: ColumnKey[] = ["name", "breakMinutes", "status", "remarks"];

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
  statusText: string | null;
  remarks: string | null;
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

    const statusText = columns.status >= 0 ? cleanString(row[columns.status]) : null;
    const remarks = columns.remarks >= 0 ? cleanString(row[columns.remarks]) : null;

    rows.push({
      rowNumber: DATA_START_ROW_INDEX + index + 1,
      iqama,
      name,
      date,
      loginTime,
      logoutTime,
      breakMinutes,
      statusText,
      remarks,
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
  attendanceStatus: WorkerAttendanceStatusValue;
  halfDayLeave: LeaveCategory | null;
  loginTime: Date | null;
  logoutTime: Date | null;
  breakMinutes: number;
  regularHours: string;
  overtimeHours: string;
  totalHours: string;
  leaveHours: string;
  remarks: string | null;
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

    const parsedStatus = row.statusText ? parseAttendanceStatusText(row.statusText) : { status: "PRESENT" as const, halfDayLeave: null };
    if (!parsedStatus) errors.push(`Unknown status "${row.statusText}". Use ${IMPORT_STATUS_HINT}.`);

    const day = parsedStatus
      ? computeAttendanceDay(
          {
            status: parsedStatus.status,
            loginTime: row.loginTime,
            logoutTime: row.logoutTime,
            breakMinutes: row.breakMinutes,
            halfDayLeave: parsedStatus.halfDayLeave,
          },
          { ...ctx.overtimeRule, maxReasonableHours: maxHours },
        )
      : null;
    if (day && !day.ok) errors.push(...day.errors);

    if (row.iqama && worker && !ctx.assignedIqamas.has(row.iqama)) {
      errors.push("Worker is not assigned to the selected site.");
    }

    if (row.date && worker) {
      const dbKey = `${worker.id}:${row.date.toISOString().slice(0, 10)}`;
      if (ctx.existingKeys.has(dbKey)) {
        errors.push("Duplicate attendance: an entry for this worker and date already exists.");
      }
    }

    if (errors.length > 0 || !worker || !row.date || !parsedStatus || !day?.ok) {
      return { rowNumber: row.rowNumber, valid: false, iqamaNumber: row.iqama, errors };
    }

    const v = day.values;
    return {
      rowNumber: row.rowNumber,
      valid: true,
      workerId: worker.id,
      workerName: worker.fullName,
      iqamaNumber: row.iqama!,
      date: row.date,
      attendanceStatus: v.attendanceStatus,
      halfDayLeave: parsedStatus.halfDayLeave,
      loginTime: v.loginTime,
      logoutTime: v.logoutTime,
      breakMinutes: v.breakMinutes,
      regularHours: v.regularHours.toFixed(2),
      overtimeHours: v.overtimeHours.toFixed(2),
      totalHours: v.totalHours.toFixed(2),
      leaveHours: v.sickLeaveHours.plus(v.annualLeaveHours).plus(v.unpaidLeaveHours).plus(v.otherLeaveHours).toFixed(2),
      remarks: row.remarks,
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
