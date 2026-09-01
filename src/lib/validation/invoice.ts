import { z } from "zod";

export const generateInvoiceFormSchema = z
  .object({
    clientId: z.string().min(1, "Client is required"),
    projectId: z.string().optional().or(z.literal("")),
    billingPeriodStart: z.string().min(1, "Start date is required"),
    billingPeriodEnd: z.string().min(1, "End date is required"),
  })
  .refine((data) => new Date(data.billingPeriodEnd) >= new Date(data.billingPeriodStart), {
    message: "End date must be on or after the start date",
    path: ["billingPeriodEnd"],
  });
export type GenerateInvoiceFormInput = z.infer<typeof generateInvoiceFormSchema>;
export type GenerateInvoiceFormValues = z.input<typeof generateInvoiceFormSchema>;

export const issueInvoiceFormSchema = z.object({
  invoiceId: z.string().min(1),
  dueDate: z.string().min(1, "Due date is required"),
});
export type IssueInvoiceFormInput = z.infer<typeof issueInvoiceFormSchema>;
export type IssueInvoiceFormValues = z.input<typeof issueInvoiceFormSchema>;

export const clientPaymentFormSchema = z.object({
  clientId: z.string().min(1),
  invoiceId: z.string().optional().or(z.literal("")),
  amount: z.coerce.number().positive("Must be greater than 0"),
  method: z.enum(["CASH", "BANK_TRANSFER", "CHEQUE", "OTHER"]),
  referenceNumber: z.string().trim().optional().or(z.literal("")),
  date: z.string().min(1, "Date is required"),
  remarks: z.string().trim().optional().or(z.literal("")),
});
export type ClientPaymentFormInput = z.infer<typeof clientPaymentFormSchema>;
export type ClientPaymentFormValues = z.input<typeof clientPaymentFormSchema>;
