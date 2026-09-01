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
  History,
  Settings,
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

// Enterprise-ERP-style grouping (§4): Overview / Workforce / Clients / HR /
// Payroll / Operations / Reports / Administration — one group per business
// domain rather than a generic "Finance" catch-all. Only routes that exist
// today are listed; Projects/Sites/Contracts/Billing/Leave/Documents/
// Advances/Loans/Sales/Commission live inside their parent detail pages for
// now and get their own top-level nav entry once Phases 4-11 build
// standalone list pages for them.
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
        label: "Timesheets",
        icon: ClipboardCheck,
        roles: ["SUPER_ADMIN", "ADMIN", "HR", "ACCOUNTS", "MANAGER"],
      },
    ],
  },
  {
    label: "Clients",
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
    label: "HR",
    items: [
      {
        href: "/employees",
        label: "Employees",
        icon: UserSquare2,
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
    label: "Operations",
    items: [
      {
        href: "/coordinators",
        label: "Coordinators",
        icon: UserCog,
        roles: ["SUPER_ADMIN", "ADMIN", "HR", "COORDINATOR"],
      },
      {
        href: "/expenses",
        label: "Expenses",
        icon: Receipt,
        roles: ["SUPER_ADMIN", "ADMIN", "ACCOUNTS", "MANAGER"],
      },
    ],
  },
  {
    label: "Reports",
    items: [
      {
        href: "/reports",
        label: "Reports",
        icon: BarChart3,
        roles: ["SUPER_ADMIN", "ADMIN", "HR", "ACCOUNTS", "MANAGER"],
      },
    ],
  },
  {
    label: "Administration",
    items: [
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
