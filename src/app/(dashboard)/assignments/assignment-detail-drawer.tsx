"use client";

import {
  Building2,
  Calendar,
  Clock,
  Coins,
  FileText,
  History,
  User,
  MapPin,
  TrendingUp,
  Briefcase,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

import { ConfirmActionButton } from "@/components/shared/confirm-action-button";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { endAssignment } from "@/server/actions/assignments";

type AssignmentDetailData = {
  assignment: {
    id: string;
    workerId: string;
    clientId: string;
    projectId: string;
    siteId: string;
    designation: string | null;
    workerHourlyRate: unknown;
    clientBillingRate: unknown;
    startDate: Date;
    endDate: Date | null;
    status: "ACTIVE" | "ENDED";
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    worker: {
      id: string;
      fullName: string;
      iqamaNumber: string;
      sequenceNo: number;
      status: string;
      designation: { title: string } | null;
    };
    client: {
      id: string;
      companyName: string;
    };
    project: {
      id: string;
      name: string;
    };
    site: {
      id: string;
      name: string;
      location: string | null;
    };
    coordinator: {
      id: string;
      name: string;
    } | null;
    createdBy: {
      id: string;
      name: string;
      email: string;
    } | null;
  };
  workerAssignments: Array<{
    id: string;
    startDate: Date;
    endDate: Date | null;
    status: "ACTIVE" | "ENDED";
    workerHourlyRate: unknown;
    clientBillingRate: unknown;
    client: { companyName: string };
    project: { name: string };
    site: { name: string };
    coordinator: { name: string } | null;
  }>;
  timesheetItems: Array<{
    id: string;
    date: Date;
    regularHours: unknown;
    overtimeHours: unknown;
    totalHours: unknown;
    status: string;
    timesheet: { site: { name: string } | null };
  }>;
  payrollRows: Array<{
    id: string;
    regularHours: unknown;
    overtimeHours: unknown;
    grossPay: unknown;
    netPayable: unknown;
    status: string;
    payrollPeriod: { name: string; periodStart: Date; periodEnd: Date };
  }>;
  auditLogs: Array<{
    id: string;
    action: string;
    createdAt: Date;
    user: { name: string; email: string } | null;
  }>;
};

function formatDate(date: Date | string | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(date));
}

function formatMoney(value: unknown) {
  const num = Number(value || 0);
  return `SAR ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function calculateTenure(startDate: Date, endDate: Date | null) {
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 30) {
    return `${diffDays} days`;
  }
  const months = Math.floor(diffDays / 30);
  const remainingDays = diffDays % 30;
  return `${months} mos${remainingDays > 0 ? `, ${remainingDays} days` : ""}`;
}

export function AssignmentDetailDrawer({
  data,
  open,
  onOpenChange,
  canEnd,
}: {
  data: AssignmentDetailData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEnd: boolean;
}) {
  if (!data) return null;

  const { assignment, workerAssignments, timesheetItems, payrollRows, auditLogs } = data;
  const workerRate = Number(assignment.workerHourlyRate);
  const clientRate = Number(assignment.clientBillingRate);
  const marginSar = clientRate - workerRate;
  const marginPct = workerRate > 0 ? (marginSar / workerRate) * 100 : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0 flex flex-col">
        {/* Top Header Banner */}
        <SheetHeader className="p-6 border-b bg-muted/20 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground border">
                  #{assignment.id.slice(-6).toUpperCase()}
                </span>
                <StatusBadge status={assignment.status} />
              </div>
              <SheetTitle className="text-xl font-semibold">
                {assignment.worker.fullName}
              </SheetTitle>
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <span>Iqama: {assignment.worker.iqamaNumber}</span>
                <span>•</span>
                <span>Designation: {assignment.worker.designation?.title ?? "General Worker"}</span>
              </p>
            </div>

            {canEnd && assignment.status === "ACTIVE" && (
              <ConfirmActionButton
                trigger={
                  <Button variant="outline" size="sm" className="shrink-0 text-destructive hover:bg-destructive/10">
                    End Assignment
                  </Button>
                }
                title="End this assignment?"
                description={`${assignment.worker.fullName} will be marked as ended at ${assignment.site.name}.`}
                confirmLabel="End Assignment"
                variant="destructive"
                action={endAssignment.bind(null, assignment.id, undefined)}
                successMessage="Assignment ended successfully."
              />
            )}
          </div>

          {/* Quick Summary Cards Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-2.5 rounded-lg border bg-background space-y-1">
              <p className="text-muted-foreground font-medium flex items-center gap-1.5">
                <Building2 className="size-3.5 text-primary" /> Client & Site
              </p>
              <p className="font-semibold text-foreground truncate">{assignment.client.companyName}</p>
              <p className="text-muted-foreground truncate">{assignment.site.name}</p>
            </div>
            <div className="p-2.5 rounded-lg border bg-background space-y-1">
              <p className="text-muted-foreground font-medium flex items-center gap-1.5">
                <Coins className="size-3.5 text-success" /> Hourly Margin
              </p>
              <p className="font-semibold text-foreground tabular-nums">
                +{formatMoney(marginSar)}/hr
              </p>
              <p className="text-success font-medium tabular-nums">+{marginPct.toFixed(1)}% markup</p>
            </div>
            <div className="p-2.5 rounded-lg border bg-background space-y-1 col-span-2 sm:col-span-1">
              <p className="text-muted-foreground font-medium flex items-center gap-1.5">
                <Calendar className="size-3.5 text-info" /> Deployment Duration
              </p>
              <p className="font-semibold text-foreground">{calculateTenure(assignment.startDate, assignment.endDate)}</p>
              <p className="text-muted-foreground truncate">
                Since {formatDate(assignment.startDate)}
              </p>
            </div>
          </div>
        </SheetHeader>

        {/* Drawer Body Tabs */}
        <div className="p-6 flex-1">
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="w-full justify-start border-b rounded-none bg-transparent p-0 h-auto gap-4">
              <TabsTrigger
                value="overview"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 pb-2 pt-1 font-medium text-xs"
              >
                Overview
              </TabsTrigger>
              <TabsTrigger
                value="history"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 pb-2 pt-1 font-medium text-xs"
              >
                Assignment History ({workerAssignments.length})
              </TabsTrigger>
              <TabsTrigger
                value="timesheets"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 pb-2 pt-1 font-medium text-xs"
              >
                Timesheets ({timesheetItems.length})
              </TabsTrigger>
              <TabsTrigger
                value="payroll"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 pb-2 pt-1 font-medium text-xs"
              >
                Payroll ({payrollRows.length})
              </TabsTrigger>
              <TabsTrigger
                value="audit"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 pb-2 pt-1 font-medium text-xs"
              >
                Audit Log ({auditLogs.length})
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: OVERVIEW */}
            <TabsContent value="overview" className="space-y-6 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <User className="size-3.5 text-primary" /> Worker Information
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between border-b pb-1.5">
                      <span className="text-muted-foreground">Full Name</span>
                      <Link href={`/workers/${assignment.workerId}`} className="font-medium text-primary hover:underline flex items-center gap-1">
                        {assignment.worker.fullName} <ExternalLink className="size-3" />
                      </Link>
                    </div>
                    <div className="flex justify-between border-b pb-1.5">
                      <span className="text-muted-foreground">Iqama Number</span>
                      <span className="font-mono font-medium">{assignment.worker.iqamaNumber}</span>
                    </div>
                    <div className="flex justify-between border-b pb-1.5">
                      <span className="text-muted-foreground">Designation</span>
                      <span className="font-medium">{assignment.designation || assignment.worker.designation?.title || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Worker Status</span>
                      <StatusBadge status={assignment.worker.status} />
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl border space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="size-3.5 text-primary" /> Deployment Location
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between border-b pb-1.5">
                      <span className="text-muted-foreground">Client Company</span>
                      <Link href={`/clients/${assignment.clientId}`} className="font-medium text-primary hover:underline flex items-center gap-1">
                        {assignment.client.companyName} <ExternalLink className="size-3" />
                      </Link>
                    </div>
                    <div className="flex justify-between border-b pb-1.5">
                      <span className="text-muted-foreground">Project</span>
                      <span className="font-medium">{assignment.project.name}</span>
                    </div>
                    <div className="flex justify-between border-b pb-1.5">
                      <span className="text-muted-foreground">Site</span>
                      <span className="font-medium">{assignment.site.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Site Location</span>
                      <span className="font-medium">{assignment.site.location || "—"}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl border space-y-3 sm:col-span-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Coins className="size-3.5 text-success" /> Commercial Rates & Profit Margin
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-muted/30 rounded-lg border text-xs">
                    <div>
                      <p className="text-muted-foreground">Worker Hourly Pay</p>
                      <p className="text-base font-bold tabular-nums text-foreground">{formatMoney(workerRate)}/hr</p>
                      <p className="text-[11px] text-muted-foreground">Cost to company</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Client Billing Rate</p>
                      <p className="text-base font-bold tabular-nums text-primary">{formatMoney(clientRate)}/hr</p>
                      <p className="text-[11px] text-muted-foreground">Invoiced to client</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Net Margin</p>
                      <p className="text-base font-bold tabular-nums text-success">+{formatMoney(marginSar)}/hr</p>
                      <p className="text-[11px] text-success font-medium">+{marginPct.toFixed(1)}% markup ratio</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl border space-y-3 sm:col-span-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Briefcase className="size-3.5 text-primary" /> Assignment Details
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
                    <div className="flex justify-between border-b pb-1.5">
                      <span className="text-muted-foreground">Coordinator</span>
                      <span className="font-medium">{assignment.coordinator?.name || "Unassigned"}</span>
                    </div>
                    <div className="flex justify-between border-b pb-1.5">
                      <span className="text-muted-foreground">Start Date</span>
                      <span className="font-medium">{formatDate(assignment.startDate)}</span>
                    </div>
                    <div className="flex justify-between border-b pb-1.5">
                      <span className="text-muted-foreground">End Date</span>
                      <span className="font-medium">{formatDate(assignment.endDate)}</span>
                    </div>
                    <div className="flex justify-between border-b pb-1.5">
                      <span className="text-muted-foreground">Total Duration</span>
                      <span className="font-medium">{calculateTenure(assignment.startDate, assignment.endDate)}</span>
                    </div>
                    <div className="flex justify-between border-b pb-1.5 sm:col-span-2">
                      <span className="text-muted-foreground">Created By</span>
                      <span className="font-medium">
                        {assignment.createdBy?.name || "System"} ({formatDate(assignment.createdAt)})
                      </span>
                    </div>
                    {assignment.notes && (
                      <div className="sm:col-span-2 pt-1">
                        <span className="text-muted-foreground block mb-1">Notes</span>
                        <p className="p-2.5 rounded-lg bg-muted/40 text-xs italic text-foreground">{assignment.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: ASSIGNMENT HISTORY */}
            <TabsContent value="history" className="pt-2">
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Client / Site</TableHead>
                      <TableHead className="text-xs">Start Date</TableHead>
                      <TableHead className="text-xs">End Date</TableHead>
                      <TableHead className="text-xs">Worker Rate</TableHead>
                      <TableHead className="text-xs">Client Rate</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {workerAssignments.map((h) => (
                      <TableRow key={h.id} className={h.id === assignment.id ? "bg-muted/40 font-medium" : ""}>
                        <TableCell className="text-xs">
                          <div>
                            <p className="font-medium">{h.client.companyName}</p>
                            <p className="text-[11px] text-muted-foreground">{h.site.name}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">{formatDate(h.startDate)}</TableCell>
                        <TableCell className="text-xs">{formatDate(h.endDate)}</TableCell>
                        <TableCell className="text-xs tabular-nums">{formatMoney(h.workerHourlyRate)}</TableCell>
                        <TableCell className="text-xs tabular-nums">{formatMoney(h.clientBillingRate)}</TableCell>
                        <TableCell className="text-xs">
                          <StatusBadge status={h.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* TAB 3: TIMESHEETS */}
            <TabsContent value="timesheets" className="pt-2">
              {timesheetItems.length === 0 ? (
                <div className="p-8 text-center border rounded-lg space-y-2">
                  <Clock className="size-8 text-muted-foreground mx-auto" />
                  <p className="text-xs text-muted-foreground">No timesheet records found for this worker during assignment period.</p>
                </div>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Date</TableHead>
                        <TableHead className="text-xs">Site</TableHead>
                        <TableHead className="text-xs text-right">Regular Hrs</TableHead>
                        <TableHead className="text-xs text-right">Overtime Hrs</TableHead>
                        <TableHead className="text-xs text-right">Total Hrs</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {timesheetItems.map((ts) => (
                        <TableRow key={ts.id}>
                          <TableCell className="text-xs font-medium">{formatDate(ts.date)}</TableCell>
                          <TableCell className="text-xs">{ts.timesheet.site?.name || assignment.site.name}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{Number(ts.regularHours).toFixed(1)}h</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{Number(ts.overtimeHours).toFixed(1)}h</TableCell>
                          <TableCell className="text-xs text-right tabular-nums font-semibold">{Number(ts.totalHours).toFixed(1)}h</TableCell>
                          <TableCell className="text-xs">
                            <StatusBadge status={ts.status} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            {/* TAB 4: PAYROLL */}
            <TabsContent value="payroll" className="pt-2">
              {payrollRows.length === 0 ? (
                <div className="p-8 text-center border rounded-lg space-y-2">
                  <Coins className="size-8 text-muted-foreground mx-auto" />
                  <p className="text-xs text-muted-foreground">No payroll records logged yet for this worker.</p>
                </div>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Period</TableHead>
                        <TableHead className="text-xs text-right">Reg. Hours</TableHead>
                        <TableHead className="text-xs text-right">OT Hours</TableHead>
                        <TableHead className="text-xs text-right">Gross Pay</TableHead>
                        <TableHead className="text-xs text-right">Net Payable</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payrollRows.map((pr) => (
                        <TableRow key={pr.id}>
                          <TableCell className="text-xs font-medium">{pr.payrollPeriod.name}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{Number(pr.regularHours).toFixed(1)}h</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{Number(pr.overtimeHours).toFixed(1)}h</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{formatMoney(pr.grossPay)}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums font-bold text-success">{formatMoney(pr.netPayable)}</TableCell>
                          <TableCell className="text-xs">
                            <StatusBadge status={pr.status} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            {/* TAB 5: AUDIT LOG */}
            <TabsContent value="audit" className="pt-2">
              {auditLogs.length === 0 ? (
                <div className="p-8 text-center border rounded-lg space-y-2">
                  <ShieldCheck className="size-8 text-muted-foreground mx-auto" />
                  <p className="text-xs text-muted-foreground">No audit logs recorded for this assignment.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="p-3 rounded-lg border bg-card space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground uppercase tracking-wide">
                          {log.action.replace("_", " ")}
                        </span>
                        <span className="text-muted-foreground">{formatDate(log.createdAt)}</span>
                      </div>
                      <p className="text-muted-foreground">
                        Performed by: <span className="font-medium text-foreground">{log.user?.name || "System Admin"}</span>
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
