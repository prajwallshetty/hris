import { z } from "zod";

export const EQUIPMENT_STATUSES = ["AVAILABLE", "RENTED", "UNDER_MAINTENANCE", "INACTIVE", "RETIRED"] as const;

export const RENTAL_RATE_TYPES = ["HOURLY", "DAILY", "WEEKLY", "MONTHLY", "CUSTOM"] as const;

export const RENTAL_STATUSES = [
  "DRAFT",
  "RESERVED",
  "ACTIVE",
  "EXTENDED",
  "RETURNED",
  "CLOSED",
  "CANCELLED",
  "OVERDUE",
] as const;

export const RENTAL_CHARGE_TYPES = ["RENTAL", "DAMAGE", "MISSING_ITEM", "LATE_FEE", "OTHER"] as const;

export const PAYMENT_METHODS = ["CASH", "BANK_TRANSFER", "CHEQUE", "OTHER"] as const;

export const equipmentFormSchema = z.object({
  serialNumber: z.string().trim().min(1, "Serial number is required"),
  name: z.string().trim().min(1, "Name is required"),
  category: z.string().trim().optional().or(z.literal("")),
  make: z.string().trim().optional().or(z.literal("")),
  model: z.string().trim().optional().or(z.literal("")),
  condition: z.string().trim().optional().or(z.literal("")),
  status: z.enum(EQUIPMENT_STATUSES).optional(),
  hourlyRate: z.coerce.number().nonnegative().optional().nullable(),
  dailyRate: z.coerce.number().nonnegative().optional().nullable(),
  weeklyRate: z.coerce.number().nonnegative().optional().nullable(),
  monthlyRate: z.coerce.number().nonnegative().optional().nullable(),
  ownerCompany: z.string().trim().optional().or(z.literal("")),
  coordinatorId: z.string().optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
});
export type EquipmentFormInput = z.infer<typeof equipmentFormSchema>;
export type EquipmentFormValues = z.input<typeof equipmentFormSchema>;

// rateAmount is entered explicitly rather than looked up from Equipment's
// master rate card at submit time — it's what gets snapshotted onto the
// rental, so the person creating it must see and be able to override it
// (e.g. a negotiated discount) before it's locked in (§4).
export const equipmentRentalFormSchema = z.object({
  equipmentId: z.string().min(1, "Equipment is required"),
  clientId: z.string().min(1, "Client is required"),
  projectId: z.string().optional().or(z.literal("")),
  siteId: z.string().optional().or(z.literal("")),
  coordinatorId: z.string().optional().or(z.literal("")),
  rateType: z.enum(RENTAL_RATE_TYPES),
  rateAmount: z.coerce.number().positive("Must be greater than 0"),
  quantity: z.coerce.number().int().positive().default(1),
  startDate: z.string().min(1, "Start date is required"),
  expectedEndDate: z.string().optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
});
export type EquipmentRentalFormInput = z.infer<typeof equipmentRentalFormSchema>;
export type EquipmentRentalFormValues = z.input<typeof equipmentRentalFormSchema>;

export const rentalReturnFormSchema = z.object({
  actualReturnDate: z.string().min(1, "Return date is required"),
  returnCondition: z.string().trim().optional().or(z.literal("")),
  damageNotes: z.string().trim().optional().or(z.literal("")),
  damageAmount: z.coerce.number().nonnegative().optional().nullable(),
  missingItemsNotes: z.string().trim().optional().or(z.literal("")),
  missingItemsAmount: z.coerce.number().nonnegative().optional().nullable(),
  returnNotes: z.string().trim().optional().or(z.literal("")),
});
export type RentalReturnFormInput = z.infer<typeof rentalReturnFormSchema>;
export type RentalReturnFormValues = z.input<typeof rentalReturnFormSchema>;

export const rentalExtendFormSchema = z.object({
  newExpectedEndDate: z.string().min(1, "New end date is required"),
  notes: z.string().trim().optional().or(z.literal("")),
});
export type RentalExtendFormInput = z.infer<typeof rentalExtendFormSchema>;
export type RentalExtendFormValues = z.input<typeof rentalExtendFormSchema>;

export const rentalChargeFormSchema = z.object({
  rentalId: z.string().min(1),
  type: z.enum(RENTAL_CHARGE_TYPES),
  description: z.string().trim().optional().or(z.literal("")),
  amount: z.coerce.number().positive("Must be greater than 0"),
  date: z.string().min(1, "Date is required"),
});
export type RentalChargeFormInput = z.infer<typeof rentalChargeFormSchema>;
export type RentalChargeFormValues = z.input<typeof rentalChargeFormSchema>;

export const rentalPaymentFormSchema = z.object({
  rentalId: z.string().min(1),
  amount: z.coerce.number().positive("Must be greater than 0"),
  method: z.enum(PAYMENT_METHODS),
  date: z.string().min(1, "Date is required"),
  referenceNumber: z.string().trim().optional().or(z.literal("")),
  remarks: z.string().trim().optional().or(z.literal("")),
});
export type RentalPaymentFormInput = z.infer<typeof rentalPaymentFormSchema>;
export type RentalPaymentFormValues = z.input<typeof rentalPaymentFormSchema>;

export const equipmentMaintenanceFormSchema = z.object({
  equipmentId: z.string().min(1, "Equipment is required"),
  maintenanceType: z.string().trim().min(1, "Maintenance type is required"),
  serviceDate: z.string().optional().or(z.literal("")),
  nextServiceDate: z.string().optional().or(z.literal("")),
  cost: z.coerce.number().nonnegative().optional().nullable(),
  workshop: z.string().trim().optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
  status: z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
});
export type EquipmentMaintenanceFormInput = z.infer<typeof equipmentMaintenanceFormSchema>;
export type EquipmentMaintenanceFormValues = z.input<typeof equipmentMaintenanceFormSchema>;

export function parseEquipmentCodeSearch(term: string): number | null {
  const match = term.trim().match(/^eqp-?0*(\d+)$/i);
  return match ? Number(match[1]) : null;
}

export function parseRentalCodeSearch(term: string): number | null {
  const match = term.trim().match(/^rnt-?0*(\d+)$/i);
  return match ? Number(match[1]) : null;
}
