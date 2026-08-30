import { db } from "@/lib/db";

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
    include: { workerPayroll: { include: { payrollPeriod: true } } },
    orderBy: { date: "desc" },
  });
}
