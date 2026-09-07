import { Skeleton } from "@/components/ui/skeleton";

export default function ReceiptLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-96 w-full rounded-xl" />
    </div>
  );
}
