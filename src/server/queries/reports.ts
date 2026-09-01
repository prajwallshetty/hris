import { Decimal } from "decimal.js";

import { db } from "@/lib/db";
import { calculateOutstanding, calculateRepayableBalance } from "@/server/calc";
import { assertCan, type SessionUser } from "@/server/rbac";

/** §31 Workforce report: active headcount per client/site. */
export async function getWorkforceAllocationReport(user: SessionUser) {
  assertCan(user, "view", "assignment");
  const rows = await db.assignment.groupBy({
    by: ["clientId", "siteId"],
    where: { status: "ACTIVE" },
    _count: { _all: true },
  });

  const [clients, sites] = await Promise.all([
    db.client.findMany({ where: { id: { in: rows.map((r) => r.clientId) } }, select: { id: true, companyName: true } }),
    db.site.findMany({ where: { id: { in: rows.map((r) => r.siteId) } }, select: { id: true, name: true } }),
  ]);
  const clientNames = new Map(clients.map((c) => [c.id, c.companyName]));
  const siteNames = new Map(sites.map((s) => [s.id, s.name]));

  return rows
    .map((r) => ({
      client: clientNames.get(r.clientId) ?? "Unknown",
      site: siteNames.get(r.siteId) ?? "Unknown",
      activeWorkers: r._count._all,
    }))
    .sort((a, b) => b.activeWorkers - a.activeWorkers);
}

/** §31 Attendance report: approved hours per site for locked timesheets. */
export async function getAttendanceSummaryReport(user: SessionUser) {
  assertCan(user, "view", "timesheet");
  const items = await db.timesheetItem.findMany({
    where: { status: "APPROVED" },
    select: {
      regularHours: true,
      overtimeHours: true,
      workerId: true,
      timesheet: { select: { period: true, site: { select: { name: true } } } },
    },
  });

  const byKey = new Map<
    string,
    { period: string; site: string; regularHours: Decimal; overtimeHours: Decimal; workerIds: Set<string> }
  >();

  for (const item of items) {
    const period = item.timesheet.period.toISOString().slice(0, 7);
    const site = item.timesheet.site?.name ?? "Unknown";
    const key = `${period}:${site}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.regularHours = existing.regularHours.plus(item.regularHours.toString());
      existing.overtimeHours = existing.overtimeHours.plus(item.overtimeHours.toString());
      existing.workerIds.add(item.workerId);
    } else {
      byKey.set(key, {
        period,
        site,
        regularHours: new Decimal(item.regularHours.toString()),
        overtimeHours: new Decimal(item.overtimeHours.toString()),
        workerIds: new Set([item.workerId]),
      });
    }
  }

  return Array.from(byKey.values())
    .map((r) => ({
      period: r.period,
      site: r.site,
      workers: r.workerIds.size,
      regularHours: r.regularHours.toFixed(1),
      overtimeHours: r.overtimeHours.toFixed(1),
    }))
    .sort((a, b) => b.period.localeCompare(a.period));
}

/** §31 Payroll report: totals per period across worker + employee payroll. */
export async function getPayrollSummaryReport(user: SessionUser) {
  assertCan(user, "view", "payrollPeriod");
  const periods = await db.payrollPeriod.findMany({
    include: {
      workerPayrolls: { include: { payments: true } },
      employeePayrolls: true,
    },
    orderBy: { periodStart: "desc" },
  });

  return periods.map((period) => {
    const workerGross = period.workerPayrolls.reduce((sum, p) => sum + Number(p.grossPay), 0);
    const workerNet = period.workerPayrolls.reduce((sum, p) => sum + Number(p.netPayable), 0);
    const workerPaid = period.workerPayrolls.reduce(
      (sum, p) => sum + p.payments.reduce((s, payment) => s + Number(payment.amount), 0),
      0,
    );
    const employeeNet = period.employeePayrolls.reduce((sum, p) => sum + Number(p.netPayable), 0);
    const advances = period.workerPayrolls.reduce((sum, p) => sum + Number(p.advanceDeduction), 0);
    const loans = period.workerPayrolls.reduce((sum, p) => sum + Number(p.loanDeduction), 0);

    return {
      periodId: period.id,
      periodName: period.name,
      workerCount: period.workerPayrolls.length,
      employeeCount: period.employeePayrolls.length,
      grossPay: workerGross,
      netPayable: workerNet + employeeNet,
      paid: workerPaid,
      outstanding: workerNet + employeeNet - workerPaid,
      advanceDeductions: advances,
      loanDeductions: loans,
      status: period.status,
    };
  });
}

/** §31 Coordinator report: sales, commission generated/paid per coordinator. */
export async function getCoordinatorPerformanceReport(user: SessionUser) {
  assertCan(user, "view", "sale");
  const coordinators = await db.coordinator.findMany({
    where: { status: "ACTIVE" },
    include: { sales: true, commissions: true },
    orderBy: { name: "asc" },
  });

  return coordinators
    .map((c) => ({
      coordinator: c.name,
      totalSales: c.sales.reduce((sum, s) => sum + Number(s.amount), 0),
      commissionGenerated: c.commissions.reduce((sum, comm) => sum + Number(comm.amount), 0),
      commissionPaid: c.commissions.filter((comm) => comm.status === "PAID").reduce((sum, comm) => sum + Number(comm.amount), 0),
      commissionOutstanding: c.commissions
        .filter((comm) => comm.status !== "PAID")
        .reduce((sum, comm) => sum + Number(comm.amount), 0),
    }))
    .filter((r) => r.totalSales > 0 || r.commissionGenerated > 0);
}

/** §31 Finance report: company-wide revenue, expenses, receivables, payables, profit. */
export async function getFinanceOverviewReport(user: SessionUser) {
  assertCan(user, "view", "invoice");

  const [invoices, expenses, workerPayrolls, employeePayrolls, commissions, advances, loans] = await Promise.all([
    db.invoice.findMany({ where: { status: { not: "CANCELLED" } }, include: { payments: true } }),
    db.expense.aggregate({ where: { deletedAt: null }, _sum: { amount: true } }),
    db.workerPayroll.findMany({ include: { payments: true } }),
    db.employeePayroll.findMany(),
    db.commission.aggregate({ _sum: { amount: true } }),
    db.advance.findMany({ where: { status: "ACTIVE" }, include: { repayments: true } }),
    db.loan.findMany({ where: { status: "ACTIVE" }, include: { repayments: true } }),
  ]);

  const revenue = invoices.reduce((sum, inv) => sum + Number(inv.subtotal), 0);
  const totalInvoiced = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
  const totalClientPaid = invoices.reduce((sum, inv) => sum + inv.payments.reduce((s, p) => s + Number(p.amount), 0), 0);
  const receivables = calculateOutstanding(totalInvoiced, [totalClientPaid]).toNumber();

  const workerNet = workerPayrolls.reduce((sum, p) => sum + Number(p.netPayable), 0);
  const workerPaid = workerPayrolls.reduce((sum, p) => sum + p.payments.reduce((s, pay) => s + Number(pay.amount), 0), 0);
  const employeeNet = employeePayrolls.reduce((sum, p) => sum + Number(p.netPayable), 0);
  const employeePaid = employeePayrolls.filter((p) => p.status === "PAID").reduce((sum, p) => sum + Number(p.netPayable), 0);
  const payables = calculateOutstanding(workerNet + employeeNet, [workerPaid + employeePaid]).toNumber();

  const advancesOutstanding = advances.reduce(
    (sum, a) => sum + calculateRepayableBalance(a.amount.toString(), a.repayments.map((r) => r.amount.toString())).toNumber(),
    0,
  );
  const loansOutstanding = loans.reduce(
    (sum, l) =>
      sum + calculateRepayableBalance(l.principalAmount.toString(), l.repayments.map((r) => r.amount.toString())).toNumber(),
    0,
  );

  return {
    revenue,
    expenses: Number(expenses._sum.amount ?? 0),
    commission: Number(commissions._sum.amount ?? 0),
    receivables,
    payables,
    advancesOutstanding,
    loansOutstanding,
    workerCost: workerPayrolls.reduce((sum, p) => sum + Number(p.grossPay), 0),
  };
}
