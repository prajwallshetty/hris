import { z } from "zod";

export const assignmentFormSchema = z
  .object({
    workerId: z.string().min(1, "Worker is required"),
    clientId: z.string().min(1, "Client is required"),
    projectId: z.string().min(1, "Project is required"),
    siteId: z.string().min(1, "Site is required"),
    designation: z.string().trim().optional().or(z.literal("")),
    workerHourlyRate: z.coerce.number().min(0.01, "Worker rate must be greater than 0"),
    clientBillingRate: z.coerce.number().min(0.01, "Client rate must be greater than 0"),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().optional().or(z.literal("")),
    coordinatorId: z.string().optional().or(z.literal("")),
    notes: z.string().trim().optional().or(z.literal("")),
  })
  .refine(
    (data) => {
      if (data.endDate && data.startDate) {
        return new Date(data.endDate) >= new Date(data.startDate);
      }
      return true;
    },
    {
      message: "End date cannot be before start date",
      path: ["endDate"],
    },
  );

export type AssignmentFormInput = z.infer<typeof assignmentFormSchema>;
export type AssignmentFormValues = z.input<typeof assignmentFormSchema>;

// Editing an assignment is deliberately narrower than creating one: worker/
// client/project/site/startDate define which assignment this IS — changing
// them would silently rewrite history rather than correct a mistake, so
// only rates/designation/coordinator/notes are editable in place. A real
// deployment change goes through end + create (§ never overwrite history).
export const assignmentEditFormSchema = z.object({
  designation: z.string().trim().optional().or(z.literal("")),
  workerHourlyRate: z.coerce.number().min(0.01, "Worker rate must be greater than 0"),
  clientBillingRate: z.coerce.number().min(0.01, "Client rate must be greater than 0"),
  coordinatorId: z.string().optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
});
export type AssignmentEditFormInput = z.infer<typeof assignmentEditFormSchema>;
export type AssignmentEditFormValues = z.input<typeof assignmentEditFormSchema>;

