import { Decimal } from "decimal.js";

import { db } from "@/lib/db";
import { assertCan, type SessionUser } from "@/server/rbac";

export async function getEmployeePayrollDetail(user: SessionUser, id: string) {
  assertCan(user, "view", "employeePayroll");
  return db.employeePayroll.findUnique({
    where: { id },
    include: {
      payrollPeriod: true,
      employee: true,
      items: { orderBy: { createdAt: "asc" } },
      payments: { orderBy: { date: "desc" } },
    },
  });
}

export async function listActiveEmployeesWithoutPayrollForPeriod(payrollPeriodId: string, employeeId?: string) {
  const alreadyGenerated = await db.employeePayroll.findMany({
    where: { payrollPeriodId },
    select: { employeeId: true },
  });
  const excludeIds = new Set(alreadyGenerated.map((e) => e.employeeId));

  const employees = await db.internalEmployee.findMany({
    where: {
      deletedAt: null,
      status: "ACTIVE",
      ...(employeeId ? { id: employeeId } : {}),
    },
  });

  return employees.filter((e) => !excludeIds.has(e.id));
}

export async function getUnpaidLeaveDaysInPeriodForEmployee(employeeId: string, periodStart: Date, periodEnd: Date) {
  const requests = await db.leaveRequest.findMany({
    where: {
      employeeId,
      status: "APPROVED",
      leaveType: { isPaid: false },
      startDate: { lte: periodEnd },
      endDate: { gte: periodStart },
    },
    select: { days: true },
  });
  return requests.reduce((sum, r) => sum.plus(r.days.toString()), new Decimal(0));
}
