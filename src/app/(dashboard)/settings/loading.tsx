import { Skeleton } from "@/components/ui/skeleton";
import { FormSkeleton, PageHeaderSkeleton } from "@/components/shared/skeletons";

export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withAction={false} />
      <Skeleton className="h-9 w-full max-w-lg" />
      <FormSkeleton sections={2} fieldsPerSection={4} />
    </div>
  );
}
