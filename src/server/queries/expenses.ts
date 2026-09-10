import type { ExpenseCategory, Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { assertCan, type SessionUser } from "@/server/rbac";

export async function listExpenses(
  user: SessionUser,
  params: {
    category?: ExpenseCategory | "ALL";
    clientId?: string;
    coordinatorId?: string;
    page?: number;
    pageSize?: number;
  } = {},
) {
  assertCan(user, "view", "expense");
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 25;

  const where: Prisma.ExpenseWhereInput = {
    deletedAt: null,
    ...(params.category && params.category !== "ALL" ? { category: params.category } : {}),
    ...(params.clientId ? { clientId: params.clientId } : {}),
    ...(params.coordinatorId ? { coordinatorId: params.coordinatorId } : {}),
  };

  const [expenses, total] = await Promise.all([
    db.expense.findMany({
      where,
      include: { worker: true, client: true, site: true },
      orderBy: { date: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.expense.count({ where }),
  ]);

  // coordinatorId/departmentId are bare scalars on Expense (no Prisma
  // relation defined), so resolve their display names with two small
  // batch lookups instead.
  const coordinatorIds = [...new Set(expenses.map((e) => e.coordinatorId).filter((id): id is string => !!id))];
  const departmentIds = [...new Set(expenses.map((e) => e.departmentId).filter((id): id is string => !!id))];
  const [coordinators, departments] = await Promise.all([
    coordinatorIds.length ? db.coordinator.findMany({ where: { id: { in: coordinatorIds } }, select: { id: true, name: true } }) : [],
    departmentIds.length ? db.department.findMany({ where: { id: { in: departmentIds } }, select: { id: true, name: true } }) : [],
  ]);
  const coordinatorNameById = new Map(coordinators.map((c) => [c.id, c.name]));
  const departmentNameById = new Map(departments.map((d) => [d.id, d.name]));

  const expensesWithNames = expenses.map((e) => ({
    ...e,
    coordinatorName: e.coordinatorId ? (coordinatorNameById.get(e.coordinatorId) ?? null) : null,
    departmentName: e.departmentId ? (departmentNameById.get(e.departmentId) ?? null) : null,
  }));

  return { expenses: expensesWithNames, total, page, pageSize };
}

export async function getTotalExpenses(filters: { clientId?: string } = {}) {
  const result = await db.expense.aggregate({
    where: { deletedAt: null, ...(filters.clientId ? { clientId: filters.clientId } : {}) },
    _sum: { amount: true },
  });
  return result._sum.amount ?? 0;
}
