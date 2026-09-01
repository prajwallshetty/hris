import { z } from "zod";

export const payrollPeriodFormSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
    periodStart: z.string().min(1, "Start date is required"),
    periodEnd: z.string().min(1, "End date is required"),
  })
  .refine((data) => new Date(data.periodEnd) >= new Date(data.periodStart), {
    message: "End date must be on or after the start date",
    path: ["periodEnd"],
  });
export type PayrollPeriodFormInput = z.infer<typeof payrollPeriodFormSchema>;
export type PayrollPeriodFormValues = z.input<typeof payrollPeriodFormSchema>;

export const generatePayrollFormSchema = z.object({
  payrollPeriodId: z.string().min(1),
  clientId: z.string().optional().or(z.literal("")),
  siteId: z.string().optional().or(z.literal("")),
  workerId: z.string().optional().or(z.literal("")),
});
export type GeneratePayrollFormInput = z.infer<typeof generatePayrollFormSchema>;
export type GeneratePayrollFormValues = z.input<typeof generatePayrollFormSchema>;

export const PAYROLL_ADJUSTMENT_TYPES = ["ALLOWANCE", "BONUS", "OTHER_DEDUCTION"] as const;
export const payrollAdjustmentFormSchema = z.object({
  workerPayrollId: z.string().min(1),
  type: z.enum(PAYROLL_ADJUSTMENT_TYPES),
  amount: z.coerce.number().positive("Must be greater than 0"),
  description: z.string().trim().min(1, "A description is required"),
});
export type PayrollAdjustmentFormInput = z.infer<typeof payrollAdjustmentFormSchema>;
export type PayrollAdjustmentFormValues = z.input<typeof payrollAdjustmentFormSchema>;

export const applyRepaymentFormSchema = z.object({
  workerPayrollId: z.string().min(1),
  sourceId: z.string().min(1), // advanceId or loanId
  amount: z.coerce.number().positive("Must be greater than 0"),
});
export type ApplyRepaymentFormInput = z.infer<typeof applyRepaymentFormSchema>;
export type ApplyRepaymentFormValues = z.input<typeof applyRepaymentFormSchema>;
