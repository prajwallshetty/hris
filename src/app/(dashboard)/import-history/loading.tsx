import { PageHeaderSkeleton } from "@/components/shared/skeletons";
import { TableSkeleton } from "@/components/shared/table-skeleton";

export default function ImportHistoryLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withAction={false} />
      <TableSkeleton columns={9} rows={12} />
    </div>
  );
}
