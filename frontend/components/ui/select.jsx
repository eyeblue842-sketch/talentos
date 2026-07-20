"use client";

import { useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Select({
  id,
  label,
  helpText,
  error,
  required = false,
  disabled = false,
  className,
  selectClassName,
  children,
  ...props
}) {
  const generatedId = useId();
  const selectId = id || generatedId;
  const describedBy = [helpText ? `${selectId}-help` : null, error ? `${selectId}-error` : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('grid gap-2.5', className)}>
      {label ? (
        <label htmlFor={selectId} className="text-sm font-semibold text-[var(--color-text)]">
          {label}
          {required ? <span className="ml-1 text-[var(--color-danger)]">*</span> : null}
        </label>
      ) : null}
      <div className="relative">
        <select
          id={selectId}
          required={required}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={cn(
            'w-full appearance-none rounded-[var(--radius-md)] border bg-[var(--color-bg-card)] px-3.5 py-2.5 pr-10 text-sm text-[var(--color-text)] shadow-[var(--shadow-sm)]',
            'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:rgba(79,156,249,0.22)]',
            error ? 'border-[var(--color-danger)]' : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)] focus:border-[var(--color-primary)]',
            disabled ? 'cursor-not-allowed bg-[var(--color-bg-muted)] text-[var(--color-text-disabled)]' : '',
            selectClassName,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown aria-hidden="true" size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
      </div>
      {helpText ? <p id={`${selectId}-help`} className="text-sm text-[var(--color-text-muted)]">{helpText}</p> : null}
      {error ? <p id={`${selectId}-error`} className="text-sm text-[var(--color-danger)]">{error}</p> : null}
    </div>
  );
}
