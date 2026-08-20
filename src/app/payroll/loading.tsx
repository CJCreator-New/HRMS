import { SkeletonHeader, SkeletonCardGrid, SkeletonTable } from "@/components/shared/Skeleton";

export default function PayrollLoading() {
  return (
    <div className="space-y-6">
      <SkeletonHeader />
      <SkeletonCardGrid count={3} />
      <SkeletonTable rows={5} />
    </div>
  );
}
