"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import {
  recurringChargeDeductionFormSchema,
  recurringChargeFormSchema,
  type RecurringChargeDeductionFormInput,
  type RecurringChargeFormInput,
} from "@/lib/validation/recurring-charge";
import { actionError, ok, type ActionResult } from "@/server/action-result";
import { logAudit } from "@/server/audit";
import { assertCan } from "@/server/rbac";
import { getSessionUser } from "@/server/session";

function toDate(value?: string | null) {
  return value ? new Date(value) : null;
}

export async function createRecurringCharge(input: RecurringChargeFormInput): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "create", "recurringCharge");
    const data = recurringChargeFormSchema.parse(input);

    const charge = await db.workerRecurringCharge.create({
      data: {
        workerId: data.workerId,
        category: data.category,
        description: data.description || null,
        amount: data.amount,
        frequency: data.frequency,
        startDate: new Date(data.startDate),
        endDate: toDate(data.endDate),
        depositAmount: data.depositAmount ?? null,
        depositPaid: data.depositPaid ?? false,
        notes: data.notes || null,
        createdById: user.id,
      },
    });

    await logAudit({
      userId: user.id,
      action: "create",
      entityType: "WorkerRecurringCharge",
      entityId: charge.id,
      newValue: data,
    });

    revalidatePath(`/workers/${data.workerId}`);
    return ok({ id: charge.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function updateRecurringCharge(
  id: string,
  input: RecurringChargeFormInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "update", "recurringCharge");
    const data = recurringChargeFormSchema.parse(input);

    const before = await db.workerRecurringCharge.findUniqueOrThrow({ where: { id } });
    const charge = await db.workerRecurringCharge.update({
      where: { id },
      data: {
        category: data.category,
        description: data.description || null,
        amount: data.amount,
        frequency: data.frequency,
        startDate: new Date(data.startDate),
        endDate: toDate(data.endDate),
        depositAmount: data.depositAmount ?? null,
        depositPaid: data.depositPaid ?? false,
        notes: data.notes || null,
      },
    });

    await logAudit({
      userId: user.id,
      action: "update",
      entityType: "WorkerRecurringCharge",
      entityId: charge.id,
      previousValue: before,
      newValue: data,
    });

    revalidatePath(`/workers/${data.workerId}`);
    revalidatePath(`/workers/${data.workerId}/recurring-charges/${id}`);
    return ok({ id: charge.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function cancelRecurringCharge(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "archive", "recurringCharge");

    const before = await db.workerRecurringCharge.findUniqueOrThrow({ where: { id } });
    const charge = await db.workerRecurringCharge.update({ where: { id }, data: { status: "CANCELLED" } });

    await logAudit({
      userId: user.id,
      action: "archive",
      entityType: "WorkerRecurringCharge",
      entityId: charge.id,
      previousValue: before,
    });

    revalidatePath(`/workers/${before.workerId}`);
    revalidatePath(`/workers/${before.workerId}/recurring-charges/${id}`);
    return ok({ id: charge.id });
  } catch (error) {
    return actionError(error);
  }
}

// Deductions are recorded directly (like a vehicle expense or an equipment
// payment) rather than gated behind a payroll run — Outstanding is always
// re-derived from this ledger, never stored (§ recurring charges).
export async function recordRecurringChargeDeduction(
  input: RecurringChargeDeductionFormInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "create", "recurringCharge");
    const data = recurringChargeDeductionFormSchema.parse(input);

    const charge = await db.workerRecurringCharge.findUniqueOrThrow({ where: { id: data.chargeId } });

    const deduction = await db.workerRecurringChargeDeduction.create({
      data: {
        chargeId: data.chargeId,
        amount: data.amount,
        date: new Date(data.date),
        notes: data.notes || null,
        createdById: user.id,
      },
    });

    await logAudit({
      userId: user.id,
      action: "create",
      entityType: "WorkerRecurringChargeDeduction",
      entityId: deduction.id,
      newValue: data,
    });

    revalidatePath(`/workers/${charge.workerId}`);
    revalidatePath(`/workers/${charge.workerId}/recurring-charges/${data.chargeId}`);
    return ok({ id: deduction.id });
  } catch (error) {
    return actionError(error);
  }
}
