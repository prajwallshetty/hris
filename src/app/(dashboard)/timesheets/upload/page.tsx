import { redirect } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { assertCan } from "@/server/rbac";
import { listClientHierarchyForSelect } from "@/server/queries/clients";
import { getSessionUser } from "@/server/session";

import { TimesheetUploadWizard } from "./upload-wizard";

export default async function TimesheetUploadPage() {
  const user = await getSessionUser();
  try {
    assertCan(user, "create", "timesheet");
  } catch {
    redirect("/timesheets");
  }

  const clients = await listClientHierarchyForSelect();

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Workforce" },
          { label: "Timesheets", href: "/timesheets" },
          { label: "Import Excel" },
        ]}
        title="Import Timesheet (LOG)"
        description="Upload a daily login sheet, review the matches, then confirm to create the timesheet."
      />
      <TimesheetUploadWizard clients={clients} />
    </div>
  );
}
