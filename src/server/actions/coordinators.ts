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
