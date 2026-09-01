"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import {
  manualTimesheetItemFormSchema,
  timesheetItemDecisionSchema,
  type ManualTimesheetItemFormInput,
  type TimesheetItemDecisionInput,
} from "@/lib/validation/timesheet";
import { actionError, ok, type ActionResult } from "@/server/action-result";
import { logAudit } from "@/server/audit";
import { calculateOvertime, calculateRegularHours } from "@/server/calc";
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
} from "@/server/queries/timesheets";
import { getSessionUser } from "@/server/session";

function combineLocalTime(date: Date, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hours, minutes));
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
        data: input.items.map((item) => ({
          timesheetId: header.id,
          workerId: item.workerId,
          assignmentId: assignmentByWorkerId.get(item.workerId) ?? null,
          iqamaNumber: item.iqamaNumber,
          date: new Date(item.date),
          loginTime: new Date(item.loginTime),
          logoutTime: new Date(item.logoutTime),
          breakMinutes: item.breakMinutes,
          regularHours: item.regularHours,
          overtimeHours: item.overtimeHours,
          totalHours: item.totalHours,
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

    revalidatePath("/timesheets");
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
    const loginTime = combineLocalTime(date, data.loginTime);
    const logoutTime = combineLocalTime(date, data.logoutTime);
    const breakMinutes = data.breakMinutes ?? 0;

    const netMinutes = (logoutTime.getTime() - loginTime.getTime()) / 60_000 - breakMinutes;
    if (netMinutes <= 0) {
      return { success: false, error: "Logout must be after login (and break)." };
    }

    const existing = await db.timesheetItem.findUnique({ where: { workerId_date: { workerId: worker.id, date } } });
    if (existing) {
      return { success: false, error: "An attendance entry for this worker and date already exists." };
    }

    const overtimeRuleRow = await getActiveOvertimeRule();
    const totalHours = calculateRegularHours(loginTime, logoutTime, breakMinutes);
    const { regularHours, overtimeHours } = calculateOvertime(totalHours, toOvertimeRuleConfig(overtimeRuleRow));
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
          loginTime,
          logoutTime,
          breakMinutes,
          regularHours: regularHours.toFixed(2),
          overtimeHours: overtimeHours.toFixed(2),
          totalHours: totalHours.toFixed(2),
          status: "PENDING",
        },
      });
    });

    await logAudit({ userId: user.id, action: "create", entityType: "TimesheetItem", entityId: item.id, newValue: data });
    revalidatePath("/timesheets");
    revalidatePath(`/timesheets/${item.timesheetId}`);
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
      return { success: false, error: "This timesheet is locked and can no longer be changed." };
    }
    if (before.status !== "PENDING") {
      return { success: false, error: "This entry has already been decided." };
    }

    const item = await db.timesheetItem.update({
      where: { id: data.itemId },
      data: { status: data.decision, remarks: data.reason || before.remarks },
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
