import { redirect } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { can } from "@/server/rbac";
import { listClientHierarchyForSelect } from "@/server/queries/clients";
import { getSessionUser } from "@/server/session";

import { TimesheetUploadWizard } from "./upload-wizard";

export default async function TimesheetUploadPage() {
  const user = await getSessionUser();
  if (!can(user, "create", "timesheet")) redirect("/timesheets");

  const clients = await listClientHierarchyForSelect();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Upload Login Sheet"
        description="Upload -> Read -> Map -> Validate -> Match Iqama -> Preview -> Import. Nothing is saved until you confirm the preview."
      />
      <TimesheetUploadWizard clients={clients} />
    </div>
  );
}
