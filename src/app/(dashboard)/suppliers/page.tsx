import { Handshake, Plus } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { SearchInput } from "@/components/shared/search-input";
import { SelectFilter } from "@/components/shared/select-filter";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { can } from "@/server/rbac";
import { listSuppliers } from "@/server/queries/suppliers";
import { getSessionUser } from "@/server/session";

import { SupplierFormDialog } from "./supplier-form-dialog";
import { SupplierRowActions } from "./supplier-row-actions";

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string; new?: string }>;
}) {
  const params = await searchParams;
  const user = await getSessionUser();
  const page = Number(params.page ?? 1) || 1;
  const { suppliers, total, pageSize } = await listSuppliers(user, {
    search: params.q,
    status: (params.status as never) ?? "ALL",
    page,
  });

  const canCreate = can(user, "create", "supplier");
  const canEdit = can(user, "update", "supplier");
  const canArchive = can(user, "archive", "supplier");

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Workforce" }, { label: "Suppliers" }]}
        title="Manpower Suppliers"
        description="Agencies that provide HRD manpower. Every HRD worker is linked to one supplier."
        actions={
          canCreate && (
            <SupplierFormDialog
              defaultOpen={params.new === "1"}
              trigger={
                <Button>
                  <Plus className="size-4" />
                  Add Supplier
                </Button>
              }
            />
          )
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <SelectFilter
          paramKey="status"
          placeholder="Status"
          options={[
            { label: "Active", value: "ACTIVE" },
            { label: "Inactive", value: "INACTIVE" },
          ]}
        />
        <SearchInput placeholder="Search by supplier, contact, or phone…" />
      </div>

      {suppliers.length === 0 ? (
        <EmptyState
          icon={Handshake}
          title="No suppliers found"
          description={canCreate ? "Add a supplier before registering HRD manpower." : undefined}
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">HRD Workers</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-muted-foreground">{s.contactPerson ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{s.phone ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{s.email ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {s._count.workers > 0 ? (
                        <Link href={`/workers?supplier=${s.id}`} className="text-primary hover:underline">
                          {s._count.workers}
                        </Link>
                      ) : (
                        0
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={s.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <SupplierRowActions
                        supplierId={s.id}
                        status={s.status}
                        canEdit={canEdit}
                        canArchive={canArchive}
                        values={{
                          name: s.name,
                          contactPerson: s.contactPerson ?? "",
                          phone: s.phone ?? "",
                          email: s.email ?? "",
                          notes: s.notes ?? "",
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="rounded-lg border">
            <Pagination page={page} pageSize={pageSize} total={total} />
          </div>
        </>
      )}
    </div>
  );
}
