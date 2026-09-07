"use client";

import { Download, Printer, Wallet } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { WorkerLedgerType } from "@/server/queries/worker-ledger";

export type LedgerRow = {
  id: string;
  date: string; // ISO — serialized from the server component
  type: WorkerLedgerType;
  description: string;
  debit: number;
  credit: number;
  reference: string | null;
  payrollPeriodId: string | null;
  payrollPeriodName: string | null;
  clientId: string | null;
  clientName: string | null;
  siteId: string | null;
  siteName: string | null;
  balance: number;
};

const TYPE_LABEL: Record<WorkerLedgerType, string> = {
  SALARY_PAYABLE: "Salary Payable",
  SALARY_PAYMENT: "Salary Payment",
  ADVANCE_ISSUED: "Advance Issued",
  ADVANCE_RECOVERY: "Advance Recovery",
  LOAN_ISSUED: "Loan Issued",
  LOAN_RECOVERY: "Loan Deduction",
  BONUS: "Bonus",
  DEDUCTION: "Deduction",
  CORRECTION: "Correction",
  RECURRING_CHARGE: "Rent / Other Charge",
  FINAL_SETTLEMENT: "Final Settlement",
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(iso));
}

function formatMoney(value: number) {
  return `SAR ${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

function toCsv(rows: LedgerRow[]): string {
  const header = ["Date", "Type", "Description", "Debit", "Credit", "Reference", "Payroll Period", "Client", "Site", "Balance"];
  const lines = rows.map((r) =>
    [
      formatDate(r.date),
      TYPE_LABEL[r.type],
      r.description,
      r.debit ? r.debit.toFixed(2) : "",
      r.credit ? r.credit.toFixed(2) : "",
      r.reference ?? "",
      r.payrollPeriodName ?? "",
      r.clientName ?? "",
      r.siteName ?? "",
      r.balance.toFixed(2),
    ]
      .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

/** Worker Personal Ledger (§ VERY IMPORTANT) — one chronological,
 * transaction-based view over every financial event for this worker, with
 * a running balance computed server-side from the transactions themselves
 * (never a stored/editable field). Filtering here is purely client-side
 * over the already-loaded rows — no separate query per filter change. */
export function LedgerTable({ workerId, rows }: { workerId: string; rows: LedgerRow[] }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [periodFilter, setPeriodFilter] = useState<string>("ALL");
  const [clientFilter, setClientFilter] = useState<string>("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const periods = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) if (r.payrollPeriodId) map.set(r.payrollPeriodId, r.payrollPeriodName ?? r.payrollPeriodId);
    return [...map.entries()];
  }, [rows]);

  const clients = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) if (r.clientId) map.set(r.clientId, r.clientName ?? r.clientId);
    return [...map.entries()];
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom).getTime() : null;
    const to = dateTo ? new Date(dateTo).getTime() : null;
    return rows.filter((r) => {
      if (typeFilter !== "ALL" && r.type !== typeFilter) return false;
      if (periodFilter !== "ALL" && r.payrollPeriodId !== periodFilter) return false;
      if (clientFilter !== "ALL" && r.clientId !== clientFilter) return false;
      const t = new Date(r.date).getTime();
      if (from !== null && t < from) return false;
      if (to !== null && t > to) return false;
      if (!q) return true;
      return (
        r.description.toLowerCase().includes(q) ||
        TYPE_LABEL[r.type].toLowerCase().includes(q) ||
        (r.reference ?? "").toLowerCase().includes(q) ||
        (r.payrollPeriodName ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, typeFilter, periodFilter, clientFilter, dateFrom, dateTo]);

  function handleExport() {
    const csv = toCsv(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `worker-${workerId}-ledger.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (rows.length === 0) {
    return <EmptyState icon={Wallet} title="No ledger transactions yet" description="Salary, payments, advances, loans, and charges will appear here as they occur." />;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
        <Input
          placeholder="Search description, type, reference…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-56"
        />
        <Select value={typeFilter} onValueChange={(v) => v && setTypeFilter(v)}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All types</SelectItem>
            {Object.entries(TYPE_LABEL).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {periods.length > 0 && (
          <Select value={periodFilter} onValueChange={(v) => v && setPeriodFilter(v)}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Payroll period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All periods</SelectItem>
              {periods.map(([id, name]) => (
                <SelectItem key={id} value={id}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {clients.length > 0 && (
          <Select value={clientFilter} onValueChange={(v) => v && setClientFilter(v)}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All clients</SelectItem>
              {clients.map(([id, name]) => (
                <SelectItem key={id} value={id}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full sm:w-40" aria-label="From date" />
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full sm:w-40" aria-label="To date" />
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="size-4" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" render={<Link href={`/workers/${workerId}/ledger`} target="_blank" />}>
            <Printer className="size-4" />
            Print / PDF
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Wallet} title="No transactions match your filters" />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Client / Site</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">{formatDate(r.date)}</TableCell>
                  <TableCell className="whitespace-nowrap">{TYPE_LABEL[r.type]}</TableCell>
                  <TableCell>{r.description}</TableCell>
                  <TableCell className="text-muted-foreground">{r.reference ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.clientName ? `${r.clientName}${r.siteName ? ` / ${r.siteName}` : ""}` : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.debit ? formatMoney(r.debit) : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.credit ? formatMoney(r.credit) : "—"}</TableCell>
                  <TableCell className={`text-right font-medium tabular-nums ${r.balance > 0 ? "text-warning-foreground" : ""}`}>
                    {formatMoney(r.balance)}
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
