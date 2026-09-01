import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderSkeleton } from "@/components/shared/skeletons";
import { TableSkeleton } from "@/components/shared/table-skeleton";

export default function ReportsLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withAction={false} />
      <Skeleton className="h-9 w-96" />
      <TableSkeleton columns={5} />
    </div>
  );
}
