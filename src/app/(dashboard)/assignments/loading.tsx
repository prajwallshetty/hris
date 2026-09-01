import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderSkeleton } from "@/components/shared/skeletons";
import { TableSkeleton } from "@/components/shared/table-skeleton";

export default function AssignmentsLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <Skeleton className="h-9 w-48" />
      <TableSkeleton columns={8} />
    </div>
  );
}
