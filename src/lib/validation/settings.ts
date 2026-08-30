import { z } from "zod";

export const overtimeRuleFormSchema = z.object({
  dailyRegularHoursThreshold: z.coerce.number().positive("Must be greater than 0"),
  overtimeMultiplier: z.coerce.number().positive("Must be greater than 0"),
  maxDailyHours: z.coerce.number().positive().optional().nullable(),
  minPayableHours: z.coerce.number().nonnegative().optional().nullable(),
});
export type OvertimeRuleFormInput = z.infer<typeof overtimeRuleFormSchema>;
export type OvertimeRuleFormValues = z.input<typeof overtimeRuleFormSchema>;

export const billingRuleFormSchema = z.object({
  taxPercent: z.coerce.number().min(0).max(100),
});
export type BillingRuleFormInput = z.infer<typeof billingRuleFormSchema>;
export type BillingRuleFormValues = z.input<typeof billingRuleFormSchema>;

export const currencySettingFormSchema = z.object({
  currencyCode: z.string().trim().length(3, "Use a 3-letter currency code, e.g. SAR").toUpperCase(),
  companyName: z.string().trim().min(1, "Company name is required"),
});
export type CurrencySettingFormInput = z.infer<typeof currencySettingFormSchema>;
