import { PageHeaderSkeleton } from "@/components/shared/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function WorkerImportLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withAction={false} />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
