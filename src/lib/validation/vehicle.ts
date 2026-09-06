import { z } from "zod";

export const VEHICLE_STATUSES = [
  "AVAILABLE",
  "ASSIGNED",
  "UNDER_MAINTENANCE",
  "INACTIVE",
  "RETIRED",
] as const;

export const VEHICLE_EXPENSE_CATEGORIES = [
  "FUEL",
  "MAINTENANCE",
  "REPAIR",
  "INSURANCE",
  "REGISTRATION",
  "FINES",
  "PARKING",
  "TOLL",
  "OTHER",
] as const;

export const MAINTENANCE_STATUSES = ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;

export const VEHICLE_DOCUMENT_TYPES = ["REGISTRATION", "INSURANCE", "INSPECTION", "OTHER"] as const;

export const vehicleFormSchema = z.object({
  plateNumber: z.string().trim().min(1, "Plate number is required"),
  make: z.string().trim().min(1, "Make is required"),
  model: z.string().trim().min(1, "Model is required"),
  year: z.coerce.number().int().optional().nullable(),
  color: z.string().trim().optional().or(z.literal("")),
  vehicleType: z.string().trim().optional().or(z.literal("")),
  vin: z.string().trim().optional().or(z.literal("")),
  currentMileage: z.coerce.number().nonnegative().optional().nullable(),
  status: z.enum(VEHICLE_STATUSES).optional(),
  registrationExpiry: z.string().optional().or(z.literal("")),
  insuranceExpiry: z.string().optional().or(z.literal("")),
  inspectionExpiry: z.string().optional().or(z.literal("")),
  ownerCompany: z.string().trim().optional().or(z.literal("")),
  coordinatorId: z.string().optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
});
export type VehicleFormInput = z.infer<typeof vehicleFormSchema>;
export type VehicleFormValues = z.input<typeof vehicleFormSchema>;

// A vehicle is handed to exactly one worker at a time (§4) — the client/
// project/site travel with the worker's own current assignment context so
// the vehicle's deployment location is always attributable.
export const vehicleAssignFormSchema = z.object({
  vehicleId: z.string().min(1, "Vehicle is required"),
  workerId: z.string().min(1, "Worker is required"),
  coordinatorId: z.string().optional().or(z.literal("")),
  clientId: z.string().optional().or(z.literal("")),
  projectId: z.string().optional().or(z.literal("")),
  siteId: z.string().optional().or(z.literal("")),
  startDate: z.string().min(1, "Start date is required"),
  expectedReturnDate: z.string().optional().or(z.literal("")),
  startingMileage: z.coerce.number().nonnegative().optional().nullable(),
  notes: z.string().trim().optional().or(z.literal("")),
});
export type VehicleAssignFormInput = z.infer<typeof vehicleAssignFormSchema>;
export type VehicleAssignFormValues = z.input<typeof vehicleAssignFormSchema>;

export const vehicleReturnFormSchema = z.object({
  endingMileage: z.coerce.number().nonnegative().optional().nullable(),
  condition: z.string().trim().optional().or(z.literal("")),
  damageNotes: z.string().trim().optional().or(z.literal("")),
  fuelLevel: z.string().trim().optional().or(z.literal("")),
  returnNotes: z.string().trim().optional().or(z.literal("")),
  returnedById: z.string().optional().or(z.literal("")),
  receivedById: z.string().optional().or(z.literal("")),
  // When damage is reported and a repair cost is known up front, a
  // VehicleExpense is created alongside the return so the cost immediately
  // feeds profitability (§4) rather than waiting on a separate entry.
  damageAmount: z.coerce.number().nonnegative().optional().nullable(),
});
export type VehicleReturnFormInput = z.infer<typeof vehicleReturnFormSchema>;
export type VehicleReturnFormValues = z.input<typeof vehicleReturnFormSchema>;

export const vehicleExpenseFormSchema = z.object({
  vehicleId: z.string().min(1, "Vehicle is required"),
  category: z.enum(VEHICLE_EXPENSE_CATEGORIES),
  amount: z.coerce.number().positive("Must be greater than 0"),
  date: z.string().min(1, "Date is required"),
  workerId: z.string().optional().or(z.literal("")),
  coordinatorId: z.string().optional().or(z.literal("")),
  clientId: z.string().optional().or(z.literal("")),
  projectId: z.string().optional().or(z.literal("")),
  siteId: z.string().optional().or(z.literal("")),
  receiptUrl: z.string().trim().optional().or(z.literal("")),
  description: z.string().trim().optional().or(z.literal("")),
});
export type VehicleExpenseFormInput = z.infer<typeof vehicleExpenseFormSchema>;
export type VehicleExpenseFormValues = z.input<typeof vehicleExpenseFormSchema>;

export const vehicleMaintenanceFormSchema = z.object({
  vehicleId: z.string().min(1, "Vehicle is required"),
  maintenanceType: z.string().trim().min(1, "Maintenance type is required"),
  serviceDate: z.string().optional().or(z.literal("")),
  serviceMileage: z.coerce.number().nonnegative().optional().nullable(),
  nextServiceDate: z.string().optional().or(z.literal("")),
  nextServiceMileage: z.coerce.number().nonnegative().optional().nullable(),
  cost: z.coerce.number().nonnegative().optional().nullable(),
  workshop: z.string().trim().optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
  status: z.enum(MAINTENANCE_STATUSES).optional(),
});
export type VehicleMaintenanceFormInput = z.infer<typeof vehicleMaintenanceFormSchema>;
export type VehicleMaintenanceFormValues = z.input<typeof vehicleMaintenanceFormSchema>;

export function parseVehicleCodeSearch(term: string): number | null {
  const match = term.trim().match(/^veh-?0*(\d+)$/i);
  return match ? Number(match[1]) : null;
}
