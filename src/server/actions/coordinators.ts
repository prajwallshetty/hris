"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { coordinatorFormSchema, type CoordinatorFormInput } from "@/lib/validation/coordinator";
import { actionError, ok, type ActionResult } from "@/server/action-result";
import { logAudit } from "@/server/audit";
import { assertCan } from "@/server/rbac";
import { getSessionUser } from "@/server/session";

export async function createCoordinator(
  input: CoordinatorFormInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "create", "coordinator");
    const data = coordinatorFormSchema.parse(input);

    const coordinator = await db.coordinator.create({
      data: { name: data.name, phone: data.phone || null, email: data.email || null },
    });

    await logAudit({
      userId: user.id,
      action: "create",
      entityType: "Coordinator",
      entityId: coordinator.id,
      newValue: data,
    });

    revalidatePath("/coordinators");
    return ok({ id: coordinator.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function updateCoordinator(
  id: string,
  input: CoordinatorFormInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "update", "coordinator");
    const data = coordinatorFormSchema.parse(input);

    const before = await db.coordinator.findUniqueOrThrow({ where: { id } });
    const coordinator = await db.coordinator.update({
      where: { id },
      data: { name: data.name, phone: data.phone || null, email: data.email || null },
    });

    await logAudit({
      userId: user.id,
      action: "update",
      entityType: "Coordinator",
      entityId: coordinator.id,
      previousValue: before,
      newValue: data,
    });

    revalidatePath("/coordinators");
    revalidatePath(`/coordinators/${id}`);
    return ok({ id: coordinator.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function archiveCoordinator(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "archive", "coordinator");

    const coordinator = await db.coordinator.update({ where: { id }, data: { status: "INACTIVE" } });

    await logAudit({ userId: user.id, action: "archive", entityType: "Coordinator", entityId: coordinator.id });

    revalidatePath("/coordinators");
    revalidatePath(`/coordinators/${id}`);
    return ok({ id: coordinator.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function reactivateCoordinator(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "update", "coordinator");

    const coordinator = await db.coordinator.update({ where: { id }, data: { status: "ACTIVE" } });

    await logAudit({ userId: user.id, action: "reactivate", entityType: "Coordinator", entityId: coordinator.id });

    revalidatePath("/coordinators");
    revalidatePath(`/coordinators/${id}`);
    return ok({ id: coordinator.id });
  } catch (error) {
    return actionError(error);
  }
}
