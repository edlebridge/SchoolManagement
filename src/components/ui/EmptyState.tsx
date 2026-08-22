import type { ReactNode } from 'react';

export function EmptyState({ title, description, icon }: { title: string; description?: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon && <div className="mb-3 text-surface-muted">{icon}</div>}
      <p className="font-medium text-ink">{title}</p>
      {description && <p className="text-sm mt-1 max-w-sm text-ink-muted">{description}</p>}
    </div>
  );
}
