import { z } from "zod";

export const PAYMENT_METHODS = ["CASH", "BANK_TRANSFER", "CHEQUE", "OTHER"] as const;
export const WORKER_PAYMENT_TYPES = ["SALARY", "ADVANCE", "LOAN", "SETTLEMENT", "ADJUSTMENT", "OTHER"] as const;

export const advanceFormSchema = z.object({
  workerId: z.string().min(1),
  amount: z.coerce.number().positive("Must be greater than 0"),
  dateGiven: z.string().min(1, "Date is required"),
  reason: z.string().trim().optional().or(z.literal("")),
});
export type AdvanceFormInput = z.infer<typeof advanceFormSchema>;
export type AdvanceFormValues = z.input<typeof advanceFormSchema>;

export const workerPaymentFormSchema = z.object({
  workerId: z.string().min(1),
  amount: z.coerce.number().positive("Must be greater than 0"),
  paymentType: z.enum(WORKER_PAYMENT_TYPES),
  method: z.enum(PAYMENT_METHODS),
  referenceNumber: z.string().trim().optional().or(z.literal("")),
  date: z.string().min(1, "Date is required"),
  remarks: z.string().trim().optional().or(z.literal("")),
});
export type WorkerPaymentFormInput = z.infer<typeof workerPaymentFormSchema>;
export type WorkerPaymentFormValues = z.input<typeof workerPaymentFormSchema>;
