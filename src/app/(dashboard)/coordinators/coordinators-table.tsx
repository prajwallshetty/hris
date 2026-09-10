"use client";

import { Archive, ArchiveRestore, Download, MoreHorizontal, Pencil, UserCog } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
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
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { archiveCoordinator, reactivateCoordinator } from "@/server/actions/coordinators";

import { CoordinatorFormDialog } from "./coordinator-form-dialog";

export type CoordinatorRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  status: "ACTIVE" | "INACTIVE";
  workerCount: number;
  activeAssignmentCount: number;
};

function toCsv(rows: CoordinatorRow[]): string {
  const header = ["Name", "Phone", "Email", "Workers", "Active Assignments", "Status"];
  const lines = rows.map((r) =>
    [r.name, r.phone ?? "", r.email ?? "", r.workerCount, r.activeAssignmentCount, r.status]
      .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

/** List-level toolbar (search/status filter/export) + "…" row action menu —
 * the pattern used consistently across Workers/Users/Assignments, applied
 * here to Coordinators. All client-side over the already-loaded rows since
 * this list is typically small (staff, not thousands of records). Edit and
 * archive/reactivate are driven by local state rather than nesting their
 * dialogs' triggers inside DropdownMenuItem, matching the Workers list
 * pattern — a dialog trigger nested in a menu item can close before the
 * dialog mounts. */
export function CoordinatorsTable({
  rows,
  canEdit,
  canArchive,
}: {
  rows: CoordinatorRow[];
  canEdit: boolean;
  canArchive: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [editTarget, setEditTarget] = useState<CoordinatorRow | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<CoordinatorRow | null>(null);
  const [reactivateTarget, setReactivateTarget] = useState<CoordinatorRow | null>(null);
  const [isPending, setIsPending] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      if (!q) return true;
      return r.name.toLowerCase().includes(q) || (r.phone ?? "").includes(q) || (r.email ?? "").toLowerCase().includes(q);
    });
  }, [rows, search, statusFilter]);

  function handleExport() {
    const csv = toCsv(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "coordinators.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleArchiveConfirm() {
    if (!archiveTarget) return;
    setIsPending(true);
    try {
      const result = await archiveCoordinator(archiveTarget.id);
      if (result.success) {
        toast.success(`${archiveTarget.name} archived.`);
        setArchiveTarget(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } finally {
      setIsPending(false);
    }
  }

  async function handleReactivateConfirm() {
    if (!reactivateTarget) return;
    setIsPending(true);
    try {
      const result = await reactivateCoordinator(reactivateTarget.id);
      if (result.success) {
        toast.success(`${reactivateTarget.name} reactivated.`);
        setReactivateTarget(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } finally {
      setIsPending(false);
    }
  }

  if (rows.length === 0) {
    return <EmptyState icon={UserCog} title="No coordinators yet" description="Add one to assign workers to them." />;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
        <Input
          placeholder="Search by name, phone, or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:max-w-xs"
        />
        <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="INACTIVE">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="ml-auto" onClick={handleExport}>
          <Download className="size-4" />
          Export
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={UserCog} title="No coordinators match your search" />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Workers</TableHead>
                <TableHead>Active Assignments</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    <Link href={`/coordinators/${c.id}`} className="hover:underline">
                      {c.name}
                    </Link>
                  </TableCell>
                  <TableCell>{c.phone ?? "—"}</TableCell>
                  <TableCell>{c.email ?? "—"}</TableCell>
                  <TableCell>{c.workerCount}</TableCell>
                  <TableCell>{c.activeAssignmentCount}</TableCell>
                  <TableCell>
                    <StatusBadge status={c.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${c.name}`}>
                            <MoreHorizontal className="size-4" />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem render={<Link href={`/coordinators/${c.id}`}>View</Link>} />
                        {canEdit && (
                          <DropdownMenuItem onClick={() => setEditTarget(c)}>
                            <Pencil className="size-4" />
                            Edit
                          </DropdownMenuItem>
                        )}
                        {canArchive && c.status === "ACTIVE" && (
                          <DropdownMenuItem variant="destructive" onClick={() => setArchiveTarget(c)}>
                            <Archive className="size-4" />
                            Archive
                          </DropdownMenuItem>
                        )}
                        {canEdit && c.status === "INACTIVE" && (
                          <DropdownMenuItem onClick={() => setReactivateTarget(c)}>
                            <ArchiveRestore className="size-4" />
                            Reactivate
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
      )}

      {editTarget && (
        <CoordinatorFormDialog
          open
          onOpenChange={(open) => !open && setEditTarget(null)}
          coordinatorId={editTarget.id}
          defaultValues={{ name: editTarget.name, phone: editTarget.phone ?? "", email: editTarget.email ?? "" }}
        />
      )}

      <AlertDialog open={archiveTarget != null} onOpenChange={(open) => !open && setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {archiveTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>They&apos;ll be hidden from active pickers but their history stays intact.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchiveConfirm} disabled={isPending} className="bg-destructive hover:bg-destructive/90">
              {isPending ? "Please wait…" : "Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={reactivateTarget != null} onOpenChange={(open) => !open && setReactivateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reactivate {reactivateTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>They&apos;ll become available again in assignment/sale pickers.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReactivateConfirm} disabled={isPending}>
              {isPending ? "Please wait…" : "Reactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
