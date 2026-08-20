import { SkeletonHeader, SkeletonTable } from "@/components/shared/Skeleton";

export default function EmployeesLoading() {
  return (
    <div className="space-y-6">
      <SkeletonHeader />
      {/* Search + filter bar skeleton */}
      <div className="bg-surface p-4 rounded-xl border border-line shadow-card flex gap-3">
        <div className="h-10 flex-1 bg-surface-muted rounded-lg animate-pulse" />
        <div className="h-10 w-32 bg-surface-muted rounded-lg animate-pulse" />
      </div>
      <SkeletonTable rows={8} />
    </div>
  );
}
