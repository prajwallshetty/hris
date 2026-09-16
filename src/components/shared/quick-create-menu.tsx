"use client";

import type { Role } from "@prisma/client";
import {
  Banknote,
  Building2,
  Car,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileText,
  Plus,
  Receipt,
  Timer,
  UserCog,
  UserPlus,
  UserSquare2,
  Wrench,
} from "lucide-react";
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
//
// Most of these targets are a list page whose "create" is a dialog, not a
// route of its own — so a bare link just lands on the list, leaving the
// user to go find the real button themselves (a "quick create" that quick
// creates nothing). Every such target carries `?new=1`, which the list
// page reads and passes as `defaultOpen` to that dialog so it's already
// open on arrival. Worker/Employee/Timesheet keep plain links since those
// really are dedicated create pages.
export function QuickCreateMenu({ role }: { role: Role }) {
  const user = { id: "", role, coordinatorId: null, clientId: null };

  const items = [
    can(user, "create", "worker") && { href: "/workers/new", label: "Add Worker", icon: UserPlus },
    can(user, "create", "employee") && { href: "/employees/new", label: "Add Employee", icon: UserSquare2 },
    can(user, "create", "assignment") && { href: "/assignments?new=1", label: "New Assignment", icon: ClipboardList },
    can(user, "create", "timesheet") && { href: "/timesheets/upload", label: "Upload Timesheet (LOG)", icon: ClipboardCheck },
    // Salary slips and worker payments are always tied to one worker — the
    // real create form lives on that worker's own profile page (the
    // Create Salary Slip / Record Payment buttons), so Quick Create routes
    // there to search for the worker rather than duplicating those forms.
    can(user, "create", "workerPayroll") && { href: "/workers", label: "Salary Slip", icon: FileText },
    can(user, "create", "workerPayment") && { href: "/workers", label: "Payment", icon: CreditCard },
    can(user, "create", "client") && { href: "/clients?new=1", label: "Add Client", icon: Building2 },
    can(user, "create", "invoice") && { href: "/invoices?new=1", label: "Generate Invoice", icon: FileText },
    can(user, "create", "vehicle") && { href: "/vehicles?new=1", label: "Add Vehicle", icon: Car },
    can(user, "create", "vehicleAssignment") && { href: "/vehicles?assign=1", label: "Vehicle Assignment", icon: UserCog },
    can(user, "create", "equipment") && { href: "/equipment?new=1", label: "Add Equipment", icon: Timer },
    can(user, "create", "equipmentRental") && { href: "/rentals?new=1", label: "Equipment Rental", icon: Wrench },
    can(user, "create", "expense") && { href: "/expenses?new=1", label: "Add Expense", icon: Receipt },
    can(user, "create", "coordinator") && { href: "/coordinators?new=1", label: "Add Coordinator", icon: UserCog },
    can(user, "create", "payrollPeriod") && { href: "/payroll?new=1", label: "New Payroll Period", icon: Banknote },
  ].filter((item): item is { href: string; label: string; icon: typeof UserPlus } => Boolean(item));

  if (items.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button size="sm"><Plus className="size-4" />Create</Button>} />
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Quick create</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.map((item) => (
          <DropdownMenuItem key={item.label} render={<Link href={item.href} />}>
            <item.icon className="size-4" />
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
