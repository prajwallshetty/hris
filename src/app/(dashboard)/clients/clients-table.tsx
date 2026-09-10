"use client";

import { Archive, ArchiveRestore, Building2, Download, MoreHorizontal, Pencil } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toCsv } from "@/lib/csv";
import { archiveClient, reactivateClient } from "@/server/actions/clients";

import { ClientFormDialog } from "./client-form-dialog";

export type ClientRow = {
  id: string;
  companyName: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  contractRef: string | null;
  paymentTerms: string | null;
  billingTerms: string | null;
  status: "ACTIVE" | "INACTIVE";
  deletedAt: Date | null;
  activeWorkers: number;
  projects: number;
  revenue: number | null;
  outstanding: number | null;
  profit: number | null;
};

function formatMoney(value: number) {
  return `SAR ${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/** List-level toolbar (search/status+archived filter/export) + "…" row action
 * menu — the pattern used consistently across Workers/Coordinators/Users,
 * applied here to Clients. All client-side over the already-loaded rows
 * (companies, not a high-volume list). Archived clients stay visible
 * (grayed, with a Reactivate action) rather than disappearing — archiving
 * must never make a record unrecoverable through the UI. */
export function ClientsTable({
  rows,
  canEdit,
  canArchive,
  showFinancials,
}: {
  rows: ClientRow[];
  canEdit: boolean;
  canArchive: boolean;
  showFinancials: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [editTarget, setEditTarget] = useState<ClientRow | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<ClientRow | null>(null);
  const [reactivateTarget, setReactivateTarget] = useState<ClientRow | null>(null);
  const [isPending, setIsPending] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter === "ARCHIVED" && !r.deletedAt) return false;
      if (statusFilter !== "ALL" && statusFilter !== "ARCHIVED" && (r.status !== statusFilter || r.deletedAt)) return false;
      if (!q) return true;
      return (
        r.companyName.toLowerCase().includes(q) ||
        (r.contactPerson ?? "").toLowerCase().includes(q) ||
        (r.phone ?? "").includes(q) ||
        (r.email ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, statusFilter]);

  function handleExport() {
    const csv = toCsv(
      [
        "Company Name",
        "Contact Person",
        "Phone",
        "Email",
        "Active Workers",
        "Projects",
        ...(showFinancials ? ["Revenue", "Outstanding", "Profit"] : []),
        "Status",
        "Archived",
      ],
      filtered.map((c) => [
        c.companyName,
        c.contactPerson ?? "",
        c.phone ?? "",
        c.email ?? "",
        c.activeWorkers,
        c.projects,
        ...(showFinancials ? [c.revenue ?? "", c.outstanding ?? "", c.profit ?? ""] : []),
        c.status,
        c.deletedAt ? "Yes" : "No",
      ]),
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "clients.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleArchiveConfirm() {
    if (!archiveTarget) return;
    setIsPending(true);
    try {
      const result = await archiveClient(archiveTarget.id);
      if (result.success) {
        toast.success(`${archiveTarget.companyName} archived.`);
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
      const result = await reactivateClient(reactivateTarget.id);
      if (result.success) {
        toast.success(`${reactivateTarget.companyName} reactivated.`);
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
    return <EmptyState icon={Building2} title="No clients found" description="Add a client to get started." />;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
        <Input
          placeholder="Search by company, contact, phone, or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:max-w-xs"
        />
        <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="INACTIVE">Inactive</SelectItem>
            <SelectItem value="ARCHIVED">Archived</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="ml-auto" onClick={handleExport}>
          <Download className="size-4" />
          Export
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Building2} title="No clients match your search" />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Active Workers</TableHead>
                <TableHead>Projects</TableHead>
                {showFinancials && (
                  <>
                    <TableHead>Revenue</TableHead>
                    <TableHead>Outstanding</TableHead>
                    <TableHead>Profit</TableHead>
                  </>
                )}
                <TableHead>Status</TableHead>
                <TableHead className="w-10 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((client) => (
                <TableRow key={client.id} className={client.deletedAt ? "opacity-60" : undefined}>
                  <TableCell>
                    <Link href={`/clients/${client.id}`} className="font-medium hover:underline">
                      {client.companyName}
                    </Link>
                    {client.contactPerson && <p className="text-muted-foreground text-xs">{client.contactPerson}</p>}
                  </TableCell>
                  <TableCell>{client.activeWorkers}</TableCell>
                  <TableCell>{client.projects}</TableCell>
                  {showFinancials && (
                    <>
                      <TableCell>{client.revenue != null ? formatMoney(client.revenue) : "—"}</TableCell>
                      <TableCell className={client.outstanding && client.outstanding > 0 ? "text-warning-foreground" : undefined}>
                        {client.outstanding != null ? formatMoney(client.outstanding) : "—"}
                      </TableCell>
                      <TableCell className="font-medium">{client.profit != null ? formatMoney(client.profit) : "—"}</TableCell>
                    </>
                  )}
                  <TableCell>
                    {client.deletedAt ? <Badge variant="secondary">Archived</Badge> : <StatusBadge status={client.status} />}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${client.companyName}`}>
                            <MoreHorizontal className="size-4" />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem render={<Link href={`/clients/${client.id}`}>View</Link>} />
                        {canEdit && !client.deletedAt && (
                          <DropdownMenuItem onSelect={(e) => e.preventDefault()} onClick={() => setEditTarget(client)}>
                            <Pencil className="size-4" />
                            Edit
                          </DropdownMenuItem>
                        )}
                        {canArchive && !client.deletedAt && (
                          <DropdownMenuItem variant="destructive" onClick={() => setArchiveTarget(client)}>
                            <Archive className="size-4" />
                            Archive
                          </DropdownMenuItem>
                        )}
                        {canEdit && client.deletedAt && (
                          <DropdownMenuItem onClick={() => setReactivateTarget(client)}>
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
        <ClientFormDialog
          open
          onOpenChange={(open) => !open && setEditTarget(null)}
          clientId={editTarget.id}
          defaultValues={{
            companyName: editTarget.companyName,
            contactPerson: editTarget.contactPerson ?? "",
            phone: editTarget.phone ?? "",
            email: editTarget.email ?? "",
            address: editTarget.address ?? "",
            contractRef: editTarget.contractRef ?? "",
            paymentTerms: editTarget.paymentTerms ?? "",
            billingTerms: editTarget.billingTerms ?? "",
            status: editTarget.status,
          }}
        />
      )}

      <AlertDialog open={archiveTarget != null} onOpenChange={(open) => !open && setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {archiveTarget?.companyName}?</AlertDialogTitle>
            <AlertDialogDescription>
              They&apos;ll be hidden from active pickers but their projects, invoices, and history stay intact and
              recoverable.
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
            <AlertDialogTitle>Reactivate {reactivateTarget?.companyName}?</AlertDialogTitle>
            <AlertDialogDescription>They&apos;ll become available again in active pickers and lists.</AlertDialogDescription>
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
