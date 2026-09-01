import { PageHeaderSkeleton } from "@/components/shared/skeletons";
import { TableSkeleton } from "@/components/shared/table-skeleton";

export default function AuditLogLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withAction={false} />
      <TableSkeleton columns={6} rows={12} />
    </div>
  );
}
