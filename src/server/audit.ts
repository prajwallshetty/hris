import { db } from "@/lib/db";

export type AuditAction =
  | "create"
  | "update"
  | "archive"
  | "reactivate"
  | "end_assignment"
  | "import";

// Single write path for the audit trail (§25). Every mutating server action
// calls this after a successful write so the log stays complete without
// each module re-implementing it.
export async function logAudit(params: {
  userId: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  previousValue?: unknown;
  newValue?: unknown;
}) {
  await db.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      previousValue: params.previousValue === undefined ? undefined : (params.previousValue as object),
      newValue: params.newValue === undefined ? undefined : (params.newValue as object),
    },
  });
}
