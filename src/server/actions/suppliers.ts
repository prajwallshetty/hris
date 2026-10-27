"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { supplierFormSchema, type SupplierFormInput } from "@/lib/validation/manpower";
import { actionError, ok, type ActionResult } from "@/server/action-result";
import { logAudit } from "@/server/audit";
import { assertCan } from "@/server/rbac";
import { getSessionUser } from "@/server/session";

function toData(data: SupplierFormInput) {
  return {
    name: data.name,
    contactPerson: data.contactPerson || null,
    phone: data.phone || null,
    email: data.email || null,
    notes: data.notes || null,
  };
}

function duplicateNameError(error: unknown, name: string): ActionResult<never> | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return { success: false, error: `A supplier named "${name}" already exists.` };
  }
  return null;
}

export async function createSupplier(input: SupplierFormInput): Promise<ActionResult<{ id: string; name: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "create", "supplier");
    const data = supplierFormSchema.parse(input);
    const supplier = await db.supplier.create({ data: toData(data) });
    await logAudit({ userId: user.id, action: "create", entityType: "Supplier", entityId: supplier.id, newValue: data });
    revalidatePath("/suppliers");
    return ok({ id: supplier.id, name: supplier.name });
  } catch (error) {
    return duplicateNameError(error, input.name?.trim() ?? "") ?? actionError(error);
  }
}

export async function updateSupplier(id: string, input: SupplierFormInput): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "update", "supplier");
    const data = supplierFormSchema.parse(input);
    const before = await db.supplier.findUniqueOrThrow({ where: { id } });
    const supplier = await db.supplier.update({ where: { id }, data: toData(data) });
    await logAudit({
      userId: user.id,
      action: "update",
      entityType: "Supplier",
      entityId: id,
      previousValue: before,
      newValue: data,
    });
    revalidatePath("/suppliers");
    revalidatePath("/workers");
    return ok({ id: supplier.id });
  } catch (error) {
    return duplicateNameError(error, input.name?.trim() ?? "") ?? actionError(error);
  }
}

// Suppliers are never hard-deleted — HRD workers keep their historical
// supplier link. Deactivating just hides it from new registrations.
export async function setSupplierStatus(id: string, status: "ACTIVE" | "INACTIVE"): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "archive", "supplier");
    const before = await db.supplier.findUniqueOrThrow({ where: { id } });
    await db.supplier.update({ where: { id }, data: { status } });
    await logAudit({
      userId: user.id,
      action: status === "INACTIVE" ? "archive" : "reactivate",
      entityType: "Supplier",
      entityId: id,
      previousValue: { status: before.status },
      newValue: { status },
    });
    revalidatePath("/suppliers");
    return ok({ id });
  } catch (error) {
    return actionError(error);
  }
}
