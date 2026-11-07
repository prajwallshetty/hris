import * as XLSX from "xlsx";

import { importEngineInfo } from "./excel-utils";
import {
  detectWorkerBulkColumns,
  extractWorkerBulkRows,
  validateWorkerBulkRows,
  type WorkerBulkImportContext,
} from "./worker-bulk-import";

// A self-check of the bulk-import date pipeline that runs on whatever build and
// spreadsheet library is actually deployed. It writes real .xlsx files in each
// shape Excel produces (a plain number, a date-formatted number, a text cell,
// a 1904-system workbook), reads them back through the same functions the
// upload uses, and compares the result with the known calendar date.

export const SELFTEST_SERIALS: { serial: number; expected: string }[] = [
  { serial: 46145, expected: "2026-05-03" },
  { serial: 46299, expected: "2026-10-04" },
  { serial: 46240, expected: "2026-08-06" },
];

type Shape = { name: string; date1904?: boolean; format?: string; text?: boolean };
const SHAPES: Shape[] = [
  { name: "plain number cell" },
  { name: "date-formatted cell (dd/mm/yyyy)", format: "dd/mm/yyyy" },
  { name: "date-formatted cell (yyyy-mm-dd)", format: "yyyy-mm-dd" },
  { name: "text cell", text: true },
  { name: "1904 date-system workbook", format: "dd/mm/yyyy", date1904: true },
];

const EMPTY_CONTEXT: WorkerBulkImportContext = {
  existingByIqama: new Map(),
  existingNaturalKeys: new Set(),
  suppliers: [],
  clients: [],
  projects: [],
  sites: [],
  coordinators: [],
};

export type SelfTestResult = {
  engine: ReturnType<typeof importEngineInfo>;
  passed: boolean;
  checks: { shape: string; serial: number; expected: string; preview: string | null; savedAs: string | null; passed: boolean }[];
};

export function runImportParserSelfTest(): SelfTestResult {
  const checks: SelfTestResult["checks"] = [];
  for (const shape of SHAPES) {
    const stored = (serial: number) => (shape.date1904 ? serial - 1462 : serial);
    const ws = XLSX.utils.aoa_to_sheet([
      ["Full Name", "Nationality", "Mobile", "Mobilization", "Worker Type"],
      ...SELFTEST_SERIALS.map(({ serial }, i) => [`Self Test ${i + 1}`, "India", `055000000${i}`, stored(serial), "FRL"]),
    ]);
    for (let r = 2; r < 2 + SELFTEST_SERIALS.length; r++) {
      const cell = ws[`D${r}`];
      if (shape.format) cell.z = shape.format;
      if (shape.text) {
        cell.t = "s";
        cell.v = String(cell.v);
      }
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Workers");
    if (shape.date1904) (wb as XLSX.WorkBook).Workbook = { WBProps: { date1904: true } } as XLSX.WorkBook["Workbook"];
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    const { columns } = detectWorkerBulkColumns(buffer);
    const rows = extractWorkerBulkRows(buffer, columns);
    const results = validateWorkerBulkRows(rows, EMPTY_CONTEXT);
    SELFTEST_SERIALS.forEach(({ serial, expected }, i) => {
      const result = results[i];
      const savedAs = result?.valid ? result.data.mobilizationDate : null;
      const preview = rows[i]?.mobilization ?? null;
      checks.push({ shape: shape.name, serial, expected, preview, savedAs, passed: preview === expected && savedAs === expected });
    });
  }
  return { engine: importEngineInfo(), passed: checks.every((c) => c.passed), checks };
}
