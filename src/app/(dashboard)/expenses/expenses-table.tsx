"use client";

import { Download, MoreHorizontal, Pencil, Receipt } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { archiveExpense } from "@/server/actions/expenses";

import { ExpenseFormDialog } from "./expense-form-dialog";

export type ExpenseRow = {
  id: string;
  date: string;
  category: string;
  description: string | null;
  amount: number;
  workerId: string | null;
  workerName: string | null;
  clientId: string | null;
  clientName: string | null;
  siteId: string | null;
  siteName: string | null;
  coordinatorId: string | null;
  coordinatorName: string | null;
  department: string | null;
};

type ClientTree = { id: string; companyName: string; projects: { id: string; name: string; sites: { id: string; name: string }[] }[] };
type WorkerOption = { id: string; fullName: string };
type Coordinator = { id: string; name: string };

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(iso));
}

function formatMoney(value: number) {
  return `SAR ${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

function toCsv(rows: ExpenseRow[]): string {
  const header = ["Date", "Category", "Description", "Linked To", "Amount"];
  const lines = rows.map((r) =>
    [
      formatDate(r.date),
      r.category,
      r.description ?? "",
      [r.workerName, r.clientName, r.siteName].filter(Boolean).join(" / "),
      r.amount.toFixed(2),
    ]
      .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

/** Expenses list toolbar (search over the current page + export) plus a
 * "…" row menu (View drawer / Edit / Archive) — the same pattern used for
 * Workers/Coordinators, giving Expenses a real view/edit path instead of
 * list-only. Server-side category filter (SelectFilter) stays on the page
 * above this; search here is client-side over the already-loaded page. */
export function ExpensesTable({
  rows,
  clients,
  workers,
  coordinators,
  canEdit,
  canArchive,
}: {
  rows: ExpenseRow[];
  clients: ClientTree[];
  workers: WorkerOption[];
  coordinators: Coordinator[];
  canEdit: boolean;
  canArchive: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [viewTarget, setViewTarget] = useState<ExpenseRow | null>(null);
  const [editTarget, setEditTarget] = useState<ExpenseRow | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<ExpenseRow | null>(null);
  const [isPending, setIsPending] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.category, r.description, r.workerName, r.clientName, r.siteName, r.coordinatorName, r.department]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q)),
    );
  }, [rows, search]);

  function handleExport() {
    const csv = toCsv(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "expenses.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleArchiveConfirm() {
    if (!archiveTarget) return;
    setIsPending(true);
    try {
      const result = await archiveExpense(archiveTarget.id);
      if (result.success) {
        toast.success("Expense archived.");
        setArchiveTarget(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } finally {
      setIsPending(false);
    }
  }

  if (rows.length === 0) {
    return <EmptyState icon={Receipt} title="No expenses recorded yet" />;
  }

  return (
    <div className="space-y-3">
      <Input
        placeholder="Search by category, description, worker, client, site…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {filtered.length === 0 ? (
        <EmptyState icon={Receipt} title="No expenses match your search" />
      ) : (
        <div className="rounded-lg border">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Linked To</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead className="w-10 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>{formatDate(expense.date)}</TableCell>
                    <TableCell>{expense.category.replaceAll("_", " ")}</TableCell>
                    <TableCell>{expense.description ?? "—"}</TableCell>
                    <TableCell>
                      {[expense.workerName, expense.clientName, expense.siteName].filter(Boolean).join(" / ") || "—"}
                    </TableCell>
                    <TableCell className="font-medium">{formatMoney(expense.amount)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" size="icon-sm" aria-label="Actions">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setViewTarget(expense)}>View</DropdownMenuItem>
                          {canEdit && (
                            <DropdownMenuItem onClick={() => setEditTarget(expense)}>
                              <Pencil className="size-4" />
                              Edit
                            </DropdownMenuItem>
                          )}
                          {canArchive && (
                            <DropdownMenuItem variant="destructive" onClick={() => setArchiveTarget(expense)}>
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
      )}

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="size-4" />
          Export
        </Button>
      </div>

      <Sheet open={viewTarget != null} onOpenChange={(open) => !open && setViewTarget(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Expense Details</SheetTitle>
          </SheetHeader>
          {viewTarget && (
            <div className="space-y-4 p-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase">Amount</p>
                <p className="text-lg font-semibold">{formatMoney(viewTarget.amount)}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-muted-foreground text-xs font-medium uppercase">Date</p>
                  <p>{formatDate(viewTarget.date)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs font-medium uppercase">Category</p>
                  <p>{viewTarget.category.replaceAll("_", " ")}</p>
                </div>
              </div>
              {viewTarget.description && (
                <div>
                  <p className="text-muted-foreground text-xs font-medium uppercase">Description</p>
                  <p>{viewTarget.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-muted-foreground text-xs font-medium uppercase">Worker</p>
                  <p>{viewTarget.workerName ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs font-medium uppercase">Client</p>
                  <p>{viewTarget.clientName ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs font-medium uppercase">Site</p>
                  <p>{viewTarget.siteName ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs font-medium uppercase">Coordinator</p>
                  <p>{viewTarget.coordinatorName ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs font-medium uppercase">Department</p>
                  <p>{viewTarget.department ?? "—"}</p>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {editTarget && (
        <ExpenseFormDialog
          clients={clients}
          workers={workers}
          coordinators={coordinators}
          expenseId={editTarget.id}
          open
          onOpenChange={(open) => !open && setEditTarget(null)}
          defaultValues={{
            category: editTarget.category as never,
            amount: editTarget.amount,
            date: editTarget.date.slice(0, 10),
            description: editTarget.description ?? "",
            workerId: editTarget.workerId ?? "",
            clientId: editTarget.clientId ?? "",
            siteId: editTarget.siteId ?? "",
            coordinatorId: editTarget.coordinatorId ?? "",
            department: editTarget.department ?? "",
          }}
        />
      )}

      <AlertDialog open={archiveTarget != null} onOpenChange={(open) => !open && setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this expense?</AlertDialogTitle>
            <AlertDialogDescription>It will no longer count toward profitability calculations.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchiveConfirm} disabled={isPending} className="bg-destructive hover:bg-destructive/90">
              {isPending ? "Please wait…" : "Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
