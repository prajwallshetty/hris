import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderSkeleton } from "@/components/shared/skeletons";
import { TableSkeleton, KpiGridSkeleton } from "@/components/shared/table-skeleton";

export default function AssignmentsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* 1. Header Skeleton */}
      <PageHeaderSkeleton />

      {/* 2. KPI Summary Grid Skeleton (5 Cards) */}
      <KpiGridSkeleton count={5} />

      {/* 3. Toolbar & Filters Skeleton */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <Skeleton className="h-9 w-72 rounded-lg" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-64 rounded-md" />
          <Skeleton className="h-9 w-20 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
      </div>

      {/* 4. Data Table Skeleton matching 12 columns x 8 rows */}
      <TableSkeleton columns={12} rows={8} />
    </div>
  );
}
