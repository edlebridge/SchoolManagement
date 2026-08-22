import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'success' | 'warning' | 'error';

export function Badge({ children, variant = 'secondary', className }: { children: React.ReactNode; variant?: Variant; className?: string }) {
  const styles: Record<Variant, string> = {
    primary: 'bg-primary-soft text-primary-soft-text',
    secondary: 'bg-surface-overlay text-ink-soft',
    success: 'bg-success-soft text-success-soft-text',
    warning: 'bg-warning-soft text-warning-soft-text',
    error: 'bg-error-soft text-error-soft-text',
  };
  return <span className={cn('badge', styles[variant], className)}>{children}</span>;
}

export function statusBadge(status: string): { variant: Variant; label: string } {
  const map: Record<string, { variant: Variant; label: string }> = {
    present: { variant: 'success', label: 'Present' },
    absent: { variant: 'error', label: 'Absent' },
    late: { variant: 'warning', label: 'Late' },
    excused: { variant: 'secondary', label: 'Excused' },
    active: { variant: 'success', label: 'Active' },
    inactive: { variant: 'secondary', label: 'Inactive' },
    draft: { variant: 'secondary', label: 'Draft' },
    scheduled: { variant: 'primary', label: 'Scheduled' },
    completed: { variant: 'primary', label: 'Completed' },
    published: { variant: 'success', label: 'Published' },
  };
  return map[status] ?? { variant: 'secondary', label: status };
}
