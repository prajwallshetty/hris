import { z } from "zod";

export const WORKER_STATUSES = [
  "ACTIVE",
  "AVAILABLE",
  "ON_LEAVE",
  "SUSPENDED",
  "DEMOBILIZED",
  "RESIGNED",
  "TERMINATED",
] as const;

export const workerFormSchema = z.object({
  iqamaNumber: z
    .string()
    .trim()
    .regex(/^\d{10}$/, "Iqama number must be exactly 10 digits"),
  fullName: z.string().trim().min(2, "Full name is required"),
  mobile: z.string().trim().optional().or(z.literal("")),
  passportNumber: z.string().trim().optional().or(z.literal("")),
  passportExpiryDate: z.string().optional().or(z.literal("")),
  iqamaExpiryDate: z.string().optional().or(z.literal("")),
  nationality: z.string().trim().optional().or(z.literal("")),
  dateOfBirth: z.string().optional().or(z.literal("")),
  designation: z.string().trim().optional().or(z.literal("")),
  skillCategory: z.string().trim().optional().or(z.literal("")),
  joiningDate: z.string().optional().or(z.literal("")),
  mobilizationDate: z.string().optional().or(z.literal("")),
  demobilizationDate: z.string().optional().or(z.literal("")),
  coordinatorId: z.string().optional().or(z.literal("")),
  hourlyRate: z.coerce.number().nonnegative().optional().nullable(),
  overtimeRate: z.coerce.number().nonnegative().optional().nullable(),
  status: z.enum(WORKER_STATUSES),
  bankName: z.string().trim().optional().or(z.literal("")),
  bankAccountIban: z.string().trim().optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
});

export type WorkerFormInput = z.infer<typeof workerFormSchema>;
// Raw field values as held by the form (before zod coerces rate strings to
// numbers) — react-hook-form needs both the pre- and post-resolver shapes
// whenever a schema transforms input, per @hookform/resolvers' zod v4 typing.
export type WorkerFormValues = z.input<typeof workerFormSchema>;
