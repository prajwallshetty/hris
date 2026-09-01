import { z } from "zod";

export const saleFormSchema = z.object({
  coordinatorId: z.string().min(1),
  clientId: z.string().optional().or(z.literal("")),
  description: z.string().trim().optional().or(z.literal("")),
  amount: z.coerce.number().positive("Must be greater than 0"),
  date: z.string().min(1, "Date is required"),
});
export type SaleFormInput = z.infer<typeof saleFormSchema>;
export type SaleFormValues = z.input<typeof saleFormSchema>;

export const COMMISSION_TYPES = [
  "PERCENT_OF_SALES",
  "PERCENT_OF_INVOICE",
  "PERCENT_OF_PROFIT",
  "PER_WORKER",
  "PER_HOUR",
  "FIXED_AMOUNT",
] as const;

export const commissionRuleFormSchema = z.object({
  coordinatorId: z.string().optional().or(z.literal("")), // empty = global default rule
  type: z.enum(COMMISSION_TYPES),
  rateOrAmount: z.coerce.number().positive("Must be greater than 0"),
  recurring: z.boolean().optional(),
});
export type CommissionRuleFormInput = z.infer<typeof commissionRuleFormSchema>;
export type CommissionRuleFormValues = z.input<typeof commissionRuleFormSchema>;

export const generateCommissionFromSaleFormSchema = z.object({
  saleId: z.string().min(1, "Sale is required"),
  commissionRuleId: z.string().min(1, "Commission rule is required"),
});
export type GenerateCommissionFromSaleFormInput = z.infer<typeof generateCommissionFromSaleFormSchema>;
export type GenerateCommissionFromSaleFormValues = z.input<typeof generateCommissionFromSaleFormSchema>;
