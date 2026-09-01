import { Plus, UserCog } from "lucide-react";
import Link from "next/link";
import { forbidden } from "next/navigation";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { can } from "@/server/rbac";
import { listCoordinators } from "@/server/queries/coordinators";
import { getSessionUser } from "@/server/session";

import { CoordinatorFormDialog } from "./coordinator-form-dialog";

export default async function CoordinatorsPage() {
  const user = await getSessionUser();
  if (!can(user, "view", "coordinator")) forbidden();

  const coordinators = await listCoordinators(user);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Operations" }, { label: "Coordinators" }]}
        title="Coordinators"
        description="Staff who manage worker deployments and client relationships."
        actions={
          can(user, "create", "coordinator") && (
            <CoordinatorFormDialog
              trigger={
                <Button>
                  <Plus className="size-4" />
                  Add Coordinator
                </Button>
              }
            />
          )
        }
      />

      {coordinators.length === 0 ? (
        <EmptyState icon={UserCog} title="No coordinators yet" description="Add one to assign workers to them." />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Workers</TableHead>
                <TableHead>Active Assignments</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coordinators.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    <Link href={`/coordinators/${c.id}`} className="hover:underline">
                      {c.name}
                    </Link>
                  </TableCell>
                  <TableCell>{c.phone ?? "—"}</TableCell>
                  <TableCell>{c.email ?? "—"}</TableCell>
                  <TableCell>{c._count.workers}</TableCell>
                  <TableCell>{c._count.assignments}</TableCell>
                  <TableCell>
                    <StatusBadge status={c.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
