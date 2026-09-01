"use server";

import { Decimal } from "decimal.js";
import type { Prisma, PayrollItemType } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { actionError, ok, type ActionResult } from "@/server/action-result";
import { logAudit } from "@/server/audit";
import { calculateEmployeePayroll, calculateLeaveDeduction } from "@/server/calc";
import {
  getUnpaidLeaveDaysInPeriodForEmployee,
  listActiveEmployeesWithoutPayrollForPeriod,
} from "@/server/queries/employee-payroll";
import { assertCan } from "@/server/rbac";
import { getSessionUser } from "@/server/session";

const STANDARD_DAYS_PER_MONTH = 30;

/**
 * Generates one EmployeePayroll row per eligible active employee — fixed
 * monthly salary, never mixed with hourly worker payroll (§15). Unlike
 * worker payroll there's no timesheet dependency; the only automatic
 * deduction is unpaid leave, using baseSalary/30 as the daily rate.
 */
export async function generateEmployeePayroll(input: {
  payrollPeriodId: string;
  employeeId?: string;
}): Promise<ActionResult<{ generated: number }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "create", "employeePayroll");

    const period = await db.payrollPeriod.findUniqueOrThrow({ where: { id: input.payrollPeriodId } });
    if (period.lockedAt) {
      return { success: false, error: "This payroll period is locked and can no longer be generated into." };
    }

    const employees = await listActiveEmployeesWithoutPayrollForPeriod(input.payrollPeriodId, input.employeeId);
    if (employees.length === 0) {
      return { success: false, error: "No eligible employees found — they may already have payroll generated for this period." };
    }

    await db.$transaction(async (tx) => {
      for (const employee of employees) {
        const baseSalary = new Decimal(employee.baseSalary.toString());
        const unpaidLeaveDays = await getUnpaidLeaveDaysInPeriodForEmployee(employee.id, period.periodStart, period.periodEnd);

        const payroll = await tx.employeePayroll.create({
          data: {
            payrollPeriodId: period.id,
            employeeId: employee.id,
            baseSalary: baseSalary.toFixed(2),
            status: "DRAFT",
          },
        });

        if (unpaidLeaveDays.gt(0)) {
          const dailyRate = baseSalary.div(STANDARD_DAYS_PER_MONTH);
          const leaveDeduction = calculateLeaveDeduction(unpaidLeaveDays, dailyRate);
          await tx.employeePayrollItem.create({
            data: {
              employeePayrollId: payroll.id,
              type: "LEAVE_DEDUCTION",
              description: `${unpaidLeaveDays.toFixed(2)} unpaid leave day(s)`,
              amount: leaveDeduction.toFixed(2),
            },
          });
        }

        await recomputeEmployeePayrollTotals(tx, payroll.id);
      }
    }, { timeout: 30_000 });

    await logAudit({
      userId: user.id,
      action: "create",
      entityType: "PayrollPeriod",
      entityId: period.id,
      newValue: { generatedEmployeePayrolls: employees.length },
    });

    revalidatePath(`/payroll/${period.id}`);
    return ok({ generated: employees.length });
  } catch (error) {
    return actionError(error);
  }
}

async function recomputeEmployeePayrollTotals(tx: Prisma.TransactionClient, employeePayrollId: string) {
  const payroll = await tx.employeePayroll.findUniqueOrThrow({ where: { id: employeePayrollId }, include: { items: true } });
  const sumByType = (type: PayrollItemType) =>
    payroll.items.filter((i) => i.type === type).reduce((sum, i) => sum.plus(i.amount.toString()), new Decimal(0));

  const allowances = sumByType("ALLOWANCE");
  const bonuses = sumByType("BONUS");
  const advanceDeduction = sumByType("ADVANCE_DEDUCTION");
  const loanDeduction = sumByType("LOAN_DEDUCTION");
  const leaveDeduction = sumByType("LEAVE_DEDUCTION");
  const otherDeductions = sumByType("OTHER_DEDUCTION");

  const result = calculateEmployeePayroll({
    baseSalary: payroll.baseSalary.toString(),
    allowances,
    bonuses,
    advanceDeduction,
    loanDeduction,
    leaveDeduction,
    otherDeductions,
  });

  return tx.employeePayroll.update({
    where: { id: employeePayrollId },
    data: {
      allowances: allowances.toFixed(2),
      bonuses: bonuses.toFixed(2),
      advanceDeduction: advanceDeduction.toFixed(2),
      loanDeduction: loanDeduction.toFixed(2),
      leaveDeduction: leaveDeduction.toFixed(2),
      otherDeductions: otherDeductions.toFixed(2),
      netPayable: result.netPayable.toFixed(2),
    },
  });
}

type EmployeeAdjustmentType = "ALLOWANCE" | "BONUS" | "OTHER_DEDUCTION";

export async function addEmployeePayrollAdjustment(input: {
  employeePayrollId: string;
  type: EmployeeAdjustmentType;
  amount: number;
  description: string;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "update", "employeePayroll");

    const payroll = await db.employeePayroll.findUniqueOrThrow({ where: { id: input.employeePayrollId } });
    if (payroll.status !== "DRAFT" && payroll.status !== "REVIEW") {
      return { success: false, error: "This payroll has already been approved and can no longer be adjusted." };
    }
    if (input.amount <= 0) {
      return { success: false, error: "Amount must be greater than 0." };
    }

    const item = await db.$transaction(async (tx) => {
      const created = await tx.employeePayrollItem.create({
        data: {
          employeePayrollId: input.employeePayrollId,
          type: input.type,
          description: input.description,
          amount: input.amount,
        },
      });
      await recomputeEmployeePayrollTotals(tx, input.employeePayrollId);
      return created;
    });

    await logAudit({
      userId: user.id,
      action: "update",
      entityType: "EmployeePayroll",
      entityId: input.employeePayrollId,
      newValue: input,
    });

    revalidatePath(`/payroll/employee/${input.employeePayrollId}`);
    return ok({ id: item.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function submitEmployeePayrollForReview(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "update", "employeePayroll");
    const before = await db.employeePayroll.findUniqueOrThrow({ where: { id } });
    if (before.status !== "DRAFT") {
      return { success: false, error: "Only draft payroll rows can be submitted for review." };
    }
    const payroll = await db.employeePayroll.update({ where: { id }, data: { status: "REVIEW" } });
    await logAudit({ userId: user.id, action: "update", entityType: "EmployeePayroll", entityId: id, previousValue: before, newValue: payroll });
    revalidatePath(`/payroll/employee/${id}`);
    return ok({ id });
  } catch (error) {
    return actionError(error);
  }
}

export async function approveEmployeePayroll(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "update", "employeePayroll");
    const before = await db.employeePayroll.findUniqueOrThrow({ where: { id } });
    if (before.status !== "REVIEW") {
      return { success: false, error: "Only payroll rows in review can be approved." };
    }
    const payroll = await db.employeePayroll.update({ where: { id }, data: { status: "APPROVED" } });
    await logAudit({ userId: user.id, action: "update", entityType: "EmployeePayroll", entityId: id, previousValue: before, newValue: payroll });
    revalidatePath(`/payroll/employee/${id}`);
    revalidatePath(`/payroll/${before.payrollPeriodId}`);
    return ok({ id });
  } catch (error) {
    return actionError(error);
  }
}
