"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import {
  billingRuleFormSchema,
  currencySettingFormSchema,
  overtimeRuleFormSchema,
  type BillingRuleFormInput,
  type CurrencySettingFormInput,
  type OvertimeRuleFormInput,
} from "@/lib/validation/settings";
import { actionError, ok, type ActionResult } from "@/server/action-result";
import { logAudit } from "@/server/audit";
import { assertCan } from "@/server/rbac";
import { getActiveBillingRule, getActiveOvertimeRule, SETTING_KEYS } from "@/server/queries/settings";
import { getSessionUser } from "@/server/session";

export async function updateOvertimeRule(input: OvertimeRuleFormInput): Promise<ActionResult<undefined>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "update", "settings");
    const data = overtimeRuleFormSchema.parse(input);

    const current = await getActiveOvertimeRule();
    await db.overtimeRule.update({
      where: { id: current.id },
      data: {
        dailyRegularHoursThreshold: data.dailyRegularHoursThreshold,
        overtimeMultiplier: data.overtimeMultiplier,
        maxDailyHours: data.maxDailyHours,
        minPayableHours: data.minPayableHours,
      },
    });

    await logAudit({ userId: user.id, action: "update", entityType: "OvertimeRule", entityId: current.id, newValue: data });
    revalidatePath("/settings");
    return ok(undefined);
  } catch (error) {
    return actionError(error);
  }
}

export async function updateBillingRule(input: BillingRuleFormInput): Promise<ActionResult<undefined>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "update", "settings");
    const data = billingRuleFormSchema.parse(input);

    const current = await getActiveBillingRule();
    await db.billingRule.update({ where: { id: current.id }, data: { taxPercent: data.taxPercent } });

    await logAudit({ userId: user.id, action: "update", entityType: "BillingRule", entityId: current.id, newValue: data });
    revalidatePath("/settings");
    return ok(undefined);
  } catch (error) {
    return actionError(error);
  }
}

export async function updateCurrencySettings(input: CurrencySettingFormInput): Promise<ActionResult<undefined>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "update", "settings");
    const data = currencySettingFormSchema.parse(input);

    await db.$transaction([
      db.systemSetting.upsert({
        where: { key: SETTING_KEYS.CURRENCY_KEY },
        update: { value: data.currencyCode },
        create: { key: SETTING_KEYS.CURRENCY_KEY, value: data.currencyCode, description: "ISO currency code used across the app" },
      }),
      db.systemSetting.upsert({
        where: { key: SETTING_KEYS.COMPANY_NAME_KEY },
        update: { value: data.companyName },
        create: { key: SETTING_KEYS.COMPANY_NAME_KEY, value: data.companyName, description: "Company name shown in the UI" },
      }),
    ]);

    await logAudit({ userId: user.id, action: "update", entityType: "SystemSetting", entityId: "currency_and_company", newValue: data });
    revalidatePath("/settings");
    return ok(undefined);
  } catch (error) {
    return actionError(error);
  }
}
