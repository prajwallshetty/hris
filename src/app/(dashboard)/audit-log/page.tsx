import { forbidden } from "next/navigation";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { History } from "lucide-react";
import { can } from "@/server/rbac";
import { listAuditLog } from "@/server/queries/dashboard";
import { getSessionUser } from "@/server/session";

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const user = await getSessionUser();
  if (!can(user, "view", "auditLog")) forbidden();

  const page = Number(params.page ?? 1) || 1;
  const { entries, total, pageSize } = await listAuditLog({ page });

  return (
    <div className="space-y-6">
      <PageHeader title="Audit Log" description="Every create, update, and status change across the system." />

      {entries.length === 0 ? (
        <EmptyState icon={History} title="No activity yet" />
      ) : (
        <div className="rounded-lg border">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Record ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(
                        entry.createdAt,
                      )}
                    </TableCell>
                    <TableCell>{entry.user?.name ?? "System"}</TableCell>
                    <TableCell className="capitalize">{entry.action.replaceAll("_", " ")}</TableCell>
                    <TableCell>{entry.entityType}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">{entry.entityId}</TableCell>
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
