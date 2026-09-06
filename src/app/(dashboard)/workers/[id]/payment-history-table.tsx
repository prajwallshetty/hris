"use client";

import { Download, Receipt } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { WORKER_PAYMENT_TYPES } from "@/lib/validation/finance";

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
   * this payment isn't tied to a specific payroll. */
  balance: number | null;
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(date);
}

function formatMoney(value: number) {
  return `SAR ${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

function toCsv(rows: PaymentHistoryRow[]): string {
  const header = ["Date", "Type", "Description", "Amount", "Method", "Reference", "Balance"];
  const lines = rows.map((r) =>
    [
      formatDate(r.date),
      r.paymentType,
      r.payrollPeriodName ?? "",
      r.amount.toFixed(2),
      r.method,
      r.referenceNumber ?? "",
      r.balance !== null ? r.balance.toFixed(2) : "",
    ]
      .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

/** Worker Payment History (§ redesign) — search/type filter, running balance
 * per linked payroll, CSV export, and a receipt link per transaction. All
 * client-side over the same rows the server already loaded — no extra
 * round trip for filtering. */
export function PaymentHistoryTable({ workerId, rows }: { workerId: string; rows: PaymentHistoryRow[] }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");

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
                <TableHead className="text-right">Receipt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{formatDate(r.date)}</TableCell>
                  <TableCell>{r.paymentType}</TableCell>
                  <TableCell>{r.payrollPeriodName ?? "—"}</TableCell>
                  <TableCell className="font-medium">{formatMoney(r.amount)}</TableCell>
                  <TableCell>{r.method.replaceAll("_", " ")}</TableCell>
                  <TableCell>{r.referenceNumber ?? "—"}</TableCell>
                  <TableCell className={r.balance !== null && r.balance > 0 ? "text-warning-foreground" : undefined}>
                    {r.balance !== null ? formatMoney(r.balance) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      render={<Link href={`/workers/${workerId}/payments/${r.id}/receipt`}>View</Link>}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
