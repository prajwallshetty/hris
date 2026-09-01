"use server";

import { Decimal } from "decimal.js";
import type { Prisma, PayrollItemType } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import {
  applyRepaymentFormSchema,
  generatePayrollFormSchema,
  payrollAdjustmentFormSchema,
  payrollPeriodFormSchema,
  type ApplyRepaymentFormInput,
  type GeneratePayrollFormInput,
  type PayrollAdjustmentFormInput,
  type PayrollPeriodFormInput,
} from "@/lib/validation/payroll";
import { actionError, ok, type ActionResult } from "@/server/action-result";
import { logAudit } from "@/server/audit";
import { calculateLeaveDeduction, calculateWorkerPayroll } from "@/server/calc";
import { buildWorkerPayrollDraft, type AssignmentHoursGroup } from "@/server/payroll/build-worker-payroll";
import { assertCan } from "@/server/rbac";
import { getActiveOvertimeRule, toOvertimeRuleConfig } from "@/server/queries/settings";
import {
  getUnpaidLeaveDaysInPeriod,
  listApprovedTimesheetItemsForPeriod,
  listWorkerIdsWithPayrollForPeriod,
} from "@/server/queries/payroll";
import { getSessionUser } from "@/server/session";

type Tx = Prisma.TransactionClient;

/** Recomputes a WorkerPayroll's aggregate fields from its item lines — the single path every generation/adjustment/repayment action funnels through (§10/§17). */
async function recomputeWorkerPayrollTotals(tx: Tx, workerPayrollId: string) {
  const payroll = await tx.workerPayroll.findUniqueOrThrow({ where: { id: workerPayrollId }, include: { items: true } });

  const sumByType = (type: PayrollItemType) =>
    payroll.items
      .filter((i) => i.type === type)
      .reduce((sum, i) => sum.plus(i.amount.toString()), new Decimal(0));

  const allowances = sumByType("ALLOWANCE");
  const bonuses = sumByType("BONUS");
  const advanceDeduction = sumByType("ADVANCE_DEDUCTION");
  const loanDeduction = sumByType("LOAN_DEDUCTION");
  const leaveDeduction = sumByType("LEAVE_DEDUCTION");
  const otherDeductions = sumByType("OTHER_DEDUCTION");

  const result = calculateWorkerPayroll({
    regularHours: payroll.regularHours.toString(),
    overtimeHours: payroll.overtimeHours.toString(),
    regularRate: payroll.regularRate.toString(),
    overtimeRate: payroll.overtimeRate.toString(),
    allowances,
    bonuses,
    advanceDeduction,
    loanDeduction,
    leaveDeduction,
    otherDeductions,
  });

  return tx.workerPayroll.update({
    where: { id: workerPayrollId },
    data: {
      allowances: allowances.toFixed(2),
      bonuses: bonuses.toFixed(2),
      advanceDeduction: advanceDeduction.toFixed(2),
      loanDeduction: loanDeduction.toFixed(2),
      leaveDeduction: leaveDeduction.toFixed(2),
      otherDeductions: otherDeductions.toFixed(2),
      grossPay: result.grossPay.toFixed(2),
      netPayable: result.netPayable.toFixed(2),
    },
  });
}

export async function createPayrollPeriod(input: PayrollPeriodFormInput): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "create", "payrollPeriod");
    const data = payrollPeriodFormSchema.parse(input);

    const period = await db.payrollPeriod.create({
      data: {
        name: data.name,
        periodStart: new Date(data.periodStart),
        periodEnd: new Date(data.periodEnd),
        status: "DRAFT",
      },
    });

    await logAudit({ userId: user.id, action: "create", entityType: "PayrollPeriod", entityId: period.id, newValue: data });
    revalidatePath("/payroll");
    return ok({ id: period.id });
  } catch (error) {
    return actionError(error);
  }
}

/**
 * Bulk-generates one WorkerPayroll row per eligible worker (§13: single
 * worker, bulk, by client/site, or by period — the same filters drive all
 * of those). Pulls ONLY from LOCKED timesheets (§11), snapshots rates per
 * assignment (§12), and auto-applies the period's unpaid-leave deduction —
 * everything else (allowances, bonuses, advance/loan repayments) is added
 * afterward during Review, since only a human should decide how much of an
 * advance balance to collect this period.
 */
export async function generateWorkerPayroll(
  input: GeneratePayrollFormInput,
): Promise<ActionResult<{ generated: number; skippedAlreadyGenerated: number }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "create", "workerPayroll");
    const data = generatePayrollFormSchema.parse(input);

    const period = await db.payrollPeriod.findUniqueOrThrow({ where: { id: data.payrollPeriodId } });
    if (period.lockedAt) {
      return { success: false, error: "This payroll period is locked and can no longer be generated into." };
    }

    const [items, alreadyGenerated, overtimeRuleRow] = await Promise.all([
      listApprovedTimesheetItemsForPeriod(period.periodStart, period.periodEnd, {
        clientId: data.clientId || undefined,
        siteId: data.siteId || undefined,
        workerId: data.workerId || undefined,
      }),
      listWorkerIdsWithPayrollForPeriod(period.id),
      getActiveOvertimeRule(),
    ]);

    type WorkerBucket = { workerName: string; groups: Map<string, AssignmentHoursGroup> };
    const byWorker = new Map<string, WorkerBucket>();
    let skippedAlreadyGenerated = 0;
    const skippedWorkerIds = new Set<string>();

    for (const item of items) {
      if (alreadyGenerated.has(item.workerId)) {
        if (!skippedWorkerIds.has(item.workerId)) {
          skippedWorkerIds.add(item.workerId);
          skippedAlreadyGenerated += 1;
        }
        continue;
      }

      const groupKey = item.assignmentId ?? "unassigned";
      const siteLabel = item.assignment
        ? `${item.assignment.site.project.client.companyName} / ${item.assignment.site.name}`
        : "Unassigned";
      const rate = item.assignment ? item.assignment.workerHourlyRate.toString() : (item.worker.hourlyRate?.toString() ?? "0");

      if (!byWorker.has(item.workerId)) byWorker.set(item.workerId, { workerName: item.worker.fullName, groups: new Map() });
      const bucket = byWorker.get(item.workerId)!;
      const existing = bucket.groups.get(groupKey);
      if (existing) {
        existing.regularHours = new Decimal(existing.regularHours).plus(item.regularHours.toString()).toString();
        existing.overtimeHours = new Decimal(existing.overtimeHours).plus(item.overtimeHours.toString()).toString();
      } else {
        bucket.groups.set(groupKey, {
          siteLabel,
          workerHourlyRate: rate,
          regularHours: item.regularHours.toString(),
          overtimeHours: item.overtimeHours.toString(),
        });
      }
    }

    if (byWorker.size === 0) {
      return {
        success: false,
        error:
          skippedAlreadyGenerated > 0
            ? "All matching workers already have payroll generated for this period."
            : "No eligible approved hours found for this period and filters — timesheets must be Locked first.",
      };
    }

    const overtimeRule = toOvertimeRuleConfig(overtimeRuleRow);

    // Computed outside the transaction — read-only lookups against tables
    // this transaction doesn't touch, so there's no need to hold them on
    // the transaction's connection/snapshot.
    const unpaidLeaveDaysByWorker = new Map(
      await Promise.all(
        Array.from(byWorker.keys()).map(
          async (workerId) =>
            [workerId, await getUnpaidLeaveDaysInPeriod(workerId, period.periodStart, period.periodEnd)] as const,
        ),
      ),
    );

    await db.$transaction(async (tx) => {
      for (const [workerId, bucket] of byWorker) {
        const draft = buildWorkerPayrollDraft(Array.from(bucket.groups.values()), overtimeRule.overtimeMultiplier.toString());
        const groupKeys = Array.from(bucket.groups.keys());
        const primaryAssignmentId = groupKeys[0] !== "unassigned" ? groupKeys[0] : null;

        const payroll = await tx.workerPayroll.create({
          data: {
            payrollPeriodId: period.id,
            workerId,
            assignmentId: primaryAssignmentId,
            regularHours: draft.regularHours,
            overtimeHours: draft.overtimeHours,
            regularRate: draft.regularRate,
            overtimeRate: draft.overtimeRate,
            status: "DRAFT",
          },
        });

        await tx.workerPayrollItem.createMany({
          data: draft.items.map((i) => ({
            workerPayrollId: payroll.id,
            type: i.type,
            description: i.description,
            quantity: i.quantity,
            rate: i.rate,
            amount: i.amount,
          })),
        });

        const unpaidLeaveDays = unpaidLeaveDaysByWorker.get(workerId) ?? new Decimal(0);
        if (unpaidLeaveDays.gt(0)) {
          const dailyRate = new Decimal(draft.regularRate).times(overtimeRule.dailyRegularHoursThreshold.toString());
          const leaveDeduction = calculateLeaveDeduction(unpaidLeaveDays, dailyRate);
          await tx.workerPayrollItem.create({
            data: {
              workerPayrollId: payroll.id,
              type: "LEAVE_DEDUCTION",
              description: `${unpaidLeaveDays.toFixed(2)} unpaid leave day(s)`,
              quantity: unpaidLeaveDays.toFixed(2),
              rate: dailyRate.toFixed(2),
              amount: leaveDeduction.toFixed(2),
            },
          });
        }

        await recomputeWorkerPayrollTotals(tx, payroll.id);
      }
    }, { timeout: 30_000 });

    await logAudit({
      userId: user.id,
      action: "create",
      entityType: "PayrollPeriod",
      entityId: period.id,
      newValue: { generated: byWorker.size, filters: data },
    });

    revalidatePath(`/payroll/${period.id}`);
    return ok({ generated: byWorker.size, skippedAlreadyGenerated });
  } catch (error) {
    return actionError(error);
  }
}

const LOCKED_PAYROLL_STATUSES = new Set(["APPROVED", "PAID", "PARTIALLY_PAID"]);

export async function addPayrollAdjustment(input: PayrollAdjustmentFormInput): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "update", "workerPayroll");
    const data = payrollAdjustmentFormSchema.parse(input);

    const payroll = await db.workerPayroll.findUniqueOrThrow({ where: { id: data.workerPayrollId } });
    if (LOCKED_PAYROLL_STATUSES.has(payroll.status)) {
      return { success: false, error: "This payroll has already been approved and can no longer be adjusted." };
    }

    const item = await db.$transaction(async (tx) => {
      const created = await tx.workerPayrollItem.create({
        data: {
          workerPayrollId: data.workerPayrollId,
          type: data.type,
          description: data.description,
          amount: data.amount,
        },
      });
      await recomputeWorkerPayrollTotals(tx, data.workerPayrollId);
      return created;
    });

    await logAudit({
      userId: user.id,
      action: "update",
      entityType: "WorkerPayroll",
      entityId: payroll.id,
      newValue: data,
    });

    revalidatePath(`/payroll/worker/${data.workerPayrollId}`);
    return ok({ id: item.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function applyAdvanceRepaymentToPayroll(input: ApplyRepaymentFormInput): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "update", "workerPayroll");
    const data = applyRepaymentFormSchema.parse(input);

    const workerPayroll = await db.workerPayroll.findUniqueOrThrow({ where: { id: data.workerPayrollId } });
    if (LOCKED_PAYROLL_STATUSES.has(workerPayroll.status)) {
      return { success: false, error: "This payroll has already been approved and can no longer be adjusted." };
    }

    const advanceBefore = await db.advance.findUniqueOrThrow({ where: { id: data.sourceId }, include: { repayments: true } });
    const remainingBefore = new Decimal(advanceBefore.amount.toString()).minus(
      advanceBefore.repayments.reduce((sum, r) => sum.plus(r.amount.toString()), new Decimal(0)),
    );
    if (new Decimal(data.amount).gt(remainingBefore)) {
      return { success: false, error: `Amount exceeds the remaining advance balance of ${remainingBefore.toFixed(2)}.` };
    }

    const payroll = await db.$transaction(async (tx) => {
      const advance = await tx.advance.findUniqueOrThrow({ where: { id: data.sourceId }, include: { repayments: true } });
      const remaining = new Decimal(advance.amount.toString()).minus(
        advance.repayments.reduce((sum, r) => sum.plus(r.amount.toString()), new Decimal(0)),
      );

      await tx.advanceRepayment.create({
        data: { advanceId: advance.id, amount: data.amount, payrollPeriodId: null, date: new Date() },
      });
      if (remaining.minus(data.amount).lte(0)) {
        await tx.advance.update({ where: { id: advance.id }, data: { status: "FULLY_REPAID" } });
      }

      await tx.workerPayrollItem.create({
        data: {
          workerPayrollId: data.workerPayrollId,
          type: "ADVANCE_DEDUCTION",
          description: `Advance repayment (${advance.dateGiven.toISOString().slice(0, 10)})`,
          amount: data.amount,
        },
      });

      return recomputeWorkerPayrollTotals(tx, data.workerPayrollId);
    });

    await logAudit({
      userId: user.id,
      action: "update",
      entityType: "Advance",
      entityId: data.sourceId,
      newValue: { workerPayrollId: data.workerPayrollId, amount: data.amount },
    });

    revalidatePath(`/payroll/worker/${data.workerPayrollId}`);
    return ok({ id: payroll.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function applyLoanRepaymentToPayroll(input: ApplyRepaymentFormInput): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "update", "workerPayroll");
    const data = applyRepaymentFormSchema.parse(input);

    const workerPayroll = await db.workerPayroll.findUniqueOrThrow({ where: { id: data.workerPayrollId } });
    if (LOCKED_PAYROLL_STATUSES.has(workerPayroll.status)) {
      return { success: false, error: "This payroll has already been approved and can no longer be adjusted." };
    }

    const loanBefore = await db.loan.findUniqueOrThrow({ where: { id: data.sourceId }, include: { repayments: true } });
    const remainingBefore = new Decimal(loanBefore.principalAmount.toString()).minus(
      loanBefore.repayments.reduce((sum, r) => sum.plus(r.amount.toString()), new Decimal(0)),
    );
    if (new Decimal(data.amount).gt(remainingBefore)) {
      return { success: false, error: `Amount exceeds the remaining loan balance of ${remainingBefore.toFixed(2)}.` };
    }

    const payroll = await db.$transaction(async (tx) => {
      const loan = await tx.loan.findUniqueOrThrow({ where: { id: data.sourceId }, include: { repayments: true } });
      const remaining = new Decimal(loan.principalAmount.toString()).minus(
        loan.repayments.reduce((sum, r) => sum.plus(r.amount.toString()), new Decimal(0)),
      );

      await tx.loanRepayment.create({
        data: { loanId: loan.id, amount: data.amount, payrollPeriodId: null, date: new Date() },
      });
      if (remaining.minus(data.amount).lte(0)) {
        await tx.loan.update({ where: { id: loan.id }, data: { status: "FULLY_REPAID" } });
      }

      await tx.workerPayrollItem.create({
        data: {
          workerPayrollId: data.workerPayrollId,
          type: "LOAN_DEDUCTION",
          description: `Loan repayment (${loan.dateGiven.toISOString().slice(0, 10)})`,
          amount: data.amount,
        },
      });

      return recomputeWorkerPayrollTotals(tx, data.workerPayrollId);
    });

    await logAudit({
      userId: user.id,
      action: "update",
      entityType: "Loan",
      entityId: data.sourceId,
      newValue: { workerPayrollId: data.workerPayrollId, amount: data.amount },
    });

    revalidatePath(`/payroll/worker/${data.workerPayrollId}`);
    return ok({ id: payroll.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function submitWorkerPayrollForReview(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "update", "workerPayroll");
    const before = await db.workerPayroll.findUniqueOrThrow({ where: { id } });
    if (before.status !== "DRAFT") {
      return { success: false, error: "Only draft payroll rows can be submitted for review." };
    }
    const payroll = await db.workerPayroll.update({ where: { id }, data: { status: "REVIEW" } });
    await logAudit({ userId: user.id, action: "update", entityType: "WorkerPayroll", entityId: id, previousValue: before, newValue: payroll });
    revalidatePath(`/payroll/worker/${id}`);
    return ok({ id });
  } catch (error) {
    return actionError(error);
  }
}

export async function approveWorkerPayroll(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "update", "workerPayroll");
    const before = await db.workerPayroll.findUniqueOrThrow({ where: { id } });
    if (before.status !== "REVIEW") {
      return { success: false, error: "Only payroll rows in review can be approved." };
    }
    const payroll = await db.workerPayroll.update({ where: { id }, data: { status: "APPROVED" } });
    await logAudit({ userId: user.id, action: "update", entityType: "WorkerPayroll", entityId: id, previousValue: before, newValue: payroll });
    revalidatePath(`/payroll/worker/${id}`);
    revalidatePath(`/payroll/${before.payrollPeriodId}`);
    return ok({ id });
  } catch (error) {
    return actionError(error);
  }
}

export async function lockPayrollPeriod(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "update", "payrollPeriod");

    const before = await db.payrollPeriod.findUniqueOrThrow({
      where: { id },
      include: { workerPayrolls: true, employeePayrolls: true },
    });
    if (before.workerPayrolls.length === 0 && before.employeePayrolls.length === 0) {
      return { success: false, error: "Generate payroll for at least one worker or employee before locking the period." };
    }
    const notApproved = before.workerPayrolls.filter(
      (p) => p.status !== "APPROVED" && p.status !== "PAID" && p.status !== "PARTIALLY_PAID",
    );
    if (notApproved.length > 0) {
      return { success: false, error: `${notApproved.length} worker payroll row(s) still need to be approved first.` };
    }
    const notApprovedEmployees = before.employeePayrolls.filter((p) => p.status !== "APPROVED" && p.status !== "PAID");
    if (notApprovedEmployees.length > 0) {
      return { success: false, error: `${notApprovedEmployees.length} employee payroll row(s) still need to be approved first.` };
    }

    const period = await db.payrollPeriod.update({ where: { id }, data: { status: "APPROVED", lockedAt: new Date() } });
    await logAudit({ userId: user.id, action: "update", entityType: "PayrollPeriod", entityId: id, previousValue: before, newValue: period });
    revalidatePath(`/payroll/${id}`);
    revalidatePath("/payroll");
    return ok({ id });
  } catch (error) {
    return actionError(error);
  }
}
