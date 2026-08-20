import { SkeletonHeader, SkeletonTable } from "@/components/shared/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonHeader />
      {/* Filter chips skeleton */}
      <div className="flex flex-wrap items-center gap-2 bg-surface p-3 rounded-xl border border-line shadow-xs">
        <div className="h-3 w-24 animate-pulse bg-surface-muted rounded" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-7 w-20 animate-pulse bg-surface-muted rounded-lg" />
        ))}
      </div>
      <SkeletonTable rows={5} />
    </div>
  );
}
