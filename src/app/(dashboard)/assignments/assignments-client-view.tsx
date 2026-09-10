"use client";

import {
  ArrowUpDown,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  ClockAlert,
  Columns,
  Download,
  Filter,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  UserCheck,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmActionButton } from "@/components/shared/confirm-action-button";
import { EmptyState } from "@/components/shared/empty-state";
import { KpiCard } from "@/components/shared/kpi-card";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { bulkEndAssignments, endAssignment } from "@/server/actions/assignments";
import type { AssignmentSortField, getAssignmentDetail, listAssignments } from "@/server/queries/assignments";

import { AssignmentDetailDrawer } from "./assignment-detail-drawer";
import { AssignmentFormDialog } from "./assignment-form";

type ClientTree = {
  id: string;
  companyName: string;
  projects: { id: string; name: string; sites: { id: string; name: string }[] }[];
};

type WorkerOption = { id: string; fullName: string; iqamaNumber: string; hourlyRate?: number | null };
type CoordinatorOption = { id: string; name: string };

// Derived directly from the query's actual return shape (not hand-typed)
// so this view can never silently drift out of sync with what the server
// component passes down.
type AssignmentRecord = Awaited<ReturnType<typeof listAssignments>>["assignments"][number];
type AssignmentDetail = Awaited<ReturnType<typeof getAssignmentDetail>>;

type AssignmentStats = {
  total: number;
  active: number;
  scheduled: number;
  endingSoon: number;
  ended: number;
};

function formatDate(date: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(date));
}

function formatMoney(value: unknown) {
  const num = Number(value || 0);
  return `SAR ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function AssignmentsClientView({
  assignments,
  total,
  page,
  pageSize,
  stats,
  clients,
  coordinators,
  workers,
  canCreate,
  canEnd,
  detailData,
}: {
  assignments: AssignmentRecord[];
  total: number;
  page: number;
  pageSize: number;
  stats: AssignmentStats;
  clients: ClientTree[];
  coordinators: CoordinatorOption[];
  workers: WorkerOption[];
  canCreate: boolean;
  canEnd: boolean;
  detailData: AssignmentDetail;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // State for selected rows (bulk actions)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // State for column visibility
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    worker: true,
    iqama: true,
    client: true,
    project: true,
    site: true,
    coordinator: true,
    workerRate: true,
    clientRate: true,
    margin: true,
    startDate: true,
    endDate: true,
    status: true,
    actions: true,
  });

  // State for filter popover & inputs
  const currentSearch = searchParams.get("q") || "";
  const currentStatus = searchParams.get("status") || "ALL";
  const currentClient = searchParams.get("client") || "";
  const currentProject = searchParams.get("project") || "";
  const currentSite = searchParams.get("site") || "";
  const currentCoordinator = searchParams.get("coordinator") || "";
  const currentFrom = searchParams.get("from") || "";
  const currentTo = searchParams.get("to") || "";
  const currentSortBy = (searchParams.get("sort") as AssignmentSortField) || "startDate";
  const currentSortOrder = (searchParams.get("order") as "asc" | "desc") || "desc";

  // Quick helper to update URL search params without page jump
  const updateQueryParams = (updates: Record<string, string | null | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, val]) => {
      if (val === null || val === undefined || val === "" || val === "ALL") {
        params.delete(key);
      } else {
        params.set(key, val);
      }
    });
    // Reset to page 1 on filter changes unless changing page directly
    if (!("page" in updates)) {
      params.set("page", "1");
    }
    startTransition(() => {
      router.push(`/assignments?${params.toString()}`);
    });
  };

  const handleSort = (field: AssignmentSortField) => {
    let order: "asc" | "desc" = "asc";
    if (currentSortBy === field && currentSortOrder === "asc") {
      order = "desc";
    }
    updateQueryParams({ sort: field, order });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(assignments.map((a) => a.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((i) => i !== id));
    }
  };

  const handleBulkEnd = async () => {
    if (!selectedIds.length) return;
    const res = await bulkEndAssignments(selectedIds);
    if (res.success) {
      toast.success(`Ended ${res.data.count} assignments.`);
      setSelectedIds([]);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  };

  const handleExportCsv = () => {
    const params = new URLSearchParams(searchParams.toString());
    window.open(`/api/assignments/export?${params.toString()}`, "_blank");
  };

  const clearAllFilters = () => {
    startTransition(() => {
      router.push("/assignments");
    });
  };

  const activeFilterCount = [
    currentSearch,
    currentClient,
    currentProject,
    currentSite,
    currentCoordinator,
    currentFrom,
    currentTo,
  ].filter(Boolean).length;

  const isAllSelected = assignments.length > 0 && selectedIds.length === assignments.length;
  const isSomeSelected = selectedIds.length > 0 && selectedIds.length < assignments.length;

  return (
    <div className="space-y-6">
      {/* 1. Page Header with Breadcrumbs & Global Actions */}
      <PageHeader
        breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Workforce" }, { label: "Assignments" }]}
        title="Deployments & Site Assignments"
        description="Enterprise worker site deployments, rate agreements, billing margins, and assignment history."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCsv}>
              <Download className="size-4" />
              Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                startTransition(() => {
                  router.refresh();
                });
              }}
              disabled={isPending}
            >
              <RefreshCw className={`size-4 ${isPending ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            {canCreate && (
              <AssignmentFormDialog
                clients={clients}
                coordinators={coordinators}
                workers={workers}
                trigger={
                  <Button size="sm">
                    <Plus className="size-4" />
                    New Assignment
                  </Button>
                }
              />
            )}
          </div>
        }
      />

      {/* 2. KPI Summary Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <button
          type="button"
          onClick={() => updateQueryParams({ status: "ALL" })}
          className="text-left focus:outline-none"
        >
          <KpiCard
            label="Total Assignments"
            value={stats.total.toLocaleString()}
            icon={ClipboardList}
            description="All recorded deployments"
            className={currentStatus === "ALL" ? "ring-2 ring-primary border-primary" : ""}
          />
        </button>

        <button
          type="button"
          onClick={() => updateQueryParams({ status: "ACTIVE" })}
          className="text-left focus:outline-none"
        >
          <KpiCard
            label="Active Deployments"
            value={stats.active.toLocaleString()}
            icon={UserCheck}
            trend={{ direction: "up", value: `${stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}% of total`, tone: "positive" }}
            className={currentStatus === "ACTIVE" ? "ring-2 ring-success border-success" : ""}
          />
        </button>

        <button
          type="button"
          onClick={() => updateQueryParams({ status: "SCHEDULED" })}
          className="text-left focus:outline-none"
        >
          <KpiCard
            label="Scheduled"
            value={stats.scheduled.toLocaleString()}
            icon={Calendar}
            description="Future start dates"
            className={currentStatus === "SCHEDULED" ? "ring-2 ring-info border-info" : ""}
          />
        </button>

        <button
          type="button"
          onClick={() => updateQueryParams({ status: "ENDING_SOON" })}
          className="text-left focus:outline-none"
        >
          <KpiCard
            label="Ending Soon"
            value={stats.endingSoon.toLocaleString()}
            icon={ClockAlert}
            description="Ending in next 30 days"
            className={currentStatus === "ENDING_SOON" ? "ring-2 ring-warning border-warning" : ""}
          />
        </button>

        <button
          type="button"
          onClick={() => updateQueryParams({ status: "ENDED" })}
          className="text-left focus:outline-none"
        >
          <KpiCard
            label="Ended / Historical"
            value={stats.ended.toLocaleString()}
            icon={CheckCircle2}
            description="Demobilized or moved"
            className={currentStatus === "ENDED" ? "ring-2 ring-muted border-muted" : ""}
          />
        </button>
      </div>

      {/* 3. Filter Toolbar & Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        {/* Quick View Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto p-1 bg-muted/40 rounded-lg border text-xs font-medium">
          {[
            { label: "All", value: "ALL" },
            { label: "Active", value: "ACTIVE" },
            { label: "Scheduled", value: "SCHEDULED" },
            { label: "Ending Soon", value: "ENDING_SOON" },
            { label: "Ended", value: "ENDED" },
          ].map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => updateQueryParams({ status: tab.value })}
              className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${
                currentStatus === tab.value
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search, Filter Popover, Column Toggle */}
        <div className="flex items-center gap-2">
          {/* Global Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search Worker, Iqama, Client..."
              value={currentSearch}
              onChange={(e) => updateQueryParams({ q: e.target.value })}
              className="pl-9 h-9 text-xs"
            />
            {currentSearch && (
              <button
                type="button"
                onClick={() => updateQueryParams({ q: "" })}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          {/* Advanced Filter Popover */}
          <Popover>
            <PopoverTrigger render={
              <Button variant="outline" size="sm" className="h-9 relative">
                <Filter className="size-3.5" />
                Filter
                {activeFilterCount > 0 && (
                  <span className="ml-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold size-4 flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            } />
            <PopoverContent className="w-80 p-4 space-y-4" align="end">
              <div className="flex items-center justify-between border-b pb-2">
                <h4 className="text-xs font-semibold">Filter Assignments</h4>
                {activeFilterCount > 0 && (
                  <Button variant="ghost" size="xs" onClick={clearAllFilters} className="text-destructive text-[11px]">
                    Reset all
                  </Button>
                )}
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-muted-foreground font-medium block mb-1">Client</label>
                  <Select
                    value={currentClient || "ALL"}
                    onValueChange={(v) => updateQueryParams({ client: v === "ALL" ? "" : v, project: "", site: "" })}
                  >
                    <SelectTrigger className="w-full h-8 text-xs">
                      <SelectValue placeholder="All Clients" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Clients</SelectItem>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.companyName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-muted-foreground font-medium block mb-1">Coordinator</label>
                  <Select
                    value={currentCoordinator || "ALL"}
                    onValueChange={(v) => updateQueryParams({ coordinator: v === "ALL" ? "" : v })}
                  >
                    <SelectTrigger className="w-full h-8 text-xs">
                      <SelectValue placeholder="All Coordinators" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Coordinators</SelectItem>
                      {coordinators.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-muted-foreground font-medium block mb-1">Start Date From</label>
                    <Input
                      type="date"
                      value={currentFrom}
                      onChange={(e) => updateQueryParams({ from: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-muted-foreground font-medium block mb-1">Start Date To</label>
                    <Input
                      type="date"
                      value={currentTo}
                      onChange={(e) => updateQueryParams({ to: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Column Visibility Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger render={
              <Button variant="outline" size="sm" className="h-9">
                <Columns className="size-3.5" />
                Columns
              </Button>
            } />
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="text-xs">Toggle Columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {Object.keys(visibleColumns).map((col) => (
                <DropdownMenuCheckboxItem
                  key={col}
                  checked={visibleColumns[col]}
                  onCheckedChange={(checked) => setVisibleColumns((prev) => ({ ...prev, [col]: !!checked }))}
                  className="text-xs capitalize"
                >
                  {col.replace(/([A-Z])/g, " $1")}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Active Filter Chips Bar */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="text-muted-foreground font-medium">Active filters:</span>
          {currentSearch && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              Search: {currentSearch}
              <button type="button" onClick={() => updateQueryParams({ q: "" })}>
                <X className="size-3" />
              </button>
            </span>
          )}
          {currentClient && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              Client: {clients.find((c) => c.id === currentClient)?.companyName}
              <button type="button" onClick={() => updateQueryParams({ client: "" })}>
                <X className="size-3" />
              </button>
            </span>
          )}
          {currentCoordinator && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              Coordinator: {coordinators.find((c) => c.id === currentCoordinator)?.name}
              <button type="button" onClick={() => updateQueryParams({ coordinator: "" })}>
                <X className="size-3" />
              </button>
            </span>
          )}
          <Button variant="ghost" size="xs" onClick={clearAllFilters} className="text-destructive text-[11px] h-6 px-2">
            Clear all
          </Button>
        </div>
      )}

      {/* Bulk Actions Floating Bar */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between p-3 bg-primary text-primary-foreground rounded-lg shadow-md animate-in fade-in slide-in-from-bottom-2 text-xs">
          <span className="font-semibold">
            {selectedIds.length} worker assignment{selectedIds.length > 1 ? "s" : ""} selected
          </span>
          <div className="flex items-center gap-2">
            {canEnd && (
              <Button variant="destructive" size="xs" onClick={handleBulkEnd}>
                Bulk End Selected
              </Button>
            )}
            <Button variant="secondary" size="xs" onClick={() => setSelectedIds([])}>
              Deselect All
            </Button>
          </div>
        </div>
      )}

      {/* 4. Enterprise Data Table */}
      {assignments.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No worker assignments found"
          description={activeFilterCount > 0 ? "Try relaxing your search terms or clearing active filters." : "Create your first assignment to deploy workers to client sites."}
          action={
            activeFilterCount > 0 ? (
              <Button variant="outline" onClick={clearAllFilters}>
                Clear filters
              </Button>
            ) : canCreate ? (
              <AssignmentFormDialog
                clients={clients}
                coordinators={coordinators}
                workers={workers}
                trigger={<Button>Create Assignment</Button>}
              />
            ) : undefined
          }
        />
      ) : (
        <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={isAllSelected || isSomeSelected}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  {visibleColumns.worker && (
                    <TableHead>
                      <button
                        type="button"
                        onClick={() => handleSort("worker")}
                        className="flex items-center gap-1 font-semibold text-xs hover:text-primary focus:outline-none"
                      >
                        Worker <ArrowUpDown className="size-3" />
                      </button>
                    </TableHead>
                  )}
                  {visibleColumns.iqama && (
                    <TableHead>
                      <button
                        type="button"
                        onClick={() => handleSort("iqama")}
                        className="flex items-center gap-1 font-semibold text-xs hover:text-primary focus:outline-none"
                      >
                        Iqama <ArrowUpDown className="size-3" />
                      </button>
                    </TableHead>
                  )}
                  {visibleColumns.client && (
                    <TableHead>
                      <button
                        type="button"
                        onClick={() => handleSort("client")}
                        className="flex items-center gap-1 font-semibold text-xs hover:text-primary focus:outline-none"
                      >
                        Client <ArrowUpDown className="size-3" />
                      </button>
                    </TableHead>
                  )}
                  {visibleColumns.project && <TableHead className="font-semibold text-xs">Project</TableHead>}
                  {visibleColumns.site && <TableHead className="font-semibold text-xs">Site</TableHead>}
                  {visibleColumns.coordinator && <TableHead className="font-semibold text-xs">Coordinator</TableHead>}
                  {visibleColumns.workerRate && (
                    <TableHead className="text-right">
                      <button
                        type="button"
                        onClick={() => handleSort("workerHourlyRate")}
                        className="flex items-center gap-1 font-semibold text-xs ml-auto hover:text-primary focus:outline-none"
                      >
                        Worker Rate <ArrowUpDown className="size-3" />
                      </button>
                    </TableHead>
                  )}
                  {visibleColumns.clientRate && (
                    <TableHead className="text-right">
                      <button
                        type="button"
                        onClick={() => handleSort("clientBillingRate")}
                        className="flex items-center gap-1 font-semibold text-xs ml-auto hover:text-primary focus:outline-none"
                      >
                        Client Rate <ArrowUpDown className="size-3" />
                      </button>
                    </TableHead>
                  )}
                  {visibleColumns.margin && <TableHead className="text-right font-semibold text-xs">Margin</TableHead>}
                  {visibleColumns.startDate && (
                    <TableHead>
                      <button
                        type="button"
                        onClick={() => handleSort("startDate")}
                        className="flex items-center gap-1 font-semibold text-xs hover:text-primary focus:outline-none"
                      >
                        Start Date <ArrowUpDown className="size-3" />
                      </button>
                    </TableHead>
                  )}
                  {visibleColumns.endDate && <TableHead className="font-semibold text-xs">End Date</TableHead>}
                  {visibleColumns.status && <TableHead className="font-semibold text-xs">Status</TableHead>}
                  {visibleColumns.actions && <TableHead className="text-right font-semibold text-xs">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((a) => {
                  const workerRate = Number(a.workerHourlyRate);
                  const clientRate = Number(a.clientBillingRate);
                  const marginSar = clientRate - workerRate;
                  const isSelected = selectedIds.includes(a.id);

                  return (
                    <TableRow
                      key={a.id}
                      className={`hover:bg-muted/30 cursor-pointer transition-colors ${isSelected ? "bg-primary/5" : ""}`}
                      onClick={() => updateQueryParams({ detail: a.id })}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => handleSelectRow(a.id, !!checked)}
                        />
                      </TableCell>

                      {visibleColumns.worker && (
                        <TableCell>
                          <div>
                            <Link
                              href={`/workers/${a.workerId}`}
                              onClick={(e) => e.stopPropagation()}
                              className="font-medium text-foreground hover:text-primary hover:underline"
                            >
                              {a.worker.fullName}
                            </Link>
                            <p className="text-[11px] text-muted-foreground">
                              {a.designation || a.worker.designation?.title || "General Worker"}
                            </p>
                          </div>
                        </TableCell>
                      )}

                      {visibleColumns.iqama && (
                        <TableCell className="font-mono text-xs font-medium text-muted-foreground">
                          {a.worker.iqamaNumber}
                        </TableCell>
                      )}

                      {visibleColumns.client && (
                        <TableCell className="font-medium text-xs">
                          {a.client.companyName}
                        </TableCell>
                      )}

                      {visibleColumns.project && (
                        <TableCell className="text-xs text-muted-foreground">
                          {a.project.name}
                        </TableCell>
                      )}

                      {visibleColumns.site && (
                        <TableCell className="text-xs font-medium">
                          {a.site.name}
                        </TableCell>
                      )}

                      {visibleColumns.coordinator && (
                        <TableCell className="text-xs text-muted-foreground">
                          {a.coordinator?.name || "—"}
                        </TableCell>
                      )}

                      {visibleColumns.workerRate && (
                        <TableCell className="text-right text-xs tabular-nums font-medium">
                          {formatMoney(workerRate)}
                        </TableCell>
                      )}

                      {visibleColumns.clientRate && (
                        <TableCell className="text-right text-xs tabular-nums font-medium text-primary">
                          {formatMoney(clientRate)}
                        </TableCell>
                      )}

                      {visibleColumns.margin && (
                        <TableCell className="text-right text-xs tabular-nums font-semibold text-success">
                          +{formatMoney(marginSar)}
                        </TableCell>
                      )}

                      {visibleColumns.startDate && (
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(a.startDate)}
                        </TableCell>
                      )}

                      {visibleColumns.endDate && (
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(a.endDate)}
                        </TableCell>
                      )}

                      {visibleColumns.status && (
                        <TableCell>
                          <StatusBadge status={a.status} />
                        </TableCell>
                      )}

                      {visibleColumns.actions && (
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger render={
                              <Button variant="ghost" size="icon-sm">
                                <MoreHorizontal className="size-4" />
                              </Button>
                            } />
                            <DropdownMenuContent align="end" className="w-40 text-xs">
                              <DropdownMenuItem onClick={() => updateQueryParams({ detail: a.id })}>
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => router.push(`/workers/${a.workerId}`)}
                              >
                                View Worker Profile
                              </DropdownMenuItem>
                              {canEnd && a.status === "ACTIVE" && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={async () => {
                                      const res = await endAssignment(a.id);
                                      if (res.success) {
                                        toast.success("Assignment ended.");
                                        router.refresh();
                                      } else {
                                        toast.error(res.error);
                                      }
                                    }}
                                  >
                                    End Assignment
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* 5. Pagination Footer */}
          <div className="border-t p-3 bg-muted/20">
            <Pagination page={page} pageSize={pageSize} total={total} />
          </div>
        </div>
      )}

      {/* 6. Assignment Detail Drawer */}
      <AssignmentDetailDrawer
        data={detailData}
        open={!!searchParams.get("detail")}
        onOpenChange={(open) => {
          if (!open) {
            updateQueryParams({ detail: null });
          }
        }}
        canEnd={canEnd}
        coordinators={coordinators}
      />
    </div>
  );
}
