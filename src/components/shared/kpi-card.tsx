import { ArrowDown, ArrowRight, ArrowUp, ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";

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

export type KpiAccent = "blue" | "green" | "purple" | "red" | "orange" | "teal";

// Solid icon tile (§ redesign reference). Cards without an accent get the
// soft brand tile, so dense detail pages don't turn into a rainbow.
const ACCENT_TILE: Record<KpiAccent, string> = {
  blue: "bg-blue-600 text-white",
  green: "bg-emerald-500 text-white",
  purple: "bg-violet-500 text-white",
  red: "bg-red-500 text-white",
  orange: "bg-orange-500 text-white",
  teal: "bg-teal-500 text-white",
};

const ACCENT_RING: Record<KpiAccent, string> = {
  blue: "stroke-blue-600",
  green: "stroke-emerald-500",
  purple: "stroke-violet-500",
  red: "stroke-red-500",
  orange: "stroke-orange-500",
  teal: "stroke-teal-500",
};

function ProgressRing({ percent, accent }: { percent: number; accent: KpiAccent }) {
  const clamped = Math.max(0, Math.min(100, percent));
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-14 shrink-0" aria-label={`${Math.round(clamped)}%`}>
      <svg viewBox="0 0 56 56" className="size-14 -rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" strokeWidth="6" className="stroke-slate-100" />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (clamped / 100) * c}
          className={ACCENT_RING[accent]}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold tabular-nums">
        {Math.round(clamped)}%
      </span>
    </div>
  );
}

/**
 * The one KPI/stat card for the whole app — icon tile, label, value,
 * optional trend or supporting line, optional percentage ring.
 */
export function KpiCard({
  href,
  label,
  value,
  icon: Icon,
  trend,
  description,
  className,
  accent,
  progress,
  valueClassName,
}: {
  href?: string;
  label: string;
  value: string;
  icon?: LucideIcon;
  trend?: KpiTrend;
  description?: string;
  className?: string;
  accent?: KpiAccent;
  /** 0–100 — renders a ring on the right (e.g. "75% of payroll paid"). */
  progress?: number;
  valueClassName?: string;
}) {
  const TrendIcon = trend ? TREND_ICON[trend.direction] : null;
  const trendTone = trend?.tone ?? (trend?.direction === "down" ? "negative" : trend?.direction === "up" ? "positive" : "neutral");

  const body = (
    <div
      className={cn(
        "data-panel flex h-full items-center gap-3.5 p-4 transition-shadow",
        href && "group-hover:border-primary/30 group-hover:shadow-md",
        className,
      )}
    >
      {Icon && (
        <div
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-xl",
            accent ? ACCENT_TILE[accent] : "bg-accent text-primary",
          )}
        >
          <Icon className="size-6" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-slate-600">{label}</p>
        <p className={cn("mt-0.5 truncate text-[22px] leading-tight font-bold tracking-tight text-slate-900 tabular-nums", valueClassName)}>
          {value}
        </p>
        {(trend ?? description) && (
          <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-xs">
            {trend && TrendIcon && (
              <span className={cn("inline-flex items-center gap-0.5 font-semibold", TREND_TONE_CLASSES[trendTone])}>
                <TrendIcon className="size-3" />
                {trend.value}
              </span>
            )}
            {description && <span className="truncate">{description}</span>}
          </p>
        )}
      </div>
      {progress != null && <ProgressRing percent={progress} accent={accent ?? "blue"} />}
      {href && progress == null && (
        <ChevronRight className="text-muted-foreground group-hover:text-primary size-4 shrink-0 transition-colors" />
      )}
    </div>
  );

  if (!href) return body;
  return (
    <Link href={href} className="group block h-full">
      {body}
    </Link>
  );
}
