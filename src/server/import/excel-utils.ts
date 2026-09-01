import * as XLSX from "xlsx";

/**
 * Reads raw rows (arrays of cell values) from the first worksheet of an
 * Excel file, starting at `headerRowIndex` (0-based row to treat as the
 * header — its own row is included as `rows[0]` for callers that want to
 * inspect/validate column headers before mapping by index).
 */
export function readWorksheetRows(buffer: Buffer, headerRowIndex: number): unknown[][] {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    range: headerRowIndex,
    defval: null,
  });
}

/**
 * Converts an Excel date cell to a UTC-safe Date, handling both real Excel
 * date serials and free-text "DD/MM/YYYY" strings (this workbook's source
 * data mixes both — see DEMO IN.xlsx). Using cellDates:true instead would
 * shift the calendar day whenever the machine's local timezone isn't UTC.
 */
export function parseExcelDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  }
  if (typeof value === "string") {
    const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) {
      const [, dd, mm, yyyy] = match;
      return new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
    }
  }
  return null;
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
