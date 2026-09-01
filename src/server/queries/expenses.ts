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

  return { expenses, total, page, pageSize };
}

export async function getTotalExpenses(filters: { clientId?: string } = {}) {
  const result = await db.expense.aggregate({
    where: { deletedAt: null, ...(filters.clientId ? { clientId: filters.clientId } : {}) },
    _sum: { amount: true },
  });
  return result._sum.amount ?? 0;
}
