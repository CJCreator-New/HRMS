import { SkeletonHeader, SkeletonCardGrid, SkeletonTable } from "@/components/shared/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonHeader />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-surface p-6 rounded-xl border border-line shadow-card space-y-4">
          <div className="h-4 w-1/2 animate-pulse bg-surface-muted rounded" />
          <div className="space-y-3">
            <div className="h-3 w-full animate-pulse bg-surface-muted rounded" />
            <div className="h-3 w-3/4 animate-pulse bg-surface-muted rounded" />
            <div className="h-8 w-full animate-pulse bg-surface-muted rounded-lg" />
          </div>
        </div>
        <div className="lg:col-span-2">
          <SkeletonTable rows={5} />
        </div>
      </div>
    </div>
  );
}
