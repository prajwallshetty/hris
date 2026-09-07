import { db } from "@/lib/db";
import { calculateOutstanding } from "@/server/calc";
import { assertCan, type SessionUser } from "@/server/rbac";

export async function listWorkerPayrollHistory(workerId: string) {
  return db.workerPayroll.findMany({
    where: { workerId },
    include: {
      payrollPeriod: true,
      items: true,
      payments: { orderBy: { date: "desc" } },
    },
    orderBy: { payrollPeriod: { periodStart: "desc" } },
  });
}

export async function listWorkerLeave(workerId: string) {
  const [balances, requests, leaveTypes] = await Promise.all([
    db.leaveBalance.findMany({ where: { workerId }, include: { leaveType: true }, orderBy: { year: "desc" } }),
    db.leaveRequest.findMany({ where: { workerId }, include: { leaveType: true }, orderBy: { startDate: "desc" } }),
    db.leaveType.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
  ]);
  return { balances, requests, leaveTypes };
}

export async function listWorkerAdvances(workerId: string) {
  return db.advance.findMany({
    where: { workerId },
    include: { repayments: { orderBy: { date: "asc" } } },
    orderBy: { dateGiven: "desc" },
  });
}

export async function listWorkerPayments(workerId: string) {
  return db.workerPayment.findMany({
    where: { workerId },
    include: {
      worker: { select: { fullName: true, mobile: true } },
      workerPayroll: { include: { payrollPeriod: true } },
    },
    orderBy: { date: "desc" },
  });
}

export async function listWorkerLoans(workerId: string) {
  return db.loan.findMany({
    where: { workerId },
    include: { repayments: { orderBy: { date: "asc" } } },
    orderBy: { dateGiven: "desc" },
  });
}

export async function getLoanDetail(user: SessionUser, loanId: string) {
  assertCan(user, "view", "loan");
  const loan = await db.loan.findUnique({
    where: { id: loanId },
    include: { worker: true, repayments: { orderBy: { date: "asc" } } },
  });
  return loan;
}

export async function getAdvanceDetail(user: SessionUser, advanceId: string) {
  assertCan(user, "view", "advance");
  const advance = await db.advance.findUnique({
    where: { id: advanceId },
    include: { worker: true, repayments: { orderBy: { date: "asc" } } },
  });
  return advance;
}

/** One payment's full receipt data — the payroll's remaining balance is
 * computed the same way createWorkerPayment computed it, never re-derived
 * differently (§ single calculation engine). */
export async function getWorkerPaymentReceipt(user: SessionUser, workerId: string, paymentId: string) {
  assertCan(user, "view", "workerPayment");

  const payment = await db.workerPayment.findFirst({
    where: { id: paymentId, workerId },
    include: {
      worker: { include: { designation: true } },
      workerPayroll: { include: { payrollPeriod: true, payments: true, items: true } },
    },
  });
  if (!payment) return null;

  const currentAssignment = await db.assignment.findFirst({
    where: { workerId, status: "ACTIVE" },
    include: { client: true, site: true },
  });

  const outstanding = payment.workerPayroll
    ? calculateOutstanding(
        payment.workerPayroll.netPayable.toString(),
        payment.workerPayroll.payments.map((p) => p.amount.toString()),
      ).toNumber()
    : null;

  return { payment, outstanding, currentAssignment };
}
