import {
  AlertTriangle,
  Banknote,
  Building2,
  Car,
  CircleCheck,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileText,
  History,
  Inbox,
  Receipt,
  UserCheck,
  Users,
  UserX,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { WorkersByStatusChart } from "@/components/shared/charts/workers-by-status-chart";
import { PayrollOverviewChart } from "@/components/shared/charts/payroll-overview-chart";
import { KpiCard } from "@/components/shared/kpi-card";
import { NAV_COLOR_CLASSES } from "@/components/shared/nav-items";
import { quickCreateItems } from "@/components/shared/quick-create-items";
import { Button } from "@/components/ui/button";
import { auth } from "@/auth";
import { auditActionLabel, getAuditEntryLabel } from "@/lib/audit-log-format";
import { cn } from "@/lib/utils";
import { can } from "@/server/rbac";
import {
  getDashboardData,
  getRecentAuditLog,
  listDashboardSites,
  recentDashboardMonths,
  resolveDashboardMonth,
} from "@/server/queries/dashboard";
import { getSessionUser } from "@/server/session";

import { DashboardFilters } from "./dashboard-filters";

function formatMoney(value: number) {
  return `SAR ${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function timeAgo(date: Date) {
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(date);
}

// Activity rows: an icon/colour per record type, and a link only where a
// detail page for that record type actually exists.
const ACTIVITY_STYLE: Record<string, { icon: LucideIcon; tile: string; label: string; href?: (id: string) => string }> = {
  Worker: { icon: Users, tile: "bg-blue-50 text-blue-600", label: "Worker", href: (id) => `/workers/${id}` },
  WorkerPayment: { icon: CreditCard, tile: "bg-emerald-50 text-emerald-600", label: "Salary payment" },
  WorkerPayroll: { icon: Wallet, tile: "bg-emerald-50 text-emerald-600", label: "Salary slip", href: (id) => `/payroll/worker/${id}` },
  Invoice: { icon: FileText, tile: "bg-violet-50 text-violet-600", label: "Invoice", href: (id) => `/invoices/${id}` },
  Client: { icon: Building2, tile: "bg-blue-50 text-blue-600", label: "Client", href: (id) => `/clients/${id}` },
  Assignment: { icon: ClipboardList, tile: "bg-teal-50 text-teal-600", label: "Assignment", href: (id) => `/assignments?detail=${id}` },
  Timesheet: { icon: ClipboardCheck, tile: "bg-orange-50 text-orange-600", label: "Attendance", href: (id) => `/timesheets/${id}` },
  Vehicle: { icon: Car, tile: "bg-slate-100 text-slate-600", label: "Vehicle", href: (id) => `/vehicles/${id}` },
  Equipment: { icon: Wrench, tile: "bg-amber-50 text-amber-600", label: "Equipment", href: (id) => `/equipment/${id}` },
  Expense: { icon: Receipt, tile: "bg-red-50 text-red-500", label: "Expense" },
  PayrollPeriod: { icon: Banknote, tile: "bg-emerald-50 text-emerald-600", label: "Payroll period", href: (id) => `/payroll/${id}` },
};

const PENDING_TONE: Record<string, string> = {
  red: "bg-red-50 text-red-500",
  orange: "bg-orange-50 text-orange-500",
  blue: "bg-blue-50 text-blue-600",
  purple: "bg-violet-50 text-violet-600",
  teal: "bg-teal-50 text-teal-600",
  green: "bg-emerald-50 text-emerald-600",
};

const PENDING_ICON: Record<string, LucideIcon> = {
  review: ClipboardCheck,
  uploaded: ClipboardCheck,
  unassigned: UserX,
  salary: Wallet,
  overdue: FileText,
  leave: Inbox,
  expiring: AlertTriangle,
};

function Panel({ title, action, children, className, id }: { title: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cn("data-panel flex min-w-0 flex-col p-4 sm:p-5", className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ month?: string; site?: string }> }) {
  const params = await searchParams;
  const [session, user] = await Promise.all([auth(), getSessionUser()]);
  const firstName = (session?.user?.name ?? "").split(" ")[0];
  const month = resolveDashboardMonth(params.month);
  const sites = await listDashboardSites(user);
  const siteId = sites.some((s) => s.id === params.site) ? params.site : undefined;
  const showActivity = can(user, "view", "auditLog");

  const [data, activity] = await Promise.all([
    getDashboardData(user, { month, siteId }),
    showActivity ? getRecentAuditLog(6) : Promise.resolve([]),
  ]);
  const { kpis } = data;
  const quickCreate = quickCreateItems(user.role).slice(0, 12);
  const pendingTotal = data.pendingActions.reduce((sum, a) => sum + a.count, 0);
  const topClientMax = Math.max(1, ...data.topClients.map((c) => c.count));
  const siteLabel = siteId ? sites.find((s) => s.id === siteId)?.name : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h1 className="text-[28px] leading-tight font-bold tracking-tight text-slate-900 sm:text-[32px]">Dashboard</h1>
          <p className="text-[15px] text-slate-600">
            Welcome back{firstName ? `, ${firstName}` : ""}! Here&rsquo;s an overview of your HR and operations
            {siteLabel ? ` at ${siteLabel}` : ""}.
          </p>
        </div>
        <DashboardFilters
          month={month.key}
          months={recentDashboardMonths().map((m) => ({ key: m.key, label: m.label }))}
          siteId={siteId ?? ""}
          sites={sites.map((s) => ({ id: s.id, label: `${s.name} — ${s.project.client.companyName}` }))}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {data.permissions.canWorkers && (
          <KpiCard
            href="/workers?status=ACTIVE"
            label="Active Workers"
            value={kpis.activeWorkers.toLocaleString()}
            icon={UserCheck}
            accent="blue"
            description={siteLabel ? `at ${siteLabel}` : "Deployed and working"}
          />
        )}
        {data.permissions.canPayroll && (
          <>
            <KpiCard
              href={data.payrollHref}
              label="Current Month Payroll"
              value={formatMoney(kpis.payroll)}
              icon={Banknote}
              accent="green"
              description={month.label}
            />
            <KpiCard
              href={data.payrollHref}
              label="Paid Amount"
              value={formatMoney(kpis.paid)}
              icon={CircleCheck}
              accent="purple"
              description="of payroll"
              progress={kpis.payroll > 0 ? kpis.paidPercent : undefined}
            />
            <KpiCard
              href={data.payrollHref}
              label="Outstanding Salary"
              value={formatMoney(kpis.outstanding)}
              icon={Wallet}
              accent="red"
              description="still to pay"
              progress={kpis.payroll > 0 ? 100 - kpis.paidPercent : undefined}
            />
          </>
        )}
        {data.permissions.canWorkers && (
          <KpiCard
            href="/workers?unassigned=1"
            label="Workers Without Assignment"
            value={kpis.workersWithoutAssignment.toLocaleString()}
            icon={UserX}
            accent="orange"
            description={siteLabel ? "across all sites" : "Active or available"}
          />
        )}
        {data.permissions.canInvoices && (
          <KpiCard
            href="/invoices?status=OVERDUE"
            label="Overdue Invoices"
            value={kpis.overdueInvoices.toLocaleString()}
            icon={FileText}
            accent="blue"
            description={kpis.overdueAmount > 0 ? `${formatMoney(kpis.overdueAmount)} outstanding` : "Nothing overdue"}
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-[1.3fr_1fr_0.95fr]">
        {data.permissions.canPayroll && (
          <Panel
            title="Payroll Overview"
            action={
              <div className="flex items-center gap-3 text-xs text-slate-600">
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-[#1f6fe5]" /> Paid
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-[#9cc2f7]" /> Outstanding
                </span>
              </div>
            }
            className="lg:col-span-2 xl:col-span-1"
          >
            {data.trend.some((m) => m.paid + m.outstanding > 0) ? (
              <PayrollOverviewChart data={data.trend} />
            ) : (
              <p className="text-muted-foreground py-16 text-center text-sm">No payroll in the 9 months up to {month.label}.</p>
            )}
          </Panel>
        )}
        {data.permissions.canWorkers && (
          <Panel title="Worker Status">
            {data.workerStatus.length > 0 ? (
              <WorkersByStatusChart data={data.workerStatus} />
            ) : (
              <p className="text-muted-foreground py-16 text-center text-sm">No workers yet.</p>
            )}
          </Panel>
        )}
        {data.permissions.canWorkers && (
          <Panel
            title="Top Clients by Active Workers"
            action={
              <Link href="/clients" className="text-primary text-sm font-semibold hover:underline">
                View All
              </Link>
            }
          >
            {data.topClients.length > 0 ? (
              <ul className="space-y-3.5">
                {data.topClients.map((client) => (
                  <li key={client.id}>
                    <Link href={`/clients/${client.id}`} className="group grid grid-cols-[minmax(0,7rem)_1fr_2.5rem] items-center gap-3 text-sm">
                      <span className="truncate text-slate-700 group-hover:text-primary">{client.name}</span>
                      <span className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                        <span
                          className="block h-full rounded-full bg-[#1f6fe5]"
                          style={{ width: `${(client.count / topClientMax) * 100}%` }}
                        />
                      </span>
                      <span className="text-right font-semibold text-slate-900 tabular-nums">{client.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground py-16 text-center text-sm">No active assignments{siteLabel ? " at this site" : ""}.</p>
            )}
          </Panel>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-[1.15fr_1fr_0.95fr]">
        <Panel
          id="pending-actions"
          className="scroll-mt-44 lg:col-span-2 xl:col-span-1"
          title={
            <>
              Pending Actions
              {pendingTotal > 0 && (
                <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white tabular-nums">{pendingTotal}</span>
              )}
            </>
          }
        >
          <div className="-mx-4 overflow-x-auto sm:-mx-5">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-y border-slate-100 bg-slate-50/80 text-left text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                  <th className="w-16 py-2.5 pr-3 pl-4 sm:pl-5">Type</th>
                  <th className="py-2.5">Description</th>
                  <th className="py-2.5 text-right">Count</th>
                  <th className="py-2.5 pr-4 text-right sm:pr-5">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.pendingActions.map((action) => {
                  const Icon = PENDING_ICON[action.key] ?? ClipboardList;
                  return (
                    <tr key={action.key} className="border-b border-slate-100 last:border-0">
                      <td className="py-2.5 pr-3 pl-4 sm:pl-5">
                        <span className={cn("flex size-8 items-center justify-center rounded-lg", PENDING_TONE[action.tone])}>
                          <Icon className="size-4" />
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-slate-700">{action.label}</td>
                      <td
                        className={cn(
                          "py-2.5 text-right font-bold tabular-nums",
                          action.count > 0 ? "text-red-500" : "text-slate-400",
                        )}
                      >
                        {action.count}
                      </td>
                      <td className="py-2.5 pr-4 text-right sm:pr-5">
                        <Button variant="outline" size="sm" nativeButton={false} render={<Link href={action.href} />}>
                          View
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        {showActivity && (
          <Panel
            title="Recent Activities"
            action={
              <Link href="/audit-log" className="text-primary text-sm font-semibold hover:underline">
                View All
              </Link>
            }
          >
            {activity.length === 0 ? (
              <p className="text-muted-foreground py-12 text-center text-sm">No activity recorded yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {activity.map((entry) => {
                  const style = ACTIVITY_STYLE[entry.entityType] ?? { icon: History, tile: "bg-slate-100 text-slate-600", label: entry.entityType };
                  const name = getAuditEntryLabel(entry.previousValue, entry.newValue);
                  const title = `${style.label} ${auditActionLabel(entry.action).toLowerCase()}`;
                  // Import entries carry the ImportRun's id, not a record id;
                  // archived records no longer have a page to open.
                  const href =
                    entry.action === "import"
                      ? "/import-history"
                      : entry.action !== "archive" && style.href
                        ? style.href(entry.entityId)
                        : null;
                  const body = (
                    <>
                      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", style.tile)}>
                        <style.icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-slate-900">{title}</span>
                        <span className="text-muted-foreground block truncate text-xs">
                          {[name, entry.user?.name ? `by ${entry.user.name}` : null].filter(Boolean).join(" · ") || "System"}
                        </span>
                      </span>
                      <span className="text-muted-foreground shrink-0 text-xs whitespace-nowrap">{timeAgo(entry.createdAt)}</span>
                    </>
                  );
                  return (
                    <li key={entry.id}>
                      {href ? (
                        <Link href={href} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm hover:bg-slate-50">
                          {body}
                        </Link>
                      ) : (
                        <div className="flex items-center gap-3 py-2.5 text-sm">{body}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        )}

        {quickCreate.length > 0 && (
          <Panel title="Quick Create">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {quickCreate.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex min-h-[84px] flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-1.5 py-3 text-center transition-colors hover:border-primary/40 hover:bg-blue-50/40"
                >
                  <item.icon className={cn("size-6", NAV_COLOR_CLASSES[item.color])} />
                  <span className="text-[12px] leading-tight font-medium text-slate-700">{item.shortLabel}</span>
                </Link>
              ))}
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
