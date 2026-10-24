import type { Role } from "@prisma/client";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  BarChart3,
  CalendarOff,
  LayoutDashboard,
  ListTodo,
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
  Upload,
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

// Shared by the top ribbon (desktop) and the overlay menu (mobile): a nav
// item's href can carry a query string (e.g. "/invoices?status=OVERDUE" for
// "Outstanding" next to plain "/invoices" for "Invoices") to give two nav
// entries genuinely distinct destinations on the same page rather than
// duplicating it. usePathname() alone can't tell them apart — it drops the
// query string — so the plain item would look active while viewing the
// filtered one. This checks the current search params too, and treats the
// plain (query-less) sibling as active only when no more specific
// query-carrying sibling on the same path currently matches.
export function isNavItemActive(
  item: NavItem,
  group: NavGroup,
  pathname: string,
  searchParams: URLSearchParams,
): boolean {
  const [itemPath, itemQuery] = item.href.split("?");
  if (pathname !== itemPath && !pathname.startsWith(`${itemPath}/`)) return false;

  if (!itemQuery) {
    const moreSpecificSiblingActive = group.items.some((sibling) => {
      if (sibling === item) return false;
      const [siblingPath, siblingQuery] = sibling.href.split("?");
      if (siblingPath !== itemPath || !siblingQuery) return false;
      const siblingParams = new URLSearchParams(siblingQuery);
      return Array.from(siblingParams.entries()).every(([key, value]) => searchParams.get(key) === value);
    });
    return !moreSpecificSiblingActive;
  }

  const itemParams = new URLSearchParams(itemQuery);
  return Array.from(itemParams.entries()).every(([key, value]) => searchParams.get(key) === value);
}

export function isNavGroupActive(group: NavGroup, pathname: string, searchParams: URLSearchParams): boolean {
  return group.items.some((item) => isNavItemActive(item, group, pathname, searchParams));
}

// Business-section grouping (§ ribbon redesign v2): Dashboard / Workforce /
// Payroll / Clients & Billing / Assets / Operations / Reports &
// Administration — these groups double as the top ribbon's tabs, with each
// group's items rendered as the icon row under that tab. A normal HR/admin
// user shouldn't have to know which of these is "operations" vs "clients"
// in database terms, just where to find the thing they need.
//
// This list is the result of an explicit audit against every route that
// actually exists (see the routes enumerated under src/app/(dashboard)) —
// every entry below resolves to a real, working page or a real, working
// filter on one. Leave got its own standalone page (/leave) because
// LeaveRequest/LeaveBalance/LeaveType are full models with real decision
// logic, not just a worker-profile tab — see src/server/queries/leave.ts.
// The following are still deliberately left out because they have no
// standalone destination of their own today — showing them would mean
// either a dead link or a duplicate of an item already listed:
//   - Accommodation: no model or feature exists anywhere in the schema —
//     unlike Leave, there is nothing to aggregate into a real page yet.
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
//     vehicle's own detail page today, though VehicleAssignment is a real
//     standalone model — a cross-vehicle assignments list is a reasonable
//     follow-up page, just not built yet. Equipment's Maintenance tab is
//     the same story.
//   - Sales, Commissions: tabs on a coordinator's own detail page.
//   - Access Codes: not a separate screen from Users & Access — resetting
//     a user's access code is an action *on* that same /users page (see
//     reset-access-code-button.tsx), so a second nav icon for it would
//     point at the identical page under a different label.
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
    label: "Dashboard",
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
      { href: "/dashboard#pending-actions", label: "Pending Actions", icon: ListTodo },
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
        label: "Attendance / LOG",
        icon: ClipboardCheck,
        roles: ["SUPER_ADMIN", "ADMIN", "HR", "ACCOUNTS", "MANAGER"],
      },
      {
        href: "/leave",
        label: "Leave",
        icon: CalendarOff,
        roles: ["SUPER_ADMIN", "ADMIN", "HR", "MANAGER"],
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
    label: "Clients & Billing",
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
      {
        href: "/expenses",
        label: "Expenses",
        icon: Receipt,
        roles: ["SUPER_ADMIN", "ADMIN", "ACCOUNTS", "MANAGER"],
      },
    ],
  },
  {
    label: "Reports & Administration",
    items: [
      {
        href: "/reports",
        label: "Reports",
        icon: BarChart3,
        roles: ["SUPER_ADMIN", "ADMIN", "HR", "ACCOUNTS", "MANAGER"],
      },
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
        href: "/import-history",
        label: "Import History",
        icon: Upload,
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
