"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { documentFormSchema, type DocumentFormInput } from "@/lib/validation/document";
import { actionError, ok, type ActionResult } from "@/server/action-result";
import { logAudit } from "@/server/audit";
import { assertCan } from "@/server/rbac";
import { getSessionUser } from "@/server/session";

export async function uploadWorkerDocument(input: DocumentFormInput): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "update", "worker");
    const data = documentFormSchema.parse(input);

    const document = await db.workerDocument.create({
      data: {
        workerId: data.workerId,
        fileName: data.fileName,
        fileUrl: data.fileUrl,
        documentType: data.documentType || null,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
        verificationStatus: "PENDING",
        uploadedById: user.id,
      },
    });

    await logAudit({ userId: user.id, action: "create", entityType: "WorkerDocument", entityId: document.id, newValue: data });
    revalidatePath(`/workers/${data.workerId}`);
    return ok({ id: document.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function verifyWorkerDocument(
  id: string,
  status: "VERIFIED" | "REJECTED",
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "update", "worker");

    const before = await db.workerDocument.findUniqueOrThrow({ where: { id } });
    const document = await db.workerDocument.update({
      where: { id },
      data: { verificationStatus: status, verifiedById: user.id, verifiedAt: new Date() },
    });

    await logAudit({
      userId: user.id,
      action: "update",
      entityType: "WorkerDocument",
      entityId: id,
      previousValue: before,
      newValue: { verificationStatus: status },
    });

    revalidatePath(`/workers/${document.workerId}`);
    return ok({ id });
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteWorkerDocument(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "update", "worker");

    const document = await db.workerDocument.delete({ where: { id } });
    await logAudit({ userId: user.id, action: "archive", entityType: "WorkerDocument", entityId: id });
    revalidatePath(`/workers/${document.workerId}`);
    return ok({ id });
  } catch (error) {
    return actionError(error);
  }
}
