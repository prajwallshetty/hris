import { Plus, Wrench } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { SearchInput } from "@/components/shared/search-input";
import { SelectFilter } from "@/components/shared/select-filter";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatRentalCode } from "@/lib/codes";
import { RENTAL_STATUSES } from "@/lib/validation/equipment";
import { calculateOutstanding } from "@/server/calc/finance";
import { calculateRentalTotal } from "@/server/calc/rental";
import { can } from "@/server/rbac";
import { listClientHierarchyForSelect } from "@/server/queries/clients";
import { listEquipmentForSelect, listRentals } from "@/server/queries/equipment";
import { listCoordinators } from "@/server/queries/workers";
import { getSessionUser } from "@/server/session";

import { CreateRentalDialog } from "./create-rental-dialog";

function formatDate(date: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(date);
}

function formatMoney(value: unknown) {
  return `SAR ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export default async function RentalsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const user = await getSessionUser();
  const page = Number(params.page ?? 1) || 1;

  const canCreate = can(user, "create", "equipmentRental");

  const [{ rentals, total, pageSize }, equipmentOptions, clients, coordinators] = await Promise.all([
    listRentals(user, { search: params.q, status: (params.status as never) ?? "ALL", page }),
    canCreate ? listEquipmentForSelect(user, { onlyAvailable: true }) : Promise.resolve([]),
    canCreate ? listClientHierarchyForSelect() : Promise.resolve([]),
    canCreate ? listCoordinators() : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Operations" }, { label: "Rentals" }]}
        title="Equipment Rentals"
        description="Every rental across the fleet — charges, payments, and outstanding."
        actions={
          canCreate && (
            <CreateRentalDialog
              equipmentOptions={equipmentOptions.map((e) => ({
                id: e.id,
                name: e.name,
                serialNumber: e.serialNumber,
                hourlyRate: e.hourlyRate ? Number(e.hourlyRate) : null,
                dailyRate: e.dailyRate ? Number(e.dailyRate) : null,
                weeklyRate: e.weeklyRate ? Number(e.weeklyRate) : null,
                monthlyRate: e.monthlyRate ? Number(e.monthlyRate) : null,
              }))}
              clients={clients}
              coordinators={coordinators}
              trigger={
                <Button>
                  <Plus className="size-4" />
                  New Rental
                </Button>
              }
            />
          )
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput placeholder="Search by equipment, serial number, client, or rental ID…" />
        <SelectFilter
          paramKey="status"
          placeholder="Status"
          options={RENTAL_STATUSES.map((s) => ({ label: s.replaceAll("_", " "), value: s }))}
        />
      </div>

      {rentals.length === 0 ? (
        <EmptyState icon={Wrench} title="No rentals found" description="Try adjusting your search or filters." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rental ID</TableHead>
                  <TableHead>Equipment</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>Expected End</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Outstanding</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rentals.map((rental) => {
                  const total = calculateRentalTotal(rental.charges.map((c) => c.amount.toString()));
                  const outstanding = calculateOutstanding(
                    total,
                    rental.payments.map((p) => p.amount.toString()),
                  );
                  return (
                    <TableRow key={rental.id}>
                      <TableCell className="text-muted-foreground font-mono text-xs">
                        {formatRentalCode(rental.sequenceNo)}
                      </TableCell>
                      <TableCell className="font-medium">
                        <Link href={`/rentals/${rental.id}`} className="hover:underline">
                          {rental.equipment.name}
                        </Link>
                      </TableCell>
                      <TableCell>{rental.client.companyName}</TableCell>
                      <TableCell>{formatDate(rental.startDate)}</TableCell>
                      <TableCell>{formatDate(rental.expectedEndDate)}</TableCell>
                      <TableCell>{formatMoney(total)}</TableCell>
                      <TableCell className={outstanding.toNumber() > 0 ? "text-warning-foreground font-medium" : undefined}>
                        {formatMoney(outstanding)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={rental.status} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <Pagination page={page} pageSize={pageSize} total={total} />
        </>
      )}
    </div>
  );
}
