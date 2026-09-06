"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import {
  vehicleAssignFormSchema,
  vehicleExpenseFormSchema,
  vehicleFormSchema,
  vehicleMaintenanceFormSchema,
  vehicleReturnFormSchema,
  type VehicleAssignFormInput,
  type VehicleExpenseFormInput,
  type VehicleFormInput,
  type VehicleMaintenanceFormInput,
  type VehicleReturnFormInput,
} from "@/lib/validation/vehicle";
import { actionError, ok, type ActionResult } from "@/server/action-result";
import { logAudit } from "@/server/audit";
import { assertCan, ForbiddenError } from "@/server/rbac";
import { getSessionUser } from "@/server/session";

function toDate(value?: string | null) {
  return value ? new Date(value) : null;
}

function buildVehicleData(data: VehicleFormInput) {
  return {
    plateNumber: data.plateNumber,
    make: data.make,
    model: data.model,
    year: data.year ?? null,
    color: data.color || null,
    vehicleType: data.vehicleType || null,
    vin: data.vin || null,
    currentMileage: data.currentMileage ?? null,
    ...(data.status ? { status: data.status } : {}),
    registrationExpiry: toDate(data.registrationExpiry),
    insuranceExpiry: toDate(data.insuranceExpiry),
    inspectionExpiry: toDate(data.inspectionExpiry),
    ownerCompany: data.ownerCompany || null,
    coordinatorId: data.coordinatorId || null,
    notes: data.notes || null,
  };
}

export async function createVehicle(input: VehicleFormInput): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "create", "vehicle");
    const data = vehicleFormSchema.parse(input);

    const vehicle = await db.vehicle.create({ data: buildVehicleData(data) });

    await logAudit({ userId: user.id, action: "create", entityType: "Vehicle", entityId: vehicle.id, newValue: data });

    revalidatePath("/vehicles");
    return ok({ id: vehicle.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function updateVehicle(id: string, input: VehicleFormInput): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "update", "vehicle");
    const data = vehicleFormSchema.parse(input);

    const before = await db.vehicle.findUniqueOrThrow({ where: { id } });
    const vehicle = await db.vehicle.update({ where: { id }, data: buildVehicleData(data) });

    await logAudit({
      userId: user.id,
      action: "update",
      entityType: "Vehicle",
      entityId: vehicle.id,
      previousValue: before,
      newValue: data,
    });

    revalidatePath("/vehicles");
    revalidatePath(`/vehicles/${id}`);
    return ok({ id: vehicle.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function archiveVehicle(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "archive", "vehicle");

    const vehicle = await db.vehicle.update({ where: { id }, data: { deletedAt: new Date() } });

    await logAudit({ userId: user.id, action: "archive", entityType: "Vehicle", entityId: vehicle.id });

    revalidatePath("/vehicles");
    revalidatePath(`/vehicles/${id}`);
    return ok({ id: vehicle.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function reactivateVehicle(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "archive", "vehicle");

    const vehicle = await db.vehicle.update({ where: { id }, data: { deletedAt: null } });

    await logAudit({ userId: user.id, action: "reactivate", entityType: "Vehicle", entityId: vehicle.id });

    revalidatePath("/vehicles");
    revalidatePath(`/vehicles/${id}`);
    return ok({ id: vehicle.id });
  } catch (error) {
    return actionError(error);
  }
}

// A vehicle can only be assigned while AVAILABLE — unlike worker
// reassignment there is no "close out the previous holder" step here
// because a vehicle already in ASSIGNED status is rejected outright, so a
// coordinator must return it first (§4/§8). The assignment row and the
// vehicle's status flip together in one transaction so the two can never
// drift out of sync.
export async function assignVehicle(
  input: VehicleAssignFormInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "create", "vehicleAssignment");
    const data = vehicleAssignFormSchema.parse(input);

    if (user.role === "COORDINATOR" && data.coordinatorId && data.coordinatorId !== user.coordinatorId) {
      throw new ForbiddenError("You can only assign vehicles under your own coordination.");
    }

    const result = await db.$transaction(async (tx) => {
      const vehicle = await tx.vehicle.findUniqueOrThrow({ where: { id: data.vehicleId } });
      if (vehicle.status !== "AVAILABLE") {
        throw new Error(`This vehicle is currently ${vehicle.status.replace(/_/g, " ").toLowerCase()} and cannot be assigned.`);
      }

      const assignment = await tx.vehicleAssignment.create({
        data: {
          vehicleId: data.vehicleId,
          workerId: data.workerId,
          coordinatorId: data.coordinatorId || vehicle.coordinatorId || null,
          clientId: data.clientId || null,
          projectId: data.projectId || null,
          siteId: data.siteId || null,
          startDate: new Date(data.startDate),
          expectedReturnDate: toDate(data.expectedReturnDate),
          startingMileage: data.startingMileage ?? vehicle.currentMileage ?? null,
          notes: data.notes || null,
          createdById: user.id,
        },
      });

      await tx.vehicle.update({ where: { id: data.vehicleId }, data: { status: "ASSIGNED" } });

      return assignment;
    });

    await logAudit({
      userId: user.id,
      action: "assign_vehicle",
      entityType: "VehicleAssignment",
      entityId: result.id,
      newValue: data,
    });

    revalidatePath("/vehicles");
    revalidatePath(`/vehicles/${data.vehicleId}`);
    revalidatePath(`/workers/${data.workerId}`);
    return ok({ id: result.id });
  } catch (error) {
    return actionError(error);
  }
}

// Closes out the assignment and returns the vehicle to service. Damage
// reported at return keeps the vehicle in UNDER_MAINTENANCE rather than
// AVAILABLE, and — when a repair cost is supplied — immediately books a
// VehicleExpense so the cost feeds profitability without a second entry
// (§4/§8).
export async function returnVehicle(
  assignmentId: string,
  input: VehicleReturnFormInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "update", "vehicleAssignment");
    const data = vehicleReturnFormSchema.parse(input);

    const before = await db.vehicleAssignment.findUniqueOrThrow({ where: { id: assignmentId } });
    if (before.status !== "ACTIVE") {
      throw new Error("This vehicle assignment has already been closed.");
    }

    const hasDamage = Boolean(data.damageNotes?.trim());
    const now = new Date();

    const result = await db.$transaction(async (tx) => {
      const assignment = await tx.vehicleAssignment.update({
        where: { id: assignmentId },
        data: {
          status: "RETURNED",
          returnedAt: now,
          endingMileage: data.endingMileage ?? null,
          condition: data.condition || null,
          damageNotes: data.damageNotes || null,
          fuelLevel: data.fuelLevel || null,
          returnNotes: data.returnNotes || null,
          returnedById: data.returnedById || null,
          receivedById: data.receivedById || null,
        },
      });

      await tx.vehicle.update({
        where: { id: assignment.vehicleId },
        data: {
          status: hasDamage ? "UNDER_MAINTENANCE" : "AVAILABLE",
          currentMileage: data.endingMileage ?? undefined,
        },
      });

      if (hasDamage && data.damageAmount) {
        await tx.vehicleExpense.create({
          data: {
            vehicleId: assignment.vehicleId,
            category: "REPAIR",
            amount: data.damageAmount,
            date: now,
            workerId: assignment.workerId,
            coordinatorId: assignment.coordinatorId,
            clientId: assignment.clientId,
            projectId: assignment.projectId,
            siteId: assignment.siteId,
            description: `Damage reported on return: ${data.damageNotes}`,
            createdById: user.id,
          },
        });
      }

      return assignment;
    });

    await logAudit({
      userId: user.id,
      action: "return_vehicle",
      entityType: "VehicleAssignment",
      entityId: result.id,
      previousValue: before,
      newValue: data,
    });

    revalidatePath("/vehicles");
    revalidatePath(`/vehicles/${result.vehicleId}`);
    revalidatePath(`/workers/${result.workerId}`);
    return ok({ id: result.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function recordVehicleExpense(
  input: VehicleExpenseFormInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "create", "vehicleExpense");
    const data = vehicleExpenseFormSchema.parse(input);

    if (user.role === "COORDINATOR" && data.coordinatorId && data.coordinatorId !== user.coordinatorId) {
      throw new ForbiddenError("You can only record expenses for vehicles under your own coordination.");
    }

    const expense = await db.vehicleExpense.create({
      data: {
        vehicleId: data.vehicleId,
        category: data.category,
        amount: data.amount,
        date: new Date(data.date),
        workerId: data.workerId || null,
        coordinatorId: data.coordinatorId || null,
        clientId: data.clientId || null,
        projectId: data.projectId || null,
        siteId: data.siteId || null,
        receiptUrl: data.receiptUrl || null,
        description: data.description || null,
        createdById: user.id,
      },
    });

    await logAudit({
      userId: user.id,
      action: "create",
      entityType: "VehicleExpense",
      entityId: expense.id,
      newValue: data,
    });

    revalidatePath("/vehicles");
    revalidatePath(`/vehicles/${data.vehicleId}`);
    return ok({ id: expense.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function archiveVehicleExpense(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "archive", "vehicleExpense");
    const before = await db.vehicleExpense.findUniqueOrThrow({ where: { id } });
    const expense = await db.vehicleExpense.update({ where: { id }, data: { deletedAt: new Date() } });

    await logAudit({
      userId: user.id,
      action: "archive",
      entityType: "VehicleExpense",
      entityId: expense.id,
      previousValue: before,
    });

    revalidatePath("/vehicles");
    revalidatePath(`/vehicles/${before.vehicleId}`);
    return ok({ id: expense.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function recordVehicleMaintenance(
  input: VehicleMaintenanceFormInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "create", "vehicleMaintenance");
    const data = vehicleMaintenanceFormSchema.parse(input);

    const record = await db.$transaction(async (tx) => {
      const maintenance = await tx.vehicleMaintenance.create({
        data: {
          vehicleId: data.vehicleId,
          maintenanceType: data.maintenanceType,
          serviceDate: toDate(data.serviceDate),
          serviceMileage: data.serviceMileage ?? null,
          nextServiceDate: toDate(data.nextServiceDate),
          nextServiceMileage: data.nextServiceMileage ?? null,
          cost: data.cost ?? null,
          workshop: data.workshop || null,
          notes: data.notes || null,
          status: data.status ?? "SCHEDULED",
          createdById: user.id,
        },
      });

      // A completed service that reports a cost is booked as a vehicle
      // expense in the same step, mirroring the return-workflow damage
      // booking so maintenance spend always reaches profitability (§4).
      if (maintenance.status === "COMPLETED" && data.cost) {
        const vehicle = await tx.vehicle.findUniqueOrThrow({ where: { id: data.vehicleId } });
        await tx.vehicleExpense.create({
          data: {
            vehicleId: data.vehicleId,
            category: "MAINTENANCE",
            amount: data.cost,
            date: data.serviceDate ? new Date(data.serviceDate) : new Date(),
            coordinatorId: vehicle.coordinatorId,
            description: `${data.maintenanceType} service${data.workshop ? ` at ${data.workshop}` : ""}`,
            createdById: user.id,
          },
        });
      }

      return maintenance;
    });

    await logAudit({
      userId: user.id,
      action: "create",
      entityType: "VehicleMaintenance",
      entityId: record.id,
      newValue: data,
    });

    revalidatePath("/vehicles");
    revalidatePath(`/vehicles/${data.vehicleId}`);
    return ok({ id: record.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function updateVehicleMaintenanceStatus(
  id: string,
  status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED",
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "update", "vehicleMaintenance");

    const before = await db.vehicleMaintenance.findUniqueOrThrow({ where: { id } });
    const maintenance = await db.vehicleMaintenance.update({ where: { id }, data: { status } });

    await logAudit({
      userId: user.id,
      action: "update",
      entityType: "VehicleMaintenance",
      entityId: maintenance.id,
      previousValue: before,
      newValue: { status },
    });

    revalidatePath("/vehicles");
    revalidatePath(`/vehicles/${maintenance.vehicleId}`);
    return ok({ id: maintenance.id });
  } catch (error) {
    return actionError(error);
  }
}
