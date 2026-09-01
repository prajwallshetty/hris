import type { LucideIcon } from "lucide-react";
import { Circle } from "lucide-react";
import type { ReactNode } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";

export type TimelineTone = "default" | "success" | "warning" | "destructive" | "info";

export type TimelineItem = {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  timestamp: Date;
  icon?: LucideIcon;
  tone?: TimelineTone;
};

const TONE_DOT_CLASSES: Record<TimelineTone, string> = {
  default: "bg-muted-foreground/60",
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
  info: "bg-info",
};

function formatTimestamp(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

/** Shared activity-feed component (§37/worker-client-payroll "Activity" tabs). */
export function Timeline({ items, emptyMessage = "No activity yet" }: { items: TimelineItem[]; emptyMessage?: string }) {
  if (items.length === 0) return <EmptyState icon={Circle} title={emptyMessage} />;

  return (
    <ol className="relative space-y-5 border-l border-border pl-5">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <li key={item.id} className="relative">
            <span
              className={cn(
                "absolute top-1 -left-[25px] flex size-3 items-center justify-center rounded-full ring-4 ring-background",
                TONE_DOT_CLASSES[item.tone ?? "default"],
              )}
            />
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2">
                {Icon && <Icon className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />}
                <p className="text-sm font-medium">{item.title}</p>
              </div>
              <time className="text-muted-foreground shrink-0 text-xs whitespace-nowrap tabular-nums">
                {formatTimestamp(item.timestamp)}
              </time>
            </div>
            {item.description && <div className="text-muted-foreground mt-0.5 text-sm">{item.description}</div>}
          </li>
        );
      })}
    </ol>
  );
}
