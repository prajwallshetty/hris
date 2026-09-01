import { Building2, Plus } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { can } from "@/server/rbac";
import { listClients } from "@/server/queries/clients";
import { getClientFinancials } from "@/server/queries/client-detail";
import { getSessionUser } from "@/server/session";

import { ClientFormDialog } from "./client-form-dialog";

function formatMoney(value: number) {
  return `SAR ${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const user = await getSessionUser();
  const clients = await listClients(user, { search: params.q });

  // §10: Revenue/Outstanding/Profit are company financials, not just "can
  // view this client" — gated the same way the dashboard's client
  // profitability summary is (invoice or workerPayroll view permission).
  const showFinancials = can(user, "view", "invoice") || can(user, "view", "workerPayroll");
  const financials = showFinancials
    ? new Map(await Promise.all(clients.map(async (c) => [c.id, await getClientFinancials(c.id)] as const)))
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Clients" }]}
        title="Clients"
        description="Companies your workers are deployed to, with their projects and sites."
        actions={
          can(user, "create", "client") && (
            <ClientFormDialog
              trigger={
                <Button>
                  <Plus className="size-4" />
                  Add Client
                </Button>
              }
            />
          )
        }
      />

      <SearchInput placeholder="Search clients…" />

      {clients.length === 0 ? (
        <EmptyState icon={Building2} title="No clients found" description="Add a client to get started." />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Active Workers</TableHead>
                <TableHead>Projects</TableHead>
                {financials && (
                  <>
                    <TableHead>Revenue</TableHead>
                    <TableHead>Outstanding</TableHead>
                    <TableHead>Profit</TableHead>
                  </>
                )}
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => {
                const clientFinancials = financials?.get(client.id);
                return (
                  <TableRow key={client.id}>
                    <TableCell>
                      <Link href={`/clients/${client.id}`} className="font-medium hover:underline">
                        {client.companyName}
                      </Link>
                      {client.contactPerson && <p className="text-muted-foreground text-xs">{client.contactPerson}</p>}
                    </TableCell>
                    <TableCell>{client._count.assignments}</TableCell>
                    <TableCell>{client._count.projects}</TableCell>
                    {financials && (
                      <>
                        <TableCell>{clientFinancials ? formatMoney(clientFinancials.revenue) : "—"}</TableCell>
                        <TableCell className={clientFinancials && clientFinancials.outstanding > 0 ? "text-warning-foreground" : undefined}>
                          {clientFinancials ? formatMoney(clientFinancials.outstanding) : "—"}
                        </TableCell>
                        <TableCell className="font-medium">
                          {clientFinancials ? formatMoney(clientFinancials.profit) : "—"}
                        </TableCell>
                      </>
                    )}
                    <TableCell>
                      <StatusBadge status={client.status} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
