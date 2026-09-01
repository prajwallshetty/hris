import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// One semantic mapping for every status enum in the app (§32) — a status
// badge should mean the same visual thing everywhere it appears, using the
// theme's success/warning/info/destructive/muted tokens rather than
// picking arbitrary Tailwind colors per module.
type Tone = "success" | "warning" | "destructive" | "info" | "neutral";

const TONE_CLASSES: Record<Tone, string> = {
  success: "bg-success/15 text-success dark:bg-success/20",
  warning: "bg-warning/20 text-warning-foreground dark:bg-warning/15 dark:text-warning",
  destructive: "bg-destructive/10 text-destructive dark:bg-destructive/20",
  info: "bg-info/15 text-info dark:bg-info/20",
  neutral: "bg-muted text-muted-foreground",
};

const STATUS_TONES: Record<string, Tone> = {
  // Worker / general entity status
  ACTIVE: "success",
  AVAILABLE: "info",
  ON_LEAVE: "warning",
  SUSPENDED: "warning",
  DEMOBILIZED: "neutral",
  RESIGNED: "neutral",
  TERMINATED: "destructive",
  INACTIVE: "neutral",

  // Assignment / timesheet lifecycle
  ENDED: "neutral",
  UPLOADED: "neutral",
  PENDING_REVIEW: "warning",
  LOCKED: "info",
  REJECTED: "destructive",

  // Generic request/approval lifecycle (leave, timesheet items)
  PENDING: "warning",
  APPROVED: "success",
  CANCELLED: "destructive",

  // Document verification
  VERIFIED: "success",

  // Payroll / commission lifecycle
  DRAFT: "neutral",
  REVIEW: "warning",
  PAID: "success",
  PARTIALLY_PAID: "warning",
  PAYABLE: "info",

  // Advances / loans
  FULLY_REPAID: "success",
  WRITTEN_OFF: "destructive",

  // Invoices
  ISSUED: "info",
  OVERDUE: "destructive",
};

function toLabel(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

export function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONES[status] ?? "neutral";
  return (
    <Badge variant="outline" className={cn("border-transparent font-medium", TONE_CLASSES[tone])}>
      {toLabel(status)}
    </Badge>
  );
}
