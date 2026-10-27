"use client";

import { ChevronDown, LogOut } from "lucide-react";

import { signOutAction } from "@/server/actions/auth-signout";
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

function roleLabel(role: string) {
  return role
    .toLowerCase()
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

export function UserMenu({
  name,
  email,
  role,
  variant = "header",
}: {
  name: string;
  email: string;
  role: string;
  /** header: avatar only until there's room for the name (≥1400px); drawer: always full. */
  variant?: "header" | "drawer";
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" className="h-11 w-full max-w-60 justify-start gap-2.5 rounded-lg px-1.5 lg:w-auto">
            <span className="bg-navy flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white">
              {initials(name)}
            </span>
            <span className={variant === "drawer" ? "min-w-0 flex-1 text-left" : "hidden min-w-0 flex-1 text-left min-[1400px]:block"}>
              <span className="block truncate text-sm font-semibold">{name}</span>
              <span className="text-muted-foreground block truncate text-xs font-normal">{roleLabel(role)}</span>
            </span>
            <ChevronDown className="text-muted-foreground size-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" side="bottom" className="w-60">
        <DropdownMenuLabel>
          <p className="truncate text-sm font-semibold">{name}</p>
          <p className="text-muted-foreground truncate text-xs font-normal">{email}</p>
          <p className="text-muted-foreground mt-0.5 text-xs font-normal">{roleLabel(role)}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={(e) => e.preventDefault()} onClick={() => void signOutAction()}>
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
