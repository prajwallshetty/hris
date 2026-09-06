import { db } from "@/lib/db";
import { calculateRecurringChargeDue } from "@/server/calc/recurring-charge";
import { assertCan, type SessionUser } from "@/server/rbac";

export async function listWorkerRecurringCharges(user: SessionUser, workerId: string) {
  assertCan(user, "view", "recurringCharge");
  return db.workerRecurringCharge.findMany({
    where: { workerId },
    include: { deductions: { orderBy: { date: "desc" } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getRecurringChargeDetail(user: SessionUser, id: string) {
  assertCan(user, "view", "recurringCharge");
  return db.workerRecurringCharge.findUnique({
    where: { id },
    include: { worker: true, deductions: { orderBy: { date: "desc" } } },
  });
}

/** Due-to-date / paid / outstanding for one charge — the same calc engine
 * function used everywhere this charge's balance is displayed. */
export function summarizeRecurringCharge(charge: {
  startDate: Date;
  frequency: "WEEKLY" | "MONTHLY" | "QUARTERLY" | "ANNUALLY" | "ONE_TIME";
  amount: unknown;
  depositAmount: unknown;
  depositPaid: boolean;
  deductions: { amount: unknown }[];
}) {
  const due = calculateRecurringChargeDue({
    startDate: charge.startDate,
    frequency: charge.frequency,
    amount: charge.amount!.toString(),
    depositAmount: charge.depositAmount ? charge.depositAmount.toString() : undefined,
    depositPaid: charge.depositPaid,
  });
  const paid = charge.deductions.reduce((sum, d) => sum + Number(d.amount), 0);
  const outstanding = due.minus(paid);
  return { due: due.toNumber(), paid, outstanding: outstanding.toNumber() };
}
