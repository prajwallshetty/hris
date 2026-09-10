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

export async function updateAdvance(id: string, input: AdvanceFormInput): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "update", "advance");
    const data = advanceFormSchema.parse(input);

    const before = await db.advance.findUniqueOrThrow({ where: { id }, include: { repayments: true } });
    if (before.repayments.length > 0) {
      return { success: false, error: "This advance already has payroll deductions recorded, so it can no longer be edited — write it off instead if a correction is needed." };
    }

    const advance = await db.advance.update({
      where: { id },
      data: { amount: data.amount, dateGiven: new Date(data.dateGiven), reason: data.reason || null },
    });

    await logAudit({ userId: user.id, action: "update", entityType: "Advance", entityId: advance.id, previousValue: before, newValue: data });
    revalidatePath(data.workerId ? `/workers/${data.workerId}` : `/employees/${data.employeeId}`);
    revalidatePath(`/workers/${data.workerId}/advances/${id}`);
    return ok({ id: advance.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function writeOffAdvance(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "update", "advance");

    const advance = await db.advance.update({ where: { id }, data: { status: "WRITTEN_OFF" } });

    await logAudit({ userId: user.id, action: "update", entityType: "Advance", entityId: advance.id, newValue: { status: "WRITTEN_OFF" } });
    revalidatePath(advance.workerId ? `/workers/${advance.workerId}` : `/employees/${advance.employeeId}`);
    revalidatePath(`/workers/${advance.workerId}/advances/${id}`);
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

export async function updateLoan(id: string, input: LoanFormInput): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "update", "loan");
    const data = loanFormSchema.parse(input);

    const before = await db.loan.findUniqueOrThrow({ where: { id }, include: { repayments: true } });
    if (before.repayments.length > 0) {
      return { success: false, error: "This loan already has payroll deductions recorded, so it can no longer be edited — write it off instead if a correction is needed." };
    }

    const loan = await db.loan.update({
      where: { id },
      data: {
        principalAmount: data.principalAmount,
        dateGiven: new Date(data.dateGiven),
        installments: data.installments ?? null,
        installmentAmount: data.installmentAmount ?? null,
        reason: data.reason || null,
      },
    });

    await logAudit({ userId: user.id, action: "update", entityType: "Loan", entityId: loan.id, previousValue: before, newValue: data });
    revalidatePath(data.workerId ? `/workers/${data.workerId}` : `/employees/${data.employeeId}`);
    revalidatePath(`/workers/${data.workerId}/loans/${id}`);
    return ok({ id: loan.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function writeOffLoan(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "update", "loan");

    const loan = await db.loan.update({ where: { id }, data: { status: "WRITTEN_OFF" } });

    await logAudit({ userId: user.id, action: "update", entityType: "Loan", entityId: loan.id, newValue: { status: "WRITTEN_OFF" } });
    revalidatePath(loan.workerId ? `/workers/${loan.workerId}` : `/employees/${loan.employeeId}`);
    revalidatePath(`/workers/${loan.workerId}/loans/${id}`);
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
          payroll.payments.filter((p) => !p.voidedAt).map((p) => p.amount.toString()),
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
          payroll.payments.filter((p) => !p.voidedAt).map((p) => p.amount.toString()),
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

// Voiding never deletes the row (§ never delete historical payment
// transactions) — it flags the payment and excludes it from outstanding/
// payroll-status calculations from here on, while it stays visible (marked
// VOIDED) in payment history and the worker ledger for audit purposes.
export async function voidWorkerPayment(id: string, reason: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "update", "workerPayment");
    if (!reason.trim()) {
      return { success: false, error: "A reason is required to void a payment." };
    }

    const payment = await db.$transaction(async (tx) => {
      const before = await tx.workerPayment.findUniqueOrThrow({ where: { id } });
      if (before.voidedAt) {
        throw new Error("This payment has already been voided.");
      }

      const voided = await tx.workerPayment.update({
        where: { id },
        data: { voidedAt: new Date(), voidReason: reason.trim(), voidedById: user.id },
      });

      if (before.workerPayrollId) {
        const payroll = await tx.workerPayroll.findUniqueOrThrow({
          where: { id: before.workerPayrollId },
          include: { payments: true },
        });
        const remaining = calculateOutstanding(
          payroll.netPayable.toString(),
          payroll.payments.filter((p) => !p.voidedAt).map((p) => p.amount.toString()),
        );
        await tx.workerPayroll.update({
          where: { id: before.workerPayrollId },
          data: { status: remaining.lte(0) ? "PAID" : remaining.gte(payroll.netPayable) ? "APPROVED" : "PARTIALLY_PAID" },
        });
      }

      if (before.employeePayrollId) {
        const payroll = await tx.employeePayroll.findUniqueOrThrow({
          where: { id: before.employeePayrollId },
          include: { payments: true },
        });
        const remaining = calculateOutstanding(
          payroll.netPayable.toString(),
          payroll.payments.filter((p) => !p.voidedAt).map((p) => p.amount.toString()),
        );
        await tx.employeePayroll.update({
          where: { id: before.employeePayrollId },
          data: { status: remaining.lte(0) ? "PAID" : remaining.gte(payroll.netPayable) ? "APPROVED" : "PARTIALLY_PAID" },
        });
      }

      return voided;
    });

    await logAudit({
      userId: user.id,
      action: "update",
      entityType: "WorkerPayment",
      entityId: payment.id,
      newValue: { voidedAt: payment.voidedAt, voidReason: reason },
    });
    revalidatePath(payment.workerId ? `/workers/${payment.workerId}` : `/employees/${payment.employeeId}`);
    if (payment.workerPayrollId) revalidatePath(`/payroll/worker/${payment.workerPayrollId}`);
    if (payment.employeePayrollId) revalidatePath(`/payroll/employee/${payment.employeePayrollId}`);
    return ok({ id: payment.id });
  } catch (error) {
    return actionError(error);
  }
}
