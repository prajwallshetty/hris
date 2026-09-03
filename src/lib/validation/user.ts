import { z } from "zod";

export const USER_ROLES = ["SUPER_ADMIN", "ADMIN", "HR", "ACCOUNTS", "MANAGER", "COORDINATOR", "CLIENT", "EMPLOYEE"] as const;

export const userFormSchema = z
  .object({
    name: z.string().trim().min(2, "Name is required"),
    email: z.string().trim().email("Invalid email"),
    role: z.enum(USER_ROLES),
    coordinatorId: z.string().optional().or(z.literal("")),
    clientId: z.string().optional().or(z.literal("")),
  })
  .refine((data) => data.role !== "COORDINATOR" || data.coordinatorId, {
    message: "A coordinator user must be linked to a coordinator record.",
    path: ["coordinatorId"],
  })
  .refine((data) => data.role !== "CLIENT" || data.clientId, {
    message: "A client user must be linked to a client record.",
    path: ["clientId"],
  });
export type UserFormInput = z.infer<typeof userFormSchema>;
