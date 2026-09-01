import { forbidden } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { can } from "@/server/rbac";
import { listCoordinators } from "@/server/queries/coordinators";
import { getSessionUser } from "@/server/session";

import { EmployeeForm } from "../employee-form";

export default async function NewEmployeePage() {
  const user = await getSessionUser();
  if (!can(user, "create", "employee")) forbidden();

  const coordinators = await listCoordinators(user);

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Add Employee" description="Register a new internal (fixed-salary) employee." />
      <EmployeeForm coordinators={coordinators} />
    </div>
  );
}
