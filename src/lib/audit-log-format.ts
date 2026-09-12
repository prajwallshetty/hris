import type { TimelineTone } from "@/components/shared/timeline";
import type { AuditAction } from "@/server/audit";

const ACTION_LABELS: Record<AuditAction, string> = {
  create: "Created",
  update: "Updated",
  archive: "Archived",
  reactivate: "Reactivated",
  end_assignment: "Assignment ended",
  assign_vehicle: "Vehicle assigned",
  return_vehicle: "Vehicle returned",
  import: "Imported",
  download_receipt: "Receipt downloaded",
};

const ACTION_TONES: Record<AuditAction, TimelineTone> = {
  create: "success",
  update: "info",
  archive: "destructive",
  reactivate: "success",
  end_assignment: "warning",
  assign_vehicle: "success",
  return_vehicle: "info",
  import: "info",
  download_receipt: "info",
};

/** Shared formatting for AuditLog.action across every entity's Activity tab/section. */
export function auditActionLabel(action: string): string {
  return ACTION_LABELS[action as AuditAction] ?? action;
}

export function auditActionTone(action: string): TimelineTone {
  return ACTION_TONES[action as AuditAction] ?? "default";
}

type JsonRecord = Record<string, unknown>;

function isPlainObject(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Common "this is the name a human would recognize" fields, checked in
// priority order — every logAudit() call in this app stores either the
// form input or the full prior row, both of which usually carry one of
// these. Never falls back to the raw id (§ never show raw database IDs) —
// a row with nothing name-like just shows the entity type alone.
const NAME_FIELDS = ["fullName", "companyName", "name", "title", "plateNumber", "label", "email"];

/** Best-effort human label for an audit entry, read from its own stored
 * before/after payload — no extra database lookup per row. */
export function getAuditEntryLabel(previousValue: unknown, newValue: unknown): string | null {
  for (const value of [newValue, previousValue]) {
    if (!isPlainObject(value)) continue;
    for (const field of NAME_FIELDS) {
      const candidate = value[field];
      if (typeof candidate === "string" && candidate.trim()) return candidate;
    }
  }
  return null;
}

function fieldLabel(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/\bId\b/g, "");
}

function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (isPlainObject(value) || Array.isArray(value)) return "(complex value)";
  return String(value);
}

export type AuditFieldDiff = { key: string; label: string; before: string; after: string; changed: boolean };

/** Turns two loosely-typed before/after JSON blobs into a flat list of
 * readable field rows instead of a raw JSON dump — skips nested
 * objects/arrays rather than printing them (§ don't dump the entire object
 * onto the screen). */
export function diffAuditValues(previousValue: unknown, newValue: unknown): AuditFieldDiff[] {
  const before = isPlainObject(previousValue) ? previousValue : {};
  const after = isPlainObject(newValue) ? newValue : {};
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).filter(
    (key) => !["id", "createdAt", "updatedAt"].includes(key) && !key.toLowerCase().endsWith("id"),
  );

  return keys
    .map((key) => {
      const beforeValue = formatFieldValue(before[key]);
      const afterValue = formatFieldValue(after[key]);
      return { key, label: fieldLabel(key), before: beforeValue, after: afterValue, changed: beforeValue !== afterValue };
    })
    .sort((a, b) => Number(b.changed) - Number(a.changed));
}
