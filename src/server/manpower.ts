import type { Prisma, WorkerStatus, WorkerType } from "@prisma/client";
import { diffWorker, type ExistingWorkerRef, type FieldChange } from "@/server/import/worker-bulk-import";

import type { CoordinatorSource } from "@/lib/coordinator-resolution";
import type { ManpowerRegistrationInput } from "@/lib/validation/manpower";
import { resolvePlacementCoordinator } from "@/server/coordinator-resolution";
import { resolveDesignationId } from "@/server/designations";
import { can, type SessionUser } from "@/server/rbac";

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
): Promise<{
  workerId: string;
  sequenceNo: number;
  status: WorkerStatus;
  assignmentId: string | null;
  coordinatorId: string | null;
  coordinatorName: string | null;
  coordinatorSource: CoordinatorSource | "self";
}> {
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

  const coordinator = await chooseCoordinator(tx, user, data, hasPlacement);

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
      coordinatorId: coordinator.id,
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

  return {
    workerId: worker.id,
    sequenceNo: worker.sequenceNo,
    status,
    assignmentId,
    coordinatorId: coordinator.id,
    coordinatorName: coordinator.name,
    coordinatorSource: coordinator.source,
  };
}

/**
 * Who coordinates this worker. A COORDINATOR-role user registers under
 * their own profile (unchanged). Otherwise an explicit choice is kept as
 * given — but only after checking it is an active coordinator and that the
 * user may choose one. With no explicit choice the Project → Client
 * coordinator is used; with neither, the worker stays unassigned.
 */
async function chooseCoordinator(
  tx: Prisma.TransactionClient,
  user: SessionUser,
  data: ManpowerRegistrationInput,
  hasPlacement: boolean,
): Promise<{ id: string | null; name: string | null; source: CoordinatorSource | "self" }> {
  if (user.role === "COORDINATOR") return { id: user.coordinatorId, name: null, source: "self" };

  if (data.coordinatorId) {
    if (!can(user, "view", "coordinator")) {
      throw new ManpowerRecordError("You are not allowed to choose a coordinator.");
    }
    const chosen = await tx.coordinator.findFirst({
      where: { id: data.coordinatorId, status: "ACTIVE" },
      select: { id: true, name: true },
    });
    if (!chosen) throw new ManpowerRecordError("The selected coordinator is not available (missing or inactive).");
    // A form pre-fills the project's coordinator and sends it back as an
    // explicit id; call it what it is when it matches what we'd resolve.
    const resolved = hasPlacement
      ? await resolvePlacementCoordinator(tx, { clientId: data.clientId, projectId: data.projectId })
      : null;
    return { id: chosen.id, name: chosen.name, source: resolved?.coordinatorId === chosen.id ? resolved.source : "manual" };
  }

  if (hasPlacement) {
    const resolved = await resolvePlacementCoordinator(tx, { clientId: data.clientId, projectId: data.projectId });
    return { id: resolved.coordinatorId, name: resolved.coordinatorName, source: resolved.source };
  }
  return { id: null, name: null, source: "none" };
}

const workerRefSelect = {
  id: true,
  fullName: true,
  iqamaNumber: true,
  sequenceNo: true,
  status: true,
  nationality: true,
  mobile: true,
  mobilizationDate: true,
  workerType: true,
  supplierId: true,
  skillCategory: true,
  hourlyRate: true,
  deletedAt: true,
  supplier: { select: { name: true } },
  designation: { select: { title: true } },
} satisfies Prisma.WorkerSelect;
export { workerRefSelect };

type WorkerRefRow = Prisma.WorkerGetPayload<{ select: typeof workerRefSelect }>;

/** A database worker as the duplicate review sees it. */
export function toExistingWorkerRef(w: WorkerRefRow): ExistingWorkerRef {
  return {
    id: w.id,
    fullName: w.fullName,
    iqamaNumber: w.iqamaNumber ?? "",
    sequenceNo: w.sequenceNo,
    status: w.status,
    nationality: w.nationality ?? null,
    mobile: w.mobile ?? null,
    mobilizationDate: w.mobilizationDate ? w.mobilizationDate.toISOString().slice(0, 10) : null,
    workerType: w.workerType,
    supplierId: w.supplierId,
    supplierName: w.supplier?.name ?? null,
    designation: w.designation?.title ?? null,
    skillCategory: w.skillCategory ?? null,
    hourlyRate: w.hourlyRate == null ? null : Number(w.hourlyRate),
  };
}

/**
 * The explicit "update existing worker" write for a bulk-import duplicate.
 * The target is found by Iqama and the changes are recomputed here from the
 * worker's CURRENT data — nothing the browser sent about the existing worker
 * is trusted. Only the profile fields in UPDATABLE_FIELDS can change, a blank
 * cell never erases a value, and the placement (assignments) is never touched.
 */
export async function updateWorkerFromImport(
  tx: Prisma.TransactionClient,
  data: ManpowerRegistrationInput,
): Promise<{ workerId: string; changes: FieldChange[] }> {
  const iqama = data.iqamaNumber;
  if (!iqama) throw new ManpowerRecordError("An update needs the worker's Iqama number.");

  const worker = await tx.worker.findUnique({ where: { iqamaNumber: iqama }, select: workerRefSelect });
  if (!worker) throw new ManpowerRecordError(`No worker with Iqama ${iqama} exists any more.`);
  if (worker.deletedAt) throw new ManpowerRecordError(`The worker with Iqama ${iqama} is archived — restore them before updating.`);

  let supplierName: string | null = null;
  if (data.workerType === "HRD") {
    const supplier = data.supplierId ? await tx.supplier.findUnique({ where: { id: data.supplierId } }) : null;
    if (!supplier || supplier.status !== "ACTIVE") throw new ManpowerRecordError("Select an active supplier for HRD manpower.");
    supplierName = supplier.name;
  }

  const existing = toExistingWorkerRef(worker);
  const changes = diffWorker(existing, data, supplierName);
  if (changes.length === 0) throw new ManpowerRecordError(`${existing.fullName} already matches this row — nothing to update.`);

  const has = (field: FieldChange["field"]) => changes.some((c) => c.field === field);
  const update: Prisma.WorkerUpdateInput = {};
  if (has("fullName")) update.fullName = data.fullName;
  if (has("nationality")) update.nationality = data.nationality;
  if (has("mobile")) update.mobile = data.mobile;
  if (has("mobilizationDate")) update.mobilizationDate = new Date(data.mobilizationDate.slice(0, 10));
  if (has("workerType")) update.workerType = data.workerType as WorkerType;
  if (has("workerType") || has("supplier")) {
    update.supplier = data.workerType === "HRD" ? { connect: { id: data.supplierId! } } : { disconnect: true };
  }
  if (has("designation")) {
    const designationId = await resolveDesignationId(data.designation, tx);
    update.designation = designationId ? { connect: { id: designationId } } : { disconnect: true };
  }
  if (has("skillCategory")) update.skillCategory = data.skillCategory || null;
  if (has("hourlyRate")) update.hourlyRate = data.workerRate ?? null;

  await tx.worker.update({ where: { id: worker.id }, data: update });
  return { workerId: worker.id, changes };
}
