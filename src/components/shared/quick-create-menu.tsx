"use client";

import type { Role } from "@prisma/client";
import { Banknote, Building2, ClipboardCheck, ClipboardList, FileText, Plus, UserCog, UserPlus } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { can } from "@/server/rbac";

// §39: a global "+ Create" menu for the operations that matter most day to
// day. Links to the existing create page/dialog for each — no new
// standalone create flows, just a faster way to reach the ones that exist.
export function QuickCreateMenu({ role }: { role: Role }) {
  const user = { id: "", role, coordinatorId: null, clientId: null };

  const items = [
    can(user, "create", "worker") && { href: "/workers/new", label: "Add Worker", icon: UserPlus },
    can(user, "create", "client") && { href: "/clients", label: "Add Client", icon: Building2 },
    can(user, "create", "assignment") && { href: "/assignments", label: "New Assignment", icon: ClipboardList },
    can(user, "create", "timesheet") && { href: "/timesheets/upload", label: "Upload Timesheet", icon: ClipboardCheck },
    can(user, "create", "payrollPeriod") && { href: "/payroll", label: "New Payroll Period", icon: Banknote },
    can(user, "create", "invoice") && { href: "/invoices", label: "Generate Invoice", icon: FileText },
    can(user, "create", "coordinator") && { href: "/coordinators", label: "Add Coordinator", icon: UserCog },
  ].filter((item): item is { href: string; label: string; icon: typeof UserPlus } => Boolean(item));

  if (items.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button size="sm"><Plus className="size-4" />Create</Button>} />
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Quick create</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.map((item) => (
          <DropdownMenuItem key={item.href} render={<Link href={item.href} />}>
            <item.icon className="size-4" />
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
