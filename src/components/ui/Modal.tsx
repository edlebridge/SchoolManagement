import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }: {
  open: boolean; onClose: () => void; title: string; description?: string;
  children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  if (!open) return null;
  const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className={cn('relative w-full rounded-2xl shadow-2xl max-h-[90vh] flex flex-col bg-surface border border-surface-border', sizes[size])}>
        <div className="flex items-start justify-between p-5 border-b border-surface-border">
          <div>
            <h2 className="text-lg font-semibold text-ink">{title}</h2>
            {description && <p className="text-sm mt-1 text-ink-muted">{description}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 transition-colors hover:bg-surface-overlay text-ink-muted">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 p-5 border-t border-surface-border">{footer}</div>}
      </div>
    </div>
  );
}
