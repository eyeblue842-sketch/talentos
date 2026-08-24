import { cn } from '@/lib/utils';

const styles = {
  default: 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]',
  success: 'bg-[var(--color-badge-success-bg)] text-[var(--color-badge-success-text)]',
  warning: 'bg-[var(--color-badge-warning-bg)] text-[var(--color-badge-warning-text)]',
  danger: 'bg-[var(--color-badge-danger-bg)] text-[var(--color-badge-danger-text)]',
  info: 'bg-[var(--color-badge-info-bg)] text-[var(--color-badge-info-text)]',
  neutral: 'bg-[var(--color-badge-neutral-bg)] text-[var(--color-badge-neutral-text)]',
  purple: 'bg-[var(--color-badge-purple-bg)] text-[var(--color-badge-purple-text)]',
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

