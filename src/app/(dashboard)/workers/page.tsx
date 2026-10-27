import { Upload, UserPlus, Users } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { SearchInput } from "@/components/shared/search-input";
import { SelectFilter } from "@/components/shared/select-filter";
import { Button } from "@/components/ui/button";
import { formatWorkerCode } from "@/lib/codes";
import { WORKER_TYPE_LABELS, WORKER_TYPES } from "@/lib/validation/manpower";
import { WORKER_STATUSES } from "@/lib/validation/worker";
import { can } from "@/server/rbac";
import { listSuppliersForSelect } from "@/server/queries/suppliers";
import { listWorkers } from "@/server/queries/workers";
import { getSessionUser } from "@/server/session";

import { ExportWorkersButton } from "./export-button";
import { WorkersTable, type WorkerRow } from "./workers-table";

export default async function WorkersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; type?: string; supplier?: string; unassigned?: string; page?: string }>;
}) {
  const params = await searchParams;
  const user = await getSessionUser();
  const page = Number(params.page ?? 1) || 1;
  const unassigned = params.unassigned === "1";

  const [{ workers, total, pageSize }, suppliers] = await Promise.all([
    listWorkers(user, {
      search: params.q,
      status: (params.status as never) ?? "ALL",
      workerType: (params.type as never) ?? "ALL",
      supplierId: params.supplier,
      unassigned,
      page,
    }),
    can(user, "view", "supplier") ? listSuppliersForSelect() : Promise.resolve([]),
  ]);

  const rows: WorkerRow[] = workers.map((worker) => {
    const currentAssignment = worker.assignments[0];
    return {
      id: worker.id,
      code: formatWorkerCode(worker.sequenceNo),
      fullName: worker.fullName,
      iqamaNumber: worker.iqamaNumber,
      workerType: worker.workerType,
      supplierName: worker.supplier?.name ?? null,
      designationTitle: worker.designation?.title ?? null,
      clientName: currentAssignment?.client.companyName ?? null,
      siteName: currentAssignment?.site.name ?? null,
      coordinatorName: worker.coordinator?.name ?? null,
      hourlyRate: worker.hourlyRate ? Number(worker.hourlyRate) : null,
      status: worker.status,
      batchNumber: worker.batchNumber,
    };
  });

  const canArchive = can(user, "archive", "worker");
  const canEdit = can(user, "update", "worker");

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Workforce" }, { label: "Workers" }]}
        title="Workers"
        description={
          unassigned
            ? "Active/available workers with no current site assignment."
            : "Manpower roster, identified by Iqama number."
        }
        actions={
          can(user, "create", "worker") && (
            <>
              <Button variant="outline" nativeButton={false} render={<Link href="/workers/import" />}>
                <Upload className="size-4" />
                Bulk Upload
              </Button>
              <Button nativeButton={false} render={<Link href="/workers/new" />}>
                <UserPlus className="size-4" />
                Register Manpower
              </Button>
            </>
          )
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SelectFilter
            paramKey="status"
            placeholder="Status"
            options={WORKER_STATUSES.map((s) => ({ label: s.replaceAll("_", " "), value: s }))}
          />
          <SelectFilter
            paramKey="type"
            placeholder="Worker type"
            options={WORKER_TYPES.map((t) => ({ label: WORKER_TYPE_LABELS[t], value: t }))}
          />
          {suppliers.length > 0 && (
            <SelectFilter
              paramKey="supplier"
              placeholder="Supplier"
              options={suppliers.map((sup) => ({ label: sup.name, value: sup.id }))}
            />
          )}
          <SearchInput placeholder="Search by name, Iqama, mobile, batch number, or worker ID…" />
        </div>
        <ExportWorkersButton />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No workers found"
          description="Try adjusting your search or filters, or add a new worker to get started."
        />
      ) : (
        <>
          <WorkersTable rows={rows} canBulkArchive={canArchive} canEdit={canEdit} />
          <Pagination page={page} pageSize={pageSize} total={total} />
        </>
      )}
    </div>
  );
}
