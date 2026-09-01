"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import {
  advanceFormSchema,
  loanFormSchema,
  workerPaymentFormSchema,
  type AdvanceFormInput,
  type LoanFormInput,
  type WorkerPaymentFormInput,
} from "@/lib/validation/finance";
import { actionError, ok, type ActionResult } from "@/server/action-result";
import { logAudit } from "@/server/audit";
import { calculateOutstanding } from "@/server/calc";
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

export async function createLoan(input: LoanFormInput): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "create", "loan");
    const data = loanFormSchema.parse(input);

    const loan = await db.loan.create({
      data: {
        workerId: data.workerId,
        principalAmount: data.principalAmount,
        dateGiven: new Date(data.dateGiven),
        installments: data.installments ?? null,
        installmentAmount: data.installmentAmount ?? null,
        reason: data.reason || null,
        status: "ACTIVE",
        createdById: user.id,
      },
    });

    await logAudit({ userId: user.id, action: "create", entityType: "Loan", entityId: loan.id, newValue: data });
    revalidatePath(`/workers/${data.workerId}`);
    return ok({ id: loan.id });
  } catch (error) {
    return actionError(error);
  }
}

// Every payment lands in the ledger (§13); when it's tied to a payroll row,
// the row's status is derived from Net Payable minus the payment ledger —
// never a manually-typed "paid" field (§13/§17).
export async function createWorkerPayment(input: WorkerPaymentFormInput): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "create", "workerPayment");
    const data = workerPaymentFormSchema.parse(input);

    const payment = await db.$transaction(async (tx) => {
      const created = await tx.workerPayment.create({
        data: {
          workerId: data.workerId,
          workerPayrollId: data.workerPayrollId || null,
          amount: data.amount,
          paymentType: data.paymentType,
          method: data.method,
          referenceNumber: data.referenceNumber || null,
          date: new Date(data.date),
          remarks: data.remarks || null,
          createdById: user.id,
        },
      });

      if (data.workerPayrollId) {
        const payroll = await tx.workerPayroll.findUniqueOrThrow({
          where: { id: data.workerPayrollId },
          include: { payments: true },
        });
        const outstanding = calculateOutstanding(
          payroll.netPayable.toString(),
          payroll.payments.map((p) => p.amount.toString()),
        );
        await tx.workerPayroll.update({
          where: { id: data.workerPayrollId },
          data: { status: outstanding.lte(0) ? "PAID" : "PARTIALLY_PAID" },
        });
      }

      return created;
    });

    await logAudit({ userId: user.id, action: "create", entityType: "WorkerPayment", entityId: payment.id, newValue: data });
    revalidatePath(`/workers/${data.workerId}`);
    if (data.workerPayrollId) revalidatePath(`/payroll/worker/${data.workerPayrollId}`);
    return ok({ id: payment.id });
  } catch (error) {
    return actionError(error);
  }
}
