import { getAssignmentDetail, getAssignmentStats, listAssignments, type AssignmentQueryParams } from "@/server/queries/assignments";
import { listClientHierarchyForSelect } from "@/server/queries/clients";
import { listCoordinators, listWorkersForSelect } from "@/server/queries/workers";
import { can } from "@/server/rbac";
import { getSessionUser } from "@/server/session";

import { AssignmentsClientView } from "./assignments-client-view";

export default async function AssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    client?: string;
    project?: string;
    site?: string;
    coordinator?: string;
    from?: string;
    to?: string;
    sort?: string;
    order?: string;
    page?: string;
    pageSize?: string;
    detail?: string;
  }>;
}) {
  const params = await searchParams;
  const user = await getSessionUser();

  const queryParams: AssignmentQueryParams = {
    search: params.q || undefined,
    status: (params.status as AssignmentQueryParams["status"]) || "ALL",
    clientId: params.client || undefined,
    projectId: params.project || undefined,
    siteId: params.site || undefined,
    coordinatorId: params.coordinator || undefined,
    startDateFrom: params.from || undefined,
    startDateTo: params.to || undefined,
    sortBy: (params.sort as AssignmentQueryParams["sortBy"]) || "startDate",
    sortOrder: (params.order as "asc" | "desc") || "desc",
    page: Number(params.page ?? 1) || 1,
    pageSize: Number(params.pageSize ?? 25) || 25,
  };

  const canCreate = can(user, "create", "assignment");
  const canEnd = can(user, "update", "assignment");

  const [stats, { assignments, total, page, pageSize }, clients, coordinators, workers, detailData] = await Promise.all([
    getAssignmentStats(user),
    listAssignments(user, queryParams),
    canCreate ? listClientHierarchyForSelect() : Promise.resolve([]),
    canCreate ? listCoordinators() : Promise.resolve([]),
    canCreate ? listWorkersForSelect(user) : Promise.resolve([]),
    params.detail ? getAssignmentDetail(params.detail, user) : Promise.resolve(null),
  ]);

  return (
    <AssignmentsClientView
      assignments={assignments as any}
      total={total}
      page={page}
      pageSize={pageSize}
      stats={stats}
      clients={clients}
      coordinators={coordinators}
      workers={workers}
      canCreate={canCreate}
      canEnd={canEnd}
      detailData={detailData}
    />
  );
}
