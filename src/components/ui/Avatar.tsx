import { cn } from '@/lib/utils';

export function Avatar({ name, src, size = 'md' }: { name: string; src?: string | null; size?: 'xs' | 'sm' | 'md' | 'lg' }) {
  const sizes = { xs: 'h-6 w-6 text-[10px]', sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-16 w-16 text-lg' };
  return (
    <div className={cn('flex shrink-0 items-center justify-center rounded-full font-semibold overflow-hidden bg-surface-overlay text-primary-light', sizes[size])}>
      {src ? <img src={src} alt={name} className="h-full w-full object-cover" /> : initials(name)}
    </div>
  );
}

function initials(name: string): string {
  return name?.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() ?? '?';
}
