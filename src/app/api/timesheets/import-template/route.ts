import * as XLSX from "xlsx";

import { IMPORT_STATUS_HINT } from "@/lib/attendance";

import { assertCan } from "@/server/rbac";
import { getSessionUser } from "@/server/session";

// Note: /api routes are outside proxy.ts's matcher, so this handler enforces
// its own auth/RBAC. Header text here must exactly match the primary alias
// each column is detected by in timesheet-import.ts's COLUMN_ALIASES, so a
// template downloaded from here always round-trips cleanly through the
// importer.
export async function GET() {
  let user;
  try {
    user = await getSessionUser();
    assertCan(user, "create", "timesheet");
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  const headers = ["Iqama", "Name", "Date", "Login", "Logout", "Break", "Status", "Remarks"];
  const exampleRows = [
    ["1234567890", "Mohammed Ahmed", "01/09/2026", "08:00", "17:00", "60", "P", ""],
    ["1234567890", "Mohammed Ahmed", "02/09/2026", "", "", "", "SL", "Medical certificate"],
    ["1234567890", "Mohammed Ahmed", "03/09/2026", "22:00", "06:00", "30", "P", "Night shift"],
  ];

  const templateSheet = XLSX.utils.aoa_to_sheet([headers, ...exampleRows]);
  templateSheet["!cols"] = [{ wch: 16 }, { wch: 22 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 28 }];

  const instructionsSheet = XLSX.utils.aoa_to_sheet([
    ["LOG / Timesheet Bulk Import — Instructions"],
    [],
    ["Column", "Required?", "Notes"],
    ["Iqama", "Required", "Exactly 10 digits — this is the primary key used to match the row to a worker. Must belong to a worker already in the system."],
    ["Name", "Optional", "For your reference only — matching always uses Iqama, never the name."],
    ["Date", "Required", "Format: DD/MM/YYYY. One row per worker per day."],
    ["Login", "Worked days", "Check-in time, e.g. 08:00 or 08:00 AM. Leave blank on leave, absent and off days."],
    ["Logout", "Worked days", "Check-out time, e.g. 17:00 or 05:00 PM. A time earlier than Login is read as an overnight shift ending the next day."],
    ["Break", "Optional", "Unpaid break, in minutes. Defaults to 0 if left blank. Recorded separately — never as leave."],
    ["Status", "Optional", `Attendance for the day: ${IMPORT_STATUS_HINT}. Blank means Present. Half Day needs Login/Logout for the worked half.`],
    ["Remarks", "Optional", "Free-text note shown on the timesheet."],
    [],
    ["Leave is stored in its own category (sick / annual / unpaid) and is never subtracted from, or added to, worked hours."],
    ["Regular vs overtime hours are calculated automatically from Login/Logout using the active overtime rule — do not enter them directly."],
    ["Do not rename the header row — columns are matched by name, not position, so you may reorder them but not rename them."],
  ]);
  instructionsSheet["!cols"] = [{ wch: 12 }, { wch: 12 }, { wch: 80 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, templateSheet, "Template");
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, "Instructions");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="timesheet-import-template.xlsx"',
    },
  });
}
