import { Upload } from "lucide-react";
import { forbidden } from "next/navigation";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { SelectFilter } from "@/components/shared/select-filter";
import { StatusBadge } from "@/components/shared/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { can } from "@/server/rbac";
import { listImportRuns } from "@/server/queries/import-runs";
import { getSessionUser } from "@/server/session";

import { ImportErrorsDialog } from "./import-errors-dialog";

type ErrorRow = { rowNumber: number; iqamaNumber: string | null; errors: string[] };

function toErrorReport(value: unknown): ErrorRow[] {
  if (!Array.isArray(value)) return [];
  return value as ErrorRow[];
}

const MODULE_LABELS: Record<string, string> = { WORKER: "Worker Bulk Upload", TIMESHEET: "LOG / Timesheet Import" };

export default async function ImportHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; module?: string }>;
}) {
  const params = await searchParams;
  const user = await getSessionUser();
  if (!can(user, "view", "auditLog")) forbidden();

  const page = Number(params.page ?? 1) || 1;
  const { runs, total, pageSize } = await listImportRuns(user, {
    page,
    module: (params.module as never) ?? "ALL",
  });

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Administration" }, { label: "Import History" }]}
        title="Import History"
        description="Every bulk Excel/CSV upload — who uploaded it, how many rows imported, and what failed."
      />

      <SelectFilter
        paramKey="module"
        placeholder="Module"
        options={[
          { label: "Worker Bulk Upload", value: "WORKER" },
          { label: "LOG / Timesheet Import", value: "TIMESHEET" },
        ]}
      />

      {runs.length === 0 ? (
        <EmptyState icon={Upload} title="No imports yet" description="Bulk uploads will appear here once you run one." />
      ) : (
        <div className="rounded-lg border">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Import Date</TableHead>
                  <TableHead>Uploaded By</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>File Name</TableHead>
                  <TableHead className="text-right">Total Rows</TableHead>
                  <TableHead className="text-right">Imported</TableHead>
                  <TableHead className="text-right">Failed</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Errors</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(run.createdAt)}
                    </TableCell>
                    <TableCell>{run.uploadedBy?.name ?? "System"}</TableCell>
                    <TableCell>{MODULE_LABELS[run.module] ?? run.module}</TableCell>
                    <TableCell className="font-medium">{run.fileName}</TableCell>
                    <TableCell className="text-right tabular-nums">{run.totalRows}</TableCell>
                    <TableCell className="text-right tabular-nums">{run.importedRows}</TableCell>
                    <TableCell className="text-right tabular-nums">{run.failedRows}</TableCell>
                    <TableCell>
                      <StatusBadge status={run.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <ImportErrorsDialog fileName={run.fileName} errorReport={toErrorReport(run.errorReport)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination page={page} pageSize={pageSize} total={total} />
        </div>
      )}
    </div>
  );
}
