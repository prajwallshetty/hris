import { Plus, Users } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { SearchInput } from "@/components/shared/search-input";
import { SelectFilter } from "@/components/shared/select-filter";
import { Button } from "@/components/ui/button";
import { formatWorkerCode } from "@/lib/codes";
import { WORKER_STATUSES } from "@/lib/validation/worker";
import { can } from "@/server/rbac";
import { listWorkers } from "@/server/queries/workers";
import { getSessionUser } from "@/server/session";

import { ExportWorkersButton } from "./export-button";
import { WorkersTable, type WorkerRow } from "./workers-table";

export default async function WorkersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const user = await getSessionUser();
  const page = Number(params.page ?? 1) || 1;

  const { workers, total, pageSize } = await listWorkers(user, {
    search: params.q,
    status: (params.status as never) ?? "ALL",
    page,
  });

  const rows: WorkerRow[] = workers.map((worker) => {
    const currentAssignment = worker.assignments[0];
    return {
      id: worker.id,
      code: formatWorkerCode(worker.sequenceNo),
      fullName: worker.fullName,
      iqamaNumber: worker.iqamaNumber,
      designationTitle: worker.designation?.title ?? null,
      clientName: currentAssignment?.client.companyName ?? null,
      siteName: currentAssignment?.site.name ?? null,
      coordinatorName: worker.coordinator?.name ?? null,
      hourlyRate: worker.hourlyRate ? Number(worker.hourlyRate) : null,
      status: worker.status,
    };
  });

  const canArchive = can(user, "archive", "worker");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workers"
        description="Manpower roster, identified by Iqama number."
        actions={
          <>
            <ExportWorkersButton />
            {can(user, "create", "worker") && (
              <Button
                render={
                  <Link href="/workers/new">
                    <Plus className="size-4" />
                    Add Worker
                  </Link>
                }
              />
            )}
          </>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput placeholder="Search by name, Iqama, mobile, or worker ID…" />
        <SelectFilter
          paramKey="status"
          placeholder="Status"
          options={WORKER_STATUSES.map((s) => ({ label: s.replaceAll("_", " "), value: s }))}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No workers found"
          description="Try adjusting your search or filters, or add a new worker to get started."
        />
      ) : (
        <>
          <WorkersTable rows={rows} canBulkArchive={canArchive} />
          <Pagination page={page} pageSize={pageSize} total={total} />
        </>
      )}
    </div>
  );
}
