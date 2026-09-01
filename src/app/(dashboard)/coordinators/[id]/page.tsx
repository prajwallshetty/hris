import { DollarSign, HandCoins } from "lucide-react";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/shared/empty-state";
import { KpiCard } from "@/components/shared/kpi-card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Timeline, type TimelineItem } from "@/components/shared/timeline";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { auditActionLabel, auditActionTone } from "@/lib/audit-log-format";
import { can } from "@/server/rbac";
import { listAllClientsForSelect } from "@/server/queries/clients";
import {
  getApplicableCommissionRules,
  getCoordinatorDetail,
  listCoordinatorCommissions,
  listCoordinatorSales,
  listUncommissionedSales,
} from "@/server/queries/coordinators";
import { getEntityAuditLog } from "@/server/queries/dashboard";
import { listInvoicesForSelect } from "@/server/queries/invoices";
import { getSessionUser } from "@/server/session";

import { AdvanceCommissionButton, GenerateCommissionDialog } from "./commission-actions";
import { GenerateAdvancedCommissionDialog } from "./generate-advanced-commission-dialog";
import { SaleDialog } from "./sale-dialog";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(date);
}

function formatMoney(value: unknown) {
  return `SAR ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export default async function CoordinatorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  const coordinator = await getCoordinatorDetail(user, id);
  if (!coordinator) notFound();

  const canRecordSale = can(user, "create", "sale");
  const canGenerateCommission = can(user, "create", "commission");
  const canUpdateCommission = can(user, "update", "commission");
  const canViewActivity = can(user, "view", "auditLog");

  const [sales, commissions, uncommissionedSales, rules, clients, invoices, activity] = await Promise.all([
    listCoordinatorSales(coordinator.id),
    listCoordinatorCommissions(coordinator.id),
    canGenerateCommission ? listUncommissionedSales(coordinator.id) : Promise.resolve([]),
    canGenerateCommission ? getApplicableCommissionRules(coordinator.id) : Promise.resolve([]),
    canRecordSale || canGenerateCommission ? listAllClientsForSelect() : Promise.resolve([]),
    canGenerateCommission ? listInvoicesForSelect(user) : Promise.resolve([]),
    canViewActivity ? getEntityAuditLog("Coordinator", coordinator.id) : Promise.resolve([]),
  ]);

  const totalSales = sales.reduce((sum, s) => sum + Number(s.amount), 0);
  const totalCommission = commissions.reduce((sum, c) => sum + Number(c.amount), 0);
  const paidCommission = commissions.filter((c) => c.status === "PAID").reduce((sum, c) => sum + Number(c.amount), 0);

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
          { label: "Coordinators", href: "/coordinators" },
          { label: coordinator.name },
        ]}
        title={coordinator.name}
        description={coordinator.email ?? coordinator.phone ?? undefined}
        actions={<StatusBadge status={coordinator.status} />}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Active Assignments" value={String(coordinator._count.assignments)} />
        <KpiCard label="Total Sales" value={formatMoney(totalSales)} />
        <KpiCard label="Commission Earned" value={formatMoney(totalCommission)} />
        <KpiCard label="Commission Paid" value={formatMoney(paidCommission)} />
      </div>

      <Tabs defaultValue="sales">
        <TabsList>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="commissions">Commissions</TabsTrigger>
          {canViewActivity && <TabsTrigger value="activity">Activity</TabsTrigger>}
        </TabsList>

        <TabsContent value="sales" className="space-y-4">
          {canRecordSale && (
            <div className="flex justify-end">
              <SaleDialog coordinatorId={coordinator.id} clients={clients} />
            </div>
          )}
          {sales.length === 0 ? (
            <EmptyState icon={DollarSign} title="No sales recorded yet" />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Commission</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell>{formatDate(sale.date)}</TableCell>
                      <TableCell>{sale.client?.companyName ?? "—"}</TableCell>
                      <TableCell>{sale.description ?? "—"}</TableCell>
                      <TableCell className="font-medium">{formatMoney(sale.amount)}</TableCell>
                      <TableCell>{sale.commissions.length > 0 ? "Generated" : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="commissions" className="space-y-4">
          {canGenerateCommission && (
            <div className="flex flex-wrap justify-end gap-2">
              <GenerateCommissionDialog
                sales={uncommissionedSales.map((s) => ({
                  id: s.id,
                  description: s.description,
                  amount: s.amount.toString(),
                  date: s.date.toISOString().slice(0, 10),
                }))}
                rules={rules.map((r) => ({
                  id: r.id,
                  type: r.type,
                  rateOrAmount: r.rateOrAmount.toString(),
                  coordinatorId: r.coordinatorId,
                }))}
              />
              <GenerateAdvancedCommissionDialog
                coordinatorId={coordinator.id}
                rules={rules.map((r) => ({
                  id: r.id,
                  type: r.type,
                  rateOrAmount: r.rateOrAmount.toString(),
                  coordinatorId: r.coordinatorId,
                }))}
                invoices={invoices.map((inv) => ({
                  id: inv.id,
                  sequenceNo: inv.sequenceNo,
                  totalAmount: inv.totalAmount.toString(),
                  clientName: inv.client.companyName,
                }))}
                clients={clients.map((c) => ({ id: c.id, companyName: c.companyName }))}
              />
            </div>
          )}
          {commissions.length === 0 ? (
            <EmptyState icon={HandCoins} title="No commissions generated yet" />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rule</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    {canUpdateCommission && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commissions.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{c.commissionRule.type.replaceAll("_", " ")}</TableCell>
                      <TableCell className="font-medium">{formatMoney(c.amount)}</TableCell>
                      <TableCell>
                        <StatusBadge status={c.status} />
                      </TableCell>
                      {canUpdateCommission && (
                        <TableCell className="text-right">
                          <AdvanceCommissionButton commissionId={c.id} status={c.status} />
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
            <Timeline items={activityItems} emptyMessage="No recorded changes for this coordinator yet" />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
