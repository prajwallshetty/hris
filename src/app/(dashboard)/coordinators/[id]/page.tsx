import { DollarSign, HandCoins } from "lucide-react";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { can } from "@/server/rbac";
import { listAllClientsForSelect } from "@/server/queries/clients";
import {
  getApplicableCommissionRules,
  getCoordinatorDetail,
  listCoordinatorCommissions,
  listCoordinatorSales,
  listUncommissionedSales,
} from "@/server/queries/coordinators";
import { getSessionUser } from "@/server/session";

import { AdvanceCommissionButton, GenerateCommissionDialog } from "./commission-actions";
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

  const [sales, commissions, uncommissionedSales, rules, clients] = await Promise.all([
    listCoordinatorSales(coordinator.id),
    listCoordinatorCommissions(coordinator.id),
    canGenerateCommission ? listUncommissionedSales(coordinator.id) : Promise.resolve([]),
    canGenerateCommission ? getApplicableCommissionRules(coordinator.id) : Promise.resolve([]),
    canRecordSale ? listAllClientsForSelect() : Promise.resolve([]),
  ]);

  const totalSales = sales.reduce((sum, s) => sum + Number(s.amount), 0);
  const totalCommission = commissions.reduce((sum, c) => sum + Number(c.amount), 0);
  const paidCommission = commissions.filter((c) => c.status === "PAID").reduce((sum, c) => sum + Number(c.amount), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={coordinator.name}
        description={coordinator.email ?? coordinator.phone ?? undefined}
        actions={<StatusBadge status={coordinator.status} />}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryStat label="Active Assignments" value={String(coordinator._count.assignments)} />
        <SummaryStat label="Total Sales" value={formatMoney(totalSales)} />
        <SummaryStat label="Commission Earned" value={formatMoney(totalCommission)} />
        <SummaryStat label="Commission Paid" value={formatMoney(paidCommission)} />
      </div>

      <Tabs defaultValue="sales">
        <TabsList>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="commissions">Commissions</TabsTrigger>
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
            <div className="flex justify-end">
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
