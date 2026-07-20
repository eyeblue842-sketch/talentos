"use client";

import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

const variantStyles = {
  primary: 'border-transparent bg-[var(--color-primary)] text-white shadow-[var(--shadow-md)] hover:bg-[var(--color-primary-hover)] hover:shadow-[var(--shadow-lg)]',
  secondary: 'border-transparent bg-[var(--color-secondary)] text-white hover:opacity-92',
  outline: 'border-[var(--color-border-strong)] bg-white text-[var(--color-text)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)]',
  ghost: 'border-transparent bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-text)]',
  danger: 'border-transparent bg-[var(--color-danger)] text-white hover:opacity-92',
  link: 'border-transparent bg-transparent px-0 text-[var(--color-primary)] shadow-none hover:text-[var(--color-primary-hover)]',
};

const sizeStyles = {
  sm: 'min-h-9 px-3.5 text-sm',
  md: 'min-h-11 px-4 text-sm',
  lg: 'min-h-12 px-5 text-base',
  icon: 'h-10 w-10 px-0',
};

export function Button({
  as: Comp = 'button',
  type = 'button',
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  leadingIcon: LeadingIcon,
  trailingIcon: TrailingIcon,
  className,
  children,
  ...props
}) {
  const isDisabled = disabled || loading;

  return (
    <Comp
      type={Comp === 'button' ? type : undefined}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] border font-semibold shadow-[var(--shadow-sm)]',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:rgba(79,156,249,0.22)]',
        'disabled:cursor-not-allowed disabled:border-[var(--color-border)] disabled:bg-[var(--color-bg-muted)] disabled:text-[var(--color-text-disabled)] disabled:shadow-none',
        'motion-safe:hover:-translate-y-px motion-reduce:hover:transform-none',
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      disabled={Comp === 'button' ? isDisabled : undefined}
      aria-disabled={Comp !== 'button' ? isDisabled : undefined}
      {...props}
    >
      {loading ? <Spinner size="sm" className="text-current" /> : LeadingIcon ? <LeadingIcon size={16} aria-hidden="true" /> : null}
      {children ? <span>{children}</span> : null}
      {TrailingIcon && !loading ? <TrailingIcon size={16} aria-hidden="true" /> : null}
    </Comp>
  );
}
