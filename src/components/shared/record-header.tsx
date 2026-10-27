import Link from "next/link";
import { Fragment } from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

import type { BreadcrumbTrailItem } from "./page-header";

export type RecordHeaderIndicator = {
  label: string;
  value: string;
  tone?: "success" | "warning" | "destructive" | "info" | "neutral";
};

const TONE_DOT_CLASSES = {
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
  info: "bg-info",
  neutral: "bg-muted-foreground",
} as const;

/**
 * Premium record-detail header (§ redesign reference) — an icon/avatar
 * block, title, status badges, a meta line (who/what this belongs to, when
 * it last changed), and a row of small colored-dot indicators on the right.
 * Every indicator here must be a real, derived value — never a fabricated
 * score (no "7.8/10"-style filler).
 */
export function RecordHeader({
  breadcrumbs,
  avatar,
  title,
  badges,
  meta,
  indicators,
  actions,
}: {
  breadcrumbs?: BreadcrumbTrailItem[];
  /** Square icon block or circular avatar — 44px, rendered by the caller. */
  avatar?: React.ReactNode;
  title: string;
  badges?: React.ReactNode;
  /** e.g. "Coordinator: Jane Doe · Edited 2 hours ago" */
  meta?: React.ReactNode;
  indicators?: RecordHeaderIndicator[];
  actions?: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((crumb, i) => (
              <Fragment key={i}>
                <BreadcrumbItem>
                  {crumb.href ? (
                    <BreadcrumbLink render={<Link href={crumb.href} />}>{crumb.label}</BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
                {i < breadcrumbs.length - 1 && <BreadcrumbSeparator />}
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      )}

      <div className="data-panel p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 flex-1 items-start gap-3.5">
            {avatar}
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="min-w-0 text-xl font-bold tracking-tight break-words text-slate-900 sm:text-2xl">{title}</h1>
                {badges}
              </div>
              {meta && <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">{meta}</div>}
            </div>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2 xl:max-w-[60%] xl:justify-end">{actions}</div>}
        </div>

        {indicators && indicators.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-slate-100 pt-3.5">
            {indicators.map((ind) => (
              <div key={ind.label} className="flex items-center gap-1.5">
                <span className={cn("size-2 shrink-0 rounded-full", TONE_DOT_CLASSES[ind.tone ?? "neutral"])} />
                <span className="text-muted-foreground text-xs">{ind.label}</span>
                <span className="text-sm font-semibold text-slate-900 tabular-nums">{ind.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** 44px square icon block — for entities without a photo (vehicles, equipment, coordinators…). */
export function RecordAvatarIcon({ icon: Icon, className }: { icon: React.ComponentType<{ className?: string }>; className?: string }) {
  return (
    <div className={cn("bg-primary flex size-12 shrink-0 items-center justify-center rounded-xl text-white shadow-sm", className)}>
      <Icon className="size-6" />
    </div>
  );
}

/** 44px circular initials avatar — for people (workers, employees, coordinators, contacts). */
export function RecordAvatarInitials({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      className={cn(
        "bg-navy flex size-12 shrink-0 items-center justify-center rounded-full text-base font-semibold text-white shadow-sm",
        className,
      )}
    >
      {initials || "?"}
    </div>
  );
}
