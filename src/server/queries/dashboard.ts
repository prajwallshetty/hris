import type { Prisma, WorkerStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { expiringDocumentsWhere } from "@/server/queries/workers";
import { assignmentScopeWhere, can, clientScopeWhere, siteScopeWhere, workerScopeWhere, type SessionUser } from "@/server/rbac";

// ---------------------------------------------------------------------------
// Dashboard (§ redesign reference): one month- and site-aware data load for
// the KPI row, analytics row and Pending Actions table. Every figure is a
// live query — nothing here is a placeholder.
// ---------------------------------------------------------------------------

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;
const MONTH_LABEL = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" });
const MONTH_LONG = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

export type DashboardMonth = { key: string; start: Date; end: Date; label: string };

function monthFromParts(year: number, monthIndex: number): DashboardMonth {
  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1));
  return {
    key: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`,
    start,
    end,
    label: MONTH_LONG.format(start),
  };
}

/** "2026-09" → that month; anything else → the current month. */
export function resolveDashboardMonth(value?: string): DashboardMonth {
  const match = value?.match(MONTH_PATTERN);
  if (match) return monthFromParts(Number(match[1]), Number(match[2]) - 1);
  const now = new Date();
  return monthFromParts(now.getUTCFullYear(), now.getUTCMonth());
}

/** The selectable months: the last 12, newest first. */
export function recentDashboardMonths(count = 12): DashboardMonth[] {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => monthFromParts(now.getUTCFullYear(), now.getUTCMonth() - i));
}

export async function listDashboardSites(user: SessionUser) {
  if (!can(user, "view", "site")) return [];
  return db.site.findMany({
    where: { deletedAt: null, ...siteScopeWhere(user) },
    select: { id: true, name: true, project: { select: { client: { select: { companyName: true } } } } },
    orderBy: { name: "asc" },
  });
}

function sumPaid(payments: { amount: Prisma.Decimal; voidedAt: Date | null }[]) {
  return payments.filter((p) => !p.voidedAt).reduce((sum, p) => sum + Number(p.amount), 0);
}

const WORKER_STATUS_ORDER: WorkerStatus[] = ["ACTIVE", "AVAILABLE", "ON_LEAVE", "SUSPENDED", "DEMOBILIZED", "RESIGNED", "TERMINATED"];

export async function getDashboardData(user: SessionUser, params: { month: DashboardMonth; siteId?: string }) {
  const { month, siteId } = params;
  const canWorkers = can(user, "view", "worker");
  const canPayroll = can(user, "view", "workerPayroll");
  const canInvoices = can(user, "view", "invoice");
  const canTimesheets = can(user, "view", "timesheet");
  const canLeave = can(user, "view", "leaveRequest");

  // Site filter: a worker "belongs" to a site through an active assignment
  // there; an invoice through any of its line items billed to that site.
  const workerSite: Prisma.WorkerWhereInput = siteId ? { assignments: { some: { siteId, status: "ACTIVE" } } } : {};
  const workerBase: Prisma.WorkerWhereInput = { deletedAt: null, ...workerScopeWhere(user) };
  const invoiceSite: Prisma.InvoiceWhereInput = siteId ? { items: { some: { siteId } } } : {};

  const trendStart = new Date(Date.UTC(month.start.getUTCFullYear(), month.start.getUTCMonth() - 8, 1));

  const [
    activeWorkers,
    workersWithoutAssignment,
    statusRows,
    clientRows,
    monthPayrolls,
    trendPayrolls,
    overdueInvoices,
    attendanceInReview,
    attendanceUploaded,
    pendingLeave,
    expiringDocuments,
    payrollPeriod,
  ] = await Promise.all([
    canWorkers ? db.worker.count({ where: { AND: [workerBase, workerSite, { status: "ACTIVE" }] } }) : 0,
    canWorkers
      ? db.worker.count({
          where: { AND: [workerBase, { status: { in: ["ACTIVE", "AVAILABLE"] }, assignments: { none: { status: "ACTIVE" } } }] },
        })
      : 0,
    canWorkers ? db.worker.groupBy({ by: ["status"], where: { AND: [workerBase, workerSite] }, _count: { _all: true } }) : [],
    canWorkers
      ? db.assignment.groupBy({
          by: ["clientId"],
          where: { status: "ACTIVE", ...(siteId ? { siteId } : {}), ...assignmentScopeWhere(user) },
          _count: { _all: true },
        })
      : [],
    canPayroll
      ? db.workerPayroll.findMany({
          where: { payrollPeriod: { periodStart: { gte: month.start, lt: month.end } }, worker: { AND: [workerBase, workerSite] } },
          select: { netPayable: true, payments: { select: { amount: true, voidedAt: true } } },
        })
      : [],
    canPayroll
      ? db.workerPayroll.findMany({
          where: { payrollPeriod: { periodStart: { gte: trendStart, lt: month.end } }, worker: { AND: [workerBase, workerSite] } },
          select: { netPayable: true, payrollPeriod: { select: { periodStart: true } }, payments: { select: { amount: true, voidedAt: true } } },
        })
      : [],
    canInvoices
      ? db.invoice.findMany({
          where: { status: "OVERDUE", client: { ...clientScopeWhere(user) }, ...invoiceSite },
          select: { totalAmount: true, payments: { select: { amount: true } } },
        })
      : [],
    canTimesheets ? db.timesheet.count({ where: { status: "PENDING_REVIEW", ...(siteId ? { siteId } : {}) } }) : 0,
    canTimesheets ? db.timesheet.count({ where: { status: "UPLOADED", ...(siteId ? { siteId } : {}) } }) : 0,
    canLeave ? db.leaveRequest.count({ where: { status: "PENDING", ...(workerScopeWhere(user) ? { worker: workerScopeWhere(user) } : {}) } }) : 0,
    canWorkers ? db.worker.count({ where: { AND: [workerBase, workerSite, expiringDocumentsWhere(30)] } }) : 0,
    db.payrollPeriod.findFirst({ where: { periodStart: { gte: month.start, lt: month.end } }, select: { id: true } }),
  ]);

  let payroll = 0;
  let paid = 0;
  let unpaidSlips = 0;
  for (const row of monthPayrolls) {
    const net = Number(row.netPayable);
    const rowPaid = sumPaid(row.payments);
    payroll += net;
    paid += rowPaid;
    if (net - rowPaid > 0.005) unpaidSlips += 1;
  }
  const outstanding = Math.max(0, payroll - paid);

  const trend = Array.from({ length: 9 }, (_, i) => {
    const start = new Date(Date.UTC(trendStart.getUTCFullYear(), trendStart.getUTCMonth() + i, 1));
    return { key: start.toISOString().slice(0, 7), month: MONTH_LABEL.format(start), paid: 0, outstanding: 0 };
  });
  for (const row of trendPayrolls) {
    const bucket = trend.find((b) => b.key === row.payrollPeriod.periodStart.toISOString().slice(0, 7));
    if (!bucket) continue;
    const net = Number(row.netPayable);
    const rowPaid = sumPaid(row.payments);
    bucket.paid += rowPaid;
    bucket.outstanding += Math.max(0, net - rowPaid);
  }

  const statusCounts = new Map(statusRows.map((r) => [r.status, r._count._all]));
  const workerStatus = WORKER_STATUS_ORDER.map((status) => ({ status, count: statusCounts.get(status) ?? 0 })).filter((r) => r.count > 0);

  const clients = await db.client.findMany({
    where: { id: { in: clientRows.map((r) => r.clientId) } },
    select: { id: true, companyName: true },
  });
  const clientName = new Map(clients.map((c) => [c.id, c.companyName]));
  const topClients = clientRows
    .map((r) => ({ id: r.clientId, name: clientName.get(r.clientId) ?? "Unknown client", count: r._count._all }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const overdueAmount = overdueInvoices.reduce(
    (sum, inv) => sum + Math.max(0, Number(inv.totalAmount) - inv.payments.reduce((s, p) => s + Number(p.amount), 0)),
    0,
  );

  const payrollHref = payrollPeriod ? `/payroll/${payrollPeriod.id}` : "/payroll";
  const pendingActions = [
    canTimesheets && { key: "review", label: "Attendance awaiting review", count: attendanceInReview, href: "/timesheets?status=PENDING_REVIEW", tone: "red" as const },
    canTimesheets && { key: "uploaded", label: "Attendance uploaded, not yet submitted", count: attendanceUploaded, href: "/timesheets?status=UPLOADED", tone: "orange" as const },
    canWorkers && { key: "unassigned", label: "Workers without assignment", count: workersWithoutAssignment, href: "/workers?unassigned=1", tone: "orange" as const },
    canPayroll && { key: "salary", label: `Salary slips not fully paid — ${month.label}`, count: unpaidSlips, href: payrollHref, tone: "blue" as const },
    canInvoices && { key: "overdue", label: "Overdue client invoices", count: overdueInvoices.length, href: "/invoices?status=OVERDUE", tone: "purple" as const },
    canLeave && { key: "leave", label: "Leave requests awaiting decision", count: pendingLeave, href: "/leave?status=PENDING", tone: "teal" as const },
    canWorkers && { key: "expiring", label: "Iqama / passport expiring in 30 days", count: expiringDocuments, href: "/workers?expiring=30", tone: "green" as const },
  ].filter((a): a is Exclude<typeof a, false> => Boolean(a));

  return {
    permissions: { canWorkers, canPayroll, canInvoices },
    kpis: {
      activeWorkers,
      payroll,
      paid,
      outstanding,
      paidPercent: payroll > 0 ? (paid / payroll) * 100 : 0,
      workersWithoutAssignment,
      overdueInvoices: overdueInvoices.length,
      overdueAmount,
    },
    payrollHref,
    trend: trend.map(({ month: label, paid: p, outstanding: o }) => ({ month: label, paid: p, outstanding: o })),
    workerStatus,
    topClients,
    pendingActions,
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
