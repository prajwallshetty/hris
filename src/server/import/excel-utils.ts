import * as XLSX from "xlsx";

/**
 * Reads raw rows (arrays of cell values) from the first worksheet of an
 * Excel file, starting at `headerRowIndex` (0-based row to treat as the
 * header — its own row is included as `rows[0]` for callers that want to
 * inspect/validate column headers before mapping by index).
 */
export function readWorksheetRows(
  buffer: Buffer,
  headerRowIndex: number,
  options: { rawText?: boolean } = {},
): unknown[][] {
  // rawText: for CSV input, keep cell text exactly as typed. Without it
  // SheetJS auto-parses "01/09/2026" as a US-style date (9 January) before
  // our own DD/MM/YYYY parser ever sees it. No effect on .xlsx cells.
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false, raw: options.rawText ?? false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    range: headerRowIndex,
    defval: null,
  });
}

// Excel stores a date as the number of days since 1899-12-30. Real worker
// mobilization dates fall in 2000–2100 (serials ~36526–73415); anything
// outside that is far more likely a stray number than a date, so it is
// rejected rather than silently turned into a 1900s or 2200s date.
const MIN_SERIAL = 36526; // 2000-01-01
const MAX_SERIAL = 73415; // 2100-12-31

function fromSerial(serial: number): Date | null {
  if (!Number.isFinite(serial) || serial < MIN_SERIAL || serial > MAX_SERIAL) return null;
  const parsed = XLSX.SSF.parse_date_code(serial);
  if (!parsed) return null;
  return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
}

function fromParts(y: string, m: string, d: string): Date | null {
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  // Reject impossible dates like 31/02/2026 instead of letting JS roll
  // them over into March.
  return date.getUTCMonth() === Number(m) - 1 && date.getUTCDate() === Number(d) ? date : null;
}

/**
 * Converts an Excel date cell to a UTC-safe Date. Accepts:
 *  - a real Excel serial number (46031) — numeric, or numeric text, which is
 *    what a bulk-import row holds once the cell has been read as text;
 *  - DD/MM/YYYY (also with - or . separators);
 *  - YYYY-MM-DD (also with / separators).
 * Slash dates are always day-first, never US month-first. Using cellDates:true
 * instead would shift the calendar day whenever the machine's local timezone
 * isn't UTC.
 */
export function parseExcelDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return fromSerial(value);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{5}(\.\d+)?$/.test(trimmed)) return fromSerial(Math.floor(Number(trimmed)));
    const dmy = trimmed.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    if (dmy) return fromParts(dmy[3], dmy[2], dmy[1]);
    const ymd = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
    if (ymd) return fromParts(ymd[1], ymd[2], ymd[3]);
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

export function cleanString(value: unknown): string | null {
  if (typeof value === "number") return String(value);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
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
