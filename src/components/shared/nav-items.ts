import type { Role } from "@prisma/client";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  Bell,
  LayoutDashboard,
  Users,
  UserSquare2,
  Building2,
  Banknote,
  ClipboardList,
  ClipboardCheck,
  FileText,
  Receipt,
  UserCog,
  UsersRound,
  History,
  Settings,
  Car,
  Wrench,
  Timer,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles?: Role[]; // omit for "all roles"
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

// Business-section grouping (§ IA restructure): Overview / Workforce /
// Payroll / Client Billing / Assets / Operations / Finance & Reports /
// Administration — a normal HR/admin user shouldn't have to know which of
// these is "operations" vs "clients" in database terms, just where to find
// the thing they need.
//
// This list is the result of an explicit audit against every route that
// actually exists (see the routes enumerated under src/app/(dashboard)) —
// every entry below resolves to a real, working page or a real, working
// filter on one. The following were deliberately left out because they
// have no standalone destination of their own — showing them would mean
// either a dead link or a duplicate of an item already listed:
//   - Leave, Accommodation: tabs on a worker's own 360° page only.
//   - Salary, Salary Slips, Payments, Advances, Loans, Final Settlement:
//     all reachable from Payroll -> a period -> a worker's payroll row
//     (which is also where Salary Slip/Record Payment/Receipt live), or
//     from a worker's own 360° page. Final Settlement is a payment type
//     you pick when recording a payment, not a separate workflow.
//   - Projects, Sites, Client Payments, Statements: tabs/actions on a
//     client's own 360° page (a project/site/statement always belongs to
//     one specific client, so there's nothing meaningful for a top-level
//     list to show).
//   - Vehicle Assignments, Vehicle Expenses, Maintenance: tabs on a
//     vehicle's own detail page. Equipment's Maintenance tab is the same.
//   - Sales, Commissions: tabs on a coordinator's own detail page.
//   - Roles & Permissions: access levels are defined in code (src/server/
//     rbac.ts), not an editable admin screen — there is nothing to link to.
//   - Cost Centres: not a concept this system tracks anywhere.
//   - Worker/Employee/Client/Vehicle/Equipment Documents as a top-level
//     "Documents" section: only Worker Documents exist today, as a tab on
//     the worker's own page — the other three record types have no
//     document feature built at all.
// If any of the above should become real top-level workflows, that's a
// feature request, not a nav relabel — build the page first, then link it.
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/notifications", label: "Pending Actions", icon: Bell },
    ],
  },
  {
    label: "Workforce",
    items: [
      {
        href: "/workers",
        label: "Workers",
        icon: Users,
        roles: ["SUPER_ADMIN", "ADMIN", "HR", "ACCOUNTS", "MANAGER", "COORDINATOR", "CLIENT"],
      },
      {
        href: "/assignments",
        label: "Assignments",
        icon: ClipboardList,
        roles: ["SUPER_ADMIN", "ADMIN", "HR", "ACCOUNTS", "MANAGER", "COORDINATOR", "CLIENT"],
      },
      {
        href: "/timesheets",
        label: "Timesheets (LOG)",
        icon: ClipboardCheck,
        roles: ["SUPER_ADMIN", "ADMIN", "HR", "ACCOUNTS", "MANAGER"],
      },
    ],
  },
  {
    label: "Payroll",
    items: [
      {
        href: "/payroll",
        label: "Payroll",
        icon: Banknote,
        roles: ["SUPER_ADMIN", "ADMIN", "HR", "ACCOUNTS", "MANAGER"],
      },
    ],
  },
  {
    label: "Client Billing",
    items: [
      {
        href: "/clients",
        label: "Clients",
        icon: Building2,
        roles: ["SUPER_ADMIN", "ADMIN", "HR", "ACCOUNTS", "MANAGER", "COORDINATOR"],
      },
      {
        href: "/invoices",
        label: "Invoices",
        icon: FileText,
        roles: ["SUPER_ADMIN", "ADMIN", "ACCOUNTS", "MANAGER", "CLIENT"],
      },
      {
        href: "/invoices?status=OVERDUE",
        label: "Outstanding",
        icon: AlertCircle,
        roles: ["SUPER_ADMIN", "ADMIN", "ACCOUNTS", "MANAGER"],
      },
    ],
  },
  {
    label: "Assets",
    items: [
      {
        href: "/vehicles",
        label: "Vehicles",
        icon: Car,
        roles: ["SUPER_ADMIN", "ADMIN", "HR", "ACCOUNTS", "MANAGER", "COORDINATOR", "CLIENT"],
      },
      {
        href: "/equipment",
        label: "Equipment",
        icon: Wrench,
        roles: ["SUPER_ADMIN", "ADMIN", "HR", "ACCOUNTS", "MANAGER", "COORDINATOR", "CLIENT"],
      },
      {
        href: "/rentals",
        label: "Equipment Rentals",
        icon: Timer,
        roles: ["SUPER_ADMIN", "ADMIN", "ACCOUNTS", "MANAGER", "COORDINATOR"],
      },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        href: "/coordinators",
        label: "Coordinators",
        icon: UserCog,
        roles: ["SUPER_ADMIN", "ADMIN", "HR", "COORDINATOR"],
      },
      {
        href: "/employees",
        label: "Internal Employees",
        icon: UserSquare2,
        roles: ["SUPER_ADMIN", "ADMIN", "HR", "ACCOUNTS", "MANAGER"],
      },
    ],
  },
  {
    label: "Finance & Reports",
    items: [
      {
        href: "/expenses",
        label: "Expenses",
        icon: Receipt,
        roles: ["SUPER_ADMIN", "ADMIN", "ACCOUNTS", "MANAGER"],
      },
      {
        href: "/reports?tab=payroll",
        label: "Payroll Reports",
        icon: Banknote,
        roles: ["SUPER_ADMIN", "ADMIN", "HR", "ACCOUNTS", "MANAGER"],
      },
      {
        href: "/reports?tab=finance",
        label: "Client Reports",
        icon: Building2,
        roles: ["SUPER_ADMIN", "ADMIN", "ACCOUNTS", "MANAGER"],
      },
      {
        href: "/reports?tab=workforce",
        label: "Worker Reports",
        icon: Users,
        roles: ["SUPER_ADMIN", "ADMIN", "HR", "ACCOUNTS", "MANAGER"],
      },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        href: "/users",
        label: "Users & Access",
        icon: UsersRound,
        roles: ["SUPER_ADMIN"],
      },
      {
        href: "/audit-log",
        label: "Audit Log",
        icon: History,
        roles: ["SUPER_ADMIN", "ADMIN", "HR", "MANAGER"],
      },
      {
        href: "/settings",
        label: "Settings",
        icon: Settings,
        roles: ["SUPER_ADMIN", "ADMIN"],
      },
    ],
  },
];

export function navGroupsForRole(role: Role): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.roles || item.roles.includes(role)),
  })).filter((group) => group.items.length > 0);
}
