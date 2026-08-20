import { SkeletonHeader, SkeletonTable } from "@/components/shared/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonHeader />
      {/* Stepper skeleton */}
      <div className="bg-surface p-5 rounded-xl border border-line shadow-card flex items-center gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="h-6 w-6 animate-pulse bg-surface-muted rounded-full" />
            <div className="h-3 w-24 animate-pulse bg-surface-muted rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form skeleton */}
        <div className="bg-surface p-6 rounded-xl border border-line shadow-card space-y-4">
          <div className="h-4 w-1/2 animate-pulse bg-surface-muted rounded" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-3 w-20 animate-pulse bg-surface-muted rounded" />
                <div className="h-9 w-full animate-pulse bg-surface-muted rounded-lg" />
              </div>
            ))}
          </div>
        </div>
        {/* Table skeleton */}
        <div className="lg:col-span-2">
          <SkeletonTable rows={3} />
        </div>
      </div>
    </div>
  );
}
