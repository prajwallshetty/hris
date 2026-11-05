"use client";

import { Archive, ArchiveRestore, MapPin, MoreHorizontal, Pencil } from "lucide-react";
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
import { archiveProject, reactivateProject } from "@/server/actions/clients";

import { AddProjectDialog } from "../clients/project-site-dialogs";

export type ProjectRow = {
  id: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
  clientId: string;
  clientName: string;
  coordinatorId: string | null;
  coordinatorName: string | null;
  siteCount: number;
  activeWorkerCount: number;
};

/** Standalone cross-client Projects overview — the Quick Access shortcut's
 * destination. Reuses the same AddProjectDialog (create/edit + coordinator
 * assignment) and archiveProject/reactivateProject server actions as the
 * per-client "Projects & Sites" tab, so there is exactly one project data
 * model and one set of mutations behind both surfaces. "View Sites" links
 * back into that per-client tab for site-level management rather than
 * duplicating it here. */
export function ProjectsTable({ rows, canEdit, canArchive }: { rows: ProjectRow[]; canEdit: boolean; canArchive: boolean }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [editTarget, setEditTarget] = useState<ProjectRow | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<ProjectRow | null>(null);
  const [reactivateTarget, setReactivateTarget] = useState<ProjectRow | null>(null);
  const [isPending, setIsPending] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.clientName.toLowerCase().includes(q) ||
        (r.coordinatorName ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, statusFilter]);

  async function handleArchiveConfirm() {
    if (!archiveTarget) return;
    setIsPending(true);
    try {
      const result = await archiveProject(archiveTarget.id);
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
      const result = await reactivateProject(reactivateTarget.id);
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
    return <EmptyState icon={MapPin} title="No projects yet" description="Add a project to a client to get started." />;
  }

  return (
    <div className="space-y-3">
      <div className="data-panel flex flex-wrap items-center gap-2 p-2">
        <Input
          placeholder="Search by project, client, or coordinator…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:max-w-xs"
        />
        <Select
          value={statusFilter}
          onValueChange={(v) => v && setStatusFilter(v)}
          items={[
            { value: "ALL", label: "All statuses" },
            { value: "ACTIVE", label: "Active" },
            { value: "INACTIVE", label: "Inactive" },
          ]}
        >
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="INACTIVE">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={MapPin} title="No projects match your search" />
      ) : (
        <div className="data-panel overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Coordinator</TableHead>
                <TableHead>Sites</TableHead>
                <TableHead>Active Workers</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    <Link href={`/clients/${p.clientId}?tab=sites`} className="hover:underline">
                      {p.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/clients/${p.clientId}`} className="hover:underline">
                      {p.clientName}
                    </Link>
                  </TableCell>
                  <TableCell>{p.coordinatorName ?? "Unassigned"}</TableCell>
                  <TableCell>{p.siteCount}</TableCell>
                  <TableCell>{p.activeWorkerCount}</TableCell>
                  <TableCell>
                    <StatusBadge status={p.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${p.name}`}>
                            <MoreHorizontal className="size-4" />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem render={<Link href={`/clients/${p.clientId}?tab=sites`} />}>
                          View Sites
                        </DropdownMenuItem>
                        {canEdit && (
                          <DropdownMenuItem onClick={() => setEditTarget(p)}>
                            <Pencil className="size-4" />
                            Edit
                          </DropdownMenuItem>
                        )}
                        {canArchive && p.status === "ACTIVE" && (
                          <DropdownMenuItem variant="destructive" onClick={() => setArchiveTarget(p)}>
                            <Archive className="size-4" />
                            Archive
                          </DropdownMenuItem>
                        )}
                        {canEdit && p.status === "INACTIVE" && (
                          <DropdownMenuItem onClick={() => setReactivateTarget(p)}>
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
        <AddProjectDialog
          open
          onOpenChange={(open) => !open && setEditTarget(null)}
          clientId={editTarget.clientId}
          projectId={editTarget.id}
          defaultValues={{
            clientId: editTarget.clientId,
            name: editTarget.name,
            status: editTarget.status,
            coordinatorId: editTarget.coordinatorId ?? "",
          }}
        />
      )}

      <AlertDialog open={archiveTarget != null} onOpenChange={(open) => !open && setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {archiveTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Its sites stay attached but the project is hidden from active pickers. History is preserved.
            </AlertDialogDescription>
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
            <AlertDialogDescription>It&apos;ll become available again for adding assignments and sites.</AlertDialogDescription>
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
