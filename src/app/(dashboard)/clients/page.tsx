import { Plus } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { can } from "@/server/rbac";
import { listClients } from "@/server/queries/clients";
import { getClientFinancials } from "@/server/queries/client-detail";
import { getSessionUser } from "@/server/session";

import { ClientFormDialog } from "./client-form-dialog";
import { ClientsTable, type ClientRow } from "./clients-table";

export default async function ClientsPage() {
  const user = await getSessionUser();
  const clients = await listClients(user);

  // §10: Revenue/Outstanding/Profit are company financials, not just "can
  // view this client" — gated the same way the dashboard's client
  // profitability summary is (invoice or workerPayroll view permission).
  const showFinancials = can(user, "view", "invoice") || can(user, "view", "workerPayroll");
  const financials = showFinancials
    ? new Map(await Promise.all(clients.map(async (c) => [c.id, await getClientFinancials(c.id)] as const)))
    : null;

  const rows: ClientRow[] = clients.map((client) => {
    const clientFinancials = financials?.get(client.id);
    return {
      id: client.id,
      companyName: client.companyName,
      contactPerson: client.contactPerson,
      phone: client.phone,
      email: client.email,
      address: client.address,
      contractRef: client.contractRef,
      paymentTerms: client.paymentTerms,
      billingTerms: client.billingTerms,
      status: client.status,
      deletedAt: client.deletedAt,
      activeWorkers: client._count.assignments,
      projects: client._count.projects,
      revenue: clientFinancials?.revenue ?? null,
      outstanding: clientFinancials?.outstanding ?? null,
      profit: clientFinancials?.profit ?? null,
    };
  });

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

      <ClientsTable
        rows={rows}
        canEdit={can(user, "update", "client")}
        canArchive={can(user, "archive", "client")}
        showFinancials={showFinancials}
      />
    </div>
  );
}
