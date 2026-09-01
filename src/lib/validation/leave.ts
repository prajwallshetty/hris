import { z } from "zod";

export const leaveRequestFormSchema = z
  .object({
    workerId: z.string().optional().or(z.literal("")),
    employeeId: z.string().optional().or(z.literal("")),
    leaveTypeId: z.string().min(1, "Leave type is required"),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),
    days: z.coerce.number().positive("Must be greater than 0"),
    reason: z.string().trim().optional().or(z.literal("")),
  })
  .refine((data) => Boolean(data.workerId) !== Boolean(data.employeeId), {
    message: "Exactly one of worker or employee is required",
    path: ["workerId"],
  });
export type LeaveRequestFormInput = z.infer<typeof leaveRequestFormSchema>;
export type LeaveRequestFormValues = z.input<typeof leaveRequestFormSchema>;
