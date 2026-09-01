"use client";

import { Archive, Eye, MoreHorizontal, Pencil } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmActionButton } from "@/components/shared/confirm-action-button";
import { archiveWorker, bulkArchiveWorkers } from "@/server/actions/workers";

export type WorkerRow = {
  id: string;
  code: string;
  fullName: string;
  iqamaNumber: string;
  designationTitle: string | null;
  clientName: string | null;
  siteName: string | null;
  coordinatorName: string | null;
  hourlyRate: number | null;
  status: string;
};

export function WorkersTable({
  rows,
  canBulkArchive,
  canEdit = canBulkArchive,
}: {
  rows: WorkerRow[];
  canBulkArchive: boolean;
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [archiveTarget, setArchiveTarget] = useState<WorkerRow | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [, startTransition] = useTransition();

  async function handleRowArchive() {
    if (!archiveTarget) return;
    setIsArchiving(true);
    try {
      const result = await archiveWorker(archiveTarget.id);
      if (result.success) {
        toast.success(`${archiveTarget.fullName} archived.`);
        setArchiveTarget(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } finally {
      setIsArchiving(false);
    }
  }

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const someSelected = selected.size > 0;

  const selectedIds = useMemo(() => Array.from(selected), [selected]);

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(rows.map((r) => r.id)) : new Set());
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function handleBulkArchive() {
    const result = await bulkArchiveWorkers(selectedIds);
    if (result.success) {
      toast.success(`Archived ${result.data.count} worker(s).`);
      setSelected(new Set());
      startTransition(() => router.refresh());
    } else {
      toast.error(result.error);
    }
    return result;
  }

  return (
    <div className="space-y-2">
      {canBulkArchive && someSelected && (
        <div className="bg-muted flex items-center justify-between rounded-lg border px-4 py-2">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <ConfirmActionButton
            trigger={
              <Button variant="outline" size="sm">
                Archive selected
              </Button>
            }
            title={`Archive ${selected.size} worker(s)?`}
            description="These workers and their history are kept, but hidden from active lists."
            confirmLabel="Archive"
            variant="destructive"
            action={handleBulkArchive}
          />
        </div>
      )}
      <div className="rounded-lg border">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {canBulkArchive && (
                  <TableHead className="w-10">
                    <Checkbox checked={allSelected} onCheckedChange={(checked) => toggleAll(checked)} />
                  </TableHead>
                )}
                <TableHead>Worker ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Iqama Number</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Site</TableHead>
                <TableHead>Coordinator</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((worker) => (
                <TableRow key={worker.id}>
                  {canBulkArchive && (
                    <TableCell>
                      <Checkbox
                        checked={selected.has(worker.id)}
                        onCheckedChange={(checked) => toggleOne(worker.id, checked)}
                      />
                    </TableCell>
                  )}
                  <TableCell className="text-muted-foreground font-mono text-xs">{worker.code}</TableCell>
                  <TableCell className="font-medium">
                    <Link href={`/workers/${worker.id}`} className="hover:underline">
                      {worker.fullName}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{worker.iqamaNumber}</TableCell>
                  <TableCell>{worker.designationTitle ?? "—"}</TableCell>
                  <TableCell>{worker.clientName ?? "—"}</TableCell>
                  <TableCell>{worker.siteName ?? "—"}</TableCell>
                  <TableCell>{worker.coordinatorName ?? "—"}</TableCell>
                  <TableCell>{worker.hourlyRate != null ? `SAR ${worker.hourlyRate.toFixed(2)}` : "—"}</TableCell>
                  <TableCell>
                    <StatusBadge status={worker.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${worker.fullName}`}>
                            <MoreHorizontal className="size-4" />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          render={
                            <Link href={`/workers/${worker.id}`}>
                              <Eye className="size-4" />
                              View
                            </Link>
                          }
                        />
                        {canEdit && (
                          <DropdownMenuItem
                            render={
                              <Link href={`/workers/${worker.id}/edit`}>
                                <Pencil className="size-4" />
                                Edit
                              </Link>
                            }
                          />
                        )}
                        {canBulkArchive && worker.status !== "TERMINATED" && (
                          <DropdownMenuItem variant="destructive" onClick={() => setArchiveTarget(worker)}>
                            <Archive className="size-4" />
                            Archive
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
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
            <AlertDialogTitle>Archive {archiveTarget?.fullName}?</AlertDialogTitle>
            <AlertDialogDescription>
              This worker and their history are kept, but hidden from active lists.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isArchiving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRowArchive} disabled={isArchiving} className="bg-destructive hover:bg-destructive/90">
              {isArchiving ? "Please wait…" : "Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
