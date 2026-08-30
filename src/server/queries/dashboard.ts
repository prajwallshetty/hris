import type { WorkerStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { getClientFinancials } from "@/server/queries/client-detail";
import { workerScopeWhere, clientScopeWhere, can, type SessionUser } from "@/server/rbac";

export async function getDashboardCounts(user: SessionUser) {
  const [totalWorkers, activeWorkers, totalClients, totalSites, activeAssignments] = await Promise.all([
    db.worker.count({ where: { deletedAt: null, ...workerScopeWhere(user) } }),
    db.worker.count({ where: { deletedAt: null, status: "ACTIVE", ...workerScopeWhere(user) } }),
    db.client.count({ where: { deletedAt: null, ...clientScopeWhere(user) } }),
    db.site.count({ where: { deletedAt: null } }),
    db.assignment.count({ where: { status: "ACTIVE" } }),
  ]);

  return { totalWorkers, activeWorkers, totalClients, totalSites, activeAssignments };
}

const WORKER_STATUS_ORDER: WorkerStatus[] = [
  "ACTIVE",
  "AVAILABLE",
  "ON_LEAVE",
  "SUSPENDED",
  "DEMOBILIZED",
  "RESIGNED",
  "TERMINATED",
];

export async function getWorkersByStatus(user: SessionUser) {
  const rows = await db.worker.groupBy({
    by: ["status"],
    where: { deletedAt: null, ...workerScopeWhere(user) },
    _count: { _all: true },
  });
  const counts = new Map(rows.map((r) => [r.status, r._count._all]));
  return WORKER_STATUS_ORDER.map((status) => ({ status, count: counts.get(status) ?? 0 })).filter(
    (row) => row.count > 0,
  );
}

export async function getWorkersByClient(user: SessionUser, limit = 8) {
  const rows = await db.assignment.groupBy({
    by: ["clientId"],
    where: { status: "ACTIVE", ...(user.role === "COORDINATOR" ? { coordinatorId: user.coordinatorId ?? "__none__" } : {}) },
    _count: { _all: true },
  });
  const clients = await db.client.findMany({
    where: { id: { in: rows.map((r) => r.clientId) } },
    select: { id: true, companyName: true },
  });
  const nameById = new Map(clients.map((c) => [c.id, c.companyName]));

  return rows
    .map((r) => ({ client: nameById.get(r.clientId) ?? "Unknown", count: r._count._all }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// Per-client profitability for the dashboard summary chart — reuses the
// exact same calc-engine-backed logic as the client detail page's Billing
// tab (one source of truth), not a separate/simplified formula.
export async function getClientProfitabilitySummary(user: SessionUser) {
  if (!can(user, "view", "invoice") && !can(user, "view", "workerPayroll")) return [];

  const clients = await db.client.findMany({
    where: { deletedAt: null, ...clientScopeWhere(user) },
    select: { id: true, companyName: true },
    orderBy: { companyName: "asc" },
  });

  const results = await Promise.all(
    clients.map(async (client) => ({
      client: client.companyName,
      ...(await getClientFinancials(client.id)),
    })),
  );

  return results.filter((r) => r.revenue > 0 || r.workerCost > 0);
}

export async function getRecentAuditLog(limit = 10) {
  return db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { name: true, email: true } } },
  });
}

export async function listAuditLog(params: { page?: number; pageSize?: number } = {}) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 50;

  const [entries, total] = await Promise.all([
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true, email: true } } },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.auditLog.count(),
  ]);

  return { entries, total, page, pageSize };
}
