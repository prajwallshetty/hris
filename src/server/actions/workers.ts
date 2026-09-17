"use server";

import { Prisma, type WorkerStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { workerFormSchema, type WorkerFormInput } from "@/lib/validation/worker";
import { actionError, ok, type ActionResult } from "@/server/action-result";
import { logAudit } from "@/server/audit";
import {
  detectWorkerBulkColumns,
  extractWorkerBulkRows,
  summarizeWorkerBulkImport,
  validateWorkerBulkRows,
  type ValidWorkerBulkRow,
  type WorkerBulkImportSummary,
} from "@/server/import/worker-bulk-import";
import { assertCan, type SessionUser } from "@/server/rbac";
import { getSessionUser } from "@/server/session";

function toDate(value?: string) {
  return value ? new Date(value) : null;
}

// Iqama uniqueness is the spec's headline data-integrity rule (§3/§31), so
// give it a specific message rather than the generic "value already exists"
// fallback — the DB driver adapter doesn't always populate error.meta.target.
function isDuplicateIqama(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

// Worker.designation is normalized into a Designation lookup table, but the
// form keeps a plain free-text field rather than forcing a pre-populated
// dropdown — find-or-create by title keeps the data normalized without
// requiring a separate Designation management screen before this form works.
async function resolveDesignationId(title?: string | null): Promise<string | null> {
  const trimmed = title?.trim();
  if (!trimmed) return null;
  const designation = await db.designation.upsert({
    where: { title: trimmed },
    update: {},
    create: { title: trimmed },
  });
  return designation.id;
}

function buildData(data: WorkerFormInput, designationId: string | null, user: SessionUser) {
  return {
    iqamaNumber: data.iqamaNumber,
    fullName: data.fullName,
    mobile: data.mobile || null,
    passportNumber: data.passportNumber || null,
    passportExpiryDate: toDate(data.passportExpiryDate),
    iqamaExpiryDate: toDate(data.iqamaExpiryDate),
    nationality: data.nationality || null,
    dateOfBirth: toDate(data.dateOfBirth),
    designationId,
    skillCategory: data.skillCategory || null,
    joiningDate: toDate(data.joiningDate),
    mobilizationDate: toDate(data.mobilizationDate),
    demobilizationDate: toDate(data.demobilizationDate),
    // A coordinator's own Workers list is scoped to coordinatorId === their
    // own id (workerScopeWhere). Trusting the form's value here let a
    // coordinator create/edit a worker that doesn't satisfy their own
    // scope — the worker saves fine but immediately vanishes from their
    // list. Force it server-side rather than relying on the form
    // remembering to pre-select them.
    coordinatorId: user.role === "COORDINATOR" ? user.coordinatorId : data.coordinatorId || null,
    hourlyRate: data.hourlyRate ?? null,
    overtimeRate: data.overtimeRate ?? null,
    status: data.status,
    batchNumber: data.batchNumber || null,
    bankName: data.bankName || null,
    bankAccountIban: data.bankAccountIban || null,
    notes: data.notes || null,
  };
}

// Live availability check for the creation wizard's Identity step — lets
// the user know a Iqama is already taken before they fill out the rest of
// the form. The DB unique constraint (surfaced via isDuplicateIqama in
// createWorker) remains the actual source of truth against a race.
export async function checkIqamaAvailability(iqamaNumber: string): Promise<ActionResult<{ available: boolean }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "create", "worker");
    if (!/^\d{10}$/.test(iqamaNumber.trim())) {
      return ok({ available: false });
    }
    const existing = await db.worker.findUnique({ where: { iqamaNumber: iqamaNumber.trim() }, select: { id: true } });
    return ok({ available: !existing });
  } catch (error) {
    return actionError(error);
  }
}

export async function createWorker(input: WorkerFormInput): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "create", "worker");
    const data = workerFormSchema.parse(input);
    const designationId = await resolveDesignationId(data.designation);

    const worker = await db.worker.create({ data: buildData(data, designationId, user) });

    await db.workerStatusHistory.create({
      data: { workerId: worker.id, previousStatus: null, newStatus: worker.status, changedById: user.id },
    });

    await logAudit({
      userId: user.id,
      action: "create",
      entityType: "Worker",
      entityId: worker.id,
      newValue: data,
    });

    revalidatePath("/workers");
    return ok({ id: worker.id });
  } catch (error) {
    if (isDuplicateIqama(error)) {
      return { success: false, error: `A worker with Iqama number ${input.iqamaNumber} already exists.` };
    }
    return actionError(error);
  }
}

export async function updateWorker(
  id: string,
  input: WorkerFormInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "update", "worker");
    const data = workerFormSchema.parse(input);
    const designationId = await resolveDesignationId(data.designation);

    const before = await db.worker.findUniqueOrThrow({ where: { id } });
    const worker = await db.worker.update({ where: { id }, data: buildData(data, designationId, user) });

    if (before.status !== worker.status) {
      await db.workerStatusHistory.create({
        data: {
          workerId: worker.id,
          previousStatus: before.status,
          newStatus: worker.status,
          changedById: user.id,
        },
      });
    }

    await logAudit({
      userId: user.id,
      action: "update",
      entityType: "Worker",
      entityId: worker.id,
      previousValue: before,
      newValue: data,
    });

    revalidatePath("/workers");
    revalidatePath(`/workers/${id}`);
    return ok({ id: worker.id });
  } catch (error) {
    if (isDuplicateIqama(error)) {
      return { success: false, error: `A worker with Iqama number ${input.iqamaNumber} already exists.` };
    }
    return actionError(error);
  }
}

export async function archiveWorker(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "archive", "worker");

    const worker = await db.worker.update({ where: { id }, data: { deletedAt: new Date() } });

    await logAudit({
      userId: user.id,
      action: "archive",
      entityType: "Worker",
      entityId: worker.id,
    });

    revalidatePath("/workers");
    revalidatePath(`/workers/${id}`);
    return ok({ id: worker.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function bulkArchiveWorkers(ids: string[]): Promise<ActionResult<{ count: number }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "archive", "worker");
    if (ids.length === 0) return ok({ count: 0 });

    const result = await db.worker.updateMany({
      where: { id: { in: ids }, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    for (const id of ids) {
      await logAudit({ userId: user.id, action: "archive", entityType: "Worker", entityId: id });
    }

    revalidatePath("/workers");
    return ok({ count: result.count });
  } catch (error) {
    return actionError(error);
  }
}

export async function reactivateWorker(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "archive", "worker");

    const worker = await db.worker.update({ where: { id }, data: { deletedAt: null } });

    await logAudit({
      userId: user.id,
      action: "reactivate",
      entityType: "Worker",
      entityId: worker.id,
    });

    revalidatePath("/workers");
    revalidatePath(`/workers/${id}`);
    return ok({ id: worker.id });
  } catch (error) {
    return actionError(error);
  }
}

// Demobilization ends the worker's active assignment and marks them
// DEMOBILIZED in one step — the assignment row itself is never deleted,
// only ended (§3.5 "historical records must remain unchanged").
export async function demobilizeWorker(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "update", "worker");
    assertCan(user, "update", "assignment");

    const before = await db.worker.findUniqueOrThrow({ where: { id } });
    const now = new Date();

    const worker = await db.$transaction(async (tx) => {
      const activeAssignment = await tx.assignment.findFirst({ where: { workerId: id, status: "ACTIVE" } });
      if (activeAssignment) {
        await tx.assignment.update({ where: { id: activeAssignment.id }, data: { status: "ENDED", endDate: now } });
      }
      return tx.worker.update({ where: { id }, data: { status: "DEMOBILIZED", demobilizationDate: now } });
    });

    await db.workerStatusHistory.create({
      data: { workerId: id, previousStatus: before.status, newStatus: "DEMOBILIZED", changedById: user.id, reason: "Demobilized" },
    });

    await logAudit({
      userId: user.id,
      action: "update",
      entityType: "Worker",
      entityId: worker.id,
      previousValue: before,
      newValue: { status: "DEMOBILIZED", demobilizationDate: now },
    });

    revalidatePath("/workers");
    revalidatePath(`/workers/${id}`);
    revalidatePath("/assignments");
    return ok({ id: worker.id });
  } catch (error) {
    return actionError(error);
  }
}

export type WorkerImportPreview = {
  summary: WorkerBulkImportSummary;
  validRows: ValidWorkerBulkRow[];
};

/**
 * Step 1 of the bulk-upload flow: Upload -> Validate -> Preview. Nothing is
 * persisted here — the client holds the returned valid rows and re-submits
 * them (plus the original summary, for an accurate Import History record) to
 * `importWorkerRows` to actually write them.
 */
export async function previewWorkerImport(formData: FormData): Promise<ActionResult<WorkerImportPreview>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "create", "worker");

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { success: false, error: "Please choose a file to upload." };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { columns, missing } = detectWorkerBulkColumns(buffer);
    if (missing.length > 0) {
      return {
        success: false,
        error: `The file is missing required column(s): ${missing.join(", ")}. Expected: Name, Iqama Number.`,
      };
    }

    const rawRows = extractWorkerBulkRows(buffer, columns);
    if (rawRows.length === 0) {
      return { success: false, error: "No data rows were found in the file." };
    }

    const iqamas = Array.from(new Set(rawRows.map((r) => r.iqama).filter((v): v is string => Boolean(v))));
    const existingWorkers = await db.worker.findMany({
      where: { iqamaNumber: { in: iqamas } },
      select: { id: true, fullName: true, iqamaNumber: true },
    });
    const existingByIqama = new Map(existingWorkers.map((w) => [w.iqamaNumber, { id: w.id, fullName: w.fullName }]));

    const results = validateWorkerBulkRows(rawRows, { existingByIqama });

    return ok({
      summary: summarizeWorkerBulkImport(results),
      validRows: results.filter((r): r is ValidWorkerBulkRow => r.valid),
    });
  } catch (error) {
    return actionError(error);
  }
}

/** Step 2: creates one worker per valid, previewed row. Each row is written
 * independently (not one all-or-nothing transaction) so a single unexpected
 * failure — e.g. a race against another import of the same Iqama — doesn't
 * discard an otherwise-good batch; ImportRunStatus.PARTIAL exists precisely
 * for this case. Rows already flagged invalid at preview (including every
 * conflicting Iqama) are never sent here and never create a worker. */
export async function importWorkerRows(input: {
  fileName: string;
  summary: WorkerBulkImportSummary;
  items: ValidWorkerBulkRow[];
}): Promise<ActionResult<{ importedCount: number; failedCount: number }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "create", "worker");

    if (input.items.length === 0) {
      return { success: false, error: "No valid rows to import." };
    }

    const designationCache = new Map<string, string | null>();
    async function resolveCached(title: string | null) {
      const key = title?.trim().toLowerCase() ?? "";
      if (!designationCache.has(key)) {
        designationCache.set(key, await resolveDesignationId(title));
      }
      return designationCache.get(key) ?? null;
    }

    const writeFailures: { rowNumber: number; iqamaNumber: string | null; errors: string[] }[] = [];
    let importedCount = 0;

    for (const row of input.items) {
      try {
        const designationId = await resolveCached(row.designation);
        const worker = await db.worker.create({
          data: {
            iqamaNumber: row.iqamaNumber,
            fullName: row.fullName,
            mobile: row.mobile || null,
            designationId,
            skillCategory: row.skillCategory || null,
            joiningDate: row.joiningDate ? new Date(row.joiningDate) : null,
            status: row.status as WorkerStatus,
            batchNumber: row.batchNumber || null,
            notes: row.remarks || null,
          },
        });
        await db.workerStatusHistory.create({
          data: { workerId: worker.id, previousStatus: null, newStatus: worker.status, changedById: user.id },
        });
        importedCount += 1;
      } catch (error) {
        writeFailures.push({
          rowNumber: row.rowNumber,
          iqamaNumber: row.iqamaNumber,
          errors: [isDuplicateIqama(error) ? `Duplicate Iqama: ${row.iqamaNumber} was just registered by another import.` : "Could not save this row."],
        });
      }
    }

    const failedCount = input.summary.invalidRows + writeFailures.length;
    const errorReport = [...input.summary.errorReport, ...writeFailures];
    const status = failedCount === 0 ? "COMPLETED" : importedCount > 0 ? "PARTIAL" : "FAILED";

    const importRun = await db.importRun.create({
      data: {
        module: "WORKER",
        status,
        fileName: input.fileName,
        totalRows: input.summary.totalRows,
        importedRows: importedCount,
        failedRows: failedCount,
        errorReport,
        uploadedById: user.id,
      },
    });

    await logAudit({
      userId: user.id,
      action: "import",
      entityType: "Worker",
      entityId: importRun.id,
      newValue: { fileName: input.fileName, importedCount, failedCount },
    });

    revalidatePath("/workers");
    revalidatePath("/import-history");
    return ok({ importedCount, failedCount });
  } catch (error) {
    return actionError(error);
  }
}
