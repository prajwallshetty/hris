import { Building2, Plus } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { can } from "@/server/rbac";
import { listClients } from "@/server/queries/clients";
import { getSessionUser } from "@/server/session";

import { ClientFormDialog } from "./client-form-dialog";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const user = await getSessionUser();
  const clients = await listClients(user, { search: params.q });

  return (
    <div className="space-y-6">
      <PageHeader
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => (
            <Link key={client.id} href={`/clients/${client.id}`}>
              <Card className="hover:border-primary/50 h-full transition-colors">
                <CardContent className="space-y-2 pt-6">
                  <div className="flex items-start justify-between">
                    <p className="font-medium">{client.companyName}</p>
                    <StatusBadge status={client.status} />
                  </div>
                  <p className="text-muted-foreground text-sm">{client.contactPerson || "No contact set"}</p>
                  <div className="text-muted-foreground flex gap-4 pt-2 text-xs">
                    <span>{client._count.projects} projects</span>
                    <span>{client._count.assignments} active workers</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
