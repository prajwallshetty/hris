import type { Role } from "@prisma/client";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  UserSquare2,
  Building2,
  Banknote,
  ClipboardList,
  ClipboardCheck,
  FileText,
  Receipt,
  BarChart3,
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

// Business-section grouping (§ UX restructure): Overview / Workforce /
// Payroll / Client Billing / Rentals / People / Finance / Admin — a normal
// HR/admin user shouldn't have to know which of these is "operations" vs
// "clients" in database terms, just where to find the thing they need. Only
// routes that exist today are listed; sub-features like Projects/Sites/
// Leave/Advances/Loans/Documents live inside their parent detail page
// (Client/Worker 360) rather than getting their own top-level entry —
// adding a nav item for every sub-feature is exactly the navigation
// confusion this restructure is meant to remove.
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
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
    ],
  },
  {
    label: "Rentals",
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
    label: "People",
    items: [
      {
        href: "/coordinators",
        label: "Coordinators",
        icon: UserCog,
        roles: ["SUPER_ADMIN", "ADMIN", "HR", "COORDINATOR"],
      },
      {
        href: "/employees",
        label: "Employees",
        icon: UserSquare2,
        roles: ["SUPER_ADMIN", "ADMIN", "HR", "ACCOUNTS", "MANAGER"],
      },
    ],
  },
  {
    label: "Finance",
    items: [
      {
        href: "/expenses",
        label: "Expenses",
        icon: Receipt,
        roles: ["SUPER_ADMIN", "ADMIN", "ACCOUNTS", "MANAGER"],
      },
      {
        href: "/reports",
        label: "Reports",
        icon: BarChart3,
        roles: ["SUPER_ADMIN", "ADMIN", "HR", "ACCOUNTS", "MANAGER"],
      },
    ],
  },
  {
    label: "Admin",
    items: [
      {
        href: "/users",
        label: "Users",
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
