"use server";

import { Prisma, type WorkerStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { formatWorkerCode } from "@/lib/codes";
import { manpowerRegistrationSchema, type ManpowerRegistrationInput } from "@/lib/validation/manpower";
import { actionError, ok, type ActionResult } from "@/server/action-result";
import { logAudit } from "@/server/audit";
import { createManpowerRecord, ManpowerRecordError } from "@/server/manpower";
import { assertCan } from "@/server/rbac";
import { getSessionUser } from "@/server/session";

export type RegisteredManpower = {
  id: string;
  fullName: string;
  code: string;
  workerType: string;
  status: WorkerStatus;
  assignmentId: string | null;
};

/**
 * Quick manpower registration (§1): the worker and, when a client/project/
 * site placement is given, its first assignment — in one transaction so a
 * failed assignment never leaves a half-registered worker.
 */
export async function registerManpower(input: ManpowerRegistrationInput): Promise<ActionResult<RegisteredManpower>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "create", "worker");
    const data = manpowerRegistrationSchema.parse(input);
    if (data.clientId) assertCan(user, "create", "assignment");

    const created = await db.$transaction((tx) => createManpowerRecord(tx, user, data));

    await logAudit({ userId: user.id, action: "create", entityType: "Worker", entityId: created.workerId, newValue: data });
    if (created.assignmentId) {
      await logAudit({
        userId: user.id,
        action: "create",
        entityType: "Assignment",
        entityId: created.assignmentId,
        newValue: { workerId: created.workerId, clientId: data.clientId, projectId: data.projectId, siteId: data.siteId },
      });
    }

    revalidatePath("/workers");
    revalidatePath("/dashboard");
    if (created.assignmentId) revalidatePath("/assignments");

    return ok({
      id: created.workerId,
      fullName: data.fullName,
      code: formatWorkerCode(created.sequenceNo),
      workerType: data.workerType,
      status: created.status,
      assignmentId: created.assignmentId,
    });
  } catch (error) {
    if (error instanceof ManpowerRecordError) return { success: false, error: error.message };
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { success: false, error: `Iqama ${input.iqamaNumber} is already registered to another worker.` };
    }
    return actionError(error);
  }
}
