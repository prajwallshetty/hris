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
import { archiveEquipment, reactivateEquipment } from "@/server/actions/equipment";

import { EquipmentFormDialog } from "./equipment-form-dialog";

export type EquipmentRow = {
  id: string;
  code: string;
  serialNumber: string;
  name: string;
  category: string | null;
  currentClient: string | null;
  coordinatorName: string | null;
  status: string;
  isArchived: boolean;
  editable: {
    id: string;
    serialNumber: string;
    name: string;
    category: string | null;
    make: string | null;
    model: string | null;
    condition: string | null;
    status: string;
    hourlyRate: number | null;
    dailyRate: number | null;
    weeklyRate: number | null;
    monthlyRate: number | null;
    ownerCompany: string | null;
    coordinatorId: string | null;
    notes: string | null;
  };
};

type CoordinatorOption = { id: string; name: string };

export function EquipmentTable({
  rows,
  coordinators,
  canEdit,
  canArchive,
}: {
  rows: EquipmentRow[];
  coordinators: CoordinatorOption[];
  canEdit: boolean;
  canArchive: boolean;
}) {
  const router = useRouter();
  const [archiveTarget, setArchiveTarget] = useState<EquipmentRow | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);

  async function handleArchiveConfirm() {
    if (!archiveTarget) return;
    setIsArchiving(true);
    try {
      const result = archiveTarget.isArchived
        ? await reactivateEquipment(archiveTarget.id)
        : await archiveEquipment(archiveTarget.id);
      if (result.success) {
        toast.success(archiveTarget.isArchived ? "Equipment reactivated." : "Equipment archived.");
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
                <TableHead>Equipment ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Serial Number</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Current Client</TableHead>
                <TableHead>Coordinator</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-muted-foreground font-mono text-xs">{item.code}</TableCell>
                  <TableCell className="font-medium">
                    <Link href={`/equipment/${item.id}`} className="hover:underline">
                      {item.name}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{item.serialNumber}</TableCell>
                  <TableCell>{item.category ?? "—"}</TableCell>
                  <TableCell>{item.currentClient ?? "—"}</TableCell>
                  <TableCell>{item.coordinatorName ?? "—"}</TableCell>
                  <TableCell>
                    <StatusBadge status={item.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    {canEdit && (
                      <EquipmentFormDialog
                        coordinators={coordinators}
                        equipment={item.editable}
                        trigger={
                          <Button variant="ghost" size="icon-sm" aria-label={`Edit ${item.name}`}>
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
                        aria-label={item.isArchived ? `Reactivate ${item.name}` : `Archive ${item.name}`}
                        onClick={() => setArchiveTarget(item)}
                      >
                        {item.isArchived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
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
              {archiveTarget?.isArchived ? "Reactivate" : "Archive"} {archiveTarget?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {archiveTarget?.isArchived
                ? "This equipment becomes visible in active lists again."
                : "This equipment and its history are kept, but hidden from active lists."}
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
