"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { workerFormSchema, type WorkerFormInput } from "@/lib/validation/worker";
import { actionError, ok, type ActionResult } from "@/server/action-result";
import { logAudit } from "@/server/audit";
import { manpowerRegistrationSchema, type ManpowerRegistrationInput } from "@/lib/validation/manpower";
import {
  buildPreviewRows,
  detectWorkerBulkColumns,
  extractWorkerBulkRows,
  naturalKey,
  summarizeWorkerBulkImport,
  validateWorkerBulkRows,
  type FieldChange,
  type RawWorkerBulkRow,
  type ValidWorkerBulkRow,
  type WorkerBulkPreviewRow,
  type WorkerBulkImportContext,
  type WorkerBulkImportSummary,
} from "@/server/import/worker-bulk-import";
import { importEngineInfo } from "@/server/import/excel-utils";
import {
  createManpowerRecord,
  ManpowerRecordError,
  toExistingWorkerRef,
  updateWorkerFromImport,
  workerRefSelect,
} from "@/server/manpower";
import { resolveDesignationId } from "@/server/designations";
import { assertCan, can, type SessionUser } from "@/server/rbac";
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

/** A duplicate row an authorized admin may choose to apply to the existing worker. */
export type WorkerUpdateCandidate = {
  rowNumber: number;
  data: ManpowerRegistrationInput;
  existingName: string;
  changes: FieldChange[];
};

export type WorkerImportPreview = {
  summary: WorkerBulkImportSummary;
  /** Rows ready to import as new workers. */
  validRows: ValidWorkerBulkRow[];
  /** Every row of the file, in order, with its validation status. */
  rows: WorkerBulkPreviewRow[];
  /** Duplicates that could be explicitly applied to the existing worker (empty unless the user may update workers). */
  updateCandidates: WorkerUpdateCandidate[];
  /** Which build / spreadsheet library read this file. */
  engine: { commit: string; xlsx: string; deployment: string };
};

function distinct(values: (string | null)[]) {
  return Array.from(new Set(values.filter((v): v is string => Boolean(v))));
}

/** Loads only the records the file actually references, for validateWorkerBulkRows. */
async function loadWorkerImportContext(rawRows: RawWorkerBulkRow[]): Promise<WorkerBulkImportContext> {
  const iqamas = distinct(rawRows.map((r) => r.iqama?.replace(/\s+/g, "") ?? null));
  const names = distinct(rawRows.map((r) => r.fullName));
  const insensitiveIn = (values: string[]) => ({ in: values, mode: "insensitive" as const });

  // Clients, projects and sites are matched in code on a normalized name
  // (spacing and case folded — see normalizeName), so they're loaded whole
  // rather than filtered by exact name in SQL, which can't ignore spacing.
  // Only non-archived records are candidates, so a row can never land on an
  // archived site. Nothing is created: an unmatched name is a row error.
  const [byIqama, sameNames, suppliers, clients, coordinators] = await Promise.all([
    db.worker.findMany({ where: { iqamaNumber: { in: iqamas } }, select: workerRefSelect }),
    db.worker.findMany({
      where: { deletedAt: null, fullName: insensitiveIn(names) },
      select: { fullName: true, mobile: true, mobilizationDate: true },
    }),
    db.supplier.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true } }),
    db.client.findMany({ where: { deletedAt: null }, select: { id: true, companyName: true, coordinatorId: true } }),
    db.coordinator.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true } }),
  ]);
  const projects = await db.project.findMany({
    where: { deletedAt: null, clientId: { in: clients.map((c) => c.id) } },
    select: { id: true, name: true, clientId: true, coordinatorId: true },
  });
  const sites = await db.site.findMany({
    where: { deletedAt: null, projectId: { in: projects.map((p) => p.id) } },
    select: { id: true, name: true, projectId: true },
  });

  return {
    existingByIqama: new Map(byIqama.flatMap((w) => (w.iqamaNumber ? [[w.iqamaNumber, toExistingWorkerRef(w)] as const] : []))),
    existingNaturalKeys: new Set(
      sameNames.flatMap((w) =>
        w.mobile && w.mobilizationDate ? [naturalKey(w.fullName, w.mobile, w.mobilizationDate.toISOString().slice(0, 10))] : [],
      ),
    ),
    suppliers,
    clients: clients.map((c) => ({ id: c.id, name: c.companyName, coordinatorId: c.coordinatorId })),
    projects,
    sites,
    coordinators,
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
    const canUpdate = can(user, "update", "worker");
    return ok({
      summary: summarizeWorkerBulkImport(results),
      validRows: results.filter((r): r is ValidWorkerBulkRow => r.valid),
      rows: buildPreviewRows(results),
      updateCandidates: canUpdate
        ? results.flatMap((r) =>
            !r.valid && r.duplicateOf && r.data && r.changes && r.changes.length > 0
              ? [{ rowNumber: r.rowNumber, data: r.data, existingName: r.duplicateOf.fullName, changes: r.changes }]
              : [],
          )
        : [],
      engine: importEngineInfo(),
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
 * safe: already-registered rows are reported as skipped, not duplicated.
 *
 * Duplicates (an Iqama that already belongs to a worker) are skipped unless
 * the caller explicitly lists them in `updates`: then, and only then, the
 * existing worker's profile fields are updated — recomputed from the
 * database, audited with before/after values, and never touching assignments. */
export async function importWorkerRows(input: {
  fileName: string;
  summary: WorkerBulkImportSummary;
  items: ValidWorkerBulkRow[];
  updates?: { rowNumber: number; data: ManpowerRegistrationInput }[];
}): Promise<ActionResult<{ importedCount: number; updatedCount: number; skippedCount: number; failedCount: number }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "create", "worker");
    const updates = input.updates ?? [];
    if (updates.length > 0) assertCan(user, "update", "worker");

    if (input.items.length === 0 && updates.length === 0) {
      return { success: false, error: "No valid rows to import." };
    }
    if (input.items.some((item) => item.data.clientId)) assertCan(user, "create", "assignment");

    const writeFailures: WorkerBulkImportSummary["errorReport"] = [];
    let importedCount = 0;
    let updatedCount = 0;
    /** Rows that turned out to be duplicates at write time (another import got there first). */
    let raceSkips = 0;
    const updatedRows = new Set<number>();

    for (const item of input.items) {
      const parsed = manpowerRegistrationSchema.safeParse(item.data);
      if (!parsed.success) {
        writeFailures.push({
          rowNumber: item.rowNumber,
          fullName: item.data.fullName ?? null,
          iqamaNumber: item.data.iqamaNumber || null,
          errors: parsed.error.issues.map((issue) => issue.message),
          source: item.source,
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
        if (alreadyRegistered || isDuplicateIqama(error)) raceSkips += 1;
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
          source: item.source,
        });
      }
    }

    for (const update of updates) {
      const parsed = manpowerRegistrationSchema.safeParse(update.data);
      if (!parsed.success) {
        writeFailures.push({
          rowNumber: update.rowNumber,
          fullName: update.data.fullName ?? null,
          iqamaNumber: update.data.iqamaNumber || null,
          errors: parsed.error.issues.map((issue) => issue.message),
        });
        continue;
      }
      try {
        const before = parsed.data.iqamaNumber
          ? await db.worker.findUnique({ where: { iqamaNumber: parsed.data.iqamaNumber }, select: workerRefSelect })
          : null;
        const result = await db.$transaction((tx) => updateWorkerFromImport(tx, parsed.data));
        await logAudit({
          userId: user.id,
          action: "update",
          entityType: "Worker",
          entityId: result.workerId,
          previousValue: Object.fromEntries(result.changes.map((c) => [c.field, c.from])),
          newValue: {
            ...Object.fromEntries(result.changes.map((c) => [c.field, c.to])),
            source: "bulk-import-update",
            fileName: input.fileName,
            existingName: before?.fullName ?? null,
          },
        });
        updatedCount += 1;
        updatedRows.add(update.rowNumber);
        revalidatePath(`/workers/${result.workerId}`);
      } catch (error) {
        writeFailures.push({
          rowNumber: update.rowNumber,
          fullName: parsed.data.fullName,
          iqamaNumber: parsed.data.iqamaNumber || null,
          errors: [error instanceof ManpowerRecordError ? error.message : "Could not update this worker."],
        });
      }
    }

    // Duplicates the user did not choose to update are skipped, untouched.
    const skippedCount = raceSkips + Math.max(0, input.summary.duplicateRows - updates.length);
    const failedCount = input.summary.invalidRows + writeFailures.length - raceSkips;
    const errorReport = [
      ...input.summary.errorReport.filter((entry) => !updatedRows.has(entry.rowNumber)),
      ...writeFailures,
    ];
    const status =
      failedCount + skippedCount === 0 ? "COMPLETED" : importedCount + updatedCount > 0 ? "PARTIAL" : "FAILED";

    const importRun = await db.importRun.create({
      data: {
        module: "WORKER",
        status,
        fileName: input.fileName,
        totalRows: input.summary.totalRows,
        importedRows: importedCount + updatedCount,
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
      newValue: { fileName: input.fileName, importedCount, updatedCount, skippedCount, failedCount },
    });

    revalidatePath("/workers");
    revalidatePath("/assignments");
    revalidatePath("/import-history");
    return ok({ importedCount, updatedCount, skippedCount, failedCount });
  } catch (error) {
    return actionError(error);
  }
}
