import { z } from "zod";

import { optionalIqama, WORKER_TYPES } from "./manpower";

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
  iqamaNumber: optionalIqama,
  // Optional here only so records created before worker types existed can
  // still be edited; new registrations require it (manpowerRegistrationSchema).
  workerType: z.enum(WORKER_TYPES).optional().or(z.literal("")),
  supplierId: z.string().optional().or(z.literal("")),
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
  batchNumber: z.string().trim().optional().or(z.literal("")),
  bankName: z.string().trim().optional().or(z.literal("")),
  bankAccountIban: z.string().trim().optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
}).superRefine((data, ctx) => {
  if (data.workerType === "HRD" && !data.supplierId) {
    ctx.addIssue({ code: "custom", path: ["supplierId"], message: "Supplier is required for HRD manpower" });
  }
});

export type WorkerFormInput = z.infer<typeof workerFormSchema>;
// Raw field values as held by the form (before zod coerces rate strings to
// numbers) — react-hook-form needs both the pre- and post-resolver shapes
// whenever a schema transforms input, per @hookform/resolvers' zod v4 typing.
export type WorkerFormValues = z.input<typeof workerFormSchema>;
