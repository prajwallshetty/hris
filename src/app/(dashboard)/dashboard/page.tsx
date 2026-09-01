import {
  Banknote,
  Building2,
  CircleCheck,
  Clock,
  ClipboardList,
  HandCoins,
  MapPin,
  Receipt,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { KpiCard } from "@/components/shared/kpi-card";
import { PageHeader } from "@/components/shared/page-header";
import { Timeline } from "@/components/shared/timeline";
import { ClientProfitabilityChart } from "@/components/shared/charts/client-profitability-chart";
import { WorkersByClientChart } from "@/components/shared/charts/workers-by-client-chart";
import { WorkersByStatusChart } from "@/components/shared/charts/workers-by-status-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/auth";
import { auditActionLabel, auditActionTone } from "@/lib/audit-log-format";
import { can } from "@/server/rbac";
import {
  getClientProfitabilitySummary,
  getDashboardCounts,
  getFinanceKpis,
  getRecentAuditLog,
  getWorkersByClient,
  getWorkersByStatus,
} from "@/server/queries/dashboard";
import { getNotifications } from "@/server/queries/notifications";
import { getSessionUser } from "@/server/session";

function formatMoney(value: number) {
  return `SAR ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const APPROVAL_TITLES = new Set(["Timesheet pending review", "Payroll pending approval", "Leave approval pending", "Commission payable"]);
const OVERDUE_TITLES = new Set(["Client payment overdue", "Salary due"]);

export default async function DashboardPage() {
  const [session, user] = await Promise.all([auth(), getSessionUser()]);
  const firstName = (session?.user?.name ?? session?.user?.email ?? "there").split(" ")[0];

  const showAuditLog = can(user, "view", "auditLog");
  const showFinancials = can(user, "view", "invoice") || can(user, "view", "workerPayroll");
  const showTimesheetKpi = can(user, "view", "timesheet");
  const showPayrollKpi = can(user, "view", "workerPayroll") || can(user, "view", "employeePayroll");
  const showCommissionKpi = can(user, "view", "commission");
  const showExpenseKpi = can(user, "view", "expense");

  const [counts, workersByStatus, workersByClient, profitability, financeKpis, auditLog, notifications] = await Promise.all([
    getDashboardCounts(user),
    getWorkersByStatus(user),
    getWorkersByClient(user),
    showFinancials ? getClientProfitabilitySummary(user) : Promise.resolve([]),
    showTimesheetKpi || showPayrollKpi || showCommissionKpi || showExpenseKpi ? getFinanceKpis() : Promise.resolve(null),
    showAuditLog ? getRecentAuditLog(8) : Promise.resolve([]),
    getNotifications(user),
  ]);

  const pendingApprovals = notifications.filter((n) => APPROVAL_TITLES.has(n.title));
  const overduePayments = notifications.filter((n) => OVERDUE_TITLES.has(n.title));

  const totals = profitability.reduce(
    (acc, row) => ({
      revenue: acc.revenue + row.revenue,
      workerCost: acc.workerCost + row.workerCost,
      outstanding: acc.outstanding + row.outstanding,
      profit: acc.profit + row.profit,
    }),
    { revenue: 0, workerCost: 0, outstanding: 0, profit: 0 },
  );

  return (
    <div className="space-y-6">
      <PageHeader title={`${greeting()}, ${firstName}`} description="Here's what's happening across your workforce today." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard href="/workers" label="Total Workers" value={counts.totalWorkers.toLocaleString()} icon={Users} />
        <KpiCard
          href="/workers?status=ACTIVE"
          label="Active Workers"
          value={counts.activeWorkers.toLocaleString()}
          icon={UserCheck}
        />
        <KpiCard href="/clients" label="Clients" value={counts.totalClients.toLocaleString()} icon={Building2} />
        <KpiCard href="/clients" label="Sites" value={counts.totalSites.toLocaleString()} icon={MapPin} />
        <KpiCard
          href="/assignments?status=ACTIVE"
          label="Active Assignments"
          value={counts.activeAssignments.toLocaleString()}
          icon={ClipboardList}
        />
      </div>

      {financeKpis && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {showTimesheetKpi && (
            <KpiCard href="/timesheets" label="Approved Hours" value={financeKpis.totalHours.toLocaleString(undefined, { maximumFractionDigits: 0 })} icon={Clock} />
          )}
          {showPayrollKpi && <KpiCard href="/payroll" label="Total Payroll" value={formatMoney(financeKpis.totalPayroll)} icon={Wallet} />}
          {showCommissionKpi && (
            <KpiCard href="/coordinators" label="Commission" value={formatMoney(financeKpis.totalCommission)} icon={HandCoins} />
          )}
          {showExpenseKpi && <KpiCard href="/expenses" label="Expenses" value={formatMoney(financeKpis.totalExpenses)} icon={Receipt} />}
        </div>
      )}

      {showFinancials && profitability.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard href="/invoices" label="Revenue" value={formatMoney(totals.revenue)} icon={TrendingUp} />
          <KpiCard href="/payroll" label="Worker Cost" value={formatMoney(totals.workerCost)} icon={Wallet} />
          <KpiCard href="/invoices" label="Outstanding" value={formatMoney(totals.outstanding)} icon={Banknote} />
          <KpiCard href="/clients" label="Profit" value={formatMoney(totals.profit)} icon={TrendingUp} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Workers by Status</CardTitle>
          </CardHeader>
          <CardContent>
            {workersByStatus.length === 0 ? (
              <p className="text-muted-foreground text-sm">No workers yet.</p>
            ) : (
              <WorkersByStatusChart data={workersByStatus} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Workforce by Client</CardTitle>
          </CardHeader>
          <CardContent>
            {workersByClient.length === 0 ? (
              <p className="text-muted-foreground text-sm">No active assignments yet.</p>
            ) : (
              <WorkersByClientChart data={workersByClient} />
            )}
          </CardContent>
        </Card>
      </div>

      {showFinancials && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Client Profitability</CardTitle>
          </CardHeader>
          <CardContent>
            {profitability.length === 0 ? (
              <p className="text-muted-foreground text-sm">No billed or paid activity yet.</p>
            ) : (
              <ClientProfitabilityChart data={profitability} />
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pending Approvals</CardTitle>
          </CardHeader>
          <CardContent>
            {pendingApprovals.length === 0 ? (
              <EmptyState icon={CircleCheck} title="Nothing waiting on you" description="All caught up." />
            ) : (
              <ul className="divide-y">
                {pendingApprovals.slice(0, 6).map((item) => (
                  <li key={item.id}>
                    <Link href={item.href} className="hover:bg-muted/50 -mx-2 flex items-start justify-between gap-3 rounded-md px-2 py-2.5 text-sm">
                      <span className="min-w-0">
                        <span className="block font-medium">{item.title}</span>
                        <span className="text-muted-foreground block truncate">{item.message}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Overdue Payments</CardTitle>
          </CardHeader>
          <CardContent>
            {overduePayments.length === 0 ? (
              <EmptyState icon={CircleCheck} title="No overdue payments" description="Everything is up to date." />
            ) : (
              <ul className="divide-y">
                {overduePayments.slice(0, 6).map((item) => (
                  <li key={item.id}>
                    <Link href={item.href} className="hover:bg-muted/50 -mx-2 flex items-start justify-between gap-3 rounded-md px-2 py-2.5 text-sm">
                      <span className="min-w-0">
                        <span className="text-destructive block font-medium">{item.title}</span>
                        <span className="text-muted-foreground block truncate">{item.message}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {showAuditLog && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            <Timeline
              items={auditLog.map((entry) => ({
                id: entry.id,
                title: `${auditActionLabel(entry.action)} ${entry.entityType} by ${entry.user?.name ?? "System"}`,
                timestamp: entry.createdAt,
                tone: auditActionTone(entry.action),
              }))}
              emptyMessage="No activity yet"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
