import { Plus } from "lucide-react";
import { forbidden } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { can } from "@/server/rbac";
import { listProjectsOverview } from "@/server/queries/clients";
import { getSessionUser } from "@/server/session";

import { AddProjectDialog } from "../clients/project-site-dialogs";
import { ProjectsTable, type ProjectRow } from "./projects-table";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const params = await searchParams;
  const user = await getSessionUser();
  if (!can(user, "view", "project")) forbidden();

  const projects = await listProjectsOverview(user);
  const rows: ProjectRow[] = projects.map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    clientId: p.clientId,
    clientName: p.client.companyName,
    coordinatorId: p.coordinatorId,
    coordinatorName: p.coordinator?.name ?? null,
    siteCount: p._count.sites,
    activeWorkerCount: p._count.assignments,
  }));

  const canCreate = can(user, "create", "project");

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Clients & Billing" }, { label: "Projects" }]}
        title="Projects"
        description="Every project across every client — add new projects, edit details, and assign coordinators. Site-level management stays on each client's Projects & Sites tab."
        actions={
          canCreate && (
            <AddProjectDialog
              defaultOpen={params.new === "1"}
              trigger={
                <Button>
                  <Plus className="size-4" />
                  Add Project
                </Button>
              }
            />
          )
        }
      />

      <ProjectsTable rows={rows} canEdit={can(user, "update", "project")} canArchive={can(user, "archive", "project")} />
    </div>
  );
}
