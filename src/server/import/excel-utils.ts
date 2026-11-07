import * as XLSX from "xlsx";

/** Which build and spreadsheet library parsed an upload — shown in the preview so a stale deployment is obvious. */
export function importEngineInfo(): { commit: string; xlsx: string; deployment: string } {
  return {
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    xlsx: XLSX.version,
    deployment: process.env.VERCEL_ENV ?? "local",
  };
}

export type WorksheetData = {
  rows: unknown[][];
  /** True when the workbook uses Excel's 1904 date system (serials are 1,462 days smaller). */
  date1904: boolean;
};

/**
 * Reads the first worksheet cell by cell and returns each cell's *stored*
 * value: numbers stay numbers (including every date and time, as Excel
 * serials), text stays text, blanks are null. The date system flag comes back
 * alongside so serials can be converted correctly.
 *
 * This deliberately does NOT use XLSX.utils.sheet_to_json. As of SheetJS
 * 0.20, sheet_to_json itself turns any numeric cell that carries a date or
 * time number format into a JavaScript Date — shifted by the server's
 * timezone offset, and ignoring the workbook's 1904 flag — so the very same
 * file read as a plain number on one SheetJS version arrives as a Date on
 * another. Reading the stored cell removes that dependence: the value we get
 * is always the serial number Excel saved.
 */
export function readWorksheet(
  buffer: Buffer,
  headerRowIndex: number,
  options: { rawText?: boolean } = {},
): WorksheetData {
  // rawText: for CSV input, keep cell text exactly as typed. Without it
  // SheetJS auto-parses "01/09/2026" as a US-style date (9 January) before
  // our own DD/MM/YYYY parser ever sees it. No effect on .xlsx cells.
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false, raw: options.rawText ?? false });
  const date1904 = isTruthyFlag((workbook.Workbook as { WBProps?: { date1904?: unknown } } | undefined)?.WBProps?.date1904);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet || !sheet["!ref"]) return { rows: [], date1904 };

  const range = XLSX.utils.decode_range(sheet["!ref"]);
  const dense = (sheet as { "!data"?: (XLSX.CellObject | undefined)[][] })["!data"];
  const rows: unknown[][] = [];
  for (let r = range.s.r + headerRowIndex; r <= range.e.r; r++) {
    const row: unknown[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = dense ? dense[r]?.[c] : sheet[XLSX.utils.encode_cell({ r, c })];
      row.push(storedValue(cell));
    }
    rows.push(row);
  }
  return { rows, date1904 };
}

/** Same rows as {@link readWorksheet}, for callers that don't need the date system. */
export function readWorksheetRows(
  buffer: Buffer,
  headerRowIndex: number,
  options: { rawText?: boolean } = {},
): unknown[][] {
  return readWorksheet(buffer, headerRowIndex, options).rows;
}

function isTruthyFlag(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}

/** The value Excel stored in a cell: number | string | boolean | null — never a Date. */
function storedValue(cell: XLSX.CellObject | undefined): unknown {
  if (!cell || cell.v === undefined || cell.v === null) return null;
  switch (cell.t) {
    case "n":
    case "s":
    case "b":
      return cell.v;
    case "d":
      // Only present if a file stores an ISO date literal; keep it as an ISO date string.
      return cell.v instanceof Date ? isoFromDateObject(cell.v) : String(cell.v);
    default:
      return null; // errors (#N/A…), stubs
  }
}

// Excel stores a date as a day count. Plausible worker/attendance dates fall in
// 2000–2100; a number or text outside that is far more likely a stray value
// than a date, so it is rejected rather than turned into a 1900s or 2200s date.
const MIN_YEAR = 2000;
const MAX_YEAR = 2100;
const DAY_MS = 86_400_000;
const EPOCH_1900 = Date.UTC(1899, 11, 30); // serial 0 in the 1900 system (for serials > 60)
const EPOCH_1904 = Date.UTC(1904, 0, 1); //   serial 0 in the 1904 system

function inRange(date: Date): Date | null {
  const year = date.getUTCFullYear();
  return year >= MIN_YEAR && year <= MAX_YEAR ? date : null;
}

/**
 * Excel serial → UTC calendar date, by plain integer arithmetic (no timezone,
 * no library). 1900 system: serial 1 = 1900-01-01, but Excel counts a
 * non-existent 1900-02-29 as serial 60, so serials above 60 are days since
 * 1899-12-30. 1904 system: days since 1904-01-01. The fractional part (time
 * of day) is ignored.
 */
export function excelSerialToDate(serial: number, date1904 = false): Date | null {
  if (!Number.isFinite(serial) || serial < 1) return null;
  const days = Math.floor(serial);
  if (date1904) return inRange(new Date(EPOCH_1904 + days * DAY_MS));
  if (days === 60) return null; // the phantom 1900-02-29
  return inRange(new Date(EPOCH_1900 + (days > 60 ? days : days + 1) * DAY_MS));
}

function fromParts(y: string, m: string, d: string): Date | null {
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  // Reject impossible dates like 31/02/2026 instead of letting JS roll
  // them over into March.
  return date.getUTCMonth() === Number(m) - 1 && date.getUTCDate() === Number(d) ? inRange(date) : null;
}

/** A Date that already holds the intended calendar day: use its UTC day when it sits at UTC midnight, else its local day. */
function isoFromDateObject(date: Date): string {
  const atUtcMidnight = date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0;
  const [y, m, d] = atUtcMidnight
    ? [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()]
    : [date.getFullYear(), date.getMonth() + 1, date.getDate()];
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11,
  dec: 12, december: 12,
};

/**
 * Text as typed in a cell → plain ASCII: Arabic-Indic (٠-٩) and Persian (۰-۹)
 * digits become 0-9, and invisible characters spreadsheet exports commonly add
 * (zero-width spaces, left/right-to-left marks, BOM) are removed — a value
 * like "46145" with a hidden mark in it otherwise looks right and fails.
 */
export function normalizeCellText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u0660-\u0669]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (c) => String(c.charCodeAt(0) - 0x06f0))
    .replace(/[\u200b-\u200f\u202a-\u202e\u2060\ufeff]/g, "")
    .replace(/\u00a0/g, " ")
    .trim();
}

/**
 * Converts one date cell to a UTC-midnight Date, or null when it isn't a
 * recognisable date. The checks run in this order, so a serial is never
 * mistaken for text and text is never mistaken for a serial:
 *  1. a JavaScript Date — used as the calendar day it already represents
 *     (never re-shifted by timezone);
 *  2. a number — an Excel serial, in the workbook's date system;
 *  3. numeric text ("46145", "46145.0", "46,145") — the same serial;
 *  4. DD/MM/YYYY (also - or . separators) — always day-first, never US order;
 *  5. YYYY-MM-DD (also /);
 *  6. day + month name ("03-May-2026", "3 May 2026").
 */
export function parseExcelDate(value: unknown, options: { date1904?: boolean } = {}): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date1904 = options.date1904 ?? false;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const [y, m, d] = isoFromDateObject(value).split("-");
    return fromParts(y, m, d);
  }
  if (typeof value === "number") return excelSerialToDate(value, date1904);
  if (typeof value !== "string") return null;

  const text = normalizeCellText(value);
  if (/^\d{4,6}([.,]\d+)?$/.test(text) && !/^\d{4}$/.test(text)) return excelSerialToDate(Number(text.replace(",", ".")), date1904);
  if (/^\d{1,3}([,\u066c ]\d{3})+$/.test(text)) return excelSerialToDate(Number(text.replace(/[,\u066c ]/g, "")), date1904);

  const dmy = text.match(/^(\d{1,2})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{4})$/);
  if (dmy) return fromParts(dmy[3], dmy[2], dmy[1]);
  const ymd = text.match(/^(\d{4})\s*[/-]\s*(\d{1,2})\s*[/-]\s*(\d{1,2})$/);
  if (ymd) return fromParts(ymd[1], ymd[2], ymd[3]);
  const named = text.match(/^(\d{1,2})[\s/.-]+([A-Za-z]{3,9})\.?[\s/.-]+(\d{4})$/);
  if (named) {
    const month = MONTHS[named[2].toLowerCase()];
    if (month) return fromParts(named[3], String(month), named[1]);
  }
  return null;
}

/**
 * Canonical form of a client/project/site/supplier name for matching: Unicode
 * compatibility-normalized (so non-breaking spaces, full-width characters
 * etc. fold to plain ones), whitespace runs collapsed to one space, trimmed,
 * lower-cased. Two names that differ only in spacing or letter case are the
 * same name. Used on BOTH sides of a match, so stored names need no cleanup.
 */
export function normalizeName(value: string | null | undefined): string {
  return (value ?? "").normalize("NFKC").replace(/[\s\u200b-\u200d\ufeff]+/g, " ").trim().toLowerCase();
}

/**
 * A cell as clean text: trimmed, with the invisible marks exports add (zero-
 * width space, left/right-to-left marks, BOM) removed and Arabic-Indic digits
 * written as 0-9, so an Iqama or mobile typed in Arabic digits still matches.
 * Deliberately lighter than {@link normalizeCellText}: a person's name is
 * never Unicode-folded or stripped of joiner characters.
 */
export function cleanString(value: unknown): string | null {
  if (typeof value === "number") return String(value);
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : isoFromDateObject(value);
  if (typeof value !== "string") return null;
  const trimmed = value
    .replace(/[\u200b\u200e\u200f\u202a-\u202e\u2060\ufeff]/g, "")
    .replace(/[\u0660-\u0669]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (c) => String(c.charCodeAt(0) - 0x06f0))
    .replace(/\u00a0/g, " ")
    .trim();
  return trimmed.length ? trimmed : null;
}

/**
 * Finds a column by trying each alias against a header row, case- and
 * whitespace-insensitively. Returns -1 if none match, so callers can report
 * "missing required column" instead of silently misreading data.
 */
export function findColumnIndex(headerRow: unknown[], aliases: string[]): number {
  const normalizedAliases = aliases.map((a) => a.trim().toLowerCase());
  return headerRow.findIndex((cell) => {
    if (typeof cell !== "string") return false;
    return normalizedAliases.includes(cell.trim().toLowerCase());
  });
}

/**
 * Combines a time-of-day cell (from a LOGIN/LOGOUT-style column) with a
 * separately-parsed date to produce a UTC-safe DateTime. Two cell shapes are
 * supported: a pure time fraction (Excel serial < 1, or a "HH:MM[:SS] [AM|PM]"
 * string) is applied to `fallbackDate`; a full datetime serial (>= 1) is
 * trusted as-is, including its own date component — this is what lets an
 * overnight shift (logout past midnight) be entered correctly instead of
 * being silently collapsed onto the login date.
 */
export function combineDateAndTime(timeCell: unknown, fallbackDate: Date | null): Date | null {
  if (timeCell === null || timeCell === undefined || timeCell === "") return null;

  if (typeof timeCell === "number") {
    const parsed = XLSX.SSF.parse_date_code(timeCell);
    if (!parsed) return null;
    if (timeCell >= 1) {
      return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d, parsed.H, parsed.M, Math.round(parsed.S)));
    }
    if (!fallbackDate) return null;
    return new Date(
      Date.UTC(
        fallbackDate.getUTCFullYear(),
        fallbackDate.getUTCMonth(),
        fallbackDate.getUTCDate(),
        parsed.H,
        parsed.M,
        Math.round(parsed.S),
      ),
    );
  }

  if (typeof timeCell === "string" && fallbackDate) {
    const match = timeCell.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM|am|pm)?$/);
    if (!match) return null;
    let hours = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = Number(match[3] ?? 0);
    const meridiem = match[4]?.toUpperCase();
    if (meridiem === "PM" && hours < 12) hours += 12;
    if (meridiem === "AM" && hours === 12) hours = 0;
    if (hours > 23 || minutes > 59 || seconds > 59) return null;
    return new Date(
      Date.UTC(fallbackDate.getUTCFullYear(), fallbackDate.getUTCMonth(), fallbackDate.getUTCDate(), hours, minutes, seconds),
    );
  }

  return null;
}
