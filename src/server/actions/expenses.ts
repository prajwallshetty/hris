"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { expenseFormSchema, type ExpenseFormInput } from "@/lib/validation/expense";
import { actionError, ok, type ActionResult } from "@/server/action-result";
import { logAudit } from "@/server/audit";
import { assertCan } from "@/server/rbac";
import { getSessionUser } from "@/server/session";

async function resolveDepartmentId(name?: string | null): Promise<string | null> {
  const trimmed = name?.trim();
  if (!trimmed) return null;
  const department = await db.department.upsert({ where: { name: trimmed }, update: {}, create: { name: trimmed } });
  return department.id;
}

export async function createExpense(input: ExpenseFormInput): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "create", "expense");
    const data = expenseFormSchema.parse(input);
    const departmentId = await resolveDepartmentId(data.department);

    const expense = await db.expense.create({
      data: {
        category: data.category,
        amount: data.amount,
        date: new Date(data.date),
        description: data.description || null,
        workerId: data.workerId || null,
        clientId: data.clientId || null,
        siteId: data.siteId || null,
        coordinatorId: data.coordinatorId || null,
        departmentId,
        createdById: user.id,
      },
    });

    await logAudit({ userId: user.id, action: "create", entityType: "Expense", entityId: expense.id, newValue: data });
    revalidatePath("/expenses");
    if (data.clientId) revalidatePath(`/clients/${data.clientId}`);
    return ok({ id: expense.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function archiveExpense(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "archive", "expense");
    const before = await db.expense.findUniqueOrThrow({ where: { id } });
    const expense = await db.expense.update({ where: { id }, data: { deletedAt: new Date() } });
    await logAudit({ userId: user.id, action: "archive", entityType: "Expense", entityId: id, previousValue: before });
    revalidatePath("/expenses");
    if (before.clientId) revalidatePath(`/clients/${before.clientId}`);
    return ok({ id: expense.id });
  } catch (error) {
    return actionError(error);
  }
}
