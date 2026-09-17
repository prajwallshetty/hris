import * as XLSX from "xlsx";

import { assertCan } from "@/server/rbac";
import { getSessionUser } from "@/server/session";

// Note: /api routes are outside proxy.ts's matcher, so this handler enforces
// its own auth/RBAC — never assume the proxy already gated it. Header text
// here must exactly match the primary alias each column is detected by in
// worker-import.ts's COLUMN_ALIASES, so a template downloaded from here
// always round-trips cleanly through the importer (the whole point of
// generating it from the app's own schema instead of a hand-maintained file).
export async function GET() {
  let user;
  try {
    user = await getSessionUser();
    assertCan(user, "create", "worker");
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  const headers = [
    "Name",
    "Iqama Number",
    "Mobile",
    "Designation",
    "Worker Type",
    "Joining Date",
    "Status",
    "Batch Number",
    "Remarks",
  ];
  const exampleRow = [
    "Mohammed Ahmed",
    "1234567890",
    "0501234567",
    "Scaffolder",
    "Skilled",
    "01/09/2026",
    "AVAILABLE",
    "",
    "",
  ];

  const templateSheet = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
  templateSheet["!cols"] = [
    { wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 24 },
  ];

  const instructionsSheet = XLSX.utils.aoa_to_sheet([
    ["Worker Bulk Import — Instructions"],
    [],
    ["Column", "Required?", "Notes"],
    ["Name", "Required", "Worker's full name."],
    ["Iqama Number", "Required", "Exactly 10 digits. Must be unique — a row with an Iqama already registered to another worker will be reported, never imported over the existing worker."],
    ["Mobile", "Optional", "Any format."],
    ["Designation", "Optional", "Job title, e.g. Scaffolder."],
    ["Worker Type", "Optional", "Skill / category, e.g. Skilled, Unskilled."],
    ["Joining Date", "Optional", "Format: DD/MM/YYYY."],
    ["Status", "Optional", "One of: ACTIVE, AVAILABLE, ON_LEAVE, SUSPENDED, DEMOBILIZED, RESIGNED, TERMINATED. Defaults to AVAILABLE if left blank."],
    ["Batch Number", "Optional", "Free-text grouping label, e.g. BATCH-001, JUL-2026, SITE-RIYADH-01. Leave blank if not needed."],
    ["Remarks", "Optional", "Any free-text note."],
    [],
    ["Do not rename the header row — columns are matched by name, not position, so you may reorder them but not rename them."],
  ]);
  instructionsSheet["!cols"] = [{ wch: 16 }, { wch: 12 }, { wch: 70 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, templateSheet, "Template");
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, "Instructions");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="worker-import-template.xlsx"',
    },
  });
}
