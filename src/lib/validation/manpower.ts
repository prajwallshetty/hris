import { z } from "zod";

export const WORKER_TYPES = ["FRL", "HRD", "OWN"] as const;
export type WorkerTypeValue = (typeof WORKER_TYPES)[number];

export const WORKER_TYPE_LABELS: Record<WorkerTypeValue, string> = {
  FRL: "FRL — Freelance",
  HRD: "HRD — Supplier-provided",
  OWN: "OWN — Company-owned",
};

const optionalText = z.string().trim().optional().or(z.literal(""));
const optionalRate = z.coerce.number().nonnegative("Rate cannot be negative").optional().nullable();

export const IQAMA_PATTERN = /^\d{10}$/;

/** Iqama is optional (new manpower often has none yet) but must be 10 digits when given. */
export const optionalIqama = z
  .string()
  .trim()
  .refine((v) => v === "" || IQAMA_PATTERN.test(v), "Iqama number must be exactly 10 digits")
  .optional();

function isValidDate(value: string) {
  return !Number.isNaN(new Date(value).getTime());
}

export const manpowerRegistrationSchema = z
  .object({
    fullName: z.string().trim().min(2, "Full name is required"),
    nationality: z.string().trim().min(1, "Nationality is required"),
    mobile: z.string().trim().min(5, "Mobile number is required"),
    mobilizationDate: z
      .string()
      .min(1, "Mobilization date is required")
      .refine(isValidDate, "Enter a valid mobilization date"),
    workerType: z.enum(WORKER_TYPES, { message: "Select a worker type" }),
    supplierId: optionalText,

    iqamaNumber: optionalIqama,
    designation: optionalText,
    skillCategory: optionalText,
    clientId: optionalText,
    projectId: optionalText,
    siteId: optionalText,
    workerRate: optionalRate,
    clientBillingRate: optionalRate,
    notes: optionalText,
  })
  .superRefine((data, ctx) => {
    if (data.workerType === "HRD" && !data.supplierId) {
      ctx.addIssue({ code: "custom", path: ["supplierId"], message: "Supplier is required for HRD manpower" });
    }
    // A placement is all-or-nothing: an Assignment needs client, project,
    // site and both rates. Registering with none of them is fine — the
    // worker can be assigned later.
    const placementStarted = Boolean(data.clientId || data.projectId || data.siteId || data.clientBillingRate != null);
    if (!placementStarted) return;
    if (!data.clientId) ctx.addIssue({ code: "custom", path: ["clientId"], message: "Select a client for this placement" });
    if (!data.projectId) ctx.addIssue({ code: "custom", path: ["projectId"], message: "Select a project for this placement" });
    if (!data.siteId) ctx.addIssue({ code: "custom", path: ["siteId"], message: "Select a site for this placement" });
    if (data.workerRate == null) {
      ctx.addIssue({ code: "custom", path: ["workerRate"], message: "Worker rate is required when assigning to a site" });
    }
    if (data.clientBillingRate == null) {
      ctx.addIssue({
        code: "custom",
        path: ["clientBillingRate"],
        message: "Client billing rate is required when assigning to a site",
      });
    }
  });

export type ManpowerRegistrationInput = z.infer<typeof manpowerRegistrationSchema>;
export type ManpowerRegistrationValues = z.input<typeof manpowerRegistrationSchema>;

export const supplierFormSchema = z.object({
  name: z.string().trim().min(2, "Supplier name is required"),
  contactPerson: optionalText,
  phone: optionalText,
  email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
  notes: optionalText,
});

export type SupplierFormInput = z.infer<typeof supplierFormSchema>;
