import type { Role } from "@prisma/client";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  BarChart3,
  Banknote,
  Briefcase,
  Building2,
  CalendarOff,
  Car,
  ClipboardCheck,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  Handshake,
  History,
  House,
  LayoutDashboard,
  ListTodo,
  PieChart,
  Receipt,
  Settings,
  ShieldCheck,
  Timer,
  TrendingUp,
  Upload,
  UserCog,
  UserPlus,
  Users,
  UserSquare2,
  UsersRound,
  Wallet,
  Wrench,
} from "lucide-react";

/** Ribbon icon colors — a fixed palette so each shortcut is recognisable at a glance. */
export type NavColor = "blue" | "green" | "teal" | "orange" | "purple" | "red" | "indigo" | "amber" | "slate";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  color: NavColor;
  roles?: Role[]; // omit for "all roles"
};

export type NavGroup = {
  label: string;
  icon: LucideIcon;
  items: NavItem[];
};

// Two-level ERP navigation (§ redesign): each group is a top-bar module tab,
// and its items are the colorful shortcut ribbon under it.
//
// Every entry resolves to a real, working page or a real filter on one.
// Deliberately NOT listed — no standalone page exists for them yet, and a
// link would be a dead button or a duplicate of an existing item:
//   - Accommodation: no model or feature anywhere in the schema.
//   - Salary Slips, Payments, Advances, Loans, Final Settlement: reachable
//     per worker (Payroll → period → worker, or the worker's profile).
//     Final Settlement is a payment type, not a separate workflow.
//   - Projects, Sites, Client Payments, Statements: per-client tabs.
//   - Vehicle Assignments, Maintenance: per-vehicle/equipment tabs.
//   - Commissions: per-coordinator tab.
//   - Access Codes: an action on the Users & Access page, not a screen.
//   - Workforce "Overview": no aggregate page beyond the Dashboard.
const ALL_STAFF: Role[] = ["SUPER_ADMIN", "ADMIN", "HR", "ACCOUNTS", "MANAGER", "COORDINATOR", "CLIENT"];
const FINANCE: Role[] = ["SUPER_ADMIN", "ADMIN", "HR", "ACCOUNTS", "MANAGER"];

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Dashboard",
    icon: House,
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard, color: "blue" },
      { href: "/dashboard#pending-actions", label: "Pending Actions", icon: ListTodo, color: "orange" },
    ],
  },
  {
    label: "Workforce",
    icon: Users,
    items: [
      { href: "/workers", label: "Workers", icon: Users, color: "blue", roles: ALL_STAFF },
      { href: "/workers/new", label: "Register Manpower", icon: UserPlus, color: "green", roles: ["SUPER_ADMIN", "ADMIN", "HR"] },
      { href: "/assignments", label: "Assignments", icon: ClipboardList, color: "teal", roles: ALL_STAFF },
      { href: "/timesheets", label: "Attendance / LOG", icon: ClipboardCheck, color: "orange", roles: FINANCE },
      { href: "/leave", label: "Leave", icon: CalendarOff, color: "purple", roles: ["SUPER_ADMIN", "ADMIN", "HR", "MANAGER"] },
      { href: "/suppliers", label: "Suppliers", icon: Handshake, color: "indigo", roles: FINANCE },
      { href: "/workers/import", label: "Bulk Import", icon: FileSpreadsheet, color: "green", roles: ["SUPER_ADMIN", "ADMIN", "HR"] },
    ],
  },
  {
    label: "Payroll",
    icon: Wallet,
    items: [
      { href: "/payroll", label: "Salary", icon: Banknote, color: "green", roles: FINANCE },
      { href: "/reports?tab=payroll", label: "Payroll Reports", icon: PieChart, color: "purple", roles: FINANCE },
    ],
  },
  {
    label: "Clients & Billing",
    icon: Building2,
    items: [
      { href: "/clients", label: "Clients", icon: Building2, color: "blue", roles: ["SUPER_ADMIN", "ADMIN", "HR", "ACCOUNTS", "MANAGER", "COORDINATOR"] },
      { href: "/invoices", label: "Invoices", icon: FileText, color: "indigo", roles: ["SUPER_ADMIN", "ADMIN", "ACCOUNTS", "MANAGER", "CLIENT"] },
      { href: "/invoices?status=OVERDUE", label: "Outstanding", icon: AlertCircle, color: "red", roles: ["SUPER_ADMIN", "ADMIN", "ACCOUNTS", "MANAGER"] },
      { href: "/reports?tab=finance", label: "Client Reports", icon: TrendingUp, color: "teal", roles: ["SUPER_ADMIN", "ADMIN", "ACCOUNTS", "MANAGER"] },
    ],
  },
  {
    label: "Assets",
    icon: Car,
    items: [
      { href: "/vehicles", label: "Vehicles", icon: Car, color: "blue", roles: ALL_STAFF },
      { href: "/equipment", label: "Equipment", icon: Wrench, color: "orange", roles: ALL_STAFF },
      { href: "/rentals", label: "Equipment Rentals", icon: Timer, color: "teal", roles: ["SUPER_ADMIN", "ADMIN", "ACCOUNTS", "MANAGER", "COORDINATOR"] },
    ],
  },
  {
    label: "Operations",
    icon: Briefcase,
    items: [
      { href: "/coordinators", label: "Coordinators", icon: UserCog, color: "purple", roles: ["SUPER_ADMIN", "ADMIN", "HR", "COORDINATOR"] },
      { href: "/employees", label: "Employees", icon: UserSquare2, color: "blue", roles: FINANCE },
      { href: "/expenses", label: "Expenses", icon: Receipt, color: "red", roles: ["SUPER_ADMIN", "ADMIN", "ACCOUNTS", "MANAGER"] },
    ],
  },
  {
    label: "Reports",
    icon: BarChart3,
    items: [
      { href: "/reports?tab=workforce", label: "Workforce Reports", icon: Users, color: "blue", roles: FINANCE },
      { href: "/reports?tab=payroll", label: "Payroll Reports", icon: PieChart, color: "purple", roles: FINANCE },
      { href: "/reports?tab=finance", label: "Client Reports", icon: TrendingUp, color: "teal", roles: ["SUPER_ADMIN", "ADMIN", "ACCOUNTS", "MANAGER"] },
    ],
  },
  {
    label: "Administration",
    icon: Settings,
    items: [
      { href: "/users", label: "Users & Access", icon: UsersRound, color: "indigo", roles: ["SUPER_ADMIN"] },
      { href: "/audit-log", label: "Audit Log", icon: History, color: "slate", roles: ["SUPER_ADMIN", "ADMIN", "HR", "MANAGER"] },
      { href: "/import-history", label: "Import History", icon: Upload, color: "green", roles: ["SUPER_ADMIN", "ADMIN", "HR", "MANAGER"] },
      { href: "/settings", label: "Settings", icon: ShieldCheck, color: "amber", roles: ["SUPER_ADMIN", "ADMIN"] },
    ],
  },
];

export function navGroupsForRole(role: Role): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.roles || item.roles.includes(role)),
  })).filter((group) => group.items.length > 0);
}

function matchScore(item: NavItem, pathname: string, searchParams: URLSearchParams): number {
  const [path, query] = item.href.split("?");
  if (path.includes("#")) return -1; // in-page anchors never represent the current route
  if (pathname !== path && !pathname.startsWith(`${path}/`)) return -1;
  if (!query) return path.length * 10;
  const params = Array.from(new URLSearchParams(query).entries());
  if (!params.every(([key, value]) => searchParams.get(key) === value)) return -1;
  return path.length * 10 + params.length;
}

/**
 * The single nav item that best represents the current URL — longest path
 * wins, and a query-carrying item ("/invoices?status=OVERDUE") beats its
 * plain sibling only when its query actually matches. So /workers/new
 * highlights "Register Manpower", not also "Workers". Ties go to the first
 * group, so a shortcut listed in two groups opens the first one.
 */
export function findActiveNav(
  groups: NavGroup[],
  pathname: string,
  searchParams: URLSearchParams,
): { groupIndex: number; href: string } | null {
  let best: { groupIndex: number; href: string; score: number } | null = null;
  for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
    for (const item of groups[groupIndex].items) {
      const score = matchScore(item, pathname, searchParams);
      if (score >= 0 && (best === null || score > best.score)) best = { groupIndex, href: item.href, score };
    }
  }
  return best;
}

export const NAV_COLOR_CLASSES: Record<NavColor, string> = {
  blue: "text-blue-600",
  green: "text-emerald-600",
  teal: "text-teal-600",
  orange: "text-orange-500",
  purple: "text-violet-600",
  red: "text-red-500",
  indigo: "text-indigo-600",
  amber: "text-amber-500",
  slate: "text-slate-500",
};
