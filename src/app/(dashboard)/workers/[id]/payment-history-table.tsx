"use client";

import { Download, MoreHorizontal, Receipt, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ReceiptModal } from "@/components/finance/receipt-modal";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { WORKER_PAYMENT_TYPES } from "@/lib/validation/finance";
import { voidWorkerPayment } from "@/server/actions/finance";

export type PaymentHistoryRow = {
  id: string;
  date: Date;
  paymentType: string;
  amount: number;
  method: string;
  payrollPeriodName: string | null;
  payrollId: string | null;
  referenceNumber: string | null;
  /** Remaining balance on the linked payroll after this payment — null when
   * this payment isn't tied to a specific payroll. Already excludes any
   * voided payments from the cumulative sum. */
  balance: number | null;
  voidedAt: Date | null;
  voidReason: string | null;
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(date);
}

function formatMoney(value: number) {
  return `SAR ${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

function toCsv(rows: PaymentHistoryRow[]): string {
  const header = ["Date", "Type", "Description", "Amount", "Method", "Reference", "Balance", "Status"];
  const lines = rows.map((r) =>
    [
      formatDate(r.date),
      r.paymentType,
      r.payrollPeriodName ?? "",
      r.amount.toFixed(2),
      r.method,
      r.referenceNumber ?? "",
      r.balance !== null ? r.balance.toFixed(2) : "",
      r.voidedAt ? "Voided" : "Paid",
    ]
      .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

/** Worker Payment History (§ redesign) — search/type filter, running balance
 * per linked payroll, CSV export, a receipt link per transaction, and a
 * Void action (never a delete — voided rows stay visible, marked, with a
 * compensating entry in the worker ledger). All client-side over the same
 * rows the server already loaded — no extra round trip for filtering. */
export function PaymentHistoryTable({
  workerId,
  workerName,
  workerMobile,
  rows,
  canVoid = false,
}: {
  workerId: string;
  workerName: string;
  workerMobile?: string | null;
  rows: PaymentHistoryRow[];
  canVoid?: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [voidTarget, setVoidTarget] = useState<PaymentHistoryRow | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [isPending, setIsPending] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (typeFilter !== "ALL" && r.paymentType !== typeFilter) return false;
      if (!q) return true;
      return (
        r.paymentType.toLowerCase().includes(q) ||
        (r.payrollPeriodName ?? "").toLowerCase().includes(q) ||
        (r.referenceNumber ?? "").toLowerCase().includes(q) ||
        r.method.toLowerCase().includes(q)
      );
    });
  }, [rows, search, typeFilter]);

  function handleExport() {
    const csv = toCsv(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `worker-${workerId}-payment-history.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleVoidConfirm() {
    if (!voidTarget) return;
    setIsPending(true);
    try {
      const result = await voidWorkerPayment(voidTarget.id, voidReason);
      if (result.success) {
        toast.success("Payment voided.");
        setVoidTarget(null);
        setVoidReason("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } finally {
      setIsPending(false);
    }
  }

  if (rows.length === 0) {
    return <EmptyState icon={Receipt} title="No payments recorded" />;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row">
          <Input
            placeholder="Search by type, period, method, or reference…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:max-w-xs"
          />
          <Select value={typeFilter} onValueChange={(v) => v && setTypeFilter(v)}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All types</SelectItem>
              {WORKER_PAYMENT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="size-4" />
          Export
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Receipt} title="No payments match your search" />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id} className={r.voidedAt ? "opacity-60" : undefined}>
                  <TableCell>{formatDate(r.date)}</TableCell>
                  <TableCell>{r.paymentType}</TableCell>
                  <TableCell>{r.payrollPeriodName ?? "—"}</TableCell>
                  <TableCell className={r.voidedAt ? "font-medium line-through" : "font-medium"}>
                    {formatMoney(r.amount)}
                  </TableCell>
                  <TableCell>{r.method.replaceAll("_", " ")}</TableCell>
                  <TableCell>{r.referenceNumber ?? "—"}</TableCell>
                  <TableCell className={r.balance !== null && r.balance > 0 ? "text-warning-foreground" : undefined}>
                    {r.balance !== null ? formatMoney(r.balance) : "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={r.voidedAt ? "VOIDED" : "PAID"} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {!r.voidedAt && (
                        <ReceiptModal
                          paymentId={r.id}
                          recipientName={workerName}
                          mobileNumber={workerMobile ?? undefined}
                          amount={r.amount}
                          payrollPeriodName={r.payrollPeriodName ?? "Direct Payment"}
                        />
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        render={<Link href={`/workers/${workerId}/payments/${r.id}/receipt`}>View</Link>}
                      />
                      {canVoid && !r.voidedAt && (
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button variant="ghost" size="icon-sm" aria-label="More actions">
                                <MoreHorizontal className="size-4" />
                              </Button>
                            }
                          />
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem variant="destructive" onClick={() => setVoidTarget(r)}>
                              <XCircle className="size-4" />
                              Void Payment
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={voidTarget != null} onOpenChange={(open) => !open && setVoidTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Void Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Voiding {voidTarget ? formatMoney(voidTarget.amount) : ""} will exclude it from the outstanding balance
              and worker ledger going forward. The payment record stays visible for audit purposes — it is never
              deleted.
            </p>
            <Field>
              <FieldLabel htmlFor="voidReason">Reason *</FieldLabel>
              <Textarea id="voidReason" rows={3} value={voidReason} onChange={(e) => setVoidReason(e.target.value)} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setVoidTarget(null)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleVoidConfirm} disabled={isPending || !voidReason.trim()}>
              {isPending ? "Please wait…" : "Void Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
