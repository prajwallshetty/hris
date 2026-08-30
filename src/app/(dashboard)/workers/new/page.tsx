import { forbidden } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { can } from "@/server/rbac";
import { listCoordinators } from "@/server/queries/workers";
import { getSessionUser } from "@/server/session";

import { WorkerForm } from "../worker-form";

export default async function NewWorkerPage() {
  const user = await getSessionUser();
  if (!can(user, "create", "worker")) forbidden();

  const coordinators = await listCoordinators();

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Add Worker" description="Register a new worker by Iqama number." />
      <WorkerForm coordinators={coordinators} />
    </div>
  );
}
