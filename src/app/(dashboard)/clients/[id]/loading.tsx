import { Skeleton } from "@/components/ui/skeleton";

export default function ClientDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-9 w-20" />
      </div>
      <Skeleton className="h-9 w-full max-w-lg" />
      <Skeleton className="h-40 rounded-xl" />
    </div>
  );
}
