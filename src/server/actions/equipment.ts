"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import {
  equipmentFormSchema,
  equipmentMaintenanceFormSchema,
  equipmentRentalFormSchema,
  rentalChargeFormSchema,
  rentalExtendFormSchema,
  rentalPaymentFormSchema,
  rentalReturnFormSchema,
  type EquipmentFormInput,
  type EquipmentMaintenanceFormInput,
  type EquipmentRentalFormInput,
  type RentalChargeFormInput,
  type RentalExtendFormInput,
  type RentalPaymentFormInput,
  type RentalReturnFormInput,
} from "@/lib/validation/equipment";
import { calculateRentalSubtotal } from "@/server/calc/rental";
import { actionError, ok, type ActionResult } from "@/server/action-result";
import { logAudit } from "@/server/audit";
import { assertCan, ForbiddenError } from "@/server/rbac";
import { getSessionUser } from "@/server/session";

function toDate(value?: string | null) {
  return value ? new Date(value) : null;
}

function buildEquipmentData(data: EquipmentFormInput) {
  return {
    serialNumber: data.serialNumber,
    name: data.name,
    category: data.category || null,
    make: data.make || null,
    model: data.model || null,
    condition: data.condition || null,
    ...(data.status ? { status: data.status } : {}),
    hourlyRate: data.hourlyRate ?? null,
    dailyRate: data.dailyRate ?? null,
    weeklyRate: data.weeklyRate ?? null,
    monthlyRate: data.monthlyRate ?? null,
    ownerCompany: data.ownerCompany || null,
    coordinatorId: data.coordinatorId || null,
    notes: data.notes || null,
  };
}

export async function createEquipment(input: EquipmentFormInput): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "create", "equipment");
    const data = equipmentFormSchema.parse(input);

    const equipment = await db.equipment.create({ data: buildEquipmentData(data) });

    await logAudit({ userId: user.id, action: "create", entityType: "Equipment", entityId: equipment.id, newValue: data });

    revalidatePath("/equipment");
    return ok({ id: equipment.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function updateEquipment(id: string, input: EquipmentFormInput): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "update", "equipment");
    const data = equipmentFormSchema.parse(input);

    const before = await db.equipment.findUniqueOrThrow({ where: { id } });
    const equipment = await db.equipment.update({ where: { id }, data: buildEquipmentData(data) });

    await logAudit({
      userId: user.id,
      action: "update",
      entityType: "Equipment",
      entityId: equipment.id,
      previousValue: before,
      newValue: data,
    });

    revalidatePath("/equipment");
    revalidatePath(`/equipment/${id}`);
    return ok({ id: equipment.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function archiveEquipment(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "archive", "equipment");
    const equipment = await db.equipment.update({ where: { id }, data: { deletedAt: new Date() } });
    await logAudit({ userId: user.id, action: "archive", entityType: "Equipment", entityId: equipment.id });
    revalidatePath("/equipment");
    revalidatePath(`/equipment/${id}`);
    return ok({ id: equipment.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function reactivateEquipment(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "archive", "equipment");
    const equipment = await db.equipment.update({ where: { id }, data: { deletedAt: null } });
    await logAudit({ userId: user.id, action: "reactivate", entityType: "Equipment", entityId: equipment.id });
    revalidatePath("/equipment");
    revalidatePath(`/equipment/${id}`);
    return ok({ id: equipment.id });
  } catch (error) {
    return actionError(error);
  }
}

// A rental can only be created against AVAILABLE equipment — creating it
// reserves the equipment immediately (§4), same guard style as
// assignVehicle. The rate is snapshotted from the form input (not
// re-read from Equipment's master rate card) so a later rate-card edit
// never rewrites an existing rental's price.
export async function createRental(input: EquipmentRentalFormInput): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "create", "equipmentRental");
    const data = equipmentRentalFormSchema.parse(input);

    if (user.role === "COORDINATOR" && data.coordinatorId && data.coordinatorId !== user.coordinatorId) {
      throw new ForbiddenError("You can only create rentals under your own coordination.");
    }

    const result = await db.$transaction(async (tx) => {
      const equipment = await tx.equipment.findUniqueOrThrow({ where: { id: data.equipmentId } });
      if (equipment.status !== "AVAILABLE") {
        throw new Error(`This equipment is currently ${equipment.status.replace(/_/g, " ").toLowerCase()} and cannot be rented.`);
      }

      const rental = await tx.equipmentRental.create({
        data: {
          equipmentId: data.equipmentId,
          clientId: data.clientId,
          projectId: data.projectId || null,
          siteId: data.siteId || null,
          // Same reasoning as assignVehicle/recordVehicleExpense: a
          // coordinator's own scope requires coordinatorId === their own
          // id, so a blank form field must never fall back to something
          // that isn't them, or the rental they just created vanishes from
          // their own list.
          coordinatorId: user.role === "COORDINATOR" ? user.coordinatorId : data.coordinatorId || equipment.coordinatorId || null,
          rateType: data.rateType,
          rateAmount: data.rateAmount,
          quantity: data.quantity,
          startDate: new Date(data.startDate),
          expectedEndDate: toDate(data.expectedEndDate),
          status: "RESERVED",
          notes: data.notes || null,
          createdById: user.id,
        },
      });

      await tx.equipment.update({ where: { id: data.equipmentId }, data: { status: "RENTED" } });

      return rental;
    });

    await logAudit({ userId: user.id, action: "create", entityType: "EquipmentRental", entityId: result.id, newValue: data });

    revalidatePath("/equipment");
    revalidatePath(`/equipment/${data.equipmentId}`);
    revalidatePath("/rentals");
    return ok({ id: result.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function activateRental(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "update", "equipmentRental");

    const before = await db.equipmentRental.findUniqueOrThrow({ where: { id } });
    if (before.status !== "RESERVED") {
      throw new Error("Only a reserved rental can be activated.");
    }
    const rental = await db.equipmentRental.update({ where: { id }, data: { status: "ACTIVE" } });

    await logAudit({
      userId: user.id,
      action: "update",
      entityType: "EquipmentRental",
      entityId: rental.id,
      previousValue: before,
      newValue: { status: "ACTIVE" },
    });

    revalidatePath("/rentals");
    revalidatePath(`/equipment/${rental.equipmentId}`);
    return ok({ id: rental.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function extendRental(id: string, input: RentalExtendFormInput): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "update", "equipmentRental");
    const data = rentalExtendFormSchema.parse(input);

    const before = await db.equipmentRental.findUniqueOrThrow({ where: { id } });
    if (before.status !== "ACTIVE" && before.status !== "EXTENDED") {
      throw new Error("Only an active rental can be extended.");
    }

    const rental = await db.equipmentRental.update({
      where: { id },
      data: { status: "EXTENDED", expectedEndDate: new Date(data.newExpectedEndDate) },
    });

    await logAudit({
      userId: user.id,
      action: "update",
      entityType: "EquipmentRental",
      entityId: rental.id,
      previousValue: { expectedEndDate: before.expectedEndDate, status: before.status },
      newValue: { expectedEndDate: rental.expectedEndDate, status: rental.status, notes: data.notes },
    });

    revalidatePath("/rentals");
    revalidatePath(`/equipment/${rental.equipmentId}`);
    return ok({ id: rental.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function cancelRental(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "update", "equipmentRental");

    const before = await db.equipmentRental.findUniqueOrThrow({ where: { id } });
    if (before.status !== "DRAFT" && before.status !== "RESERVED") {
      throw new Error("Only a draft or reserved rental can be cancelled.");
    }

    const rental = await db.$transaction(async (tx) => {
      const updated = await tx.equipmentRental.update({ where: { id }, data: { status: "CANCELLED" } });
      await tx.equipment.update({ where: { id: updated.equipmentId }, data: { status: "AVAILABLE" } });
      return updated;
    });

    await logAudit({
      userId: user.id,
      action: "update",
      entityType: "EquipmentRental",
      entityId: rental.id,
      previousValue: before,
      newValue: { status: "CANCELLED" },
    });

    revalidatePath("/rentals");
    revalidatePath(`/equipment/${rental.equipmentId}`);
    return ok({ id: rental.id });
  } catch (error) {
    return actionError(error);
  }
}

// Computes the base rental charge from actual elapsed duration (never
// hardcoded in the frontend, §4) and books it as a RentalCharge row,
// alongside any damage/missing-item charges reported at return. The
// equipment returns to AVAILABLE unless damage was reported, mirroring the
// Vehicle module's return workflow.
export async function returnRental(id: string, input: RentalReturnFormInput): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "update", "equipmentRental");
    const data = rentalReturnFormSchema.parse(input);

    const before = await db.equipmentRental.findUniqueOrThrow({ where: { id } });
    if (!["RESERVED", "ACTIVE", "EXTENDED"].includes(before.status)) {
      throw new Error("This rental is not in a returnable state.");
    }

    const actualReturnDate = new Date(data.actualReturnDate);
    const hasDamage = Boolean(data.damageNotes?.trim());
    const hasMissingItems = Boolean(data.missingItemsNotes?.trim());

    const subtotal = calculateRentalSubtotal({
      rateType: before.rateType,
      rateAmount: before.rateAmount,
      quantity: before.quantity,
      startDate: before.startDate,
      endDate: actualReturnDate,
    });

    const result = await db.$transaction(async (tx) => {
      const rental = await tx.equipmentRental.update({
        where: { id },
        data: {
          status: "RETURNED",
          actualReturnDate,
          returnCondition: data.returnCondition || null,
          damageNotes: data.damageNotes || null,
          missingItemsNotes: data.missingItemsNotes || null,
          returnNotes: data.returnNotes || null,
        },
      });

      await tx.rentalCharge.create({
        data: {
          rentalId: id,
          type: "RENTAL",
          description: `${before.rateType} rental — ${before.quantity} unit(s)`,
          amount: subtotal,
          date: actualReturnDate,
          createdById: user.id,
        },
      });

      if (hasDamage && data.damageAmount) {
        await tx.rentalCharge.create({
          data: {
            rentalId: id,
            type: "DAMAGE",
            description: data.damageNotes,
            amount: data.damageAmount,
            date: actualReturnDate,
            createdById: user.id,
          },
        });
      }

      if (hasMissingItems && data.missingItemsAmount) {
        await tx.rentalCharge.create({
          data: {
            rentalId: id,
            type: "MISSING_ITEM",
            description: data.missingItemsNotes,
            amount: data.missingItemsAmount,
            date: actualReturnDate,
            createdById: user.id,
          },
        });
      }

      await tx.equipment.update({
        where: { id: rental.equipmentId },
        data: { status: hasDamage ? "UNDER_MAINTENANCE" : "AVAILABLE" },
      });

      return rental;
    });

    await logAudit({
      userId: user.id,
      action: "update",
      entityType: "EquipmentRental",
      entityId: result.id,
      previousValue: before,
      newValue: data,
    });

    revalidatePath("/rentals");
    revalidatePath("/equipment");
    revalidatePath(`/equipment/${result.equipmentId}`);
    return ok({ id: result.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function closeRental(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "update", "equipmentRental");

    const before = await db.equipmentRental.findUniqueOrThrow({ where: { id } });
    if (before.status !== "RETURNED") {
      throw new Error("Only a returned rental can be closed.");
    }

    const rental = await db.equipmentRental.update({ where: { id }, data: { status: "CLOSED" } });

    await logAudit({
      userId: user.id,
      action: "update",
      entityType: "EquipmentRental",
      entityId: rental.id,
      previousValue: before,
      newValue: { status: "CLOSED" },
    });

    revalidatePath("/rentals");
    return ok({ id: rental.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function recordRentalCharge(input: RentalChargeFormInput): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "update", "equipmentRental");
    const data = rentalChargeFormSchema.parse(input);

    const charge = await db.rentalCharge.create({
      data: {
        rentalId: data.rentalId,
        type: data.type,
        description: data.description || null,
        amount: data.amount,
        date: new Date(data.date),
        createdById: user.id,
      },
    });

    await logAudit({ userId: user.id, action: "create", entityType: "RentalCharge", entityId: charge.id, newValue: data });

    revalidatePath("/rentals");
    revalidatePath(`/rentals/${data.rentalId}`);
    return ok({ id: charge.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function recordRentalPayment(input: RentalPaymentFormInput): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "create", "rentalPayment");
    const data = rentalPaymentFormSchema.parse(input);

    const payment = await db.equipmentPayment.create({
      data: {
        rentalId: data.rentalId,
        amount: data.amount,
        method: data.method,
        date: new Date(data.date),
        referenceNumber: data.referenceNumber || null,
        remarks: data.remarks || null,
        createdById: user.id,
      },
    });

    await logAudit({ userId: user.id, action: "create", entityType: "EquipmentPayment", entityId: payment.id, newValue: data });

    revalidatePath("/rentals");
    revalidatePath(`/rentals/${data.rentalId}`);
    return ok({ id: payment.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function recordEquipmentMaintenance(
  input: EquipmentMaintenanceFormInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "create", "equipmentMaintenance");
    const data = equipmentMaintenanceFormSchema.parse(input);

    const record = await db.equipmentMaintenance.create({
      data: {
        equipmentId: data.equipmentId,
        maintenanceType: data.maintenanceType,
        serviceDate: toDate(data.serviceDate),
        nextServiceDate: toDate(data.nextServiceDate),
        cost: data.cost ?? null,
        workshop: data.workshop || null,
        notes: data.notes || null,
        status: data.status ?? "SCHEDULED",
        createdById: user.id,
      },
    });

    await logAudit({
      userId: user.id,
      action: "create",
      entityType: "EquipmentMaintenance",
      entityId: record.id,
      newValue: data,
    });

    revalidatePath("/equipment");
    revalidatePath(`/equipment/${data.equipmentId}`);
    return ok({ id: record.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function updateEquipmentMaintenanceStatus(
  id: string,
  status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED",
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "update", "equipmentMaintenance");

    const before = await db.equipmentMaintenance.findUniqueOrThrow({ where: { id } });
    const maintenance = await db.equipmentMaintenance.update({ where: { id }, data: { status } });

    await logAudit({
      userId: user.id,
      action: "update",
      entityType: "EquipmentMaintenance",
      entityId: maintenance.id,
      previousValue: before,
      newValue: { status },
    });

    revalidatePath("/equipment");
    revalidatePath(`/equipment/${maintenance.equipmentId}`);
    return ok({ id: maintenance.id });
  } catch (error) {
    return actionError(error);
  }
}
