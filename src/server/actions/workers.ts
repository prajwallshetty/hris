"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { workerFormSchema, type WorkerFormInput } from "@/lib/validation/worker";
import { actionError, ok, type ActionResult } from "@/server/action-result";
import { logAudit } from "@/server/audit";
import { assertCan } from "@/server/rbac";
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

function buildData(data: WorkerFormInput, designationId: string | null) {
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
    coordinatorId: data.coordinatorId || null,
    hourlyRate: data.hourlyRate ?? null,
    overtimeRate: data.overtimeRate ?? null,
    status: data.status,
    bankName: data.bankName || null,
    bankAccountIban: data.bankAccountIban || null,
    notes: data.notes || null,
  };
}

export async function createWorker(input: WorkerFormInput): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "create", "worker");
    const data = workerFormSchema.parse(input);
    const designationId = await resolveDesignationId(data.designation);

    const worker = await db.worker.create({ data: buildData(data, designationId) });

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
    const worker = await db.worker.update({ where: { id }, data: buildData(data, designationId) });

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
