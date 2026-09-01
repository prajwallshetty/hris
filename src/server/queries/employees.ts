import { db } from "@/lib/db";
import { assertCan, type SessionUser } from "@/server/rbac";

export async function listEmployees(user: SessionUser, params: { search?: string; page?: number; pageSize?: number } = {}) {
  assertCan(user, "view", "employee");
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 25;

  const where = {
    deletedAt: null,
    ...(params.search ? { fullName: { contains: params.search, mode: "insensitive" as const } } : {}),
  };

  const [employees, total] = await Promise.all([
    db.internalEmployee.findMany({
      where,
      include: { department: true, designation: true, coordinator: true },
      orderBy: { fullName: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.internalEmployee.count({ where }),
  ]);

  return { employees, total, page, pageSize };
}

export async function getEmployee(user: SessionUser, id: string) {
  assertCan(user, "view", "employee");
  return db.internalEmployee.findFirst({
    where: { id, deletedAt: null },
    include: { department: true, designation: true, coordinator: true },
  });
}

export async function listEmployeeAttendance(employeeId: string) {
  return db.attendance.findMany({ where: { employeeId }, orderBy: { date: "desc" }, take: 60 });
}

export async function listEmployeeLeave(employeeId: string) {
  const [balances, requests, leaveTypes] = await Promise.all([
    db.leaveBalance.findMany({ where: { employeeId }, include: { leaveType: true }, orderBy: { year: "desc" } }),
    db.leaveRequest.findMany({ where: { employeeId }, include: { leaveType: true }, orderBy: { startDate: "desc" } }),
    db.leaveType.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
  ]);
  return { balances, requests, leaveTypes };
}

export async function listEmployeeAdvances(employeeId: string) {
  return db.advance.findMany({
    where: { employeeId },
    include: { repayments: { orderBy: { date: "asc" } } },
    orderBy: { dateGiven: "desc" },
  });
}

export async function listEmployeeLoans(employeeId: string) {
  return db.loan.findMany({
    where: { employeeId },
    include: { repayments: { orderBy: { date: "asc" } } },
    orderBy: { dateGiven: "desc" },
  });
}

export async function listEmployeePayrollHistory(employeeId: string) {
  return db.employeePayroll.findMany({
    where: { employeeId },
    include: { payrollPeriod: true, items: true },
    orderBy: { payrollPeriod: { periodStart: "desc" } },
  });
}

export async function listEmployeesForSelect(user: SessionUser) {
  assertCan(user, "view", "employee");
  return db.internalEmployee.findMany({
    where: { deletedAt: null, status: "ACTIVE" },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true },
  });
}
