export function RowSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="card divide-y divide-surface-border">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-4">
          <div className="h-10 w-10 rounded-full animate-pulse bg-skeleton" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/3 rounded animate-pulse bg-skeleton" />
            <div className="h-3 w-1/4 rounded animate-pulse bg-skeleton" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return <div className="card p-5"><div className="h-20 rounded-xl animate-pulse bg-skeleton" /></div>;
}
