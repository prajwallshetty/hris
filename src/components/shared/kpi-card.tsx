import { ArrowDown, ArrowRight, ArrowUp, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type KpiTrend = {
  direction: "up" | "down" | "flat";
  /** Pre-formatted, e.g. "4.8%" or "12 vs last month". */
  value: string;
  /** Positive framing for this metric — "up" isn't always good (e.g. Overdue). */
  tone?: "positive" | "negative" | "neutral";
};

const TREND_ICON = { up: ArrowUp, down: ArrowDown, flat: ArrowRight } as const;

const TREND_TONE_CLASSES = {
  positive: "text-success",
  negative: "text-destructive",
  neutral: "text-muted-foreground",
} as const;

/**
 * The one KPI/stat-card implementation for the whole app (§9/§40) — icon,
 * label, number, optional trend, optional supporting text. Used in place of
 * page-local "SummaryStat"/"SummaryCard" duplicates.
 */
export function KpiCard({
  href,
  label,
  value,
  icon: Icon,
  trend,
  description,
  className,
}: {
  href?: string;
  label: string;
  value: string;
  icon?: LucideIcon;
  trend?: KpiTrend;
  description?: string;
  className?: string;
}) {
  const TrendIcon = trend ? TREND_ICON[trend.direction] : null;
  const trendTone = trend?.tone ?? (trend?.direction === "down" ? "negative" : trend?.direction === "up" ? "positive" : "neutral");

  const body = (
    <Card variant={href ? "interactive" : "standard"} className={cn("py-4", href && "group-hover:border-primary/40", className)}>
      <CardContent className="flex items-start justify-between gap-3 px-4">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-medium">{label}</p>
          <p className="mt-1 truncate text-2xl font-semibold tabular-nums">{value}</p>
          {(trend ?? description) && (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              {trend && TrendIcon && (
                <span className={cn("inline-flex items-center gap-0.5 font-medium", TREND_TONE_CLASSES[trendTone])}>
                  <TrendIcon className="size-3" />
                  {trend.value}
                </span>
              )}
              {description && <span className="truncate">{description}</span>}
            </p>
          )}
        </div>
        {Icon && (
          <div className="bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors">
            <Icon className="size-4.5" />
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (!href) return body;
  return (
    <Link href={href} className="group">
      {body}
    </Link>
  );
}
