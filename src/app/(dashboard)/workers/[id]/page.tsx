import { ArchiveRestore, Archive, ClipboardList, LogOut, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ConfirmActionButton } from "@/components/shared/confirm-action-button";
import { EmptyState } from "@/components/shared/empty-state";
import { KpiCard } from "@/components/shared/kpi-card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Timeline, type TimelineItem } from "@/components/shared/timeline";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { auditActionLabel, auditActionTone } from "@/lib/audit-log-format";
import { calculateRepayableBalance } from "@/server/calc";
import { can } from "@/server/rbac";
import { archiveWorker, demobilizeWorker, reactivateWorker } from "@/server/actions/workers";
import { listClientHierarchyForSelect } from "@/server/queries/clients";
import { getEntityAuditLog } from "@/server/queries/dashboard";
import { getWorker } from "@/server/queries/workers";
import {
  listWorkerAdvances,
  listWorkerLeave,
  listWorkerLoans,
  listWorkerPayments,
  listWorkerPayrollHistory,
} from "@/server/queries/worker-detail";
import { getSessionUser } from "@/server/session";

import { AssignmentFormDialog } from "../../assignments/assignment-form";
import { AdvanceDialog } from "./advance-dialog";
import { DocumentActions } from "./document-actions";
import { DocumentDialog } from "./document-dialog";
import { LeaveDecisionButtons } from "./leave-decision-buttons";
import { LeaveRequestDialog } from "./leave-request-dialog";
import { LoanDialog } from "./loan-dialog";
import { PaymentDialog } from "./payment-dialog";
import { PayrollCalculationDialog } from "./payroll-calculation-dialog";

function formatDate(date: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(date);
}

function formatMoney(value: unknown) {
  if (value === null || value === undefined) return "—";
  return `SAR ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}


export default async function WorkerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  const worker = await getWorker(user, id);
  if (!worker) notFound();

  const canEdit = can(user, "update", "worker");
  const canArchive = can(user, "archive", "worker");
  const canCreateAssignment = can(user, "create", "assignment");
  const canDemobilize = can(user, "update", "worker") && can(user, "update", "assignment");
  const canRequestLeave = can(user, "create", "leaveRequest");
  const canDecideLeave = can(user, "update", "leaveRequest");
  const canManageAdvances = can(user, "create", "advance");
  const canManageLoans = can(user, "create", "loan");
  const canManagePayments = can(user, "create", "workerPayment");
  const canViewActivity = can(user, "view", "auditLog");

  const [clients, payrollHistory, leave, advances, loans, payments, activity] = await Promise.all([
    canCreateAssignment ? listClientHierarchyForSelect() : Promise.resolve([]),
    listWorkerPayrollHistory(worker.id),
    listWorkerLeave(worker.id),
    listWorkerAdvances(worker.id),
    listWorkerLoans(worker.id),
    listWorkerPayments(worker.id),
    canViewActivity ? getEntityAuditLog("Worker", worker.id) : Promise.resolve([]),
  ]);

  const activityItems: TimelineItem[] = activity.map((entry) => ({
    id: entry.id,
    title: `${auditActionLabel(entry.action)} by ${entry.user?.name ?? "System"}`,
    timestamp: entry.createdAt,
    tone: auditActionTone(entry.action),
  }));

  const currentAssignment = worker.assignments.find((a) => a.status === "ACTIVE");
  const isDemobilizable = currentAssignment !== undefined && worker.status !== "DEMOBILIZED";

  // §11 financial summary strip — the latest payroll period's real figures,
  // not a fabricated "current month" (no live timesheet data feeds that yet).
  const latestPayroll = payrollHistory[0];
  const latestPayrollPaid = latestPayroll
    ? latestPayroll.payments.reduce((sum, p) => sum + Number(p.amount), 0)
    : 0;
  const latestPayrollOutstanding = latestPayroll ? Number(latestPayroll.netPayable) - latestPayrollPaid : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Workforce" },
          { label: "Workers", href: "/workers" },
          { label: worker.fullName },
        ]}
        title={worker.fullName}
        description={`Iqama: ${worker.iqamaNumber}`}
        actions={
          <>
            <StatusBadge status={worker.status} />
            {canEdit && (
              <Button
                variant="outline"
                render={
                  <Link href={`/workers/${worker.id}/edit`}>
                    <Pencil className="size-4" />
                    Edit
                  </Link>
                }
              />
            )}
            {canDemobilize && isDemobilizable && (
              <ConfirmActionButton
                trigger={
                  <Button variant="outline">
                    <LogOut className="size-4" />
                    Demobilize
                  </Button>
                }
                title="Demobilize this worker?"
                description="Their current assignment will be ended and their status set to Demobilized. This does not delete any history."
                confirmLabel="Demobilize"
                variant="destructive"
                action={demobilizeWorker.bind(null, worker.id)}
                successMessage="Worker demobilized."
              />
            )}
            {canArchive &&
              (worker.deletedAt ? (
                <ConfirmActionButton
                  trigger={
                    <Button variant="outline">
                      <ArchiveRestore className="size-4" />
                      Reactivate
                    </Button>
                  }
                  title="Reactivate worker?"
                  description="This worker will reappear in active lists and searches."
                  confirmLabel="Reactivate"
                  action={reactivateWorker.bind(null, worker.id)}
                  successMessage="Worker reactivated."
                />
              ) : (
                <ConfirmActionButton
                  trigger={
                    <Button variant="outline">
                      <Archive className="size-4" />
                      Archive
                    </Button>
                  }
                  title="Archive this worker?"
                  description="The worker record and history are kept, but they'll be hidden from active lists."
                  confirmLabel="Archive"
                  variant="destructive"
                  action={archiveWorker.bind(null, worker.id)}
                  successMessage="Worker archived."
                />
              ))}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Hourly Rate" value={formatMoney(worker.hourlyRate)} />
        {latestPayroll ? (
          <>
            <KpiCard label="Net Payable" value={formatMoney(latestPayroll.netPayable)} />
            <KpiCard label="Paid" value={formatMoney(latestPayrollPaid)} />
            <KpiCard
              label="Outstanding"
              value={formatMoney(latestPayrollOutstanding)}
              className={latestPayrollOutstanding > 0 ? "text-warning-foreground" : undefined}
            />
          </>
        ) : (
          <KpiCard label="Payroll" value="No payroll yet" className="col-span-3" />
        )}
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="assignments">Assignment History</TabsTrigger>
          <TabsTrigger value="payroll">Payroll</TabsTrigger>
          <TabsTrigger value="leave">Leave</TabsTrigger>
          <TabsTrigger value="advances">Advances</TabsTrigger>
          <TabsTrigger value="loans">Loans</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          {canViewActivity && <TabsTrigger value="activity">Activity</TabsTrigger>}
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Identity</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <Detail label="Mobile" value={worker.mobile} />
                <Detail label="Passport Number" value={worker.passportNumber} />
                <Detail label="Passport Expiry" value={formatDate(worker.passportExpiryDate)} />
                <Detail label="Iqama Expiry" value={formatDate(worker.iqamaExpiryDate)} />
                <Detail label="Nationality" value={worker.nationality} />
                <Detail label="Date of Birth" value={formatDate(worker.dateOfBirth)} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Employment</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <Detail label="Designation" value={worker.designation?.title} />
                <Detail label="Skill / Category" value={worker.skillCategory} />
                <Detail label="Coordinator" value={worker.coordinator?.name} />
                <Detail label="Joining Date" value={formatDate(worker.joiningDate)} />
                <Detail label="Mobilization Date" value={formatDate(worker.mobilizationDate)} />
                <Detail label="Demobilization Date" value={formatDate(worker.demobilizationDate)} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Rates</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <Detail label="Hourly Rate" value={formatMoney(worker.hourlyRate)} />
                <Detail label="Overtime Rate" value={formatMoney(worker.overtimeRate)} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Bank Details</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <Detail label="Bank Name" value={worker.bankName} />
                <Detail label="IBAN / Account" value={worker.bankAccountIban} />
              </CardContent>
            </Card>
            {worker.notes && (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Notes</CardTitle>
                </CardHeader>
                <CardContent className="text-sm whitespace-pre-wrap">{worker.notes}</CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          {canEdit && (
            <div className="flex justify-end">
              <DocumentDialog workerId={worker.id} />
            </div>
          )}
          {worker.documents.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No documents uploaded yet" />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead>Verification</TableHead>
                    {canEdit && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {worker.documents.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">
                          {doc.fileName}
                        </a>
                      </TableCell>
                      <TableCell>{doc.documentType ?? "—"}</TableCell>
                      <TableCell>{formatDate(doc.expiryDate)}</TableCell>
                      <TableCell>
                        <StatusBadge status={doc.verificationStatus} />
                      </TableCell>
                      {canEdit && (
                        <TableCell className="text-right">
                          <DocumentActions documentId={doc.id} canVerify={doc.verificationStatus === "PENDING"} />
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="assignments" className="space-y-4">
          <div className="flex justify-end">
            {canCreateAssignment && (
              <AssignmentFormDialog
                clients={clients}
                coordinators={[]}
                presetWorkerId={worker.id}
                trigger={
                  <Button>
                    <Plus className="size-4" />
                    Add Assignment
                  </Button>
                }
              />
            )}
          </div>

          {worker.assignments.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No assignments yet"
              description="Deploy this worker to a client site to start tracking their assignment history."
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead>Worker Rate</TableHead>
                    <TableHead>Client Rate</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {worker.assignments.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>{a.client.companyName}</TableCell>
                      <TableCell>{a.site.name}</TableCell>
                      <TableCell>{formatMoney(a.workerHourlyRate)}</TableCell>
                      <TableCell>{formatMoney(a.clientBillingRate)}</TableCell>
                      <TableCell>{formatDate(a.startDate)}</TableCell>
                      <TableCell>{formatDate(a.endDate)}</TableCell>
                      <TableCell>
                        <StatusBadge status={a.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {currentAssignment === undefined && worker.assignments.length > 0 && (
            <p className="text-muted-foreground text-sm">This worker has no active assignment right now.</p>
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
                    <TableHead>Regular Hrs</TableHead>
                    <TableHead>OT Hrs</TableHead>
                    <TableHead>Gross</TableHead>
                    <TableHead>Deductions</TableHead>
                    <TableHead>Net Payable</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Calculation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payrollHistory.map((p) => {
                    const overtimeItem = p.items.find((item) => item.type === "OVERTIME");
                    const regularItem = p.items.find((item) => item.type === "REGULAR_HOURS");
                    const paid = p.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
                    return (
                      <TableRow key={p.id}>
                        <TableCell>{p.payrollPeriod.name}</TableCell>
                        <TableCell>{Number(p.regularHours).toFixed(1)}</TableCell>
                        <TableCell>{Number(p.overtimeHours).toFixed(1)}</TableCell>
                        <TableCell>{formatMoney(p.grossPay)}</TableCell>
                        <TableCell>
                          {formatMoney(
                            Number(p.advanceDeduction) + Number(p.loanDeduction) + Number(p.leaveDeduction) + Number(p.otherDeductions),
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{formatMoney(p.netPayable)}</TableCell>
                        <TableCell>
                          <StatusBadge status={p.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <PayrollCalculationDialog
                            data={{
                              periodName: p.payrollPeriod.name,
                              regularHours: Number(p.regularHours),
                              regularRate: Number(p.regularRate),
                              regularPay: Number(regularItem?.amount ?? Number(p.regularHours) * Number(p.regularRate)),
                              overtimeHours: Number(p.overtimeHours),
                              overtimeRate: Number(p.overtimeRate),
                              overtimePay: Number(overtimeItem?.amount ?? Number(p.overtimeHours) * Number(p.overtimeRate)),
                              allowances: Number(p.allowances),
                              bonuses: Number(p.bonuses),
                              advanceDeduction: Number(p.advanceDeduction),
                              loanDeduction: Number(p.loanDeduction),
                              leaveDeduction: Number(p.leaveDeduction),
                              otherDeductions: Number(p.otherDeductions),
                              grossPay: Number(p.grossPay),
                              netPayable: Number(p.netPayable),
                              paid,
                              outstanding: Number(p.netPayable) - paid,
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
                  <p className="text-muted-foreground text-xs">
                    {Number(balance.usedDays)} used of {Number(balance.entitledDays)} ({balance.year})
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {canRequestLeave && (
            <div className="flex justify-end">
              <LeaveRequestDialog
                workerId={worker.id}
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
              <AdvanceDialog workerId={worker.id} />
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
                    <TableHead>Repaid</TableHead>
                    <TableHead>Remaining</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {advances.map((advance) => {
                    const repaid = advance.repayments.reduce((sum, r) => sum + Number(r.amount), 0);
                    const remaining = calculateRepayableBalance(
                      advance.amount.toString(),
                      advance.repayments.map((r) => r.amount.toString()),
                    );
                    return (
                      <TableRow key={advance.id}>
                        <TableCell>{formatDate(advance.dateGiven)}</TableCell>
                        <TableCell>{formatMoney(advance.amount)}</TableCell>
                        <TableCell>{formatMoney(repaid)}</TableCell>
                        <TableCell className="font-medium">{formatMoney(remaining.toNumber())}</TableCell>
                        <TableCell>{advance.reason ?? "—"}</TableCell>
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
              <LoanDialog workerId={worker.id} />
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
                    <TableHead>Repaid</TableHead>
                    <TableHead>Remaining</TableHead>
                    <TableHead>Installment</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loans.map((loan) => {
                    const repaid = loan.repayments.reduce((sum, r) => sum + Number(r.amount), 0);
                    const remaining = calculateRepayableBalance(
                      loan.principalAmount.toString(),
                      loan.repayments.map((r) => r.amount.toString()),
                    );
                    return (
                      <TableRow key={loan.id}>
                        <TableCell>{formatDate(loan.dateGiven)}</TableCell>
                        <TableCell>{formatMoney(loan.principalAmount)}</TableCell>
                        <TableCell>{formatMoney(repaid)}</TableCell>
                        <TableCell className="font-medium">{formatMoney(remaining.toNumber())}</TableCell>
                        <TableCell>{loan.installmentAmount ? formatMoney(loan.installmentAmount) : "—"}</TableCell>
                        <TableCell>{loan.reason ?? "—"}</TableCell>
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

        <TabsContent value="payments" className="space-y-4">
          {canManagePayments && (
            <div className="flex justify-end">
              <PaymentDialog workerId={worker.id} />
            </div>
          )}
          {payments.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No payments recorded" />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Payroll Period</TableHead>
                    <TableHead>Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>{formatDate(payment.date)}</TableCell>
                      <TableCell>{payment.paymentType}</TableCell>
                      <TableCell className="font-medium">{formatMoney(payment.amount)}</TableCell>
                      <TableCell>{payment.method.replaceAll("_", " ")}</TableCell>
                      <TableCell>{payment.workerPayroll?.payrollPeriod.name ?? "—"}</TableCell>
                      <TableCell>{payment.referenceNumber ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {canViewActivity && (
          <TabsContent value="activity">
            <Timeline items={activityItems} emptyMessage="No recorded changes for this worker yet" />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value || "—"}</dd>
    </div>
  );
}
