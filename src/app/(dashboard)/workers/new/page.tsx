import { forbidden } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { can } from "@/server/rbac";
import { listClientHierarchyForSelect } from "@/server/queries/clients";
import { listCoordinators } from "@/server/queries/workers";
import { getSessionUser } from "@/server/session";

import { WorkerCreateWizard } from "./worker-create-wizard";

export default async function NewWorkerPage() {
  const user = await getSessionUser();
  if (!can(user, "create", "worker")) forbidden();

  const [coordinators, clients] = await Promise.all([listCoordinators(), listClientHierarchyForSelect()]);

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title="Add Worker" description="Register a new worker through the guided setup steps." />
      <WorkerCreateWizard coordinators={coordinators} clients={clients} />
    </div>
  );
}
