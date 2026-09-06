import { Timer, Wrench } from "lucide-react";
import { notFound } from "next/navigation";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { KpiCard } from "@/components/shared/kpi-card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Timeline, type TimelineItem } from "@/components/shared/timeline";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatEquipmentCode, formatRentalCode } from "@/lib/codes";
import { auditActionLabel, auditActionTone } from "@/lib/audit-log-format";
import { calculateOutstanding } from "@/server/calc/finance";
import { calculateRentalTotal } from "@/server/calc/rental";
import { can } from "@/server/rbac";
import { listClientHierarchyForSelect } from "@/server/queries/clients";
import { getEntityAuditLog } from "@/server/queries/dashboard";
import { getEquipment } from "@/server/queries/equipment";
import { listCoordinators } from "@/server/queries/workers";
import { getSessionUser } from "@/server/session";

import { CreateRentalDialog } from "../../rentals/create-rental-dialog";
import { EquipmentMaintenanceDialog } from "./equipment-maintenance-dialog";
import { MaintenanceStatusButton } from "./maintenance-status-button";

function formatDate(date: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(date);
}

function formatMoney(value: unknown) {
  return `SAR ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export default async function EquipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  const equipment = await getEquipment(user, id);
  if (!equipment) notFound();

  const canCreateRental = can(user, "create", "equipmentRental");
  const canRecordMaintenance = can(user, "create", "equipmentMaintenance");
  const canUpdateMaintenance = can(user, "update", "equipmentMaintenance");
  const canViewActivity = can(user, "view", "auditLog");

  const [clients, coordinators, activity] = await Promise.all([
    canCreateRental ? listClientHierarchyForSelect() : Promise.resolve([]),
    canCreateRental ? listCoordinators() : Promise.resolve([]),
    canViewActivity ? getEntityAuditLog("Equipment", equipment.id) : Promise.resolve([]),
  ]);

  const currentRental = equipment.rentals.find((r) => r.status === "ACTIVE" || r.status === "EXTENDED");
  const totalRentalRevenue = equipment.rentals.reduce((sum, r) => {
    const total = calculateRentalTotal(r.charges.map((c) => c.amount.toString()));
    return sum + total.toNumber();
  }, 0);

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
          { label: "Equipment", href: "/equipment" },
          { label: equipment.name },
        ]}
        title={equipment.name}
        description={`${formatEquipmentCode(equipment.sequenceNo)} · ${equipment.serialNumber}`}
        actions={<StatusBadge status={equipment.status} />}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Status" value={equipment.status.replaceAll("_", " ")} />
        <KpiCard label="Current Client" value={currentRental?.client.companyName ?? "Unrented"} />
        <KpiCard label="Total Rentals" value={String(equipment.rentals.length)} />
        <KpiCard label="Lifetime Revenue" value={formatMoney(totalRentalRevenue)} />
      </div>

      <Tabs defaultValue="rentals">
        <TabsList>
          <TabsTrigger value="rentals">Rentals</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          {canViewActivity && <TabsTrigger value="activity">Activity</TabsTrigger>}
        </TabsList>

        <TabsContent value="rentals" className="space-y-4">
          {canCreateRental && equipment.status === "AVAILABLE" && (
            <div className="flex justify-end">
              <CreateRentalDialog
                equipmentId={equipment.id}
                clients={clients}
                coordinators={coordinators}
                trigger={<Button>New Rental</Button>}
              />
            </div>
          )}
          {equipment.rentals.length === 0 ? (
            <EmptyState icon={Timer} title="No rentals yet" description="This equipment has never been rented out." />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rental</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>Return</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Outstanding</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {equipment.rentals.map((rental) => {
                    const total = calculateRentalTotal(rental.charges.map((c) => c.amount.toString()));
                    const outstanding = calculateOutstanding(total, rental.payments.map((p) => p.amount.toString()));
                    return (
                      <TableRow key={rental.id}>
                        <TableCell className="font-medium">
                          <Link href={`/rentals/${rental.id}`} className="hover:underline">
                            {formatRentalCode(rental.sequenceNo)}
                          </Link>
                        </TableCell>
                        <TableCell>{rental.client.companyName}</TableCell>
                        <TableCell>{formatDate(rental.startDate)}</TableCell>
                        <TableCell>{formatDate(rental.actualReturnDate ?? rental.expectedEndDate)}</TableCell>
                        <TableCell>{formatMoney(total)}</TableCell>
                        <TableCell className={outstanding.toNumber() > 0 ? "text-warning-foreground font-medium" : undefined}>
                          {formatMoney(outstanding)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={rental.status} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="maintenance" className="space-y-4">
          {canRecordMaintenance && (
            <div className="flex justify-end">
              <EquipmentMaintenanceDialog equipmentId={equipment.id} />
            </div>
          )}
          {equipment.maintenance.length === 0 ? (
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
                  {equipment.maintenance.map((m) => (
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
            <Timeline items={activityItems} emptyMessage="No recorded changes for this equipment yet" />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
