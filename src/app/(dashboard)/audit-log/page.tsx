import { History } from "lucide-react";
import { forbidden } from "next/navigation";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { SelectFilter } from "@/components/shared/select-filter";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { auditActionLabel } from "@/lib/audit-log-format";
import type { AuditAction } from "@/server/audit";
import { can } from "@/server/rbac";
import { listAuditLog, listAuditLogEntityTypes } from "@/server/queries/dashboard";
import { getSessionUser } from "@/server/session";

import { AuditDiffDialog } from "./audit-diff-dialog";

const AUDIT_ACTIONS: AuditAction[] = ["create", "update", "archive", "reactivate", "end_assignment", "import"];

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; action?: string; entityType?: string }>;
}) {
  const params = await searchParams;
  const user = await getSessionUser();
  if (!can(user, "view", "auditLog")) forbidden();

  const page = Number(params.page ?? 1) || 1;
  const [{ entries, total, pageSize }, entityTypes] = await Promise.all([
    listAuditLog({ page, action: params.action, entityType: params.entityType }),
    listAuditLogEntityTypes(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Administration" }, { label: "Audit Log" }]}
        title="Audit Log"
        description="Every create, update, and status change across the system."
      />

      <div className="flex flex-wrap gap-3">
        <SelectFilter
          paramKey="action"
          placeholder="Action"
          options={AUDIT_ACTIONS.map((a) => ({ label: auditActionLabel(a), value: a }))}
        />
        <SelectFilter
          paramKey="entityType"
          placeholder="Entity"
          options={entityTypes.map((t) => ({ label: t, value: t }))}
        />
      </div>

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
                  <TableHead className="text-right">Changes</TableHead>
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
                    <TableCell>{auditActionLabel(entry.action)}</TableCell>
                    <TableCell>{entry.entityType}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">{entry.entityId}</TableCell>
                    <TableCell className="text-right">
                      <AuditDiffDialog
                        entityType={entry.entityType}
                        entityId={entry.entityId}
                        previousValue={entry.previousValue}
                        newValue={entry.newValue}
                      />
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
