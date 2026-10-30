"use server";

import { revalidatePath } from "next/cache";

import { ATTENDANCE_TONES, leaveTypeLabel } from "@/lib/attendance";
import { db } from "@/lib/db";
import { toCsv } from "@/lib/csv";
import {
  manualTimesheetItemFormSchema,
  timesheetItemDecisionSchema,
  timesheetItemUpdateSchema,
  type ManualTimesheetItemFormInput,
  type TimesheetItemDecisionInput,
  type TimesheetItemUpdateInput,
} from "@/lib/validation/timesheet";
import { actionError, ok, type ActionResult } from "@/server/action-result";
import {
  assertActiveLeaveType,
  attendanceItemData,
  buildAttendanceDayFromForm,
  findLeaveRequestConflict,
  getAttendanceRule,
} from "@/server/attendance";
import { logAudit } from "@/server/audit";
import { computeAttendanceDay } from "@/server/calc";
import {
  detectTimesheetColumns,
  extractTimesheetRows,
  summarizeTimesheetImport,
  validateTimesheetImportRows,
  type TimesheetImportSummary,
  type ValidTimesheetImportRow,
} from "@/server/import/timesheet-import";
import { assertCan } from "@/server/rbac";
import { getActiveOvertimeRule, toOvertimeRuleConfig } from "@/server/queries/settings";
import {
  findWorkersByIqamas,
  getAssignedIqamasForSite,
  getExistingTimesheetKeys,
  listTimesheetLog,
  type TimesheetLogFilters,
} from "@/server/queries/timesheets";
import { getSessionUser } from "@/server/session";

function formatDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

// Ignores pagination so a filtered CSV export always reflects every
// matching entry, not just the current page (§14 — filtered download must
// reflect exactly what's filtered). Same worker-rate/billing-rate/billing-
// amount figures used everywhere else (assignment snapshot rates, hours ×
// clientBillingRate — the same formula buildInvoiceDraft uses), not a
// separately invented calculation.
export async function exportTimesheetLogCsv(filters: TimesheetLogFilters): Promise<ActionResult<{ csv: string }>> {
  try {
    const user = await getSessionUser();
    const { items } = await listTimesheetLog(user, { ...filters, page: 1, pageSize: 100000 });
    const hhmm = (value: Date | null) => (value ? value.toISOString().slice(11, 16) : "");
    const csv = toCsv(
      [
        "Date",
        "Worker",
        "Iqama",
        "Client",
        "Site",
        "Coordinator",
        "Attendance Status",
        "Leave Type",
        "Check-in",
        "Check-out",
        "Actual Hours",
        "Break (min)",
        "Regular Hours",
        "OT Hours",
        "Sick Leave Hours",
        "Annual Leave Hours",
        "Unpaid Leave Hours",
        "Other Leave Hours",
        "Worker Rate",
        "PU Rate",
        "Billing Amount",
        "Approval",
        "Remarks",
      ],
      items.map((item) => {
        const client = item.timesheet.site?.project.client.companyName ?? "";
        const site = item.timesheet.site?.name ?? "";
        const workerRate = item.assignment?.workerHourlyRate;
        const puRate = item.assignment?.clientBillingRate;
        const billingAmount = puRate ? Number(item.totalHours) * Number(puRate) : "";
        return [
          formatDateOnly(item.date),
          item.worker.fullName,
          item.iqamaNumber,
          client,
          site,
          item.assignment?.coordinator?.name ?? "",
          ATTENDANCE_TONES[item.attendanceStatus].label,
          leaveTypeLabel(item) ?? "",
          hhmm(item.loginTime),
          hhmm(item.logoutTime),
          Number(item.totalHours).toFixed(2),
          item.loginTime ? item.breakMinutes : "",
          Number(item.regularHours).toFixed(2),
          Number(item.overtimeHours).toFixed(2),
          Number(item.sickLeaveHours).toFixed(2),
          Number(item.annualLeaveHours).toFixed(2),
          Number(item.unpaidLeaveHours).toFixed(2),
          Number(item.otherLeaveHours).toFixed(2),
          workerRate ? Number(workerRate).toFixed(2) : "",
          puRate ? Number(puRate).toFixed(2) : "",
          typeof billingAmount === "number" ? billingAmount.toFixed(2) : "",
          item.status,
          item.remarks ?? "",
        ];
      }),
    );
    return ok({ csv });
  } catch (error) {
    return actionError(error);
  }
}

export type TimesheetImportPreview = {
  summary: TimesheetImportSummary;
  validRows: ValidTimesheetImportRow[];
};

/**
 * Step 1 of §6's Upload -> Read -> Map -> Validate -> Match Iqama -> Preview
 * flow. Nothing is persisted here — the client holds the returned valid rows
 * and re-submits them to `importTimesheetRows` to actually write them.
 */
export async function previewTimesheetImport(formData: FormData): Promise<ActionResult<TimesheetImportPreview>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "create", "timesheet");

    const file = formData.get("file");
    const siteId = String(formData.get("siteId") ?? "");
    if (!(file instanceof File) || file.size === 0) {
      return { success: false, error: "Please choose a file to upload." };
    }
    if (!siteId) {
      return { success: false, error: "Please select a site." };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { columns, missing } = detectTimesheetColumns(buffer);
    if (missing.length > 0) {
      return {
        success: false,
        error: `The file is missing required column(s): ${missing.join(", ")}. Expected: Iqama, Date, Login, Logout.`,
      };
    }

    const rawRows = extractTimesheetRows(buffer, columns);
    if (rawRows.length === 0) {
      return { success: false, error: "No data rows were found in the file." };
    }

    const iqamas = Array.from(new Set(rawRows.map((r) => r.iqama).filter((v): v is string => Boolean(v))));
    const [workersByIqama, assignedIqamas, overtimeRuleRow] = await Promise.all([
      findWorkersByIqamas(iqamas),
      getAssignedIqamasForSite(siteId),
      getActiveOvertimeRule(),
    ]);
    const workerIds = Array.from(new Set(Array.from(workersByIqama.values()).map((w) => w.id)));
    const existingKeys = await getExistingTimesheetKeys(workerIds);

    const results = validateTimesheetImportRows(rawRows, {
      workersByIqama,
      assignedIqamas,
      existingKeys,
      overtimeRule: toOvertimeRuleConfig(overtimeRuleRow),
    });

    return ok({
      summary: summarizeTimesheetImport(results),
      validRows: results.filter((r): r is ValidTimesheetImportRow => r.valid),
    });
  } catch (error) {
    return actionError(error);
  }
}

/** Step 2: persists the rows the user already previewed and confirmed. */
export async function importTimesheetRows(input: {
  siteId: string;
  period: string;
  items: ValidTimesheetImportRow[];
  fileName?: string;
  summary?: TimesheetImportSummary;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "create", "timesheet");

    if (input.items.length === 0) {
      return { success: false, error: "No valid rows to import." };
    }

    const site = await db.site.findUniqueOrThrow({ where: { id: input.siteId }, include: { project: true } });
    const assignments = await db.assignment.findMany({
      where: { siteId: input.siteId, status: "ACTIVE" },
      select: { id: true, workerId: true },
    });
    const assignmentByWorkerId = new Map(assignments.map((a) => [a.workerId, a.id]));

    // Rows come back from the browser, so the hours are rebuilt here from
    // the row's status and times rather than trusted as sent.
    const rule = await getAttendanceRule();
    const rows: { item: (typeof input.items)[number]; data: ReturnType<typeof attendanceItemData> }[] = [];
    const problems: string[] = [];
    for (const item of input.items) {
      const date = new Date(item.date);
      const day = computeAttendanceDay(
        {
          status: item.attendanceStatus,
          loginTime: item.loginTime ? new Date(item.loginTime) : null,
          logoutTime: item.logoutTime ? new Date(item.logoutTime) : null,
          breakMinutes: item.breakMinutes,
          halfDayLeave: item.halfDayLeave,
        },
        rule,
      );
      if (!day.ok) {
        problems.push(`Row ${item.rowNumber}: ${day.errors.join(" ")}`);
        continue;
      }
      const conflict = await findLeaveRequestConflict(db, item.workerId, date, item.attendanceStatus, item.halfDayLeave);
      if (conflict) {
        problems.push(`Row ${item.rowNumber}: ${conflict}`);
        continue;
      }
      rows.push({ item, data: attendanceItemData(day.values) });
    }
    if (problems.length > 0) {
      return { success: false, error: `Nothing was imported. ${problems.slice(0, 5).join(" ")}${problems.length > 5 ? ` (+${problems.length - 5} more)` : ""}` };
    }

    const timesheet = await db.$transaction(async (tx) => {
      const header = await tx.timesheet.create({
        data: {
          clientId: site.project.clientId,
          projectId: site.projectId,
          siteId: site.id,
          period: new Date(input.period),
          uploadSource: "EXCEL",
          status: "UPLOADED",
          uploadedById: user.id,
        },
      });

      await tx.timesheetItem.createMany({
        data: rows.map(({ item, data }) => ({
          timesheetId: header.id,
          workerId: item.workerId,
          assignmentId: assignmentByWorkerId.get(item.workerId) ?? null,
          iqamaNumber: item.iqamaNumber,
          date: new Date(item.date),
          ...data,
          remarks: item.remarks,
          status: "PENDING" as const,
        })),
      });

      return header;
    });

    await logAudit({
      userId: user.id,
      action: "import",
      entityType: "Timesheet",
      entityId: timesheet.id,
      newValue: { siteId: input.siteId, period: input.period, itemCount: input.items.length },
    });

    if (input.fileName && input.summary) {
      const failedRows = input.summary.invalidRows;
      await db.importRun.create({
        data: {
          module: "TIMESHEET",
          status: failedRows === 0 ? "COMPLETED" : "PARTIAL",
          fileName: input.fileName,
          totalRows: input.summary.totalRows,
          importedRows: input.items.length,
          failedRows,
          errorReport: input.summary.errorReport,
          uploadedById: user.id,
        },
      });
    }

    revalidatePath("/timesheets");
    revalidatePath("/import-history");
    return ok({ id: timesheet.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function createManualTimesheetItem(
  input: ManualTimesheetItemFormInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "create", "timesheet");
    const data = manualTimesheetItemFormSchema.parse(input);

    const [worker, site, assignment] = await Promise.all([
      db.worker.findUniqueOrThrow({ where: { id: data.workerId } }),
      db.site.findUniqueOrThrow({ where: { id: data.siteId }, include: { project: true } }),
      db.assignment.findFirst({ where: { workerId: data.workerId, siteId: data.siteId, status: "ACTIVE" } }),
    ]);
    if (!assignment) {
      return { success: false, error: "This worker does not have an active assignment at the selected site." };
    }

    const date = new Date(data.date);
    const day = buildAttendanceDayFromForm(date, data, await getAttendanceRule());
    if (!day.ok) return { success: false, error: day.errors.join(" ") };

    // One record per worker per day (also enforced by a unique index) — an
    // existing day is corrected through the audited edit, never overwritten.
    const existing = await db.timesheetItem.findUnique({ where: { workerId_date: { workerId: worker.id, date } } });
    if (existing) {
      return {
        success: false,
        error: "An attendance entry for this worker and date already exists — open it and use Edit to correct it.",
      };
    }

    const conflict =
      (await findLeaveRequestConflict(db, worker.id, date, data.attendanceStatus, data.halfDayLeave || null)) ??
      (await assertActiveLeaveType(db, day.values.otherLeaveTypeId));
    if (conflict) return { success: false, error: conflict };

    const period = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));

    const item = await db.$transaction(async (tx) => {
      let header = await tx.timesheet.findFirst({
        where: { siteId: data.siteId, period, uploadSource: "MANUAL", status: { in: ["UPLOADED", "PENDING_REVIEW"] } },
      });
      if (!header) {
        header = await tx.timesheet.create({
          data: {
            clientId: site.project.clientId,
            projectId: site.projectId,
            siteId: site.id,
            period,
            uploadSource: "MANUAL",
            status: "UPLOADED",
            uploadedById: user.id,
          },
        });
      }

      return tx.timesheetItem.create({
        data: {
          timesheetId: header.id,
          workerId: worker.id,
          assignmentId: assignment.id,
          iqamaNumber: worker.iqamaNumber,
          date,
          ...attendanceItemData(day.values),
          remarks: data.remarks || null,
          status: "PENDING",
        },
      });
    });

    await logAudit({ userId: user.id, action: "create", entityType: "TimesheetItem", entityId: item.id, newValue: item });
    revalidatePath("/timesheets");
    revalidatePath("/timesheets/log");
    revalidatePath(`/timesheets/${item.timesheetId}`);
    return ok({ id: item.id });
  } catch (error) {
    return actionError(error);
  }
}

/**
 * Corrects a recorded day (§ attendance: manual adjustments stay auditable,
 * nothing is silently overwritten). Requires a reason, logs the full before/
 * after, and sends an already-decided entry back to Pending so it's reviewed
 * again. Locked/approved timesheets can't be changed — they feed payroll.
 */
export async function updateTimesheetItem(input: TimesheetItemUpdateInput): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "update", "timesheet");
    const data = timesheetItemUpdateSchema.parse(input);

    const before = await db.timesheetItem.findUniqueOrThrow({ where: { id: data.itemId }, include: { timesheet: true } });
    if (before.timesheet.status === "LOCKED" || before.timesheet.status === "APPROVED") {
      return {
        success: false,
        error: "This entry belongs to an approved or locked timesheet, which feeds payroll — it can no longer be edited.",
      };
    }

    const day = buildAttendanceDayFromForm(before.date, data, await getAttendanceRule());
    if (!day.ok) return { success: false, error: day.errors.join(" ") };

    const conflict =
      (await findLeaveRequestConflict(db, before.workerId, before.date, data.attendanceStatus, data.halfDayLeave || null)) ??
      (await assertActiveLeaveType(db, day.values.otherLeaveTypeId));
    if (conflict) return { success: false, error: conflict };

    const item = await db.timesheetItem.update({
      where: { id: before.id },
      data: {
        ...attendanceItemData(day.values),
        remarks: data.remarks || null,
        ...(before.status !== "PENDING" ? { status: "PENDING" as const, reviewNote: null } : {}),
      },
    });

    const previousValue: Partial<typeof before> = { ...before };
    delete previousValue.timesheet;
    await logAudit({
      userId: user.id,
      action: "update",
      entityType: "TimesheetItem",
      entityId: item.id,
      previousValue,
      newValue: { ...item, correctionReason: data.reason },
    });

    revalidatePath("/timesheets/log");
    revalidatePath(`/timesheets/${before.timesheetId}`);
    revalidatePath(`/timesheets/worker/${before.workerId}`);
    return ok({ id: item.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function submitTimesheetForReview(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "update", "timesheet");

    const before = await db.timesheet.findUniqueOrThrow({ where: { id } });
    if (before.status !== "UPLOADED") {
      return { success: false, error: "Only newly uploaded timesheets can be submitted for review." };
    }

    const timesheet = await db.timesheet.update({ where: { id }, data: { status: "PENDING_REVIEW" } });
    await logAudit({
      userId: user.id,
      action: "update",
      entityType: "Timesheet",
      entityId: id,
      previousValue: before,
      newValue: timesheet,
    });

    revalidatePath(`/timesheets/${id}`);
    revalidatePath("/timesheets");
    return ok({ id });
  } catch (error) {
    return actionError(error);
  }
}

/** Approve/reject one line item during review. A reject always requires a reason (§9). */
export async function decideTimesheetItem(input: TimesheetItemDecisionInput): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "update", "timesheet");
    const data = timesheetItemDecisionSchema.parse(input);

    if (data.decision === "REJECTED" && !data.reason) {
      return { success: false, error: "A reason is required to reject a timesheet entry." };
    }

    const before = await db.timesheetItem.findUniqueOrThrow({
      where: { id: data.itemId },
      include: { timesheet: true },
    });
    if (before.timesheet.status === "LOCKED") {
      return {
        success: false,
        error: "This LOG is locked because it's marked ready for payroll — locked entries can't be changed to keep payroll calculations accurate.",
      };
    }
    if (before.status !== "PENDING") {
      return { success: false, error: "This entry has already been decided." };
    }

    const item = await db.timesheetItem.update({
      where: { id: data.itemId },
      data: { status: data.decision, reviewNote: data.decision === "REJECTED" ? data.reason || null : null },
    });

    await logAudit({
      userId: user.id,
      action: "update",
      entityType: "TimesheetItem",
      entityId: item.id,
      previousValue: before,
      newValue: { status: data.decision, reason: data.reason || null },
    });

    revalidatePath(`/timesheets/${before.timesheetId}`);
    return ok({ id: item.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function approveTimesheet(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "update", "timesheet");

    const before = await db.timesheet.findUniqueOrThrow({ where: { id }, include: { items: true } });
    if (before.status !== "PENDING_REVIEW") {
      return { success: false, error: "Only timesheets pending review can be approved." };
    }
    const pendingCount = before.items.filter((i) => i.status === "PENDING").length;
    if (pendingCount > 0) {
      return {
        success: false,
        error: `${pendingCount} entr${pendingCount === 1 ? "y" : "ies"} still need a decision before this timesheet can be approved.`,
      };
    }

    const timesheet = await db.timesheet.update({
      where: { id },
      data: { status: "APPROVED", approvedById: user.id, approvedAt: new Date() },
    });

    await logAudit({
      userId: user.id,
      action: "update",
      entityType: "Timesheet",
      entityId: id,
      previousValue: before,
      newValue: timesheet,
    });

    revalidatePath(`/timesheets/${id}`);
    revalidatePath("/timesheets");
    return ok({ id });
  } catch (error) {
    return actionError(error);
  }
}

export async function lockTimesheet(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "update", "timesheet");

    const before = await db.timesheet.findUniqueOrThrow({ where: { id } });
    if (before.status !== "APPROVED") {
      return { success: false, error: "Only approved timesheets can be locked." };
    }

    const timesheet = await db.timesheet.update({ where: { id }, data: { status: "LOCKED" } });
    await logAudit({
      userId: user.id,
      action: "update",
      entityType: "Timesheet",
      entityId: id,
      previousValue: before,
      newValue: timesheet,
    });

    revalidatePath(`/timesheets/${id}`);
    revalidatePath("/timesheets");
    return ok({ id });
  } catch (error) {
    return actionError(error);
  }
}
