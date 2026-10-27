"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { workerFormSchema, type WorkerFormInput } from "@/lib/validation/worker";
import { actionError, ok, type ActionResult } from "@/server/action-result";
import { logAudit } from "@/server/audit";
import { manpowerRegistrationSchema } from "@/lib/validation/manpower";
import {
  detectWorkerBulkColumns,
  extractWorkerBulkRows,
  naturalKey,
  summarizeWorkerBulkImport,
  validateWorkerBulkRows,
  type RawWorkerBulkRow,
  type ValidWorkerBulkRow,
  type WorkerBulkImportContext,
  type WorkerBulkImportSummary,
} from "@/server/import/worker-bulk-import";
import { createManpowerRecord, ManpowerRecordError } from "@/server/manpower";
import { resolveDesignationId } from "@/server/designations";
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

function buildData(data: WorkerFormInput, designationId: string | null, user: SessionUser) {
  return {
    iqamaNumber: data.iqamaNumber || null,
    workerType: data.workerType || null,
    // Only HRD manpower is supplier-provided — never keep a stale supplier
    // on a worker whose type was changed away from HRD.
    supplierId: data.workerType === "HRD" ? data.supplierId || null : null,
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

function groupByName<T extends { id: string; name: string }>(items: T[], keyOf: (item: T) => string) {
  const map = new Map<string, { id: string; name: string }[]>();
  for (const item of items) {
    const key = keyOf(item);
    map.set(key, [...(map.get(key) ?? []), { id: item.id, name: item.name }]);
  }
  return map;
}

function distinct(values: (string | null)[]) {
  return Array.from(new Set(values.filter((v): v is string => Boolean(v))));
}

/** Loads only the records the file actually references, for validateWorkerBulkRows. */
async function loadWorkerImportContext(rawRows: RawWorkerBulkRow[]): Promise<WorkerBulkImportContext> {
  const iqamas = distinct(rawRows.map((r) => r.iqama?.replace(/\s+/g, "") ?? null));
  const names = distinct(rawRows.map((r) => r.fullName));
  const insensitiveIn = (values: string[]) => ({ in: values, mode: "insensitive" as const });

  const [byIqama, sameNames, suppliers, clients] = await Promise.all([
    db.worker.findMany({ where: { iqamaNumber: { in: iqamas } }, select: { fullName: true, iqamaNumber: true } }),
    db.worker.findMany({
      where: { deletedAt: null, fullName: insensitiveIn(names) },
      select: { fullName: true, mobile: true, mobilizationDate: true },
    }),
    db.supplier.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true } }),
    db.client.findMany({
      where: { deletedAt: null, companyName: insensitiveIn(distinct(rawRows.map((r) => r.client))) },
      select: { id: true, companyName: true },
    }),
  ]);
  const projects = await db.project.findMany({
    where: {
      deletedAt: null,
      clientId: { in: clients.map((c) => c.id) },
      name: insensitiveIn(distinct(rawRows.map((r) => r.project))),
    },
    select: { id: true, name: true, clientId: true },
  });
  const sites = await db.site.findMany({
    where: {
      deletedAt: null,
      projectId: { in: projects.map((p) => p.id) },
      name: insensitiveIn(distinct(rawRows.map((r) => r.site))),
    },
    select: { id: true, name: true, projectId: true },
  });

  return {
    existingByIqama: new Map(byIqama.flatMap((w) => (w.iqamaNumber ? [[w.iqamaNumber, { fullName: w.fullName }] as const] : []))),
    existingNaturalKeys: new Set(
      sameNames.flatMap((w) =>
        w.mobile && w.mobilizationDate ? [naturalKey(w.fullName, w.mobile, w.mobilizationDate.toISOString().slice(0, 10))] : [],
      ),
    ),
    suppliersByName: groupByName(suppliers, (s) => s.name.toLowerCase()),
    clientsByName: groupByName(
      clients.map((c) => ({ id: c.id, name: c.companyName })),
      (c) => c.name.toLowerCase(),
    ),
    projectsByKey: groupByName(projects, (p) => `${p.clientId}|${p.name.toLowerCase()}`),
    sitesByKey: groupByName(sites, (s) => `${s.projectId}|${s.name.toLowerCase()}`),
  };
}

/**
 * Step 1 of the bulk-upload flow: Upload -> Validate -> Preview. Nothing is
 * persisted here — the client holds the returned valid rows and re-submits
 * them (plus the original summary, for an accurate Import History record) to
 * `importWorkerRows`, which re-validates each one before writing.
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
        error: `The file is missing required column(s): ${missing.join(", ")}. Download the template to see the expected headers.`,
      };
    }

    const rawRows = extractWorkerBulkRows(buffer, columns);
    if (rawRows.length === 0) {
      return { success: false, error: "No data rows were found in the file." };
    }

    const results = validateWorkerBulkRows(rawRows, await loadWorkerImportContext(rawRows));
    return ok({
      summary: summarizeWorkerBulkImport(results),
      validRows: results.filter((r): r is ValidWorkerBulkRow => r.valid),
    });
  } catch (error) {
    return actionError(error);
  }
}

/** Step 2: creates one worker (and optional placement) per previewed row.
 * Each row is its own transaction (not all-or-nothing) so one unexpected
 * failure — e.g. a race against another import of the same Iqama — doesn't
 * discard an otherwise-good batch; ImportRunStatus.PARTIAL exists for this.
 * Rows come back from the browser, so each is re-validated with the same
 * schema Quick Register uses, and createManpowerRecord re-checks every
 * referenced record against the database. Re-running the same import is
 * safe: already-registered rows are reported as skipped, not duplicated. */
export async function importWorkerRows(input: {
  fileName: string;
  summary: WorkerBulkImportSummary;
  items: ValidWorkerBulkRow[];
}): Promise<ActionResult<{ importedCount: number; skippedCount: number; failedCount: number }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "create", "worker");

    if (input.items.length === 0) {
      return { success: false, error: "No valid rows to import." };
    }
    if (input.items.some((item) => item.data.clientId)) assertCan(user, "create", "assignment");

    const writeFailures: WorkerBulkImportSummary["errorReport"] = [];
    let importedCount = 0;
    let skippedCount = 0;

    for (const item of input.items) {
      const parsed = manpowerRegistrationSchema.safeParse(item.data);
      if (!parsed.success) {
        writeFailures.push({
          rowNumber: item.rowNumber,
          fullName: item.data.fullName ?? null,
          iqamaNumber: item.data.iqamaNumber || null,
          errors: parsed.error.issues.map((issue) => issue.message),
        });
        continue;
      }
      try {
        const created = await db.$transaction((tx) =>
          createManpowerRecord(tx, user, parsed.data, { batchNumber: item.batchNumber }),
        );
        await logAudit({
          userId: user.id,
          action: "create",
          entityType: "Worker",
          entityId: created.workerId,
          newValue: { ...parsed.data, source: "bulk-import", fileName: input.fileName },
        });
        importedCount += 1;
      } catch (error) {
        const alreadyRegistered = error instanceof ManpowerRecordError && /already registered/.test(error.message);
        if (alreadyRegistered || isDuplicateIqama(error)) skippedCount += 1;
        writeFailures.push({
          rowNumber: item.rowNumber,
          fullName: parsed.data.fullName,
          iqamaNumber: parsed.data.iqamaNumber || null,
          errors: [
            error instanceof ManpowerRecordError
              ? error.message
              : isDuplicateIqama(error)
                ? `Iqama ${parsed.data.iqamaNumber} was just registered by another import.`
                : "Could not save this row.",
          ],
        });
      }
    }

    const failedCount = input.summary.invalidRows + writeFailures.length - skippedCount;
    const errorReport = [...input.summary.errorReport, ...writeFailures];
    const status = failedCount + skippedCount === 0 ? "COMPLETED" : importedCount > 0 ? "PARTIAL" : "FAILED";

    const importRun = await db.importRun.create({
      data: {
        module: "WORKER",
        status,
        fileName: input.fileName,
        totalRows: input.summary.totalRows,
        importedRows: importedCount,
        failedRows: failedCount + skippedCount,
        errorReport,
        uploadedById: user.id,
      },
    });

    await logAudit({
      userId: user.id,
      action: "import",
      entityType: "Worker",
      entityId: importRun.id,
      newValue: { fileName: input.fileName, importedCount, skippedCount, failedCount },
    });

    revalidatePath("/workers");
    revalidatePath("/assignments");
    revalidatePath("/import-history");
    return ok({ importedCount, skippedCount, failedCount });
  } catch (error) {
    return actionError(error);
  }
}
