import type { Prisma, WorkerStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { getClientFinancials } from "@/server/queries/client-detail";
import {
  workerScopeWhere,
  clientScopeWhere,
  siteScopeWhere,
  assignmentScopeWhere,
  vehicleScopeWhere,
  equipmentScopeWhere,
  equipmentRentalScopeWhere,
  can,
  type SessionUser,
} from "@/server/rbac";

export async function getDashboardCounts(user: SessionUser) {
  const [totalWorkers, activeWorkers, totalClients, totalSites, activeAssignments] = await Promise.all([
    db.worker.count({ where: { deletedAt: null, ...workerScopeWhere(user) } }),
    db.worker.count({ where: { deletedAt: null, status: "ACTIVE", ...workerScopeWhere(user) } }),
    db.client.count({ where: { deletedAt: null, ...clientScopeWhere(user) } }),
    db.site.count({ where: { deletedAt: null, ...siteScopeWhere(user) } }),
    db.assignment.count({ where: { status: "ACTIVE", ...assignmentScopeWhere(user) } }),
  ]);

  return { totalWorkers, activeWorkers, totalClients, totalSites, activeAssignments };
}

// Fleet KPIs — drillable to /vehicles, /equipment, /rentals (§4/§20).
export async function getFleetCounts(user: SessionUser) {
  const [totalVehicles, vehiclesDeployed, totalEquipment, equipmentRented, activeRentals] = await Promise.all([
    can(user, "view", "vehicle")
      ? db.vehicle.count({ where: { deletedAt: null, ...vehicleScopeWhere(user) } })
      : Promise.resolve(0),
    can(user, "view", "vehicle")
      ? db.vehicle.count({ where: { deletedAt: null, status: "ASSIGNED", ...vehicleScopeWhere(user) } })
      : Promise.resolve(0),
    can(user, "view", "equipment")
      ? db.equipment.count({ where: { deletedAt: null, ...equipmentScopeWhere(user) } })
      : Promise.resolve(0),
    can(user, "view", "equipment")
      ? db.equipment.count({ where: { deletedAt: null, status: "RENTED", ...equipmentScopeWhere(user) } })
      : Promise.resolve(0),
    can(user, "view", "equipmentRental")
      ? db.equipmentRental.count({ where: { status: { in: ["ACTIVE", "EXTENDED"] }, ...equipmentRentalScopeWhere(user) } })
      : Promise.resolve(0),
  ]);

  return { totalVehicles, vehiclesDeployed, totalEquipment, equipmentRented, activeRentals };
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
    where: { status: "ACTIVE", ...assignmentScopeWhere(user) },
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

const TREND_MONTH_FORMAT = new Intl.DateTimeFormat("en-GB", { month: "short", year: "2-digit" });

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// Monthly revenue-vs-worker-cost trend for the dashboard's primary chart
// (§ redesign reference "Consolidated budget" chart) — bucketed in JS from
// the same Invoice/WorkerPayroll rows the rest of the app already reads,
// scoped exactly like every other client/worker query. Real data only: a
// month with nothing billed or paid still appears, at zero.
export async function getRevenueCostTrend(user: SessionUser, monthsBack = 12) {
  const now = new Date();
  const rangeStart = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1), 1);

  const [invoices, payrolls] = await Promise.all([
    can(user, "view", "invoice")
      ? db.invoice.findMany({
          where: {
            billingPeriodStart: { gte: rangeStart },
            status: { not: "CANCELLED" },
            client: { ...clientScopeWhere(user) },
          },
          select: { subtotal: true, billingPeriodStart: true },
        })
      : Promise.resolve([]),
    can(user, "view", "workerPayroll")
      ? db.workerPayroll.findMany({
          where: {
            payrollPeriod: { periodStart: { gte: rangeStart } },
            worker: { ...workerScopeWhere(user) },
          },
          select: { grossPay: true, payrollPeriod: { select: { periodStart: true } } },
        })
      : Promise.resolve([]),
  ]);

  const buckets = new Map<string, { label: string; date: Date; revenue: number; workerCost: number }>();
  for (let i = 0; i < monthsBack; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1 - i), 1);
    buckets.set(monthKey(date), { label: TREND_MONTH_FORMAT.format(date), date, revenue: 0, workerCost: 0 });
  }

  for (const inv of invoices) {
    const bucket = buckets.get(monthKey(inv.billingPeriodStart));
    if (bucket) bucket.revenue += Number(inv.subtotal);
  }
  for (const p of payrolls) {
    const bucket = buckets.get(monthKey(p.payrollPeriod.periodStart));
    if (bucket) bucket.workerCost += Number(p.grossPay);
  }

  return Array.from(buckets.values()).map(({ label, revenue, workerCost }) => ({
    month: label,
    revenue,
    workerCost,
  }));
}

// Company-wide finance KPIs for the dashboard — same underlying tables as
// the Payroll/Timesheets/Coordinators/Expenses pages, just summed (§30/§45:
// one calculation, shown consistently everywhere).
export async function getFinanceKpis() {
  const [hours, workerPayroll, employeePayroll, commission, expenses] = await Promise.all([
    db.timesheetItem.aggregate({
      where: { status: "APPROVED" },
      _sum: { regularHours: true, overtimeHours: true },
    }),
    db.workerPayroll.aggregate({ _sum: { netPayable: true } }),
    db.employeePayroll.aggregate({ _sum: { netPayable: true } }),
    db.commission.aggregate({ _sum: { amount: true } }),
    db.expense.aggregate({ where: { deletedAt: null }, _sum: { amount: true } }),
  ]);

  const totalHours = Number(hours._sum.regularHours ?? 0) + Number(hours._sum.overtimeHours ?? 0);
  const totalPayroll = Number(workerPayroll._sum.netPayable ?? 0) + Number(employeePayroll._sum.netPayable ?? 0);

  return {
    totalHours,
    totalPayroll,
    totalCommission: Number(commission._sum.amount ?? 0),
    totalExpenses: Number(expenses._sum.amount ?? 0),
  };
}

// Entity-scoped audit trail for a detail page's Activity tab (§8/§37) —
// the same AuditLog table the global Audit Log page reads, filtered to one
// record via its existing [entityType, entityId] index.
export async function getEntityAuditLog(entityType: string, entityId: string, limit = 20) {
  return db.auditLog.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { name: true, email: true } } },
  });
}

export async function getRecentAuditLog(limit = 10) {
  return db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { name: true, email: true } } },
  });
}

export async function listAuditLog(
  params: { page?: number; pageSize?: number; action?: string; entityType?: string } = {},
) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 50;

  const where: Prisma.AuditLogWhereInput = {
    ...(params.action ? { action: params.action } : {}),
    ...(params.entityType ? { entityType: params.entityType } : {}),
  };

  const [entries, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true, email: true } } },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.auditLog.count({ where }),
  ]);

  return { entries, total, page, pageSize };
}

/** Distinct entity types on file, for the Audit Log page's filter dropdown. */
export async function listAuditLogEntityTypes() {
  const rows = await db.auditLog.findMany({ distinct: ["entityType"], select: { entityType: true }, orderBy: { entityType: "asc" } });
  return rows.map((r) => r.entityType);
}
