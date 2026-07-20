"use client";

import { useId } from 'react';
import { cn } from '@/lib/utils';

export function Textarea({
  id,
  label,
  helpText,
  error,
  required = false,
  disabled = false,
  readOnly = false,
  className,
  textareaClassName,
  ...props
}) {
  const generatedId = useId();
  const textareaId = id || generatedId;
  const describedBy = [helpText ? `${textareaId}-help` : null, error ? `${textareaId}-error` : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('grid gap-2.5', className)}>
      {label ? (
        <label htmlFor={textareaId} className="text-sm font-semibold text-[var(--color-text)]">
          {label}
          {required ? <span className="ml-1 text-[var(--color-danger)]">*</span> : null}
        </label>
      ) : null}
      <textarea
        id={textareaId}
        required={required}
        disabled={disabled}
        readOnly={readOnly}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className={cn(
          'min-h-28 w-full rounded-[var(--radius-lg)] border bg-[var(--color-bg-card)] px-3.5 py-3 text-sm text-[var(--color-text)] shadow-[var(--shadow-sm)]',
          'placeholder:text-[var(--color-text-muted)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:rgba(79,156,249,0.22)]',
          error ? 'border-[var(--color-danger)]' : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)] focus:border-[var(--color-primary)]',
          disabled ? 'cursor-not-allowed bg-[var(--color-bg-muted)] text-[var(--color-text-disabled)]' : '',
          readOnly ? 'bg-[var(--color-bg-muted)]' : '',
          textareaClassName,
        )}
        {...props}
      />
      {helpText ? <p id={`${textareaId}-help`} className="text-sm text-[var(--color-text-muted)]">{helpText}</p> : null}
      {error ? <p id={`${textareaId}-error`} className="text-sm text-[var(--color-danger)]">{error}</p> : null}
    </div>
  );
}
