import { ClipboardList, Plus } from "lucide-react";
import Link from "next/link";

import { ConfirmActionButton } from "@/components/shared/confirm-action-button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { SelectFilter } from "@/components/shared/select-filter";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { can } from "@/server/rbac";
import { endAssignment } from "@/server/actions/assignments";
import { listAssignments } from "@/server/queries/assignments";
import { listClientHierarchyForSelect } from "@/server/queries/clients";
import { listCoordinators, listWorkersForSelect } from "@/server/queries/workers";
import { getSessionUser } from "@/server/session";

import { AssignmentFormDialog } from "./assignment-form";

function formatDate(date: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(date);
}

function formatMoney(value: unknown) {
  return `SAR ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export default async function AssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const user = await getSessionUser();
  const page = Number(params.page ?? 1) || 1;

  const canCreate = can(user, "create", "assignment");
  const canEnd = can(user, "update", "assignment");

  const [{ assignments, total, pageSize }, clients, coordinators, workers] = await Promise.all([
    listAssignments(user, { status: (params.status as never) ?? "ALL", page }),
    canCreate ? listClientHierarchyForSelect() : Promise.resolve([]),
    canCreate ? listCoordinators() : Promise.resolve([]),
    canCreate ? listWorkersForSelect(user) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assignments"
        description="Every worker deployment to a client site, past and present."
        actions={
          canCreate && (
            <AssignmentFormDialog
              clients={clients}
              coordinators={coordinators}
              workers={workers}
              trigger={
                <Button>
                  <Plus className="size-4" />
                  New Assignment
                </Button>
              }
            />
          )
        }
      />

      <SelectFilter
        paramKey="status"
        placeholder="Status"
        options={[
          { label: "Active", value: "ACTIVE" },
          { label: "Ended", value: "ENDED" },
        ]}
      />

      {assignments.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No assignments found" />
      ) : (
        <div className="rounded-lg border">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Worker</TableHead>
                  <TableHead>Client / Site</TableHead>
                  <TableHead>Worker Rate</TableHead>
                  <TableHead>Client Rate</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Status</TableHead>
                  {canEnd && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <Link href={`/workers/${a.workerId}`} className="font-medium hover:underline">
                        {a.worker.fullName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {a.client.companyName} / {a.site.name}
                    </TableCell>
                    <TableCell>{formatMoney(a.workerHourlyRate)}</TableCell>
                    <TableCell>{formatMoney(a.clientBillingRate)}</TableCell>
                    <TableCell>{formatDate(a.startDate)}</TableCell>
                    <TableCell>{formatDate(a.endDate)}</TableCell>
                    <TableCell>
                      <StatusBadge status={a.status} />
                    </TableCell>
                    {canEnd && (
                      <TableCell className="text-right">
                        {a.status === "ACTIVE" && (
                          <ConfirmActionButton
                            trigger={
                              <Button variant="outline" size="sm">
                                End
                              </Button>
                            }
                            title="End this assignment?"
                            description={`${a.worker.fullName} will no longer be marked active at ${a.site.name}.`}
                            confirmLabel="End Assignment"
                            variant="destructive"
                            action={endAssignment.bind(null, a.id, undefined)}
                            successMessage="Assignment ended."
                          />
                        )}
                      </TableCell>
                    )}
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
