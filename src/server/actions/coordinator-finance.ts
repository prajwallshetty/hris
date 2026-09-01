"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import {
  commissionRuleFormSchema,
  generateCommissionFromSaleFormSchema,
  saleFormSchema,
  type CommissionRuleFormInput,
  type GenerateCommissionFromSaleFormInput,
  type SaleFormInput,
} from "@/lib/validation/coordinator-finance";
import { actionError, ok, type ActionResult } from "@/server/action-result";
import { logAudit } from "@/server/audit";
import { calculateCommission } from "@/server/calc";
import { assertCan } from "@/server/rbac";
import { getSessionUser } from "@/server/session";

export async function createSale(input: SaleFormInput): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "create", "sale");
    const data = saleFormSchema.parse(input);

    // A COORDINATOR-role user may only ever log a sale under themselves.
    if (user.role === "COORDINATOR" && data.coordinatorId !== user.coordinatorId) {
      return { success: false, error: "You can only record sales for yourself." };
    }

    const sale = await db.sale.create({
      data: {
        coordinatorId: data.coordinatorId,
        clientId: data.clientId || null,
        description: data.description || null,
        amount: data.amount,
        date: new Date(data.date),
        createdById: user.id,
      },
    });

    await logAudit({ userId: user.id, action: "create", entityType: "Sale", entityId: sale.id, newValue: data });
    revalidatePath(`/coordinators/${data.coordinatorId}`);
    return ok({ id: sale.id });
  } catch (error) {
    return actionError(error);
  }
}

// Commission rules live under Settings, alongside OvertimeRule/BillingRule
// (§17: calculation rules live in data, not hardcoded) — a null
// coordinatorId is the global default; a set one overrides it for that
// coordinator only, per the schema's own convention.
export async function createCommissionRule(input: CommissionRuleFormInput): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "update", "settings");
    const data = commissionRuleFormSchema.parse(input);

    const rule = await db.commissionRule.create({
      data: {
        coordinatorId: data.coordinatorId || null,
        type: data.type,
        rateOrAmount: data.rateOrAmount,
        recurring: data.recurring ?? false,
        status: "ACTIVE",
      },
    });

    await logAudit({ userId: user.id, action: "create", entityType: "CommissionRule", entityId: rule.id, newValue: data });
    revalidatePath("/settings");
    return ok({ id: rule.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function archiveCommissionRule(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "update", "settings");
    const before = await db.commissionRule.findUniqueOrThrow({ where: { id } });
    const rule = await db.commissionRule.update({ where: { id }, data: { status: "INACTIVE" } });
    await logAudit({ userId: user.id, action: "archive", entityType: "CommissionRule", entityId: id, previousValue: before, newValue: rule });
    revalidatePath("/settings");
    return ok({ id });
  } catch (error) {
    return actionError(error);
  }
}

/**
 * Generates a Commission from an existing Sale. Restricted to
 * PERCENT_OF_SALES and FIXED_AMOUNT rules — the other bases (per invoice,
 * per profit, per worker, per hour) don't derive from a single Sale record
 * and need their own generation entry point, not built in this pass.
 */
export async function generateCommissionFromSale(
  input: GenerateCommissionFromSaleFormInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "create", "commission");
    const data = generateCommissionFromSaleFormSchema.parse(input);

    const [sale, rule] = await Promise.all([
      db.sale.findUniqueOrThrow({ where: { id: data.saleId } }),
      db.commissionRule.findUniqueOrThrow({ where: { id: data.commissionRuleId } }),
    ]);

    if (rule.type !== "PERCENT_OF_SALES" && rule.type !== "FIXED_AMOUNT") {
      return {
        success: false,
        error: "Only percent-of-sales or fixed-amount rules can be generated directly from a sale.",
      };
    }

    const amount = calculateCommission(
      { type: rule.type, rateOrAmount: rule.rateOrAmount.toString() },
      { salesAmount: sale.amount.toString() },
    );

    const commission = await db.$transaction(async (tx) => {
      const created = await tx.commission.create({
        data: {
          coordinatorId: sale.coordinatorId,
          commissionRuleId: rule.id,
          saleId: sale.id,
          amount: amount.toFixed(2),
          status: "DRAFT",
        },
      });
      await tx.commissionItem.create({
        data: {
          commissionId: created.id,
          description: sale.description ?? `Sale on ${sale.date.toISOString().slice(0, 10)}`,
          baseAmount: sale.amount,
          rate: rule.rateOrAmount,
          amount: amount.toFixed(2),
        },
      });
      return created;
    });

    await logAudit({
      userId: user.id,
      action: "create",
      entityType: "Commission",
      entityId: commission.id,
      newValue: { saleId: sale.id, ruleId: rule.id, amount: amount.toFixed(2) },
    });

    revalidatePath(`/coordinators/${sale.coordinatorId}`);
    return ok({ id: commission.id });
  } catch (error) {
    return actionError(error);
  }
}

const COMMISSION_TRANSITIONS: Record<string, string> = {
  DRAFT: "APPROVED",
  APPROVED: "PAYABLE",
  PAYABLE: "PAID",
};

export async function advanceCommissionStatus(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "update", "commission");
    const before = await db.commission.findUniqueOrThrow({ where: { id } });
    const next = COMMISSION_TRANSITIONS[before.status];
    if (!next) {
      return { success: false, error: "This commission has already been paid." };
    }

    const data: { status: "APPROVED" | "PAYABLE" | "PAID"; approvedById?: string; approvedAt?: Date } = {
      status: next as "APPROVED" | "PAYABLE" | "PAID",
    };
    if (next === "APPROVED") {
      data.approvedById = user.id;
      data.approvedAt = new Date();
    }

    const commission = await db.commission.update({ where: { id }, data });
    await logAudit({
      userId: user.id,
      action: "update",
      entityType: "Commission",
      entityId: id,
      previousValue: before,
      newValue: commission,
    });
    revalidatePath(`/coordinators/${before.coordinatorId}`);
    return ok({ id });
  } catch (error) {
    return actionError(error);
  }
}
