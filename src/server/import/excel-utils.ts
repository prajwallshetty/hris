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
