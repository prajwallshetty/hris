import { forbidden } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { can } from "@/server/rbac";
import { getSessionUser } from "@/server/session";

import { ManpowerRegistrationForm } from "./manpower-registration-form";

export default async function RegisterManpowerPage() {
  const user = await getSessionUser();
  if (!can(user, "create", "worker")) forbidden();

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Workforce" }, { label: "Workers", href: "/workers" }, { label: "Register Manpower" }]}
        title="Register Manpower"
        description="Five required fields — everything else is optional and can be added later from the worker's profile."
      />
      <ManpowerRegistrationForm
        canCreateSupplier={can(user, "create", "supplier")}
        canAssign={can(user, "create", "assignment")}
      />
    </div>
  );
}
