import { Car, Receipt, Wrench } from "lucide-react";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/shared/empty-state";
import { KpiCard } from "@/components/shared/kpi-card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Timeline, type TimelineItem } from "@/components/shared/timeline";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { formatVehicleCode } from "@/lib/codes";
import { auditActionLabel, auditActionTone } from "@/lib/audit-log-format";
import { can } from "@/server/rbac";
import { listClientHierarchyForSelect } from "@/server/queries/clients";
import { getEntityAuditLog } from "@/server/queries/dashboard";
import { getVehicle, getVehicleExpenseTotal } from "@/server/queries/vehicles";
import { listCoordinators, listWorkersForSelect } from "@/server/queries/workers";
import { getSessionUser } from "@/server/session";

import { AssignVehicleDialog } from "./assign-vehicle-dialog";
import { MaintenanceStatusButton } from "./maintenance-status-button";
import { ReturnVehicleDialog } from "./return-vehicle-dialog";
import { VehicleExpenseDialog } from "./vehicle-expense-dialog";
import { VehicleMaintenanceDialog } from "./vehicle-maintenance-dialog";

function formatDate(date: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(date);
}

function formatMoney(value: unknown) {
  return `SAR ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  const vehicle = await getVehicle(user, id);
  if (!vehicle) notFound();

  const canAssign = can(user, "create", "vehicleAssignment");
  const canReturn = can(user, "update", "vehicleAssignment");
  const canRecordExpense = can(user, "create", "vehicleExpense");
  const canRecordMaintenance = can(user, "create", "vehicleMaintenance");
  const canUpdateMaintenance = can(user, "update", "vehicleMaintenance");
  const canViewActivity = can(user, "view", "auditLog");

  const [workers, clients, coordinators, expenseTotal, activity] = await Promise.all([
    canAssign ? listWorkersForSelect(user) : Promise.resolve([]),
    canAssign ? listClientHierarchyForSelect() : Promise.resolve([]),
    canAssign ? listCoordinators() : Promise.resolve([]),
    getVehicleExpenseTotal(vehicle.id),
    canViewActivity ? getEntityAuditLog("Vehicle", vehicle.id) : Promise.resolve([]),
  ]);

  const activeAssignment = vehicle.assignments.find((a) => a.status === "ACTIVE");

  const activityItems: TimelineItem[] = activity.map((entry) => ({
    id: entry.id,
    title: `${auditActionLabel(entry.action)} by ${entry.user?.name ?? "System"}`,
    timestamp: entry.createdAt,
    tone: auditActionTone(entry.action),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Operations" },
          { label: "Vehicles", href: "/vehicles" },
          { label: vehicle.plateNumber },
        ]}
        title={vehicle.plateNumber}
        description={`${formatVehicleCode(vehicle.sequenceNo)} · ${vehicle.make} ${vehicle.model}${vehicle.year ? ` (${vehicle.year})` : ""}`}
        actions={<StatusBadge status={vehicle.status} />}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Status" value={vehicle.status.replaceAll("_", " ")} />
        <KpiCard label="Current Mileage" value={vehicle.currentMileage ? `${Number(vehicle.currentMileage).toLocaleString()} km` : "—"} />
        <KpiCard label="Current Driver" value={activeAssignment?.worker.fullName ?? "Unassigned"} />
        <KpiCard label="Total Expenses" value={formatMoney(expenseTotal)} />
      </div>

      <Tabs defaultValue="assignments">
        <TabsList>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          {canViewActivity && <TabsTrigger value="activity">Activity</TabsTrigger>}
        </TabsList>

        <TabsContent value="assignments" className="space-y-4">
          {canAssign && vehicle.status === "AVAILABLE" && (
            <div className="flex justify-end">
              <AssignVehicleDialog
                vehicleId={vehicle.id}
                workers={workers}
                clients={clients}
                coordinators={coordinators}
                trigger={<Button>Assign Vehicle</Button>}
              />
            </div>
          )}
          {vehicle.assignments.length === 0 ? (
            <EmptyState icon={Car} title="No assignments yet" description="This vehicle has never been assigned to a worker." />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Worker</TableHead>
                    <TableHead>Client / Site</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>Return</TableHead>
                    <TableHead>Mileage</TableHead>
                    <TableHead>Status</TableHead>
                    {canReturn && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehicle.assignments.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.worker.fullName}</TableCell>
                      <TableCell>
                        {a.client?.companyName ?? "—"} {a.site?.name ? `/ ${a.site.name}` : ""}
                      </TableCell>
                      <TableCell>{formatDate(a.startDate)}</TableCell>
                      <TableCell>{formatDate(a.returnedAt ?? a.expectedReturnDate)}</TableCell>
                      <TableCell>
                        {a.startingMileage != null ? Number(a.startingMileage).toLocaleString() : "—"}
                        {a.endingMileage != null ? ` → ${Number(a.endingMileage).toLocaleString()}` : ""} km
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={a.status} />
                      </TableCell>
                      {canReturn && (
                        <TableCell className="text-right">
                          {a.status === "ACTIVE" && (
                            <ReturnVehicleDialog
                              assignmentId={a.id}
                              workerName={a.worker.fullName}
                              trigger={
                                <Button variant="outline" size="sm">
                                  Return
                                </Button>
                              }
                            />
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="expenses" className="space-y-4">
          {canRecordExpense && (
            <div className="flex justify-end">
              <VehicleExpenseDialog vehicleId={vehicle.id} />
            </div>
          )}
          {vehicle.expenses.length === 0 ? (
            <EmptyState icon={Receipt} title="No expenses recorded yet" />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehicle.expenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell>{formatDate(expense.date)}</TableCell>
                      <TableCell>
                        <StatusBadge status={expense.category} />
                      </TableCell>
                      <TableCell>{expense.description ?? "—"}</TableCell>
                      <TableCell className="font-medium">{formatMoney(expense.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="maintenance" className="space-y-4">
          {canRecordMaintenance && (
            <div className="flex justify-end">
              <VehicleMaintenanceDialog vehicleId={vehicle.id} />
            </div>
          )}
          {vehicle.maintenance.length === 0 ? (
            <EmptyState icon={Wrench} title="No maintenance records yet" />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Service Date</TableHead>
                    <TableHead>Next Due</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Status</TableHead>
                    {canUpdateMaintenance && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehicle.maintenance.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.maintenanceType}</TableCell>
                      <TableCell>{formatDate(m.serviceDate)}</TableCell>
                      <TableCell>{formatDate(m.nextServiceDate)}</TableCell>
                      <TableCell>{m.cost ? formatMoney(m.cost) : "—"}</TableCell>
                      <TableCell>
                        <StatusBadge status={m.status} />
                      </TableCell>
                      {canUpdateMaintenance && (
                        <TableCell className="text-right">
                          <MaintenanceStatusButton id={m.id} status={m.status} />
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {canViewActivity && (
          <TabsContent value="activity">
            <Timeline items={activityItems} emptyMessage="No recorded changes for this vehicle yet" />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
