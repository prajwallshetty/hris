import type { NextRequest } from "next/server";

import { formatWorkerCode } from "@/lib/codes";
import { toCsv } from "@/lib/csv";
import { listAssignmentsForExport, type AssignmentQueryParams } from "@/server/queries/assignments";
import { getSessionUser } from "@/server/session";

function formatDate(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "";
}

export async function GET(request: NextRequest) {
  let user;
  try {
    user = await getSessionUser();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const params: AssignmentQueryParams = {
    search: searchParams.get("q") ?? undefined,
    status: (searchParams.get("status") as AssignmentQueryParams["status"]) ?? "ALL",
    clientId: searchParams.get("client") ?? undefined,
    projectId: searchParams.get("project") ?? undefined,
    siteId: searchParams.get("site") ?? undefined,
    coordinatorId: searchParams.get("coordinator") ?? undefined,
    startDateFrom: searchParams.get("from") ?? undefined,
    startDateTo: searchParams.get("to") ?? undefined,
  };

  const assignments = await listAssignmentsForExport(user, params);

  const csv = toCsv(
    [
      "Assignment ID",
      "Worker Code",
      "Worker Name",
      "Iqama Number",
      "Designation",
      "Client",
      "Project",
      "Site",
      "Coordinator",
      "Worker Rate (SAR/hr)",
      "Client Rate (SAR/hr)",
      "Hourly Margin (SAR)",
      "Start Date",
      "End Date",
      "Status",
    ],
    assignments.map((a) => {
      const workerRate = Number(a.workerHourlyRate);
      const clientRate = Number(a.clientBillingRate);
      const margin = clientRate - workerRate;

      return [
        a.id,
        formatWorkerCode(a.worker.sequenceNo),
        a.worker.fullName,
        a.worker.iqamaNumber,
        a.worker.designation?.title ?? "",
        a.client.companyName,
        a.project.name,
        a.site.name,
        a.coordinator?.name ?? "—",
        workerRate.toFixed(2),
        clientRate.toFixed(2),
        margin.toFixed(2),
        formatDate(a.startDate),
        formatDate(a.endDate),
        a.status,
      ];
    }),
  );

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="assignments-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
