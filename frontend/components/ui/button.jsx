"use client";

import Link from 'next/link';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

const variantStyles = {
  primary: 'border-transparent bg-[var(--color-primary)] text-white shadow-[var(--shadow-sm)] hover:bg-[var(--color-primary-hover)] hover:shadow-[var(--shadow-md)]',
  secondary: 'border-transparent bg-[var(--color-secondary)] text-white shadow-[var(--shadow-sm)] hover:bg-[color:var(--color-primary)]',
  outline: 'border-[var(--color-border-strong)] bg-[var(--color-bg-card)] text-[var(--color-text)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)]',
  ghost: 'border-transparent bg-transparent text-[var(--color-text-secondary)] shadow-none hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-text)]',
  danger: 'border-transparent bg-[var(--color-danger)] text-white shadow-[var(--shadow-sm)] hover:opacity-90',
  link: 'border-transparent bg-transparent px-0 text-[var(--color-primary)] shadow-none hover:text-[var(--color-primary-hover)]',
};

const sizeStyles = {
  sm: 'min-h-9 px-3.5 text-sm',
  md: 'min-h-11 px-4 text-sm',
  lg: 'min-h-12 px-5 text-base',
  icon: 'h-10 w-10 px-0',
};

export function Button({
  as: AsComp,
  href,
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
  // `href` renders a Link here so server components can use <Button href> without
  // passing a component function across the server/client boundary (`as={Link}`).
  const Comp = AsComp || (href ? Link : 'button');
  const isDisabled = disabled || loading;

  return (
    <Comp
      type={Comp === 'button' ? type : undefined}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] border font-semibold shadow-[var(--shadow-sm)]',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--focus-ring-glow)]',
        'disabled:cursor-not-allowed disabled:border-[var(--color-border)] disabled:bg-[var(--color-bg-muted)] disabled:text-[var(--color-text-disabled)] disabled:shadow-none',
        'transition-colors motion-safe:active:scale-[0.98]',
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      disabled={Comp === 'button' ? isDisabled : undefined}
      aria-disabled={Comp !== 'button' ? isDisabled : undefined}
      {...(href ? { href } : {})}
      {...props}
    >
      {loading ? <Spinner size="sm" className="text-current" /> : LeadingIcon ? <LeadingIcon size={16} aria-hidden="true" /> : null}
      {children ? <span>{children}</span> : null}
      {TrailingIcon && !loading ? <TrailingIcon size={16} aria-hidden="true" /> : null}
    </Comp>
  );
}
