import { z } from "zod";

export const timesheetUploadMetaSchema = z.object({
  siteId: z.string().min(1, "Site is required"),
  period: z.string().min(1, "Period is required"),
});
export type TimesheetUploadMetaInput = z.infer<typeof timesheetUploadMetaSchema>;

export const manualTimesheetItemFormSchema = z.object({
  workerId: z.string().min(1, "Worker is required"),
  siteId: z.string().min(1, "Site is required"),
  date: z.string().min(1, "Date is required"),
  loginTime: z.string().regex(/^\d{2}:\d{2}$/, "Login time is required"),
  logoutTime: z.string().regex(/^\d{2}:\d{2}$/, "Logout time is required"),
  breakMinutes: z.coerce.number().nonnegative("Must be 0 or more").optional(),
});
export type ManualTimesheetItemFormInput = z.infer<typeof manualTimesheetItemFormSchema>;
export type ManualTimesheetItemFormValues = z.input<typeof manualTimesheetItemFormSchema>;

export const timesheetItemDecisionSchema = z.object({
  itemId: z.string().min(1),
  decision: z.enum(["APPROVED", "REJECTED"]),
  reason: z.string().trim().optional().or(z.literal("")),
});
export type TimesheetItemDecisionInput = z.infer<typeof timesheetItemDecisionSchema>;
