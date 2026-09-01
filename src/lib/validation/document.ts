import { z } from "zod";

export const DOCUMENT_TYPES = ["Iqama", "Passport", "Contract", "Certificate", "Medical", "Other"] as const;

export const documentFormSchema = z.object({
  workerId: z.string().min(1),
  fileName: z.string().trim().min(1, "File name is required"),
  fileUrl: z.string().trim().url("Must be a valid URL"),
  documentType: z.string().trim().optional().or(z.literal("")),
  expiryDate: z.string().optional().or(z.literal("")),
});
export type DocumentFormInput = z.infer<typeof documentFormSchema>;
export type DocumentFormValues = z.input<typeof documentFormSchema>;
