import { z } from "zod";

export const assignmentFormSchema = z.object({
  workerId: z.string().min(1, "Worker is required"),
  clientId: z.string().min(1, "Client is required"),
  projectId: z.string().min(1, "Project is required"),
  siteId: z.string().min(1, "Site is required"),
  designation: z.string().trim().optional().or(z.literal("")),
  workerHourlyRate: z.coerce.number().nonnegative("Must be 0 or more"),
  clientBillingRate: z.coerce.number().nonnegative("Must be 0 or more"),
  startDate: z.string().min(1, "Start date is required"),
  coordinatorId: z.string().optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
});
export type AssignmentFormInput = z.infer<typeof assignmentFormSchema>;
export type AssignmentFormValues = z.input<typeof assignmentFormSchema>;
