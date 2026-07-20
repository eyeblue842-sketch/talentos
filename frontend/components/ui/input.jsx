"use client";

import { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

function inputClassName({ invalid, disabled, readOnly, className }) {
  return cn(
    'w-full rounded-[var(--radius-md)] border bg-[var(--color-bg-card)] px-3.5 py-2.5 text-sm text-[var(--color-text)] shadow-[var(--shadow-sm)]',
    'placeholder:text-[var(--color-text-muted)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:rgba(79,156,249,0.22)]',
    invalid ? 'border-[var(--color-danger)]' : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)] focus:border-[var(--color-primary)]',
    disabled ? 'cursor-not-allowed bg-[var(--color-bg-muted)] text-[var(--color-text-disabled)]' : '',
    readOnly ? 'bg-[var(--color-bg-muted)]' : '',
    className,
  );
}

export function Input({
  id,
  type = 'text',
  label,
  helpText,
  error,
  required = false,
  disabled = false,
  readOnly = false,
  leadingIcon: LeadingIcon,
  trailingAction,
  className,
  inputClassName: customInputClassName,
  ...props
}) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const describedBy = [helpText ? `${inputId}-help` : null, error ? `${inputId}-error` : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('grid gap-2.5', className)}>
      {label ? (
        <label htmlFor={inputId} className="text-sm font-semibold text-[var(--color-text)]">
          {label}
          {required ? <span className="ml-1 text-[var(--color-danger)]">*</span> : null}
        </label>
      ) : null}
      <div className="relative">
        {LeadingIcon ? <LeadingIcon aria-hidden="true" size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" /> : null}
        <input
          id={inputId}
          type={type}
          required={required}
          disabled={disabled}
          readOnly={readOnly}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={inputClassName({
            invalid: Boolean(error),
            disabled,
            readOnly,
            className: cn(LeadingIcon ? 'pl-10' : '', trailingAction ? 'pr-12' : '', customInputClassName),
          })}
          {...props}
        />
        {trailingAction ? (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            {trailingAction}
          </div>
        ) : null}
      </div>
      {helpText ? <p id={`${inputId}-help`} className="text-sm text-[var(--color-text-muted)]">{helpText}</p> : null}
      {error ? <p id={`${inputId}-error`} className="text-sm text-[var(--color-danger)]">{error}</p> : null}
    </div>
  );
}

export function PasswordField({ id, ...props }) {
  const [isVisible, setIsVisible] = useState(false);
  const generatedId = useId();
  const inputId = id || generatedId;

  return (
    <Input
      id={inputId}
      type={isVisible ? 'text' : 'password'}
      trailingAction={(
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full shadow-none"
          aria-label={isVisible ? 'Hide password' : 'Show password'}
          onClick={() => setIsVisible((current) => !current)}
        >
          {isVisible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
        </Button>
      )}
      {...props}
    />
  );
}
