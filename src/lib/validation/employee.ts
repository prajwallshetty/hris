import { z } from "zod";

export const EMPLOYEE_STATUSES = ["ACTIVE", "ON_LEAVE", "SUSPENDED", "RESIGNED", "TERMINATED"] as const;

export const employeeFormSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required"),
  email: z.string().trim().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().trim().optional().or(z.literal("")),
  department: z.string().trim().optional().or(z.literal("")),
  designation: z.string().trim().optional().or(z.literal("")),
  joiningDate: z.string().optional().or(z.literal("")),
  coordinatorId: z.string().optional().or(z.literal("")),
  baseSalary: z.coerce.number().nonnegative("Must be 0 or more"),
  status: z.enum(EMPLOYEE_STATUSES),
  bankName: z.string().trim().optional().or(z.literal("")),
  bankAccountIban: z.string().trim().optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
});
export type EmployeeFormInput = z.infer<typeof employeeFormSchema>;
export type EmployeeFormValues = z.input<typeof employeeFormSchema>;

export const attendanceFormSchema = z.object({
  employeeId: z.string().min(1),
  date: z.string().min(1, "Date is required"),
  status: z.enum(["PRESENT", "ABSENT", "HALF_DAY", "ON_LEAVE", "HOLIDAY"]),
  checkIn: z.string().optional().or(z.literal("")),
  checkOut: z.string().optional().or(z.literal("")),
  remarks: z.string().trim().optional().or(z.literal("")),
});
export type AttendanceFormInput = z.infer<typeof attendanceFormSchema>;
export type AttendanceFormValues = z.input<typeof attendanceFormSchema>;
