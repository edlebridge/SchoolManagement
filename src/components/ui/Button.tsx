import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  leftIcon?: ReactNode;
  className?: string;
  form?: string;
}

export function Button({ children, onClick, type = 'button', variant = 'primary', size = 'md', loading, disabled, leftIcon, className, form }: ButtonProps) {
  const variants: Record<Variant, string> = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    success: 'btn-primary',
    warning: 'btn-primary',
    error: 'btn-primary',
    ghost: 'btn-ghost',
    danger: 'btn-danger',
  };
  const variantStyles: Record<Variant, React.CSSProperties> = {
    primary: {}, secondary: {}, ghost: {}, danger: {},
    success: { background: 'var(--color-success)' },
    warning: { background: 'var(--color-warning)' },
    error: { background: 'var(--color-error)' },
  };
  const sizes: Record<Size, string> = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2.5 text-sm', lg: 'px-5 py-3 text-base' };
  return (
    <button type={type} onClick={onClick} disabled={disabled || loading} form={form}
      style={variantStyles[variant]}
      className={cn('btn', variants[variant], sizes[size], className)}>
      {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : leftIcon}
      {children}
    </button>
  );
}
