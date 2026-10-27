import type { Prisma, WorkerStatus, WorkerType } from "@prisma/client";

import { db } from "@/lib/db";
import { parseWorkerCodeSearch } from "@/lib/codes";
import { assertCan, type SessionUser, workerScopeWhere } from "@/server/rbac";

function buildWorkerSearchWhere(search?: string): Prisma.WorkerWhereInput {
  if (!search) return {};
  const codeMatch = parseWorkerCodeSearch(search);
  return {
    OR: [
      { fullName: { contains: search, mode: "insensitive" } },
      { iqamaNumber: { contains: search } },
      { mobile: { contains: search } },
      { batchNumber: { contains: search, mode: "insensitive" } },
      ...(codeMatch !== null ? [{ sequenceNo: codeMatch }] : []),
    ],
  };
}

export const CURRENT_ASSIGNMENT_INCLUDE = {
  assignments: {
    where: { status: "ACTIVE" as const },
    orderBy: { startDate: "desc" as const },
    take: 1,
    include: { client: true, site: true, project: true },
  },
  coordinator: true,
  designation: true,
  supplier: { select: { id: true, name: true } },
};

type WorkerListFilters = {
  search?: string;
  status?: WorkerStatus | "ALL";
  workerType?: WorkerType | "ALL";
  supplierId?: string;
  unassigned?: boolean;
};

function buildWorkerListWhere(user: SessionUser, params: WorkerListFilters): Prisma.WorkerWhereInput {
  return {
    deletedAt: null,
    ...workerScopeWhere(user),
    ...(params.status && params.status !== "ALL" ? { status: params.status } : {}),
    ...(params.workerType && params.workerType !== "ALL" ? { workerType: params.workerType } : {}),
    ...(params.supplierId ? { supplierId: params.supplierId } : {}),
    ...(params.unassigned ? { assignments: { none: { status: "ACTIVE" } } } : {}),
    ...buildWorkerSearchWhere(params.search),
  };
}

export async function listWorkers(
  user: SessionUser,
  params: WorkerListFilters & { page?: number; pageSize?: number },
) {
  assertCan(user, "view", "worker");
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 25;
  const where = buildWorkerListWhere(user, params);

  const [workers, total] = await Promise.all([
    db.worker.findMany({
      where,
      include: CURRENT_ASSIGNMENT_INCLUDE,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.worker.count({ where }),
  ]);

  return { workers, total, page, pageSize };
}

export async function getWorker(user: SessionUser, id: string) {
  assertCan(user, "view", "worker");
  const worker = await db.worker.findFirst({
    where: { id, deletedAt: null, ...workerScopeWhere(user) },
    include: {
      coordinator: true,
      designation: true,
      supplier: { select: { id: true, name: true } },
      documents: { orderBy: { uploadedAt: "desc" } },
      assignments: {
        orderBy: { startDate: "desc" },
        include: { client: true, project: true, site: true, coordinator: true },
      },
    },
  });
  return worker;
}

// Unpaginated — used by CSV export, which must cover every matching row,
// not just the current page.
export async function listWorkersForExport(
  user: SessionUser,
  params: WorkerListFilters,
) {
  assertCan(user, "view", "worker");
  const where = buildWorkerListWhere(user, params);

  return db.worker.findMany({
    where,
    include: CURRENT_ASSIGNMENT_INCLUDE,
    orderBy: { sequenceNo: "asc" },
  });
}

export async function listCoordinators() {
  return db.coordinator.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } });
}

export async function listWorkersForSelect(user: SessionUser) {
  assertCan(user, "view", "worker");
  return db.worker.findMany({
    where: { deletedAt: null, ...workerScopeWhere(user) },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true, iqamaNumber: true },
  });
}
