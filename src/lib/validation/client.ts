import { z } from "zod";

export const ENTITY_STATUSES = ["ACTIVE", "INACTIVE"] as const;

export const clientFormSchema = z.object({
  companyName: z.string().trim().min(2, "Company name is required"),
  contactPerson: z.string().trim().optional().or(z.literal("")),
  phone: z.string().trim().optional().or(z.literal("")),
  email: z.string().trim().email("Invalid email").optional().or(z.literal("")),
  address: z.string().trim().optional().or(z.literal("")),
  contractRef: z.string().trim().optional().or(z.literal("")),
  paymentTerms: z.string().trim().optional().or(z.literal("")),
  billingTerms: z.string().trim().optional().or(z.literal("")),
  status: z.enum(ENTITY_STATUSES),
});
export type ClientFormInput = z.infer<typeof clientFormSchema>;

export const projectFormSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  name: z.string().trim().min(2, "Project name is required"),
  status: z.enum(ENTITY_STATUSES),
});
export type ProjectFormInput = z.infer<typeof projectFormSchema>;

export const siteFormSchema = z.object({
  projectId: z.string().min(1, "Project is required"),
  name: z.string().trim().min(2, "Site name is required"),
  location: z.string().trim().optional().or(z.literal("")),
  status: z.enum(ENTITY_STATUSES),
});
export type SiteFormInput = z.infer<typeof siteFormSchema>;

export const clientContactFormSchema = z.object({
  clientId: z.string().min(1),
  name: z.string().trim().min(1, "Name is required"),
  designation: z.string().trim().optional().or(z.literal("")),
  phone: z.string().trim().optional().or(z.literal("")),
  email: z.string().trim().email("Invalid email").optional().or(z.literal("")),
  isPrimary: z.boolean(),
});
export type ClientContactFormInput = z.infer<typeof clientContactFormSchema>;
export type ClientContactFormValues = z.input<typeof clientContactFormSchema>;

export const clientContractFormSchema = z.object({
  clientId: z.string().min(1),
  contractNumber: z.string().trim().optional().or(z.literal("")),
  startDate: z.string().optional().or(z.literal("")),
  endDate: z.string().optional().or(z.literal("")),
  terms: z.string().trim().optional().or(z.literal("")),
});
export type ClientContractFormInput = z.infer<typeof clientContractFormSchema>;
