import { z } from "zod";

export const coordinatorFormSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  phone: z.string().trim().optional().or(z.literal("")),
  email: z.string().trim().email("Invalid email").optional().or(z.literal("")),
});
export type CoordinatorFormInput = z.infer<typeof coordinatorFormSchema>;
