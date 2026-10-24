"use client";

import { LogOut } from "lucide-react";

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

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// Lives in the top ribbon header (§ ribbon redesign) — there's no more
// sidebar-collapse state to react to now that the sidebar is gone, so this
// always renders the full name+role form.
export function UserMenu({ name, email, role }: { name: string; email: string; role: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" className="h-9 max-w-48 gap-2 px-2">
            <Avatar className="size-6.5 shrink-0">
              <AvatarFallback className="text-xs">{initials(name)}</AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-sm font-medium">{name}</span>
              <span className="text-muted-foreground block truncate text-[11px]">{role.replaceAll("_", " ")}</span>
            </span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" side="bottom" className="w-56">
        <DropdownMenuLabel>
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="text-muted-foreground truncate text-xs font-normal">{email}</p>
          <p className="text-muted-foreground mt-0.5 text-xs font-normal">{role.replaceAll("_", " ")}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={(e) => e.preventDefault()} onClick={() => void signOutAction()}>
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
