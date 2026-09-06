import { Car, Plus } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { SearchInput } from "@/components/shared/search-input";
import { SelectFilter } from "@/components/shared/select-filter";
import { Button } from "@/components/ui/button";
import { formatVehicleCode } from "@/lib/codes";
import { VEHICLE_STATUSES } from "@/lib/validation/vehicle";
import { can } from "@/server/rbac";
import { listVehicles } from "@/server/queries/vehicles";
import { listCoordinators } from "@/server/queries/workers";
import { getSessionUser } from "@/server/session";

import { VehicleFormDialog } from "./vehicle-form-dialog";
import { VehiclesTable, type VehicleRow } from "./vehicles-table";

function toDateInput(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : null;
}

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const user = await getSessionUser();
  const page = Number(params.page ?? 1) || 1;

  const canCreate = can(user, "create", "vehicle");
  const canEdit = can(user, "update", "vehicle");
  const canArchive = can(user, "archive", "vehicle");

  const [{ vehicles, total, pageSize }, coordinators] = await Promise.all([
    listVehicles(user, { search: params.q, status: (params.status as never) ?? "ALL", page }),
    canCreate || canEdit ? listCoordinators() : Promise.resolve([]),
  ]);

  const rows: VehicleRow[] = vehicles.map((vehicle) => {
    const currentAssignment = vehicle.assignments[0];
    return {
      id: vehicle.id,
      code: formatVehicleCode(vehicle.sequenceNo),
      plateNumber: vehicle.plateNumber,
      makeModel: `${vehicle.make} ${vehicle.model}`,
      vehicleType: vehicle.vehicleType,
      currentDriver: currentAssignment?.worker.fullName ?? null,
      coordinatorName: vehicle.coordinator?.name ?? null,
      currentMileage: vehicle.currentMileage ? Number(vehicle.currentMileage) : null,
      status: vehicle.status,
      isArchived: vehicle.deletedAt != null,
      editable: {
        id: vehicle.id,
        plateNumber: vehicle.plateNumber,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        color: vehicle.color,
        vehicleType: vehicle.vehicleType,
        vin: vehicle.vin,
        currentMileage: vehicle.currentMileage ? Number(vehicle.currentMileage) : null,
        status: vehicle.status,
        registrationExpiry: toDateInput(vehicle.registrationExpiry),
        insuranceExpiry: toDateInput(vehicle.insuranceExpiry),
        inspectionExpiry: toDateInput(vehicle.inspectionExpiry),
        ownerCompany: vehicle.ownerCompany,
        coordinatorId: vehicle.coordinatorId,
        notes: vehicle.notes,
      },
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Operations" }, { label: "Vehicles" }]}
        title="Vehicles"
        description="Fleet master data, deployment, expenses, and maintenance."
        actions={
          canCreate && (
            <VehicleFormDialog
              coordinators={coordinators}
              trigger={
                <Button>
                  <Plus className="size-4" />
                  Add Vehicle
                </Button>
              }
            />
          )
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput placeholder="Search by plate, make, model, VIN, or vehicle ID…" />
        <SelectFilter
          paramKey="status"
          placeholder="Status"
          options={VEHICLE_STATUSES.map((s) => ({ label: s.replaceAll("_", " "), value: s }))}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Car}
          title="No vehicles found"
          description="Try adjusting your search or filters, or add a new vehicle to get started."
        />
      ) : (
        <>
          <VehiclesTable rows={rows} coordinators={coordinators} canEdit={canEdit} canArchive={canArchive} />
          <Pagination page={page} pageSize={pageSize} total={total} />
        </>
      )}
    </div>
  );
}
