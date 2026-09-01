import { Decimal } from "decimal.js";
import type { PayrollStatus, Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { assertCan, type SessionUser } from "@/server/rbac";

export async function listPayrollPeriods(
  user: SessionUser,
  params: { status?: PayrollStatus | "ALL"; page?: number; pageSize?: number } = {},
) {
  assertCan(user, "view", "payrollPeriod");
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 25;

  const where: Prisma.PayrollPeriodWhereInput = {
    ...(params.status && params.status !== "ALL" ? { status: params.status } : {}),
  };

  const [periods, total] = await Promise.all([
    db.payrollPeriod.findMany({
      where,
      include: { _count: { select: { workerPayrolls: true } } },
      orderBy: { periodStart: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.payrollPeriod.count({ where }),
  ]);

  return { periods, total, page, pageSize };
}

export async function getPayrollPeriod(user: SessionUser, id: string) {
  assertCan(user, "view", "payrollPeriod");
  return db.payrollPeriod.findUnique({
    where: { id },
    include: {
      workerPayrolls: {
        include: { worker: true, payments: true },
        orderBy: { worker: { fullName: "asc" } },
      },
      employeePayrolls: {
        include: { employee: true, payments: true },
        orderBy: { employee: { fullName: "asc" } },
      },
    },
  });
}

export async function getWorkerPayrollDetail(user: SessionUser, id: string) {
  assertCan(user, "view", "workerPayroll");
  return db.workerPayroll.findUnique({
    where: { id },
    include: {
      payrollPeriod: true,
      worker: true,
      items: { orderBy: { createdAt: "asc" } },
      payments: { orderBy: { date: "desc" } },
    },
  });
}

/** Every worker id that already has a payroll row for this period — generation skips them. */
export async function listWorkerIdsWithPayrollForPeriod(payrollPeriodId: string): Promise<Set<string>> {
  const rows = await db.workerPayroll.findMany({ where: { payrollPeriodId }, select: { workerId: true } });
  return new Set(rows.map((r) => r.workerId));
}

/**
 * Raw approved-hours rows for the period, scoped to LOCKED timesheets only
 * (§11: payroll pulls ONLY approved — here, fully locked — timesheets).
 * Grouping by worker/assignment happens in the caller so the pure
 * `buildWorkerPayrollDraft` helper stays DB-agnostic and testable.
 */
export async function listApprovedTimesheetItemsForPeriod(
  periodStart: Date,
  periodEnd: Date,
  filters: { clientId?: string; siteId?: string; workerId?: string } = {},
) {
  return db.timesheetItem.findMany({
    where: {
      status: "APPROVED",
      date: { gte: periodStart, lte: periodEnd },
      ...(filters.workerId ? { workerId: filters.workerId } : {}),
      timesheet: {
        status: "LOCKED",
        ...(filters.clientId ? { clientId: filters.clientId } : {}),
        ...(filters.siteId ? { siteId: filters.siteId } : {}),
      },
    },
    include: {
      worker: { select: { id: true, fullName: true, hourlyRate: true } },
      assignment: { include: { site: { include: { project: { include: { client: true } } } } } },
    },
  });
}

export async function listActiveAdvancesForWorker(workerId: string) {
  const advances = await db.advance.findMany({
    where: { workerId, status: "ACTIVE" },
    include: { repayments: true },
    orderBy: { dateGiven: "asc" },
  });
  return advances
    .map((a) => ({
      id: a.id,
      dateGiven: a.dateGiven,
      amount: a.amount,
      remaining: new Decimal(a.amount.toString()).minus(
        a.repayments.reduce((sum, r) => sum.plus(r.amount.toString()), new Decimal(0)),
      ),
    }))
    .filter((a) => a.remaining.gt(0));
}

export async function listActiveLoansForWorker(workerId: string) {
  const loans = await db.loan.findMany({
    where: { workerId, status: "ACTIVE" },
    include: { repayments: true },
    orderBy: { dateGiven: "asc" },
  });
  return loans
    .map((l) => ({
      id: l.id,
      dateGiven: l.dateGiven,
      principalAmount: l.principalAmount,
      installmentAmount: l.installmentAmount,
      remaining: new Decimal(l.principalAmount.toString()).minus(
        l.repayments.reduce((sum, r) => sum.plus(r.amount.toString()), new Decimal(0)),
      ),
    }))
    .filter((l) => l.remaining.gt(0));
}

/**
 * Sum of days on APPROVED unpaid-leave requests overlapping the period.
 * Uses each request's full `days` value rather than clipping to the exact
 * days inside the period boundary — a reasonable simplification given
 * there's no daily leave calendar to clip against.
 */
export async function getUnpaidLeaveDaysInPeriod(workerId: string, periodStart: Date, periodEnd: Date): Promise<Decimal> {
  const requests = await db.leaveRequest.findMany({
    where: {
      workerId,
      status: "APPROVED",
      leaveType: { isPaid: false },
      startDate: { lte: periodEnd },
      endDate: { gte: periodStart },
    },
    select: { days: true },
  });
  return requests.reduce((sum, r) => sum.plus(r.days.toString()), new Decimal(0));
}
