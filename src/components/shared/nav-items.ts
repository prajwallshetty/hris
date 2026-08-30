import type { Role } from "@prisma/client";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  Building2,
  ClipboardList,
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

// Grouped so future phases (Timesheets under Workforce, Payroll under its
// own group, Reports, etc.) slot into an existing section instead of
// forcing a sidebar restructure later.
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
    ],
  },
  {
    label: "Operations",
    items: [
      {
        href: "/coordinators",
        label: "Coordinators",
        icon: UserCog,
        roles: ["SUPER_ADMIN", "ADMIN", "HR"],
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
