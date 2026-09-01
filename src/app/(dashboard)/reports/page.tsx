import { BarChart3 } from "lucide-react";
import { forbidden } from "next/navigation";

import { EmptyState } from "@/components/shared/empty-state";
import { KpiCard } from "@/components/shared/kpi-card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { can } from "@/server/rbac";
import {
  canViewFinanceOverview,
  getAttendanceSummaryReport,
  getCoordinatorPerformanceReport,
  getFinanceOverviewReport,
  getPayrollSummaryReport,
  getWorkforceAllocationReport,
} from "@/server/queries/reports";
import { getSessionUser } from "@/server/session";

function formatMoney(value: number) {
  return `SAR ${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export default async function ReportsPage() {
  const user = await getSessionUser();

  const showWorkforce = can(user, "view", "assignment");
  const showAttendance = can(user, "view", "timesheet");
  const showPayroll = can(user, "view", "payrollPeriod");
  const showCoordinator = can(user, "view", "sale");
  const showFinance = canViewFinanceOverview(user);

  if (!showWorkforce && !showAttendance && !showPayroll && !showCoordinator && !showFinance) forbidden();

  const [workforce, attendance, payroll, coordinator, finance] = await Promise.all([
    showWorkforce ? getWorkforceAllocationReport(user) : Promise.resolve([]),
    showAttendance ? getAttendanceSummaryReport(user) : Promise.resolve([]),
    showPayroll ? getPayrollSummaryReport(user) : Promise.resolve([]),
    showCoordinator ? getCoordinatorPerformanceReport(user) : Promise.resolve([]),
    showFinance ? getFinanceOverviewReport(user) : Promise.resolve(null),
  ]);

  const defaultTab = showWorkforce ? "workforce" : showAttendance ? "attendance" : showPayroll ? "payroll" : showCoordinator ? "coordinator" : "finance";

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Reports" }]}
        title="Reports"
        description="Aggregated, DB-backed rollups across workforce, attendance, payroll, coordinators, and finance."
      />

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          {showWorkforce && <TabsTrigger value="workforce">Workforce</TabsTrigger>}
          {showAttendance && <TabsTrigger value="attendance">Attendance</TabsTrigger>}
          {showPayroll && <TabsTrigger value="payroll">Payroll</TabsTrigger>}
          {showCoordinator && <TabsTrigger value="coordinator">Coordinators</TabsTrigger>}
          {showFinance && <TabsTrigger value="finance">Finance</TabsTrigger>}
        </TabsList>

        {showWorkforce && (
          <TabsContent value="workforce">
            {workforce.length === 0 ? (
              <EmptyState icon={BarChart3} title="No active assignments yet" />
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Site</TableHead>
                      <TableHead>Active Workers</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {workforce.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell>{row.client}</TableCell>
                        <TableCell>{row.site}</TableCell>
                        <TableCell className="font-medium">{row.activeWorkers}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        )}

        {showAttendance && (
          <TabsContent value="attendance">
            {attendance.length === 0 ? (
              <EmptyState icon={BarChart3} title="No approved timesheet hours yet" />
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead>Site</TableHead>
                      <TableHead>Workers</TableHead>
                      <TableHead>Regular Hrs</TableHead>
                      <TableHead>OT Hrs</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendance.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell>{row.period}</TableCell>
                        <TableCell>{row.site}</TableCell>
                        <TableCell>{row.workers}</TableCell>
                        <TableCell>{row.regularHours}</TableCell>
                        <TableCell>{row.overtimeHours}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        )}

        {showPayroll && (
          <TabsContent value="payroll">
            {payroll.length === 0 ? (
              <EmptyState icon={BarChart3} title="No payroll periods yet" />
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead>Workers</TableHead>
                      <TableHead>Employees</TableHead>
                      <TableHead>Net Payable</TableHead>
                      <TableHead>Paid</TableHead>
                      <TableHead>Outstanding</TableHead>
                      <TableHead>Advances</TableHead>
                      <TableHead>Loans</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payroll.map((row) => (
                      <TableRow key={row.periodId}>
                        <TableCell className="font-medium">{row.periodName}</TableCell>
                        <TableCell>{row.workerCount}</TableCell>
                        <TableCell>{row.employeeCount}</TableCell>
                        <TableCell>{formatMoney(row.netPayable)}</TableCell>
                        <TableCell>{formatMoney(row.paid)}</TableCell>
                        <TableCell>{formatMoney(row.outstanding)}</TableCell>
                        <TableCell>{formatMoney(row.advanceDeductions)}</TableCell>
                        <TableCell>{formatMoney(row.loanDeductions)}</TableCell>
                        <TableCell>
                          <StatusBadge status={row.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        )}

        {showCoordinator && (
          <TabsContent value="coordinator">
            {coordinator.length === 0 ? (
              <EmptyState icon={BarChart3} title="No sales or commission activity yet" />
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Coordinator</TableHead>
                      <TableHead>Total Sales</TableHead>
                      <TableHead>Commission Generated</TableHead>
                      <TableHead>Commission Paid</TableHead>
                      <TableHead>Commission Outstanding</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {coordinator.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{row.coordinator}</TableCell>
                        <TableCell>{formatMoney(row.totalSales)}</TableCell>
                        <TableCell>{formatMoney(row.commissionGenerated)}</TableCell>
                        <TableCell>{formatMoney(row.commissionPaid)}</TableCell>
                        <TableCell>{formatMoney(row.commissionOutstanding)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        )}

        {showFinance && finance && (
          <TabsContent value="finance">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <KpiCard label="Revenue" value={formatMoney(finance.revenue)} />
              <KpiCard label="Worker Cost" value={formatMoney(finance.workerCost)} />
              <KpiCard label="Expenses" value={formatMoney(finance.expenses)} />
              <KpiCard label="Commission" value={formatMoney(finance.commission)} />
              <KpiCard label="Receivables (from clients)" value={formatMoney(finance.receivables)} />
              <KpiCard label="Payables (to workers/employees)" value={formatMoney(finance.payables)} />
              <KpiCard label="Advances Outstanding" value={formatMoney(finance.advancesOutstanding)} />
              <KpiCard label="Loans Outstanding" value={formatMoney(finance.loansOutstanding)} />
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
