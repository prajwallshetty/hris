import { Archive, ArchiveRestore, ClipboardList, Pencil } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ConfirmActionButton } from "@/components/shared/confirm-action-button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { calculateRepayableBalance } from "@/server/calc";
import { can } from "@/server/rbac";
import { archiveEmployee, reactivateEmployee } from "@/server/actions/employees";
import { getEmployee } from "@/server/queries/employees";
import {
  listEmployeeAdvances,
  listEmployeeAttendance,
  listEmployeeLeave,
  listEmployeeLoans,
  listEmployeePayrollHistory,
} from "@/server/queries/employees";
import { getSessionUser } from "@/server/session";

import { AdvanceDialog } from "../../workers/[id]/advance-dialog";
import { LeaveDecisionButtons } from "../../workers/[id]/leave-decision-buttons";
import { LeaveRequestDialog } from "../../workers/[id]/leave-request-dialog";
import { LoanDialog } from "../../workers/[id]/loan-dialog";
import { AttendanceDialog } from "./attendance-dialog";

function formatDate(date: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(date);
}

function formatTime(date: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatMoney(value: unknown) {
  if (value === null || value === undefined) return "—";
  return `SAR ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  const employee = await getEmployee(user, id);
  if (!employee) notFound();

  const canEdit = can(user, "update", "employee");
  const canArchive = can(user, "archive", "employee");
  const canRecordAttendance = can(user, "update", "attendance");
  const canRequestLeave = can(user, "create", "leaveRequest");
  const canDecideLeave = can(user, "update", "leaveRequest");
  const canManageAdvances = can(user, "create", "advance");
  const canManageLoans = can(user, "create", "loan");

  const [attendance, leave, advances, loans, payrollHistory] = await Promise.all([
    listEmployeeAttendance(employee.id),
    listEmployeeLeave(employee.id),
    listEmployeeAdvances(employee.id),
    listEmployeeLoans(employee.id),
    listEmployeePayrollHistory(employee.id),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={employee.fullName}
        description={employee.designation?.title ?? undefined}
        actions={
          <>
            <StatusBadge status={employee.status} />
            {canEdit && (
              <Button
                variant="outline"
                render={
                  <Link href={`/employees/${employee.id}/edit`}>
                    <Pencil className="size-4" />
                    Edit
                  </Link>
                }
              />
            )}
            {canArchive &&
              (employee.deletedAt ? (
                <ConfirmActionButton
                  trigger={
                    <Button variant="outline">
                      <ArchiveRestore className="size-4" />
                      Reactivate
                    </Button>
                  }
                  title="Reactivate employee?"
                  description="This employee will reappear in active lists."
                  confirmLabel="Reactivate"
                  action={reactivateEmployee.bind(null, employee.id)}
                  successMessage="Employee reactivated."
                />
              ) : (
                <ConfirmActionButton
                  trigger={
                    <Button variant="outline">
                      <Archive className="size-4" />
                      Archive
                    </Button>
                  }
                  title="Archive this employee?"
                  description="The employee record and history are kept, but they'll be hidden from active lists."
                  confirmLabel="Archive"
                  variant="destructive"
                  action={archiveEmployee.bind(null, employee.id)}
                  successMessage="Employee archived."
                />
              ))}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryStat label="Base Salary" value={formatMoney(employee.baseSalary)} />
        <SummaryStat label="Department" value={employee.department?.name ?? "—"} />
        <SummaryStat label="Coordinator" value={employee.coordinator?.name ?? "—"} />
        <SummaryStat label="Joined" value={formatDate(employee.joiningDate)} />
      </div>

      <Tabs defaultValue="attendance">
        <TabsList>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="leave">Leave</TabsTrigger>
          <TabsTrigger value="advances">Advances</TabsTrigger>
          <TabsTrigger value="loans">Loans</TabsTrigger>
          <TabsTrigger value="payroll">Payroll</TabsTrigger>
        </TabsList>

        <TabsContent value="attendance" className="space-y-4">
          {canRecordAttendance && (
            <div className="flex justify-end">
              <AttendanceDialog employeeId={employee.id} />
            </div>
          )}
          {attendance.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No attendance recorded yet" />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Check In</TableHead>
                    <TableHead>Check Out</TableHead>
                    <TableHead>Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendance.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>{formatDate(a.date)}</TableCell>
                      <TableCell>
                        <StatusBadge status={a.status} />
                      </TableCell>
                      <TableCell>{formatTime(a.checkIn)}</TableCell>
                      <TableCell>{formatTime(a.checkOut)}</TableCell>
                      <TableCell>{a.remarks ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="leave" className="space-y-4">
          <div className="flex flex-wrap gap-4">
            {leave.balances.map((balance) => (
              <Card key={balance.id} className="min-w-40">
                <CardContent className="pt-6">
                  <p className="text-muted-foreground text-xs">{balance.leaveType.name}</p>
                  <p className="text-lg font-semibold">
                    {(Number(balance.entitledDays) - Number(balance.usedDays)).toFixed(1)}{" "}
                    <span className="text-muted-foreground text-sm font-normal">remaining</span>
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
          {canRequestLeave && (
            <div className="flex justify-end">
              <LeaveRequestDialog
                employeeId={employee.id}
                leaveTypes={leave.leaveTypes.map((type) => ({ id: type.id, name: type.name }))}
              />
            </div>
          )}
          {leave.requests.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No leave requests yet" />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Status</TableHead>
                    {canDecideLeave && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leave.requests.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.leaveType.name}</TableCell>
                      <TableCell>{formatDate(r.startDate)}</TableCell>
                      <TableCell>{formatDate(r.endDate)}</TableCell>
                      <TableCell>{Number(r.days)}</TableCell>
                      <TableCell>
                        <StatusBadge status={r.status} />
                      </TableCell>
                      {canDecideLeave && (
                        <TableCell className="text-right">
                          {r.status === "PENDING" && <LeaveDecisionButtons requestId={r.id} />}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="advances" className="space-y-4">
          {canManageAdvances && (
            <div className="flex justify-end">
              <AdvanceDialog employeeId={employee.id} />
            </div>
          )}
          {advances.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No advances given" />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Remaining</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {advances.map((advance) => {
                    const remaining = calculateRepayableBalance(
                      advance.amount.toString(),
                      advance.repayments.map((r) => r.amount.toString()),
                    );
                    return (
                      <TableRow key={advance.id}>
                        <TableCell>{formatDate(advance.dateGiven)}</TableCell>
                        <TableCell>{formatMoney(advance.amount)}</TableCell>
                        <TableCell className="font-medium">{formatMoney(remaining.toNumber())}</TableCell>
                        <TableCell>
                          <StatusBadge status={advance.status} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="loans" className="space-y-4">
          {canManageLoans && (
            <div className="flex justify-end">
              <LoanDialog employeeId={employee.id} />
            </div>
          )}
          {loans.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No loans given" />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Principal</TableHead>
                    <TableHead>Remaining</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loans.map((loan) => {
                    const remaining = calculateRepayableBalance(
                      loan.principalAmount.toString(),
                      loan.repayments.map((r) => r.amount.toString()),
                    );
                    return (
                      <TableRow key={loan.id}>
                        <TableCell>{formatDate(loan.dateGiven)}</TableCell>
                        <TableCell>{formatMoney(loan.principalAmount)}</TableCell>
                        <TableCell className="font-medium">{formatMoney(remaining.toNumber())}</TableCell>
                        <TableCell>
                          <StatusBadge status={loan.status} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="payroll" className="space-y-4">
          {payrollHistory.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No payroll history yet" />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Base Salary</TableHead>
                    <TableHead>Deductions</TableHead>
                    <TableHead>Net Payable</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payrollHistory.map((p) => {
                    const paid = p.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
                    return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Link href={`/payroll/employee/${p.id}`} className="font-medium hover:underline">
                          {p.payrollPeriod.name}
                        </Link>
                      </TableCell>
                      <TableCell>{formatMoney(p.baseSalary)}</TableCell>
                      <TableCell>
                        {formatMoney(
                          Number(p.advanceDeduction) + Number(p.loanDeduction) + Number(p.leaveDeduction) + Number(p.otherDeductions),
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{formatMoney(p.netPayable)}</TableCell>
                      <TableCell>{formatMoney(paid)}</TableCell>
                      <TableCell>
                        <StatusBadge status={p.status} />
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="px-4 py-3">
        <p className="text-muted-foreground text-xs font-medium">{label}</p>
        <p className="mt-1 truncate text-lg font-medium tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
