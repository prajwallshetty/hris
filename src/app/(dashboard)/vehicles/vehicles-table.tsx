"use client";

import { Archive, ArchiveRestore, Pencil } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { archiveVehicle, reactivateVehicle } from "@/server/actions/vehicles";

import { VehicleFormDialog } from "./vehicle-form-dialog";

export type VehicleRow = {
  id: string;
  code: string;
  plateNumber: string;
  makeModel: string;
  vehicleType: string | null;
  currentDriver: string | null;
  coordinatorName: string | null;
  currentMileage: number | null;
  status: string;
  isArchived: boolean;
  editable: {
    id: string;
    plateNumber: string;
    make: string;
    model: string;
    year: number | null;
    color: string | null;
    vehicleType: string | null;
    vin: string | null;
    currentMileage: number | null;
    status: string;
    registrationExpiry: string | null;
    insuranceExpiry: string | null;
    inspectionExpiry: string | null;
    ownerCompany: string | null;
    coordinatorId: string | null;
    notes: string | null;
  };
};

type CoordinatorOption = { id: string; name: string };

export function VehiclesTable({
  rows,
  coordinators,
  canEdit,
  canArchive,
}: {
  rows: VehicleRow[];
  coordinators: CoordinatorOption[];
  canEdit: boolean;
  canArchive: boolean;
}) {
  const router = useRouter();
  const [archiveTarget, setArchiveTarget] = useState<VehicleRow | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);

  async function handleArchiveConfirm() {
    if (!archiveTarget) return;
    setIsArchiving(true);
    try {
      const result = archiveTarget.isArchived
        ? await reactivateVehicle(archiveTarget.id)
        : await archiveVehicle(archiveTarget.id);
      if (result.success) {
        toast.success(archiveTarget.isArchived ? "Vehicle reactivated." : "Vehicle archived.");
        setArchiveTarget(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } finally {
      setIsArchiving(false);
    }
  }

  return (
    <>
      <div className="rounded-lg border">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vehicle ID</TableHead>
                <TableHead>Plate</TableHead>
                <TableHead>Make / Model</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Current Driver</TableHead>
                <TableHead>Coordinator</TableHead>
                <TableHead>Mileage</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((vehicle) => (
                <TableRow key={vehicle.id}>
                  <TableCell className="text-muted-foreground font-mono text-xs">{vehicle.code}</TableCell>
                  <TableCell className="font-medium">
                    <Link href={`/vehicles/${vehicle.id}`} className="hover:underline">
                      {vehicle.plateNumber}
                    </Link>
                  </TableCell>
                  <TableCell>{vehicle.makeModel}</TableCell>
                  <TableCell>{vehicle.vehicleType ?? "—"}</TableCell>
                  <TableCell>{vehicle.currentDriver ?? "—"}</TableCell>
                  <TableCell>{vehicle.coordinatorName ?? "—"}</TableCell>
                  <TableCell>{vehicle.currentMileage != null ? `${vehicle.currentMileage.toLocaleString()} km` : "—"}</TableCell>
                  <TableCell>
                    <StatusBadge status={vehicle.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    {canEdit && (
                      <VehicleFormDialog
                        coordinators={coordinators}
                        vehicle={vehicle.editable}
                        trigger={
                          <Button variant="ghost" size="icon-sm" className="ml-1" aria-label={`Edit ${vehicle.plateNumber}`}>
                            <Pencil className="size-4" />
                          </Button>
                        }
                      />
                    )}
                    {canArchive && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="ml-1"
                        aria-label={vehicle.isArchived ? `Reactivate ${vehicle.plateNumber}` : `Archive ${vehicle.plateNumber}`}
                        onClick={() => setArchiveTarget(vehicle)}
                      >
                        {vehicle.isArchived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <AlertDialog open={archiveTarget != null} onOpenChange={(open) => !open && setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {archiveTarget?.isArchived ? "Reactivate" : "Archive"} {archiveTarget?.plateNumber}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {archiveTarget?.isArchived
                ? "This vehicle becomes visible in active lists again."
                : "This vehicle and its history are kept, but hidden from active lists."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isArchiving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchiveConfirm}
              disabled={isArchiving}
              className={archiveTarget?.isArchived ? undefined : "bg-destructive hover:bg-destructive/90"}
            >
              {isArchiving ? "Please wait…" : archiveTarget?.isArchived ? "Reactivate" : "Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
