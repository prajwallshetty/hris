import { z } from "zod";

export const RECURRING_CHARGE_CATEGORIES = ["HOUSING", "TRANSPORT", "MEAL", "UTILITY", "OTHER"] as const;
export const BILLING_FREQUENCIES = ["WEEKLY", "MONTHLY", "QUARTERLY", "ANNUALLY", "ONE_TIME"] as const;
export const RECURRING_CHARGE_STATUSES = ["ACTIVE", "COMPLETED", "CANCELLED"] as const;

export const recurringChargeFormSchema = z.object({
  workerId: z.string().min(1, "Worker is required"),
  category: z.enum(RECURRING_CHARGE_CATEGORIES),
  description: z.string().trim().optional().or(z.literal("")),
  amount: z.coerce.number().positive("Must be greater than 0"),
  frequency: z.enum(BILLING_FREQUENCIES),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional().or(z.literal("")),
  depositAmount: z.coerce.number().nonnegative().optional().nullable(),
  depositPaid: z.boolean().optional(),
  notes: z.string().trim().optional().or(z.literal("")),
});
export type RecurringChargeFormInput = z.infer<typeof recurringChargeFormSchema>;
export type RecurringChargeFormValues = z.input<typeof recurringChargeFormSchema>;

export const recurringChargeDeductionFormSchema = z.object({
  chargeId: z.string().min(1),
  amount: z.coerce.number().positive("Must be greater than 0"),
  date: z.string().min(1, "Date is required"),
  notes: z.string().trim().optional().or(z.literal("")),
});
export type RecurringChargeDeductionFormInput = z.infer<typeof recurringChargeDeductionFormSchema>;
export type RecurringChargeDeductionFormValues = z.input<typeof recurringChargeDeductionFormSchema>;
