import { Skeleton } from "@/components/ui/skeleton";
import { KpiGridSkeleton, TableSkeleton } from "@/components/shared/table-skeleton";

/** Title + description + primary action — the header every list/detail page starts with. */
export function PageHeaderSkeleton({ withAction = true }: { withAction?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      {withAction && <Skeleton className="h-9 w-28 shrink-0" />}
    </div>
  );
}

/** A single card-shaped placeholder — title bar + a couple of lines. */
export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-3 rounded-xl border p-4">
      <Skeleton className="h-4 w-1/3" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="h-3.5 w-full" />
      ))}
    </div>
  );
}

/** Vertical list of row items — avatar/icon + two lines + trailing element. */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="divide-y rounded-lg border">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Rectangular chart placeholder with a simulated baseline/bars silhouette. */
export function ChartSkeleton({ height = "h-64" }: { height?: string }) {
  return (
    <div className={`flex items-end gap-2 rounded-xl border p-4 ${height}`}>
      {[45, 70, 55, 90, 65, 80, 50, 75, 60, 40].map((h, i) => (
        <Skeleton key={i} className="w-full rounded-t-sm" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}

/** Activity-feed placeholder matching the shared Timeline component's shape. */
export function TimelineSkeleton({ items = 4 }: { items?: number }) {
  return (
    <div className="space-y-5 border-l pl-5">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-3 w-3/5" />
        </div>
      ))}
    </div>
  );
}

/** Grouped label+input pairs, matching §43's sectioned-form guidance. */
export function FormSkeleton({ sections = 2, fieldsPerSection = 4 }: { sections?: number; fieldsPerSection?: number }) {
  return (
    <div className="space-y-6">
      {Array.from({ length: sections }).map((_, s) => (
        <div key={s} className="space-y-3">
          <Skeleton className="h-4 w-32" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.from({ length: fieldsPerSection }).map((_, f) => (
              <div key={f} className="space-y-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Record header with an avatar — for person-centric detail pages (Worker, Employee). */
export function ProfileHeaderSkeleton() {
  return (
    <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
      <div className="flex items-center gap-3">
        <Skeleton className="size-14 shrink-0 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-44" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-24" />
      </div>
    </div>
  );
}

/** Record header without an avatar — for document-style detail pages (Invoice, Payroll, Client). */
export function DetailHeaderSkeleton() {
  return (
    <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-24" />
      </div>
    </div>
  );
}

/** Full composition for a person-centric record page (header → summary → tabs → content). */
export function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <ProfileHeaderSkeleton />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-9 w-full max-w-md" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

/** Full composition for a document-style record page (Invoice/Payroll/Coordinator/Client). */
export function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <DetailHeaderSkeleton />
      <Skeleton className="h-9 w-full max-w-sm" />
      <TableSkeleton rows={5} columns={5} />
    </div>
  );
}

/** Full dashboard composition — greeting header, KPI rows, chart row, activity. */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-80" />
      </div>
      <KpiGridSkeleton count={4} />
      <KpiGridSkeleton count={4} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartSkeleton height="h-56" />
        <ChartSkeleton height="h-56" />
      </div>
      <ListSkeleton rows={5} />
    </div>
  );
}

/** Standard list-page composition — header → toolbar → table. */
export function PageSkeleton({ columns = 6, rows = 8 }: { columns?: number; rows?: number }) {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="flex gap-3">
        <Skeleton className="h-9 w-full max-w-sm" />
        <Skeleton className="h-9 w-32" />
      </div>
      <TableSkeleton columns={columns} rows={rows} />
    </div>
  );
}
