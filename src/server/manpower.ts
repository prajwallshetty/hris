import type { Prisma, WorkerStatus, WorkerType } from "@prisma/client";

import type { ManpowerRegistrationInput } from "@/lib/validation/manpower";
import { resolveDesignationId } from "@/server/designations";
import type { SessionUser } from "@/server/rbac";

/** A business-rule rejection with a message safe to show the user as-is. */
export class ManpowerRecordError extends Error {}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/** Deployed to a site and already mobilized → ACTIVE; otherwise AVAILABLE. */
export function mobilizationStatus(mobilizationIso: string, hasPlacement: boolean): WorkerStatus {
  return hasPlacement && mobilizationIso <= todayIso() ? "ACTIVE" : "AVAILABLE";
}

/**
 * The one write path for a new manpower record — used by Quick Register and
 * by bulk import, so both enforce identical rules. Must run inside the
 * caller's transaction. Re-checks everything against the database rather
 * than trusting IDs the browser sent back.
 */
export async function createManpowerRecord(
  tx: Prisma.TransactionClient,
  user: SessionUser,
  data: ManpowerRegistrationInput,
  extra: { batchNumber?: string | null } = {},
): Promise<{ workerId: string; sequenceNo: number; status: WorkerStatus; assignmentId: string | null }> {
  const iqamaNumber = data.iqamaNumber || null;
  const mobilizationIso = data.mobilizationDate.slice(0, 10);
  const mobilizationDate = new Date(mobilizationIso);
  const hasPlacement = Boolean(data.clientId && data.projectId && data.siteId);

  if (iqamaNumber) {
    const existing = await tx.worker.findUnique({ where: { iqamaNumber }, select: { fullName: true } });
    if (existing) throw new ManpowerRecordError(`Iqama ${iqamaNumber} is already registered to ${existing.fullName}.`);
  } else {
    // No Iqama to key on — guard against a double-submitted form or a
    // re-run import creating the same person twice.
    const samePerson = await tx.worker.findFirst({
      where: {
        deletedAt: null,
        fullName: { equals: data.fullName, mode: "insensitive" },
        mobile: data.mobile,
        mobilizationDate,
      },
      select: { id: true },
    });
    if (samePerson) {
      throw new ManpowerRecordError(
        `${data.fullName} (${data.mobile}) is already registered with mobilization date ${mobilizationIso}.`,
      );
    }
  }

  let supplierId: string | null = null;
  if (data.workerType === "HRD") {
    const supplier = data.supplierId ? await tx.supplier.findUnique({ where: { id: data.supplierId } }) : null;
    if (!supplier || supplier.status !== "ACTIVE") {
      throw new ManpowerRecordError("Select an active supplier for HRD manpower.");
    }
    supplierId = supplier.id;
  }

  // Never trust client/project/site IDs to belong together just because a
  // cascading selector or a name lookup usually keeps them in sync.
  if (hasPlacement) {
    const site = await tx.site.findFirst({
      where: { id: data.siteId, deletedAt: null, projectId: data.projectId, project: { clientId: data.clientId } },
      select: { id: true },
    });
    if (!site) throw new ManpowerRecordError("The selected site does not belong to the selected client and project.");
  }

  const status = mobilizationStatus(mobilizationIso, hasPlacement);
  const designationId = await resolveDesignationId(data.designation, tx);

  const worker = await tx.worker.create({
    data: {
      fullName: data.fullName,
      nationality: data.nationality,
      mobile: data.mobile,
      mobilizationDate,
      workerType: data.workerType as WorkerType,
      supplierId,
      iqamaNumber,
      designationId,
      skillCategory: data.skillCategory || null,
      hourlyRate: data.workerRate ?? null,
      batchNumber: extra.batchNumber || null,
      notes: data.notes || null,
      status,
      coordinatorId: user.role === "COORDINATOR" ? user.coordinatorId : null,
    },
  });

  await tx.workerStatusHistory.create({
    data: { workerId: worker.id, previousStatus: null, newStatus: status, changedById: user.id },
  });

  let assignmentId: string | null = null;
  if (hasPlacement) {
    const assignment = await tx.assignment.create({
      data: {
        workerId: worker.id,
        clientId: data.clientId!,
        projectId: data.projectId!,
        siteId: data.siteId!,
        designation: data.designation || null,
        workerHourlyRate: data.workerRate!,
        clientBillingRate: data.clientBillingRate!,
        startDate: mobilizationDate,
        coordinatorId: worker.coordinatorId,
        createdById: user.id,
      },
    });
    assignmentId = assignment.id;
  }

  return { workerId: worker.id, sequenceNo: worker.sequenceNo, status, assignmentId };
}
