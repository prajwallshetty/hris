import { Decimal } from "decimal.js";

import { db } from "@/lib/db";
import { assertCan, coordinatorScopeWhere, type SessionUser } from "@/server/rbac";

export async function listCoordinators(user: SessionUser) {
  assertCan(user, "view", "coordinator");
  return db.coordinator.findMany({
    where: coordinatorScopeWhere(user),
    orderBy: { name: "asc" },
    include: { _count: { select: { workers: true, assignments: { where: { status: "ACTIVE" } } } } },
  });
}

export async function getCoordinatorDetail(user: SessionUser, id: string) {
  assertCan(user, "view", "coordinator");
  return db.coordinator.findFirst({
    where: { id, ...coordinatorScopeWhere(user) },
    include: { _count: { select: { workers: true, assignments: { where: { status: "ACTIVE" } } } } },
  });
}

export async function listCoordinatorSales(coordinatorId: string) {
  return db.sale.findMany({
    where: { coordinatorId },
    include: { client: true, commissions: true },
    orderBy: { date: "desc" },
  });
}

/** Sales with no commission generated yet, for the "generate from sale" picker. */
export async function listUncommissionedSales(coordinatorId: string) {
  return db.sale.findMany({
    where: { coordinatorId, commissions: { none: {} } },
    include: { client: true },
    orderBy: { date: "desc" },
  });
}

export async function listCoordinatorCommissions(coordinatorId: string) {
  return db.commission.findMany({
    where: { coordinatorId },
    include: { commissionRule: true, sale: true, items: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getApplicableCommissionRules(coordinatorId: string) {
  return db.commissionRule.findMany({
    where: { status: "ACTIVE", OR: [{ coordinatorId }, { coordinatorId: null }] },
    orderBy: [{ coordinatorId: "desc" }, { createdAt: "desc" }],
  });
}

export async function listAllCommissionRules() {
  return db.commissionRule.findMany({
    where: { status: "ACTIVE" },
    include: { coordinator: true },
    orderBy: [{ coordinatorId: "asc" }, { createdAt: "desc" }],
  });
}

/** PER_WORKER basis: distinct workers currently deployed under this coordinator's assignments. */
export async function getActiveWorkerCountForCoordinator(coordinatorId: string): Promise<number> {
  const assignments = await db.assignment.findMany({
    where: { coordinatorId, status: "ACTIVE" },
    select: { workerId: true },
    distinct: ["workerId"],
  });
  return assignments.length;
}

/** PER_HOUR basis: approved hours in the period, across this coordinator's deployments. */
export async function getApprovedHoursForCoordinatorPeriod(
  coordinatorId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<Decimal> {
  const items = await db.timesheetItem.findMany({
    where: {
      status: "APPROVED",
      date: { gte: periodStart, lte: periodEnd },
      assignment: { coordinatorId },
    },
    select: { regularHours: true, overtimeHours: true },
  });
  return items.reduce(
    (sum, i) => sum.plus(i.regularHours.toString()).plus(i.overtimeHours.toString()),
    new Decimal(0),
  );
}

/**
 * PERCENT_OF_PROFIT basis: a client's profit for one period only (revenue
 * from invoices billed in that window, worker cost from payroll periods
 * starting in that window, expenses dated in that window) — a period-
 * scoped sibling of getClientFinancials, which is intentionally all-time.
 * Commission is never subtracted here since it's the very figure being
 * based on this profit.
 */
export async function getClientProfitForPeriod(clientId: string, periodStart: Date, periodEnd: Date) {
  const [invoices, expenseTotal, assignments] = await Promise.all([
    db.invoice.aggregate({
      where: { clientId, status: { not: "CANCELLED" }, billingPeriodStart: { gte: periodStart }, billingPeriodEnd: { lte: periodEnd } },
      _sum: { subtotal: true },
    }),
    db.expense.aggregate({
      where: { clientId, deletedAt: null, date: { gte: periodStart, lte: periodEnd } },
      _sum: { amount: true },
    }),
    db.assignment.findMany({ where: { clientId }, select: { workerId: true } }),
  ]);

  const workerIds = [...new Set(assignments.map((a) => a.workerId))];
  const workerCostAgg = workerIds.length
    ? await db.workerPayroll.aggregate({
        where: {
          workerId: { in: workerIds },
          payrollPeriod: { periodStart: { gte: periodStart, lte: periodEnd } },
        },
        _sum: { grossPay: true },
      })
    : null;

  const revenue = Number(invoices._sum.subtotal ?? 0);
  const workerCost = Number(workerCostAgg?._sum.grossPay ?? 0);
  const expenses = Number(expenseTotal._sum.amount ?? 0);

  return { revenue, workerCost, expenses, profit: revenue - workerCost - expenses };
}
