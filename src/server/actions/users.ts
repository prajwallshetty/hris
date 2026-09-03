"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { accessCodeLookupHash, generateRandomAccessCode, hashAccessCode } from "@/lib/access-code";
import { userFormSchema, type UserFormInput } from "@/lib/validation/user";
import { actionError, ok, type ActionResult } from "@/server/action-result";
import { logAudit } from "@/server/audit";
import { assertCan } from "@/server/rbac";
import { getSessionUser } from "@/server/session";

async function uniqueAccessCode(role: Parameters<typeof generateRandomAccessCode>[0]): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = generateRandomAccessCode(role);
    const existing = await db.user.findUnique({ where: { accessCodeLookupHash: accessCodeLookupHash(code) } });
    if (!existing) return code;
  }
  throw new Error("Could not generate a unique access code — try again.");
}

export async function createUser(input: UserFormInput): Promise<ActionResult<{ id: string; accessCode: string }>> {
  try {
    const sessionUser = await getSessionUser();
    assertCan(sessionUser, "create", "user");
    const data = userFormSchema.parse(input);

    const code = await uniqueAccessCode(data.role);
    const [accessCodeHash, lookupHash] = await Promise.all([hashAccessCode(code), Promise.resolve(accessCodeLookupHash(code))]);

    const created = await db.user.create({
      data: {
        name: data.name,
        email: data.email.toLowerCase(),
        role: data.role,
        coordinatorId: data.role === "COORDINATOR" ? data.coordinatorId || null : null,
        clientId: data.role === "CLIENT" ? data.clientId || null : null,
        accessCodeHash,
        accessCodeLookupHash: lookupHash,
        accessCodeSetAt: new Date(),
      },
    });

    await logAudit({
      userId: sessionUser.id,
      action: "create",
      entityType: "User",
      entityId: created.id,
      newValue: { name: data.name, email: data.email, role: data.role },
    });

    revalidatePath("/users");
    return ok({ id: created.id, accessCode: code });
  } catch (error) {
    return actionError(error);
  }
}

export async function generateAccessCode(userId: string): Promise<ActionResult<{ accessCode: string }>> {
  try {
    const sessionUser = await getSessionUser();
    assertCan(sessionUser, "update", "user");

    const target = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!target) return { success: false, error: "That user could not be found." };

    const code = await uniqueAccessCode(target.role);
    const [accessCodeHash, lookupHash] = await Promise.all([hashAccessCode(code), Promise.resolve(accessCodeLookupHash(code))]);

    await db.user.update({
      where: { id: userId },
      data: { accessCodeHash, accessCodeLookupHash: lookupHash, accessCodeSetAt: new Date() },
    });

    // Never write the code itself to the audit trail — just that it changed.
    await logAudit({ userId: sessionUser.id, action: "update", entityType: "User", entityId: userId, newValue: { accessCodeReset: true } });

    revalidatePath("/users");
    return ok({ accessCode: code });
  } catch (error) {
    return actionError(error);
  }
}

export async function archiveUser(userId: string): Promise<ActionResult<{ id: string }>> {
  try {
    const sessionUser = await getSessionUser();
    assertCan(sessionUser, "archive", "user");
    if (userId === sessionUser.id) return { success: false, error: "You can't disable your own account." };

    await db.user.update({ where: { id: userId }, data: { status: "INACTIVE" } });
    await logAudit({ userId: sessionUser.id, action: "archive", entityType: "User", entityId: userId });

    revalidatePath("/users");
    return ok({ id: userId });
  } catch (error) {
    return actionError(error);
  }
}

export async function reactivateUser(userId: string): Promise<ActionResult<{ id: string }>> {
  try {
    const sessionUser = await getSessionUser();
    assertCan(sessionUser, "update", "user");

    await db.user.update({ where: { id: userId }, data: { status: "ACTIVE" } });
    await logAudit({ userId: sessionUser.id, action: "reactivate", entityType: "User", entityId: userId });

    revalidatePath("/users");
    return ok({ id: userId });
  } catch (error) {
    return actionError(error);
  }
}
