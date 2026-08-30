"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { advanceFormSchema, workerPaymentFormSchema, type AdvanceFormInput, type WorkerPaymentFormInput } from "@/lib/validation/finance";
import { actionError, ok, type ActionResult } from "@/server/action-result";
import { logAudit } from "@/server/audit";
import { assertCan } from "@/server/rbac";
import { getSessionUser } from "@/server/session";

export async function createAdvance(input: AdvanceFormInput): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "create", "advance");
    const data = advanceFormSchema.parse(input);

    const advance = await db.advance.create({
      data: {
        workerId: data.workerId,
        amount: data.amount,
        dateGiven: new Date(data.dateGiven),
        reason: data.reason || null,
        status: "ACTIVE",
        createdById: user.id,
      },
    });

    await logAudit({ userId: user.id, action: "create", entityType: "Advance", entityId: advance.id, newValue: data });
    revalidatePath(`/workers/${data.workerId}`);
    return ok({ id: advance.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function createWorkerPayment(input: WorkerPaymentFormInput): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "create", "workerPayment");
    const data = workerPaymentFormSchema.parse(input);

    const payment = await db.workerPayment.create({
      data: {
        workerId: data.workerId,
        amount: data.amount,
        paymentType: data.paymentType,
        method: data.method,
        referenceNumber: data.referenceNumber || null,
        date: new Date(data.date),
        remarks: data.remarks || null,
        createdById: user.id,
      },
    });

    await logAudit({ userId: user.id, action: "create", entityType: "WorkerPayment", entityId: payment.id, newValue: data });
    revalidatePath(`/workers/${data.workerId}`);
    return ok({ id: payment.id });
  } catch (error) {
    return actionError(error);
  }
}
