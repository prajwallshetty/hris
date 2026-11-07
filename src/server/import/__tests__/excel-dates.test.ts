import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

import {
  cleanString,
  excelSerialToDate,
  normalizeCellText,
  parseExcelDate,
  readWorksheet,
  readWorksheetRows,
} from "../excel-utils";
import { detectWorkerBulkColumns, extractWorkerBulkRows } from "../worker-bulk-import";

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

// The serials reported failing in production, and the dates they stand for.
const REPORTED: [number, string][] = [
  [46145, "2026-05-03"],
  [46299, "2026-10-04"],
  [46240, "2026-08-06"],
];

describe("Excel serial → date (1900 system)", () => {
  it.each(REPORTED)("serial %i is %s", (serial, expected) => {
    expect(iso(excelSerialToDate(serial))).toBe(expected);
  });

  it("matches Excel at well-known anchors, across the 1900 leap-year bug", () => {
    expect(iso(excelSerialToDate(36526))).toBe("2000-01-01");
    expect(iso(excelSerialToDate(45658))).toBe("2025-01-01");
    expect(iso(excelSerialToDate(46023))).toBe("2026-01-01");
    expect(iso(excelSerialToDate(73415))).toBe("2100-12-31");
    expect(excelSerialToDate(60)).toBeNull(); // Excel's phantom 1900-02-29
  });

  it("ignores the time-of-day fraction instead of rolling the day", () => {
    expect(iso(excelSerialToDate(46145.0))).toBe("2026-05-03");
    expect(iso(excelSerialToDate(46145.999))).toBe("2026-05-03");
    expect(iso(excelSerialToDate(46145.5))).toBe("2026-05-03");
  });

  it("rejects numbers that are not plausible dates", () => {
    for (const bad of [0, -5, 12345, 99999, 1e9, NaN, Infinity]) expect(excelSerialToDate(bad), String(bad)).toBeNull();
  });
});

describe("Excel serial → date (1904 system)", () => {
  it("the same calendar day has a serial 1,462 lower", () => {
    for (const [serial, expected] of REPORTED) expect(iso(excelSerialToDate(serial - 1462, true))).toBe(expected);
  });
  it("is not applied unless asked for", () => {
    expect(iso(parseExcelDate(46145 - 1462))).not.toBe("2026-05-03");
    expect(iso(parseExcelDate(46145 - 1462, { date1904: true }))).toBe("2026-05-03");
    expect(iso(parseExcelDate(String(46145 - 1462), { date1904: true }))).toBe("2026-05-03");
  });
});

describe("parseExcelDate — every representation of the reported serials", () => {
  const forms = (n: number): [string, unknown][] => [
    ["numeric cell", n],
    ["numeric cell with a time fraction", n + 0.25],
    ["text", String(n)],
    ["text, padded", `  ${n}  `],
    ["text, non-breaking spaces", ` ${n} `],
    ["text, zero-width space inside", `46​${String(n).slice(2)}`],
    ["text, left-to-right mark", `‎${n}‎`],
    ["text, right-to-left mark", `‏${n}`],
    ["text, byte-order mark", `﻿${n}`],
    ["text with .0", `${n}.0`],
    ["text with comma decimal", `${n},0`],
    ["text with thousands separator", `${String(n).slice(0, 2)},${String(n).slice(2)}`],
    ["Arabic-Indic digits", String(n).replace(/\d/g, (d) => String.fromCharCode(0x0660 + Number(d)))],
    ["Persian digits", String(n).replace(/\d/g, (d) => String.fromCharCode(0x06f0 + Number(d)))],
    ["full-width digits", String(n).replace(/\d/g, (d) => String.fromCharCode(0xff10 + Number(d)))],
  ];
  for (const [serial, expected] of REPORTED) {
    it.each(forms(serial))(`${serial}: %s → ${expected}`, (_label, value) => {
      expect(iso(parseExcelDate(value))).toBe(expected);
    });
  }
});

describe("parseExcelDate — written dates", () => {
  it.each([
    ["03/05/2026", "2026-05-03"],
    ["3/5/2026", "2026-05-03"],
    ["03-05-2026", "2026-05-03"],
    ["03.05.2026", "2026-05-03"],
    [" 03 / 05 / 2026 ", "2026-05-03"],
    ["2026-05-03", "2026-05-03"],
    ["2026/05/03", "2026-05-03"],
    ["04/10/2026", "2026-10-04"], // day-first: 4 October, never 10 April
    ["03-May-2026", "2026-05-03"],
    ["3 May 2026", "2026-05-03"],
    ["3 sept 2026", "2026-09-03"],
    ["٠٣/٠٥/٢٠٢٦", "2026-05-03"],
  ])("%s → %s", (text, expected) => {
    expect(iso(parseExcelDate(text))).toBe(expected);
  });

  it.each(["31/02/2026", "13/13/2026", "2026-02-30", "32/01/2026", "soon", "", "12345", "2026", "46145x", "05/2026"])(
    "rejects %j",
    (text) => {
      expect(parseExcelDate(text)).toBeNull();
    },
  );
});

describe("parseExcelDate — JavaScript Date inputs are never re-shifted", () => {
  it("uses the calendar day a UTC-midnight Date already holds", () => {
    expect(iso(parseExcelDate(new Date(Date.UTC(2026, 4, 3))))).toBe("2026-05-03");
  });
  it("uses the local calendar day of a local-midnight Date (what SheetJS' sheet_to_json hands back)", () => {
    expect(iso(parseExcelDate(new Date(2026, 4, 3)))).toBe("2026-05-03");
    expect(iso(parseExcelDate(new Date(2026, 9, 4, 0, 0, 0)))).toBe("2026-10-04");
  });
  it("rejects an invalid Date", () => {
    expect(parseExcelDate(new Date("nope"))).toBeNull();
  });
});

describe("text helpers", () => {
  it("normalizeCellText folds digits and hidden characters", () => {
    expect(normalizeCellText("‏٤٦١٤٥ ")).toBe("46145");
  });
  it("cleanString keeps a name intact but tidies invisible marks and Arabic digits", () => {
    expect(cleanString("  ‎Mohammed  Ali‏ ")).toBe("Mohammed  Ali");
    expect(cleanString("٢٥٨٩٥٤٤٣٦٦")).toBe("2589544366");
    expect(cleanString("Nesamony ‍ Thomas")).toBe("Nesamony ‍ Thomas"); // joiners are left alone
    expect(cleanString(46145)).toBe("46145");
    expect(cleanString(null)).toBeNull();
    expect(cleanString("   ")).toBeNull();
  });
});

// ── Real .xlsx files, built in every shape Excel produces ───────────────────

type Shape = "General number" | "date-formatted number" | "ISO-formatted number" | "text cell" | "time-formatted fraction";

function workbook(shape: Shape, opts: { date1904?: boolean; offset?: number } = {}): Buffer {
  const offset = opts.offset ?? 0;
  const ws = XLSX.utils.aoa_to_sheet([
    ["Full Name", "Nationality", "Mobile", "Mobilization", "Worker Type"],
    ...REPORTED.map(([serial], i) => [`Worker ${i + 1}`, "India", `05510000${i}`, serial - offset, "FRL"]),
  ]);
  for (let r = 2; r <= 4; r++) {
    const cell = ws[`D${r}`];
    if (shape === "date-formatted number") cell.z = "dd/mm/yyyy";
    if (shape === "ISO-formatted number") cell.z = "yyyy-mm-dd";
    if (shape === "text cell") {
      cell.t = "s";
      cell.v = String(cell.v);
    }
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Workers");
  if (opts.date1904) (wb as XLSX.WorkBook).Workbook = { WBProps: { date1904: true } } as XLSX.WorkBook["Workbook"];
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

function mobilizations(buffer: Buffer) {
  const { columns, missing } = detectWorkerBulkColumns(buffer);
  expect(missing).toEqual([]);
  return extractWorkerBulkRows(buffer, columns).map((r) => r.mobilization);
}

describe("reading real workbooks (the whole path up to the preview)", () => {
  it.each(["General number", "date-formatted number", "ISO-formatted number", "text cell"] as Shape[])(
    "%s: 46145, 46299, 46240 → 2026-05-03, 2026-10-04, 2026-08-06",
    (shape) => {
      expect(mobilizations(workbook(shape))).toEqual(["2026-05-03", "2026-10-04", "2026-08-06"]);
    },
  );

  it("1904-date-system workbook: the stored serials (1,462 lower) convert to the same days", () => {
    expect(mobilizations(workbook("date-formatted number", { date1904: true, offset: 1462 }))).toEqual([
      "2026-05-03",
      "2026-10-04",
      "2026-08-06",
    ]);
  });

  it("detects the 1904 flag, and its absence", () => {
    expect(readWorksheet(workbook("General number", { date1904: true, offset: 1462 }), 0).date1904).toBe(true);
    expect(readWorksheet(workbook("General number"), 0).date1904).toBe(false);
  });

  it("never hands back a Date object, whatever the cell format — dates and times stay serial numbers", () => {
    for (const shape of ["General number", "date-formatted number", "ISO-formatted number"] as Shape[]) {
      const rows = readWorksheetRows(workbook(shape), 0, { rawText: true });
      for (const row of rows.slice(1)) {
        expect(row[3]).not.toBeInstanceOf(Date);
        expect(typeof row[3]).toBe("number");
      }
    }
    const ws = XLSX.utils.aoa_to_sheet([["Time"], [0.3333333333]]);
    ws["A2"].z = "h:mm";
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "T");
    const rows = readWorksheetRows(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer, 0);
    expect(rows[1][0]).toBeCloseTo(0.3333, 3);
  });

  it("returns blanks as null and keeps column positions", () => {
    const ws = XLSX.utils.aoa_to_sheet([["A", "B", "C"], ["x", null, "z"]]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "S");
    expect(readWorksheetRows(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer, 0)).toEqual([
      ["A", "B", "C"],
      ["x", null, "z"],
    ]);
  });

  it("reads a CSV the same way (text stays text, converted afterwards)", () => {
    const csv = "Full Name,Nationality,Mobile,Mobilization,Worker Type\nA,India,0551,46145,FRL\nB,India,0552,03/05/2026,FRL\n";
    expect(mobilizations(Buffer.from(csv))).toEqual(["2026-05-03", "2026-05-03"]);
  });
});
