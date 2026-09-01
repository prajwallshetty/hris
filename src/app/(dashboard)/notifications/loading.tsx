import { ListSkeleton, PageHeaderSkeleton } from "@/components/shared/skeletons";

export default function NotificationsLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withAction={false} />
      <ListSkeleton rows={8} />
    </div>
  );
}
