import { ClipboardList } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { ExportCsvButton } from "@/components/shared/export-csv-button";
import { MonthFilter } from "@/components/shared/month-filter";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { SearchInput } from "@/components/shared/search-input";
import { SelectFilter } from "@/components/shared/select-filter";
import { StatusBadge } from "@/components/shared/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { exportTimesheetLogCsv } from "@/server/actions/timesheets";
import { getTimesheetLogFilterOptions, listTimesheetLog } from "@/server/queries/timesheets";
import { getSessionUser } from "@/server/session";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(date);
}

function formatMoney(value: number) {
  return `SAR ${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export default async function TimesheetLogPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    month?: string;
    clientId?: string;
    siteId?: string;
    coordinatorId?: string;
    status?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const user = await getSessionUser();
  const page = Number(params.page ?? 1) || 1;

  const filters = {
    search: params.q,
    month: params.month,
    clientId: params.clientId,
    siteId: params.siteId,
    coordinatorId: params.coordinatorId,
    status: (params.status as never) ?? "ALL",
  };

  const [{ items, total, pageSize }, filterOptions] = await Promise.all([
    listTimesheetLog(user, { ...filters, page }),
    getTimesheetLogFilterOptions(),
  ]);

  const sites = params.clientId ? filterOptions.sites.filter((s) => s.clientId === params.clientId) : filterOptions.sites;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Workforce" },
          { label: "Timesheets", href: "/timesheets" },
          { label: "LOG" },
        ]}
        title="Timesheets — LOG"
        description="Every worker-day entry across all timesheet batches — filter and export exactly what you need."
        actions={
          <Link href="/timesheets" className="text-muted-foreground text-sm hover:underline">
            ← Batches view
          </Link>
        }
      />

      <div className="bg-card flex flex-col gap-3 rounded-lg border p-3">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput placeholder="Search worker name or Iqama…" />
          <MonthFilter />
          <SelectFilter
            paramKey="clientId"
            placeholder="Client"
            options={filterOptions.clients.map((c) => ({ label: c.companyName, value: c.id }))}
          />
          <SelectFilter paramKey="siteId" placeholder="Site" options={sites.map((s) => ({ label: s.name, value: s.id }))} />
          <SelectFilter
            paramKey="coordinatorId"
            placeholder="Coordinator"
            options={filterOptions.coordinators.map((c) => ({ label: c.name, value: c.id }))}
          />
          <SelectFilter
            paramKey="status"
            placeholder="Status"
            options={[
              { label: "Pending", value: "PENDING" },
              { label: "Approved", value: "APPROVED" },
              { label: "Rejected", value: "REJECTED" },
            ]}
          />
          <ExportCsvButton
            action={exportTimesheetLogCsv.bind(null, filters)}
            filename="timesheet-log.csv"
            label="Export"
          />
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No log entries found" description="Try adjusting your filters." />
      ) : (
        <>
          <div className="rounded-lg border">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Worker</TableHead>
                    <TableHead>Iqama</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead className="text-right">Regular</TableHead>
                    <TableHead className="text-right">OT</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Worker Rate</TableHead>
                    <TableHead className="text-right">PU Rate</TableHead>
                    <TableHead className="text-right">Billing Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const client = item.timesheet.site?.project.client.companyName ?? "—";
                    const site = item.timesheet.site?.name ?? "—";
                    const workerRate = item.assignment?.workerHourlyRate;
                    const puRate = item.assignment?.clientBillingRate;
                    const billingAmount = puRate ? Number(item.totalHours) * Number(puRate) : null;
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="whitespace-nowrap">{formatDate(item.date)}</TableCell>
                        <TableCell>
                          <Link href={`/workers/${item.worker.id}`} className="font-medium hover:underline">
                            {item.worker.fullName}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground font-mono text-xs">{item.iqamaNumber}</TableCell>
                        <TableCell>{client}</TableCell>
                        <TableCell>{site}</TableCell>
                        <TableCell className="text-right tabular-nums">{Number(item.regularHours).toFixed(1)}</TableCell>
                        <TableCell className="text-right tabular-nums">{Number(item.overtimeHours).toFixed(1)}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{Number(item.totalHours).toFixed(1)}</TableCell>
                        <TableCell className="text-right tabular-nums">{workerRate ? formatMoney(Number(workerRate)) : "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{puRate ? formatMoney(Number(puRate)) : "—"}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {billingAmount != null ? formatMoney(billingAmount) : "—"}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={item.status} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <Pagination page={page} pageSize={pageSize} total={total} />
          </div>
        </>
      )}
    </div>
  );
}
