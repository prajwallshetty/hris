import type { AssignmentStatus, Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { assertCan, assignmentScopeWhere, type SessionUser } from "@/server/rbac";

export async function listAssignments(
  user: SessionUser,
  params: {
    workerId?: string;
    clientId?: string;
    siteId?: string;
    status?: AssignmentStatus | "ALL";
    page?: number;
    pageSize?: number;
  } = {},
) {
  assertCan(user, "view", "assignment");
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 25;

  const where: Prisma.AssignmentWhereInput = {
    ...assignmentScopeWhere(user),
    ...(params.workerId ? { workerId: params.workerId } : {}),
    ...(params.clientId ? { clientId: params.clientId } : {}),
    ...(params.siteId ? { siteId: params.siteId } : {}),
    ...(params.status && params.status !== "ALL" ? { status: params.status } : {}),
  };

  const [assignments, total] = await Promise.all([
    db.assignment.findMany({
      where,
      include: { worker: true, client: true, project: true, site: true, coordinator: true },
      orderBy: { startDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.assignment.count({ where }),
  ]);

  return { assignments, total, page, pageSize };
}

export async function getActiveAssignmentForWorker(workerId: string) {
  return db.assignment.findFirst({
    where: { workerId, status: "ACTIVE" },
    include: { client: true, project: true, site: true },
  });
}
