"use client";

import type { Role } from "@prisma/client";
import { Building2, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useSyncExternalStore } from "react";

import { GlobalSearch } from "@/components/shared/global-search";
import { SidebarNav } from "@/components/shared/sidebar-nav";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsClient } from "@/lib/use-is-client";
import {
  getSidebarCollapsedServerSnapshot,
  getSidebarCollapsedSnapshot,
  setSidebarCollapsed,
  subscribeSidebarCollapsed,
} from "@/lib/sidebar-collapsed-store";

// Server-rendered slots (Notifications hits the DB, UserMenu reads the
// session) passed down from the layout — this component itself stays a
// client component for the collapse state, so it can't import/render them
// directly (§ Next.js server/client composition).
export function DesktopSidebar({
  role,
  notifications,
  userMenu,
}: {
  role: Role;
  notifications: React.ReactNode;
  userMenu: React.ReactNode;
}) {
  const collapsed = useSyncExternalStore(
    subscribeSidebarCollapsed,
    getSidebarCollapsedSnapshot,
    getSidebarCollapsedServerSnapshot,
  );
  const mounted = useIsClient();

  return (
    <aside
      className={cn(
        "bg-sidebar hidden shrink-0 flex-col border-r transition-[width] duration-150 md:flex",
        collapsed ? "w-16" : "w-64",
        !mounted && "duration-0",
      )}
    >
      <div className={cn("flex h-14 items-center gap-2 border-b px-4", collapsed && "justify-center px-2")}>
        <div className="bg-primary text-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-md">
          <Building2 className="size-4" />
        </div>
        {!collapsed && <span className="truncate font-semibold">Manpower HRIS</span>}
      </div>

      <div className={cn("border-b p-3", collapsed && "flex justify-center px-2")}>
        <GlobalSearch collapsed={collapsed} />
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <SidebarNav role={role} collapsed={collapsed} />
      </div>

      <div className={cn("space-y-0.5 border-t p-2", collapsed && "flex flex-col items-center")}>
        {notifications}
        {userMenu}
        <div className={cn("pt-1", collapsed ? "" : "flex justify-end")}>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </Button>
        </div>
      </div>
    </aside>
  );
}
