import type { Prisma, WorkerStatus } from "@prisma/client";

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
      ...(codeMatch !== null ? [{ sequenceNo: codeMatch }] : []),
    ],
  };
}

const CURRENT_ASSIGNMENT_INCLUDE = {
  assignments: {
    where: { status: "ACTIVE" as const },
    orderBy: { startDate: "desc" as const },
    take: 1,
    include: { client: true, site: true, project: true },
  },
  coordinator: true,
  designation: true,
};

export async function listWorkers(
  user: SessionUser,
  params: { search?: string; status?: WorkerStatus | "ALL"; page?: number; pageSize?: number },
) {
  assertCan(user, "view", "worker");
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 25;

  const where: Prisma.WorkerWhereInput = {
    deletedAt: null,
    ...workerScopeWhere(user),
    ...(params.status && params.status !== "ALL" ? { status: params.status } : {}),
    ...buildWorkerSearchWhere(params.search),
  };

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
  params: { search?: string; status?: WorkerStatus | "ALL" },
) {
  assertCan(user, "view", "worker");
  const where: Prisma.WorkerWhereInput = {
    deletedAt: null,
    ...workerScopeWhere(user),
    ...(params.status && params.status !== "ALL" ? { status: params.status } : {}),
    ...buildWorkerSearchWhere(params.search),
  };

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
