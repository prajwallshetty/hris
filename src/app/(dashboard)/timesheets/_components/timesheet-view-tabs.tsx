import { CalendarDays, Layers } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

/** Switches between the daily attendance table and the batch/approval view. */
export function TimesheetViewTabs({ active }: { active: "daily" | "batches" }) {
  const tabs = [
    { key: "daily", href: "/timesheets/log", label: "Daily Attendance", icon: CalendarDays },
    { key: "batches", href: "/timesheets", label: "Batches & Approval", icon: Layers },
  ] as const;
  return (
    <nav aria-label="Timesheet views" className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={active === t.key ? "page" : undefined}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            active === t.key ? "bg-primary text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
          )}
        >
          <t.icon className="size-4" />
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
