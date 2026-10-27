"use client";

import type { Role } from "@prisma/client";
import { ChevronDown, Plus } from "lucide-react";
import Link from "next/link";

import { NAV_COLOR_CLASSES } from "@/components/shared/nav-items";
import { quickCreateItems } from "@/components/shared/quick-create-items";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function QuickCreateMenu({ role }: { role: Role }) {
  const items = quickCreateItems(role);
  if (items.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button className="h-10 gap-1.5 rounded-lg px-3 shadow-sm sm:px-4" aria-label="Create">
            <Plus className="size-4.5" />
            <span className="hidden sm:inline">Create</span>
            <ChevronDown className="hidden size-4 opacity-80 sm:inline" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>Quick create</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.map((item) => (
          <DropdownMenuItem key={item.label} render={<Link href={item.href} />}>
            <item.icon className={cn("size-4", NAV_COLOR_CLASSES[item.color])} />
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
