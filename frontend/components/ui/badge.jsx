import { cn } from '@/lib/utils';

const styles = {
  default: 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]',
  success: 'bg-emerald-100 text-emerald-800',
  warning: 'bg-amber-100 text-amber-900',
  danger: 'bg-rose-100 text-rose-800',
  info: 'bg-blue-100 text-blue-800',
  neutral: 'bg-slate-100 text-slate-700',
  purple: 'bg-violet-100 text-violet-800',
  brand: 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]',
};

export function Badge({ children, tone, variant = 'default', className }) {
  const resolvedVariant = tone || variant;

  return (
    <span className={cn('inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-wide', styles[resolvedVariant], className)}>
      {children}
    </span>
  );
}

