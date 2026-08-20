import { SkeletonHeader, SkeletonCardGrid, SkeletonTable } from "@/components/shared/Skeleton";

export default function LeaveLoading() {
  return (
    <div className="space-y-6">
      <SkeletonHeader />
      <SkeletonCardGrid count={4} />
      <SkeletonTable rows={3} />
    </div>
  );
}
