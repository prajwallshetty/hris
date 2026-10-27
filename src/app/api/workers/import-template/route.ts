import type { NextRequest } from "next/server";
import * as XLSX from "xlsx";

import { toCsv } from "@/lib/csv";
import { WORKER_IMPORT_COLUMNS } from "@/server/import/worker-bulk-import";
import { assertCan } from "@/server/rbac";
import { getSessionUser } from "@/server/session";

// Generated from WORKER_IMPORT_COLUMNS — the same list the importer detects
// and validates against — so a downloaded template always round-trips.
// /api routes are outside proxy.ts's matcher, so this handler enforces its
// own auth/RBAC.
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    assertCan(user, "create", "worker");
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  const headers = WORKER_IMPORT_COLUMNS.map((c) => c.header);
  const exampleRow = WORKER_IMPORT_COLUMNS.map((c) => c.example);

  if (new URL(request.url).searchParams.get("format") === "csv") {
    return new Response(toCsv(headers, [exampleRow]), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="manpower-import-template.csv"',
      },
    });
  }

  const templateSheet = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
  templateSheet["!cols"] = WORKER_IMPORT_COLUMNS.map((c) => ({ wch: Math.max(14, c.header.length + 4) }));

  const instructionsSheet = XLSX.utils.aoa_to_sheet([
    ["Manpower Bulk Import — Instructions"],
    [],
    ["Column", "Required?", "Notes"],
    ...WORKER_IMPORT_COLUMNS.map((c) => [c.header, c.required ? "Required" : "Optional", c.note]),
    [],
    ["Columns are matched by header name, not position — you may reorder or delete optional columns, but do not rename headers."],
    ["Rows with problems are listed in the preview and never imported; fix them and upload again. Valid rows can be imported straight away."],
  ]);
  instructionsSheet["!cols"] = [{ wch: 20 }, { wch: 12 }, { wch: 100 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, templateSheet, "Template");
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, "Instructions");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="manpower-import-template.xlsx"',
    },
  });
}
