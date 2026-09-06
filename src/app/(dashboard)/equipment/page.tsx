import { Plus, Wrench } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { SearchInput } from "@/components/shared/search-input";
import { SelectFilter } from "@/components/shared/select-filter";
import { Button } from "@/components/ui/button";
import { formatEquipmentCode } from "@/lib/codes";
import { EQUIPMENT_STATUSES } from "@/lib/validation/equipment";
import { can } from "@/server/rbac";
import { listEquipment } from "@/server/queries/equipment";
import { listCoordinators } from "@/server/queries/workers";
import { getSessionUser } from "@/server/session";

import { EquipmentFormDialog } from "./equipment-form-dialog";
import { EquipmentTable, type EquipmentRow } from "./equipment-table";

export default async function EquipmentPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const user = await getSessionUser();
  const page = Number(params.page ?? 1) || 1;

  const canCreate = can(user, "create", "equipment");
  const canEdit = can(user, "update", "equipment");
  const canArchive = can(user, "archive", "equipment");

  const [{ equipment, total, pageSize }, coordinators] = await Promise.all([
    listEquipment(user, { search: params.q, status: (params.status as never) ?? "ALL", page }),
    canCreate || canEdit ? listCoordinators() : Promise.resolve([]),
  ]);

  const rows: EquipmentRow[] = equipment.map((item) => {
    const currentRental = item.rentals[0];
    return {
      id: item.id,
      code: formatEquipmentCode(item.sequenceNo),
      serialNumber: item.serialNumber,
      name: item.name,
      category: item.category,
      currentClient: currentRental?.client.companyName ?? null,
      coordinatorName: item.coordinator?.name ?? null,
      status: item.status,
      isArchived: item.deletedAt != null,
      editable: {
        id: item.id,
        serialNumber: item.serialNumber,
        name: item.name,
        category: item.category,
        make: item.make,
        model: item.model,
        condition: item.condition,
        status: item.status,
        hourlyRate: item.hourlyRate ? Number(item.hourlyRate) : null,
        dailyRate: item.dailyRate ? Number(item.dailyRate) : null,
        weeklyRate: item.weeklyRate ? Number(item.weeklyRate) : null,
        monthlyRate: item.monthlyRate ? Number(item.monthlyRate) : null,
        ownerCompany: item.ownerCompany,
        coordinatorId: item.coordinatorId,
        notes: item.notes,
      },
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Operations" }, { label: "Equipment" }]}
        title="Equipment"
        description="Rental fleet master data, rentals, and maintenance."
        actions={
          canCreate && (
            <EquipmentFormDialog
              coordinators={coordinators}
              trigger={
                <Button>
                  <Plus className="size-4" />
                  Add Equipment
                </Button>
              }
            />
          )
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput placeholder="Search by name, serial number, category, or equipment ID…" />
        <SelectFilter
          paramKey="status"
          placeholder="Status"
          options={EQUIPMENT_STATUSES.map((s) => ({ label: s.replaceAll("_", " "), value: s }))}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="No equipment found"
          description="Try adjusting your search or filters, or add new equipment to get started."
        />
      ) : (
        <>
          <EquipmentTable rows={rows} coordinators={coordinators} canEdit={canEdit} canArchive={canArchive} />
          <Pagination page={page} pageSize={pageSize} total={total} />
        </>
      )}
    </div>
  );
}
