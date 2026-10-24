"use client";

import type { Role } from "@prisma/client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { isNavGroupActive, isNavItemActive, navGroupsForRole } from "@/components/shared/nav-items";

// Classic ERP ribbon (§ ribbon redesign): a row of module tabs, and under
// the selected tab, a row of large icon buttons — each one a real route,
// never a placeholder. The selected tab follows the current route by
// default (so landing on /payroll shows the Payroll tab open); clicking a
// different tab overrides that until the next navigation re-syncs it.
export function TopRibbonNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const groups = navGroupsForRole(role);

  const routeGroupIndex = groups.findIndex((group) => isNavGroupActive(group, pathname, searchParams));
  const defaultIndex = routeGroupIndex >= 0 ? routeGroupIndex : 0;
  const routeKey = `${pathname}?${searchParams.toString()}`;

  const [selectedIndex, setSelectedIndex] = useState(defaultIndex);
  // Re-sync the open tab to whichever group the route just landed in, without
  // an effect (adjusting state during render, not after it, per
  // https://react.dev/learn/you-might-not-need-an-effect#resetting-all-state-when-a-prop-changes) —
  // a manual tab click overrides this until the next navigation.
  const [lastRouteKey, setLastRouteKey] = useState(routeKey);
  if (routeKey !== lastRouteKey) {
    setLastRouteKey(routeKey);
    setSelectedIndex(defaultIndex);
  }

  if (groups.length === 0) return null;
  const selectedGroup = groups[Math.min(selectedIndex, groups.length - 1)];

  return (
    <div className="hidden border-b bg-white md:block">
      <nav aria-label="Modules" className="flex items-stretch overflow-x-auto px-2">
        {groups.map((group, index) => {
          const isSelected = index === selectedIndex;
          return (
            <button
              key={group.label}
              type="button"
              onClick={() => setSelectedIndex(index)}
              aria-current={isSelected ? "true" : undefined}
              className={cn(
                "shrink-0 border-b-2 px-3.5 py-2 text-[13px] font-medium whitespace-nowrap transition-colors",
                isSelected
                  ? "border-primary text-primary bg-accent/50"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground border-transparent",
              )}
            >
              {group.label}
            </button>
          );
        })}
      </nav>

      <div className="flex items-stretch gap-1 overflow-x-auto border-t px-2 py-1.5">
        {selectedGroup.items.map((item) => {
          const isActive = isNavItemActive(item, selectedGroup, pathname, searchParams);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-w-[76px] shrink-0 flex-col items-center gap-1 rounded-sm px-2.5 py-1.5 text-center transition-colors",
                isActive
                  ? "bg-accent text-primary"
                  : "text-foreground/80 hover:bg-secondary hover:text-foreground",
              )}
            >
              <item.icon className={cn("size-5", isActive && "text-primary")} />
              <span className="text-[11px] leading-tight font-medium whitespace-nowrap">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
