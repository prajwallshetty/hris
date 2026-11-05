import type { Role } from "@prisma/client";
import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  Building2,
  CalendarOff,
  Car,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileText,
  FolderKanban,
  Receipt,
  Timer,
  UserCog,
  UserPlus,
  UserSquare2,
  Wrench,
} from "lucide-react";

import type { NavColor } from "@/components/shared/nav-items";
import { can } from "@/server/rbac";

export type QuickCreateItem = { href: string; label: string; shortLabel: string; icon: LucideIcon; color: NavColor };

/**
 * The one list of Quick Create shortcuts — rendered both by the header's
 * "+ Create" menu and the dashboard's Quick Create panel. Every target is an
 * existing create page, or a list page whose create dialog opens via
 * `?new=1`. Salary Slip, Payment and Leave are always tied to one worker,
 * so they route to Workers to pick the worker rather than duplicating the
 * forms that live on the worker's profile.
 */
export function quickCreateItems(role: Role): QuickCreateItem[] {
  const user = { id: "", role, coordinatorId: null, clientId: null };
  const items: (QuickCreateItem | false)[] = [
    can(user, "create", "worker") && { href: "/workers/new", label: "Register Manpower", shortLabel: "Worker", icon: UserPlus, color: "blue" },
    can(user, "create", "assignment") && { href: "/assignments?new=1", label: "New Assignment", shortLabel: "Assignment", icon: ClipboardList, color: "green" },
    can(user, "create", "timesheet") && { href: "/timesheets/upload", label: "Attendance / LOG", shortLabel: "Attendance", icon: ClipboardCheck, color: "orange" },
    can(user, "create", "workerPayroll") && { href: "/workers", label: "Salary Slip", shortLabel: "Salary Slip", icon: FileText, color: "purple" },
    can(user, "create", "workerPayment") && { href: "/workers", label: "Payment", shortLabel: "Payment", icon: CreditCard, color: "red" },
    can(user, "create", "client") && { href: "/clients?new=1", label: "Add Client", shortLabel: "Client", icon: Building2, color: "blue" },
    can(user, "create", "project") && { href: "/projects?new=1", label: "Add Project", shortLabel: "Project", icon: FolderKanban, color: "green" },
    can(user, "create", "invoice") && { href: "/invoices?new=1", label: "Generate Invoice", shortLabel: "Invoice", icon: FileText, color: "indigo" },
    can(user, "create", "vehicle") && { href: "/vehicles?new=1", label: "Add Vehicle", shortLabel: "Vehicle", icon: Car, color: "slate" },
    can(user, "create", "equipment") && { href: "/equipment?new=1", label: "Add Equipment", shortLabel: "Equipment", icon: Wrench, color: "teal" },
    can(user, "create", "equipmentRental") && { href: "/rentals?new=1", label: "Equipment Rental", shortLabel: "Equipment Rental", icon: Timer, color: "amber" },
    can(user, "create", "expense") && { href: "/expenses?new=1", label: "Add Expense", shortLabel: "Expense", icon: Receipt, color: "indigo" },
    can(user, "create", "leaveRequest") && { href: "/workers", label: "Leave", shortLabel: "Leave", icon: CalendarOff, color: "purple" },
    can(user, "create", "vehicleAssignment") && { href: "/vehicles?assign=1", label: "Vehicle Assignment", shortLabel: "Vehicle Assignment", icon: UserCog, color: "slate" },
    can(user, "create", "employee") && { href: "/employees/new", label: "Add Employee", shortLabel: "Employee", icon: UserSquare2, color: "blue" },
    can(user, "create", "coordinator") && { href: "/coordinators?new=1", label: "Add Coordinator", shortLabel: "Coordinator", icon: UserCog, color: "purple" },
    can(user, "create", "payrollPeriod") && { href: "/payroll?new=1", label: "New Payroll Period", shortLabel: "Payroll Period", icon: Banknote, color: "green" },
  ];
  return items.filter((item): item is QuickCreateItem => Boolean(item));
}
