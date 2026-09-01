import { db } from "@/lib/db";
import { DEFAULT_OVERTIME_RULE, type OvertimeRuleConfig } from "@/server/calc";

const CURRENCY_KEY = "currency_code";
const COMPANY_NAME_KEY = "company_name";

export async function getActiveOvertimeRule() {
  const rule = await db.overtimeRule.findFirst({ where: { status: "ACTIVE" }, orderBy: { createdAt: "desc" } });
  return (
    rule ??
    (await db.overtimeRule.create({
      data: { name: "Default", ...DEFAULT_OVERTIME_RULE },
    }))
  );
}

export async function getActiveBillingRule() {
  const rule = await db.billingRule.findFirst({ where: { status: "ACTIVE" }, orderBy: { createdAt: "desc" } });
  return rule ?? (await db.billingRule.create({ data: { name: "Default", taxPercent: 0 } }));
}

export async function getSystemSettings() {
  const settings = await db.systemSetting.findMany({ where: { key: { in: [CURRENCY_KEY, COMPANY_NAME_KEY] } } });
  const map = new Map(settings.map((s) => [s.key, s.value]));
  return {
    currencyCode: map.get(CURRENCY_KEY) ?? "SAR",
    companyName: map.get(COMPANY_NAME_KEY) ?? "Manpower HRIS",
  };
}

export const SETTING_KEYS = { CURRENCY_KEY, COMPANY_NAME_KEY };

/** Converts a stored OvertimeRule row (Prisma Decimals) into the calc engine's plain config shape. */
export function toOvertimeRuleConfig(rule: {
  dailyRegularHoursThreshold: unknown;
  overtimeMultiplier: unknown;
  maxDailyHours: unknown;
  minPayableHours: unknown;
}): OvertimeRuleConfig {
  return {
    dailyRegularHoursThreshold: String(rule.dailyRegularHoursThreshold),
    overtimeMultiplier: String(rule.overtimeMultiplier),
    maxDailyHours: rule.maxDailyHours === null ? null : String(rule.maxDailyHours),
    minPayableHours: rule.minPayableHours === null ? null : String(rule.minPayableHours),
  };
}
