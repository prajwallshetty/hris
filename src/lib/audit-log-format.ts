import type { TimelineTone } from "@/components/shared/timeline";
import type { AuditAction } from "@/server/audit";

const ACTION_LABELS: Record<AuditAction, string> = {
  create: "Created",
  update: "Updated",
  archive: "Archived",
  reactivate: "Reactivated",
  end_assignment: "Assignment ended",
  import: "Imported",
};

const ACTION_TONES: Record<AuditAction, TimelineTone> = {
  create: "success",
  update: "info",
  archive: "destructive",
  reactivate: "success",
  end_assignment: "warning",
  import: "info",
};

/** Shared formatting for AuditLog.action across every entity's Activity tab/section. */
export function auditActionLabel(action: string): string {
  return ACTION_LABELS[action as AuditAction] ?? action;
}

export function auditActionTone(action: string): TimelineTone {
  return ACTION_TONES[action as AuditAction] ?? "default";
}
