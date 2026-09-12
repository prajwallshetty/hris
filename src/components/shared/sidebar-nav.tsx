"use client";

import type { Role } from "@prisma/client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { navGroupsForRole, type NavGroup, type NavItem } from "@/components/shared/nav-items";

// A nav item's href can carry a query string (e.g. "/invoices?status=OVERDUE"
// for "Outstanding" next to plain "/invoices" for "Invoices") to give two
// sidebar entries genuinely distinct destinations on the same page rather
// than duplicating it. usePathname() alone can't tell them apart — it drops
// the query string — so the plain item would look active while viewing the
// filtered one. This checks the current search params too, and treats the
// plain (query-less) sibling as active only when no more specific
// query-carrying sibling on the same path currently matches.
function isNavItemActive(item: NavItem, group: NavGroup, pathname: string, searchParams: URLSearchParams): boolean {
  const [itemPath, itemQuery] = item.href.split("?");
  if (pathname !== itemPath && !pathname.startsWith(`${itemPath}/`)) return false;

  if (!itemQuery) {
    const moreSpecificSiblingActive = group.items.some((sibling) => {
      if (sibling === item) return false;
      const [siblingPath, siblingQuery] = sibling.href.split("?");
      if (siblingPath !== itemPath || !siblingQuery) return false;
      const siblingParams = new URLSearchParams(siblingQuery);
      return Array.from(siblingParams.entries()).every(([key, value]) => searchParams.get(key) === value);
    });
    return !moreSpecificSiblingActive;
  }

  const itemParams = new URLSearchParams(itemQuery);
  return Array.from(itemParams.entries()).every(([key, value]) => searchParams.get(key) === value);
}

export function SidebarNav({
  role,
  collapsed = false,
  onNavigate,
}: {
  role: Role;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const groups = navGroupsForRole(role);

  return (
    <nav className="flex flex-col gap-3.5">
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-0.5">
          {!collapsed && (
            <p className="text-muted-foreground/80 px-3 pb-1 text-[10.5px] font-semibold tracking-wider uppercase">
              {group.label}
            </p>
          )}
          {group.items.map((item) => {
            const isActive = isNavItemActive(item, group, pathname, searchParams);
            const link = (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
                  collapsed && "justify-center px-2",
                  isActive
                    ? "bg-accent text-primary before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <item.icon className="size-4 shrink-0" />
                {!collapsed && item.label}
              </Link>
            );

            if (!collapsed) return link;

            return (
              <Tooltip key={item.href}>
                <TooltipTrigger render={link} />
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
