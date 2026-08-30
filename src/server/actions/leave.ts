"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { leaveRequestFormSchema, type LeaveRequestFormInput } from "@/lib/validation/leave";
import { actionError, ok, type ActionResult } from "@/server/action-result";
import { logAudit } from "@/server/audit";
import { assertCan } from "@/server/rbac";
import { getSessionUser } from "@/server/session";

export async function createLeaveRequest(input: LeaveRequestFormInput): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "create", "leaveRequest");
    const data = leaveRequestFormSchema.parse(input);

    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);
    if (endDate < startDate) {
      return { success: false, error: "End date cannot be before the start date." };
    }

    const request = await db.leaveRequest.create({
      data: {
        workerId: data.workerId,
        leaveTypeId: data.leaveTypeId,
        startDate,
        endDate,
        days: data.days,
        reason: data.reason || null,
        status: "PENDING",
        requestedById: user.id,
      },
    });

    await logAudit({ userId: user.id, action: "create", entityType: "LeaveRequest", entityId: request.id, newValue: data });
    revalidatePath(`/workers/${data.workerId}`);
    return ok({ id: request.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function decideLeaveRequest(
  id: string,
  decision: "APPROVED" | "REJECTED",
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "update", "leaveRequest");

    const before = await db.leaveRequest.findUniqueOrThrow({ where: { id } });
    if (before.status !== "PENDING") {
      return { success: false, error: "This leave request has already been decided." };
    }

    const request = await db.leaveRequest.update({
      where: { id },
      data: { status: decision, approvedById: user.id, approvedAt: new Date() },
    });

    if (decision === "APPROVED") {
      const year = request.startDate.getFullYear();
      const balance = await db.leaveBalance.findFirst({
        where: { workerId: request.workerId, leaveTypeId: request.leaveTypeId, year },
      });
      if (balance) {
        await db.leaveBalance.update({
          where: { id: balance.id },
          data: { usedDays: { increment: request.days } },
        });
      }
    }

    await logAudit({
      userId: user.id,
      action: "update",
      entityType: "LeaveRequest",
      entityId: request.id,
      previousValue: before,
      newValue: { status: decision },
    });

    revalidatePath(`/workers/${request.workerId ?? ""}`);
    return ok({ id: request.id });
  } catch (error) {
    return actionError(error);
  }
}
