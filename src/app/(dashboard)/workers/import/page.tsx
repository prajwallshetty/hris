import { redirect } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { assertCan } from "@/server/rbac";
import { getSessionUser } from "@/server/session";

import { WorkerImportWizard } from "./worker-import-wizard";

export default async function WorkerImportPage() {
  const user = await getSessionUser();
  try {
    assertCan(user, "create", "worker");
  } catch {
    redirect("/workers");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Workforce" },
          { label: "Workers", href: "/workers" },
          { label: "Bulk Upload" },
        ]}
        title="Bulk Upload Workers"
        description="Download the template, fill it in, upload, review the preview, then import."
      />
      <WorkerImportWizard />
    </div>
  );
}
