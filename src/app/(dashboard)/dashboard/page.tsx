import {
  Banknote,
  Building2,
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
import { PageHeader } from "@/components/shared/page-header";
import { ClientProfitabilityChart } from "@/components/shared/charts/client-profitability-chart";
import { WorkersByClientChart } from "@/components/shared/charts/workers-by-client-chart";
import { WorkersByStatusChart } from "@/components/shared/charts/workers-by-status-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { can } from "@/server/rbac";
import {
  getClientProfitabilitySummary,
  getDashboardCounts,
  getFinanceKpis,
  getRecentAuditLog,
  getWorkersByClient,
  getWorkersByStatus,
} from "@/server/queries/dashboard";
import { getSessionUser } from "@/server/session";

function formatMoney(value: number) {
  return `SAR ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function KpiCard({
  href,
  label,
  value,
  icon: Icon,
}: {
  href: string;
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link href={href} className="group">
      <Card className="group-hover:border-primary/40 group-hover:shadow-sm py-4 transition-all">
        <CardContent className="flex items-center justify-between gap-3 px-4">
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs font-medium">{label}</p>
            <p className="mt-1 truncate text-xl font-semibold tabular-nums">{value}</p>
          </div>
          <div className="bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors">
            <Icon className="size-4.5" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default async function DashboardPage() {
  const user = await getSessionUser();
  const showAuditLog = can(user, "view", "auditLog");
  const showFinancials = can(user, "view", "invoice") || can(user, "view", "workerPayroll");
  const showTimesheetKpi = can(user, "view", "timesheet");
  const showPayrollKpi = can(user, "view", "workerPayroll") || can(user, "view", "employeePayroll");
  const showCommissionKpi = can(user, "view", "commission");
  const showExpenseKpi = can(user, "view", "expense");

  const [counts, workersByStatus, workersByClient, profitability, financeKpis, auditLog] = await Promise.all([
    getDashboardCounts(user),
    getWorkersByStatus(user),
    getWorkersByClient(user),
    showFinancials ? getClientProfitabilitySummary(user) : Promise.resolve([]),
    showTimesheetKpi || showPayrollKpi || showCommissionKpi || showExpenseKpi ? getFinanceKpis() : Promise.resolve(null),
    showAuditLog ? getRecentAuditLog(8) : Promise.resolve([]),
  ]);

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
      <PageHeader title="Dashboard" description="Live snapshot of workforce, deployment, and financial health." />

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

      {showAuditLog && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            {auditLog.length === 0 ? (
              <EmptyState icon={ClipboardList} title="No activity yet" />
            ) : (
              <ul className="divide-y">
                {auditLog.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between py-2.5 text-sm">
                    <span>
                      <span className="font-medium">{entry.user?.name ?? "System"}</span>{" "}
                      <span className="text-muted-foreground">
                        {entry.action.replaceAll("_", " ")}d {entry.entityType.toLowerCase()}
                      </span>
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(
                        entry.createdAt,
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
