export default function ReportsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="bg-surface p-6 rounded-xl border border-line shadow-xs">
        <div className="h-6 bg-surface-muted rounded w-1/4 mb-2" />
        <div className="h-4 bg-surface-muted rounded w-1/3" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-surface p-5 rounded-xl border border-line shadow-xs space-y-3">
            <div className="h-5 bg-surface-muted rounded w-1/2" />
            <div className="h-4 bg-surface-muted rounded w-2/3" />
            <div className="h-10 bg-surface-muted rounded w-1/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
