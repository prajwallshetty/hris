import type { LeaveRequestStatus, Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { assertCan, type SessionUser, workerScopeWhere } from "@/server/rbac";

// A top-level Leave list (§ redesign Workforce group) aggregating
// LeaveRequest across every worker and internal employee — the per-worker
// dialogs/decision buttons on the worker 360° page stay the primary way to
// *file* a request; this is the cross-worker queue for reviewing them.
export async function listLeaveRequests(
  user: SessionUser,
  params: { status?: LeaveRequestStatus | "ALL"; search?: string; page?: number; pageSize?: number },
) {
  assertCan(user, "view", "leaveRequest");
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 25;
  const search = params.search?.trim();

  // Coordinator/client roles only ever see their own workers' requests, and
  // never internal-employee leave (employees aren't coordinator/client
  // scoped anywhere else in the app either).
  const workerScope = workerScopeWhere(user);
  const baseConditions: Prisma.LeaveRequestWhereInput[] = [];
  if (workerScope) baseConditions.push({ worker: workerScope });
  if (search) {
    baseConditions.push({
      OR: [
        { worker: { fullName: { contains: search, mode: "insensitive" } } },
        { worker: { iqamaNumber: { contains: search } } },
        { employee: { fullName: { contains: search, mode: "insensitive" } } },
      ],
    });
  }
  const baseWhere: Prisma.LeaveRequestWhereInput = baseConditions.length ? { AND: baseConditions } : {};

  const where: Prisma.LeaveRequestWhereInput =
    params.status && params.status !== "ALL" ? { AND: [baseWhere, { status: params.status }] } : baseWhere;

  const [requests, total, pendingCount] = await Promise.all([
    db.leaveRequest.findMany({
      where,
      include: {
        worker: { select: { id: true, fullName: true, iqamaNumber: true } },
        employee: { select: { id: true, fullName: true } },
        leaveType: { select: { name: true, isPaid: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.leaveRequest.count({ where }),
    db.leaveRequest.count({ where: { AND: [baseWhere, { status: "PENDING" }] } }),
  ]);

  return { requests, total, page, pageSize, pendingCount };
}
