import { z } from "zod";

export const PAYMENT_METHODS = ["CASH", "BANK_TRANSFER", "CHEQUE", "OTHER"] as const;
export const WORKER_PAYMENT_TYPES = ["SALARY", "ADVANCE", "LOAN", "SETTLEMENT", "ADJUSTMENT", "OTHER"] as const;

export const advanceFormSchema = z
  .object({
    workerId: z.string().optional().or(z.literal("")),
    employeeId: z.string().optional().or(z.literal("")),
    amount: z.coerce.number().positive("Must be greater than 0"),
    dateGiven: z.string().min(1, "Date is required"),
    reason: z.string().trim().optional().or(z.literal("")),
  })
  .refine((data) => Boolean(data.workerId) !== Boolean(data.employeeId), {
    message: "Exactly one of worker or employee is required",
    path: ["workerId"],
  });
export type AdvanceFormInput = z.infer<typeof advanceFormSchema>;
export type AdvanceFormValues = z.input<typeof advanceFormSchema>;

export const workerPaymentFormSchema = z
  .object({
    workerId: z.string().optional().or(z.literal("")),
    workerPayrollId: z.string().optional().or(z.literal("")),
    employeeId: z.string().optional().or(z.literal("")),
    employeePayrollId: z.string().optional().or(z.literal("")),
    amount: z.coerce.number().positive("Must be greater than 0"),
    paymentType: z.enum(WORKER_PAYMENT_TYPES),
    method: z.enum(PAYMENT_METHODS),
    referenceNumber: z.string().trim().optional().or(z.literal("")),
    date: z.string().min(1, "Date is required"),
    remarks: z.string().trim().optional().or(z.literal("")),
  })
  .refine((data) => Boolean(data.workerId) !== Boolean(data.employeeId), {
    message: "Exactly one of worker or employee is required",
    path: ["workerId"],
  });
export type WorkerPaymentFormInput = z.infer<typeof workerPaymentFormSchema>;
export type WorkerPaymentFormValues = z.input<typeof workerPaymentFormSchema>;

export const loanFormSchema = z
  .object({
    workerId: z.string().optional().or(z.literal("")),
    employeeId: z.string().optional().or(z.literal("")),
    principalAmount: z.coerce.number().positive("Must be greater than 0"),
    dateGiven: z.string().min(1, "Date is required"),
    installments: z.coerce.number().int().positive().optional(),
    installmentAmount: z.coerce.number().positive().optional(),
    reason: z.string().trim().optional().or(z.literal("")),
  })
  .refine((data) => Boolean(data.workerId) !== Boolean(data.employeeId), {
    message: "Exactly one of worker or employee is required",
    path: ["workerId"],
  });
export type LoanFormInput = z.infer<typeof loanFormSchema>;
export type LoanFormValues = z.input<typeof loanFormSchema>;
