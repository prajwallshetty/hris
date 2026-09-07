"use client";

import { LogOut } from "lucide-react";
import { useSyncExternalStore } from "react";

import { signOutAction } from "@/server/actions/auth-signout";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getSidebarCollapsedServerSnapshot,
  getSidebarCollapsedSnapshot,
  subscribeSidebarCollapsed,
} from "@/lib/sidebar-collapsed-store";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// Lives at the bottom of the sidebar (§ shell redesign) — reads the same
// collapsed store as DesktopSidebar directly, since the server layout that
// renders this can't know client-only collapse state at render time.
export function UserMenu({ name, email, role }: { name: string; email: string; role: string }) {
  const collapsed = useSyncExternalStore(
    subscribeSidebarCollapsed,
    getSidebarCollapsedSnapshot,
    getSidebarCollapsedServerSnapshot,
  );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          collapsed ? (
            <Button variant="ghost" size="icon" className="mx-auto">
              <Avatar className="size-7">
                <AvatarFallback className="text-xs">{initials(name)}</AvatarFallback>
              </Avatar>
            </Button>
          ) : (
            <Button variant="ghost" className="h-11 w-full justify-start gap-2.5 px-2">
              <Avatar className="size-7 shrink-0">
                <AvatarFallback className="text-xs">{initials(name)}</AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate text-sm font-medium">{name}</span>
                <span className="text-muted-foreground block truncate text-xs">{role.replaceAll("_", " ")}</span>
              </span>
            </Button>
          )
        }
      />
      <DropdownMenuContent align="start" side={collapsed ? "right" : "top"} className="w-56">
        <DropdownMenuLabel>
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="text-muted-foreground truncate text-xs font-normal">{email}</p>
          <p className="text-muted-foreground mt-0.5 text-xs font-normal">{role.replaceAll("_", " ")}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <form action={signOutAction}>
          <DropdownMenuItem
            render={
              <button type="submit" className="flex w-full items-center gap-2">
                <LogOut className="size-4" />
                Sign out
              </button>
            }
          />
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
