import { z } from "zod";

export const EXPENSE_CATEGORIES = [
  "TRANSPORT",
  "ACCOMMODATION",
  "RECRUITMENT",
  "TRAVEL",
  "MEDICAL",
  "WORKER",
  "SITE",
  "OFFICE",
  "OTHER",
] as const;

export const expenseFormSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  amount: z.coerce.number().positive("Must be greater than 0"),
  date: z.string().min(1, "Date is required"),
  description: z.string().trim().optional().or(z.literal("")),
  workerId: z.string().optional().or(z.literal("")),
  clientId: z.string().optional().or(z.literal("")),
  siteId: z.string().optional().or(z.literal("")),
  coordinatorId: z.string().optional().or(z.literal("")),
  department: z.string().trim().optional().or(z.literal("")),
});
export type ExpenseFormInput = z.infer<typeof expenseFormSchema>;
export type ExpenseFormValues = z.input<typeof expenseFormSchema>;
