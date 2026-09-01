import { FormSkeleton, PageHeaderSkeleton } from "@/components/shared/skeletons";

export default function EmployeeNewLoading() {
  return (
    <div className="max-w-2xl space-y-6">
      <PageHeaderSkeleton withAction={false} />
      <FormSkeleton sections={2} fieldsPerSection={4} />
    </div>
  );
}
