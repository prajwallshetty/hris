"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { generateUniqueReceiptNumber } from "@/lib/receipt-number";
import {
  advanceFormSchema,
  loanFormSchema,
  workerPaymentFormSchema,
  type AdvanceFormInput,
  type LoanFormInput,
  type WorkerPaymentFormInput,
} from "@/lib/validation/finance";
import { formatReceiptNumber } from "@/lib/codes";
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
        workerId: data.workerId || null,
        employeeId: data.employeeId || null,
        amount: data.amount,
        dateGiven: new Date(data.dateGiven),
        reason: data.reason || null,
        status: "ACTIVE",
        createdById: user.id,
      },
    });

    await logAudit({ userId: user.id, action: "create", entityType: "Advance", entityId: advance.id, newValue: data });
    revalidatePath(data.workerId ? `/workers/${data.workerId}` : `/employees/${data.employeeId}`);
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
        workerId: data.workerId || null,
        employeeId: data.employeeId || null,
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
    revalidatePath(data.workerId ? `/workers/${data.workerId}` : `/employees/${data.employeeId}`);
    return ok({ id: loan.id });
  } catch (error) {
    return actionError(error);
  }
}

// Every payment lands in the ledger (§13); when it's tied to a payroll row,
// the row's status is derived from Net Payable minus the payment ledger —
// never a manually-typed "paid" field (§13/§17).
export type WorkerPaymentReceipt = {
  id: string;
  receiptNumber: string;
  amount: number;
  /** Remaining balance on the linked payroll after this payment — null when
   * this payment isn't tied to a specific payroll (advance/loan/other). */
  outstanding: number | null;
};

export async function createWorkerPayment(input: WorkerPaymentFormInput): Promise<ActionResult<WorkerPaymentReceipt>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "create", "workerPayment");
    const data = workerPaymentFormSchema.parse(input);

    const receiptNumber = await generateUniqueReceiptNumber(new Date(data.date).getFullYear());

    const { payment, outstanding } = await db.$transaction(async (tx) => {
      const created = await tx.workerPayment.create({
        data: {
          receiptNumber,
          workerId: data.workerId || null,
          workerPayrollId: data.workerPayrollId || null,
          employeeId: data.employeeId || null,
          employeePayrollId: data.employeePayrollId || null,
          amount: data.amount,
          paymentType: data.paymentType,
          method: data.method,
          referenceNumber: data.referenceNumber || null,
          date: new Date(data.date),
          remarks: data.remarks || null,
          createdById: user.id,
        },
      });

      let outstanding: number | null = null;

      if (data.workerPayrollId) {
        const payroll = await tx.workerPayroll.findUniqueOrThrow({
          where: { id: data.workerPayrollId },
          include: { payments: true },
        });
        const remaining = calculateOutstanding(
          payroll.netPayable.toString(),
          payroll.payments.map((p) => p.amount.toString()),
        );
        outstanding = remaining.toNumber();
        await tx.workerPayroll.update({
          where: { id: data.workerPayrollId },
          data: { status: remaining.lte(0) ? "PAID" : "PARTIALLY_PAID" },
        });
      }

      if (data.employeePayrollId) {
        const payroll = await tx.employeePayroll.findUniqueOrThrow({
          where: { id: data.employeePayrollId },
          include: { payments: true },
        });
        const remaining = calculateOutstanding(
          payroll.netPayable.toString(),
          payroll.payments.map((p) => p.amount.toString()),
        );
        outstanding = remaining.toNumber();
        await tx.employeePayroll.update({
          where: { id: data.employeePayrollId },
          data: { status: remaining.lte(0) ? "PAID" : "PARTIALLY_PAID" },
        });
      }

      return { payment: created, outstanding };
    });

    await logAudit({ userId: user.id, action: "create", entityType: "WorkerPayment", entityId: payment.id, newValue: data });
    revalidatePath(data.workerId ? `/workers/${data.workerId}` : `/employees/${data.employeeId}`);
    if (data.workerPayrollId) revalidatePath(`/payroll/worker/${data.workerPayrollId}`);
    if (data.employeePayrollId) revalidatePath(`/payroll/employee/${data.employeePayrollId}`);

    const finalReceiptNumber = payment.receiptNumber ?? receiptNumber ?? formatReceiptNumber(payment.sequenceNo);

    return ok({
      id: payment.id,
      receiptNumber: finalReceiptNumber,
      amount: Number(payment.amount),
      outstanding,
    });
  } catch (error) {
    return actionError(error);
  }
}
