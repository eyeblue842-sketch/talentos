"use client";

import { useId } from 'react';
import { cn } from '@/lib/utils';

export function Checkbox({ id, label, helpText, className, ...props }) {
  const generatedId = useId();
  const inputId = id || generatedId;

  return (
    <label htmlFor={inputId} className={cn('inline-flex items-start gap-3 text-sm text-[var(--color-text)]', className)}>
      <input
        id={inputId}
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-[var(--color-border-strong)] text-[var(--color-primary)] accent-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:rgba(79,156,249,0.22)]"
        {...props}
      />
      <span className="grid gap-1">
        <span className="font-medium">{label}</span>
        {helpText ? <span className="text-[var(--color-text-muted)]">{helpText}</span> : null}
      </span>
    </label>
  );
}
