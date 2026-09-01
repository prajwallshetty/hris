import { z } from "zod";

export const DOCUMENT_TYPES = ["Iqama", "Passport", "Contract", "Certificate", "Medical", "Other"] as const;

// The file itself travels as a FormData entry (see uploadWorkerDocument),
// not through this schema — this only validates the accompanying metadata.
export const documentMetaSchema = z.object({
  workerId: z.string().min(1),
  documentType: z.string().trim().optional().or(z.literal("")),
  expiryDate: z.string().optional().or(z.literal("")),
});
export type DocumentMetaInput = z.infer<typeof documentMetaSchema>;
