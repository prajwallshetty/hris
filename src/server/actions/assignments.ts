"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { assignmentFormSchema, type AssignmentFormInput } from "@/lib/validation/assignment";
import { actionError, ok, type ActionResult } from "@/server/action-result";
import { logAudit } from "@/server/audit";
import { assertCan } from "@/server/rbac";
import { getSessionUser } from "@/server/session";

// Ending the worker's current assignment and creating the new one happen in
// one transaction: history is preserved (the old row keeps its own rates
// and dates, just gains an endDate/ENDED status) rather than overwritten,
// per §5/§31 of the spec ("historical assignments must remain accessible").
export async function createAssignment(
  input: AssignmentFormInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "create", "assignment");
    const data = assignmentFormSchema.parse(input);
    const startDate = new Date(data.startDate);

    const result = await db.$transaction(async (tx) => {
      const currentActive = await tx.assignment.findFirst({
        where: { workerId: data.workerId, status: "ACTIVE" },
      });

      if (currentActive) {
        await tx.assignment.update({
          where: { id: currentActive.id },
          data: { status: "ENDED", endDate: startDate },
        });
        await logAudit({
          userId: user.id,
          action: "end_assignment",
          entityType: "Assignment",
          entityId: currentActive.id,
          previousValue: currentActive,
          newValue: { status: "ENDED", endDate: startDate },
        });
      }

      const assignment = await tx.assignment.create({
        data: {
          workerId: data.workerId,
          clientId: data.clientId,
          projectId: data.projectId,
          siteId: data.siteId,
          designation: data.designation || null,
          workerHourlyRate: data.workerHourlyRate,
          clientBillingRate: data.clientBillingRate,
          startDate,
          coordinatorId: data.coordinatorId || null,
          notes: data.notes || null,
          createdById: user.id,
        },
      });

      return assignment;
    });

    await logAudit({
      userId: user.id,
      action: "create",
      entityType: "Assignment",
      entityId: result.id,
      newValue: data,
    });

    revalidatePath("/assignments");
    revalidatePath(`/workers/${data.workerId}`);
    revalidatePath(`/clients/${data.clientId}`);
    return ok({ id: result.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function endAssignment(id: string, endDate?: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "update", "assignment");

    const before = await db.assignment.findUniqueOrThrow({ where: { id } });
    const assignment = await db.assignment.update({
      where: { id },
      data: { status: "ENDED", endDate: endDate ? new Date(endDate) : new Date() },
    });

    await logAudit({
      userId: user.id,
      action: "end_assignment",
      entityType: "Assignment",
      entityId: assignment.id,
      previousValue: before,
      newValue: assignment,
    });

    revalidatePath("/assignments");
    revalidatePath(`/workers/${assignment.workerId}`);
    return ok({ id: assignment.id });
  } catch (error) {
    return actionError(error);
  }
}
