import { Plus } from "lucide-react";
import { forbidden } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { can } from "@/server/rbac";
import { listCoordinators } from "@/server/queries/coordinators";
import { getSessionUser } from "@/server/session";

import { CoordinatorFormDialog } from "./coordinator-form-dialog";
import { CoordinatorsTable, type CoordinatorRow } from "./coordinators-table";

export default async function CoordinatorsPage() {
  const user = await getSessionUser();
  if (!can(user, "view", "coordinator")) forbidden();

  const coordinators = await listCoordinators(user);
  const rows: CoordinatorRow[] = coordinators.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    status: c.status,
    workerCount: c._count.workers,
    activeAssignmentCount: c._count.assignments,
  }));

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

      <CoordinatorsTable rows={rows} canEdit={can(user, "update", "coordinator")} canArchive={can(user, "archive", "coordinator")} />
    </div>
  );
}
