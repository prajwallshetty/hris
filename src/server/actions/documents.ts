"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { documentMetaSchema } from "@/lib/validation/document";
import { saveUploadedFile } from "@/lib/storage";
import { actionError, ok, type ActionResult } from "@/server/action-result";
import { logAudit } from "@/server/audit";
import { assertCan } from "@/server/rbac";
import { getSessionUser } from "@/server/session";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function uploadWorkerDocument(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "update", "worker");

    const data = documentMetaSchema.parse({
      workerId: formData.get("workerId"),
      documentType: formData.get("documentType"),
      expiryDate: formData.get("expiryDate"),
    });

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { success: false, error: "Please choose a file to upload." };
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return { success: false, error: "File is too large (10 MB limit)." };
    }

    const stored = await saveUploadedFile(file, `workers/${data.workerId}`);

    const document = await db.workerDocument.create({
      data: {
        workerId: data.workerId,
        fileName: file.name,
        fileUrl: stored.url,
        fileType: file.type || null,
        documentType: data.documentType || null,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
        verificationStatus: "PENDING",
        uploadedById: user.id,
      },
    });

    await logAudit({
      userId: user.id,
      action: "create",
      entityType: "WorkerDocument",
      entityId: document.id,
      newValue: { workerId: data.workerId, documentType: data.documentType, fileName: file.name },
    });
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
