import { db } from "@/lib/db";
import { calculateAssignmentMargin, calculateOutstanding, calculateProfitability } from "@/server/calc";

export async function listClientContacts(clientId: string) {
  return db.clientContact.findMany({ where: { clientId }, orderBy: [{ isPrimary: "desc" }, { name: "asc" }] });
}

export async function listClientContracts(clientId: string) {
  return db.clientContract.findMany({ where: { clientId }, orderBy: { startDate: "desc" } });
}

export async function listClientWorkers(clientId: string) {
  return db.assignment.findMany({
    where: { clientId, status: "ACTIVE" },
    include: { worker: { include: { designation: true } }, site: true },
    orderBy: { startDate: "desc" },
  });
}

export async function listClientInvoices(clientId: string) {
  return db.invoice.findMany({
    where: { clientId },
    include: { payments: true, items: true },
    orderBy: { billingPeriodStart: "desc" },
  });
}

/**
 * Client-level profitability (§5.5): revenue from invoiced hours, worker
 * cost matched by joining each client assignment's worker to their payroll
 * for periods that actually overlap the assignment window, plus linked
 * expenses and coordinator commission on this client's sales.
 */
export async function getClientFinancials(clientId: string) {
  const [invoices, assignments, expenses, sales] = await Promise.all([
    db.invoice.findMany({ where: { clientId }, include: { payments: true } }),
    db.assignment.findMany({ where: { clientId }, select: { workerId: true, startDate: true, endDate: true } }),
    db.expense.findMany({ where: { clientId, deletedAt: null } }),
    db.sale.findMany({ where: { clientId }, include: { commissions: true } }),
  ]);

  const revenue = invoices.reduce((sum, inv) => sum + Number(inv.subtotal), 0);
  const totalInvoiced = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + inv.payments.reduce((s, p) => s + Number(p.amount), 0), 0);
  const outstanding = calculateOutstanding(totalInvoiced, [totalPaid]);

  const workerIds = [...new Set(assignments.map((a) => a.workerId))];
  const payrollRows = workerIds.length
    ? await db.workerPayroll.findMany({
        where: { workerId: { in: workerIds } },
        include: { payrollPeriod: true },
      })
    : [];

  let workerCost = 0;
  for (const assignment of assignments) {
    const windowEnd = assignment.endDate ?? new Date();
    for (const payroll of payrollRows) {
      if (payroll.workerId !== assignment.workerId) continue;
      const periodStart = payroll.payrollPeriod.periodStart;
      if (periodStart >= assignment.startDate && periodStart <= windowEnd) {
        workerCost += Number(payroll.grossPay);
      }
    }
  }

  const expenseTotal = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const commissionTotal = sales.reduce(
    (sum, sale) => sum + sale.commissions.reduce((s, c) => s + Number(c.amount), 0),
    0,
  );

  const margin = calculateAssignmentMargin(revenue, workerCost);
  const profit = calculateProfitability({ revenue, workerCost, expenses: expenseTotal, commission: commissionTotal });

  return {
    invoiceCount: invoices.length,
    revenue,
    totalInvoiced,
    totalPaid,
    outstanding: outstanding.toNumber(),
    workerCost,
    expenseTotal,
    commissionTotal,
    margin: margin.toNumber(),
    profit: profit.toNumber(),
  };
}
