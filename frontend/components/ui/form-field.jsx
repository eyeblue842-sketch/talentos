import { cn } from '@/lib/utils';

export function FormField({
  label,
  htmlFor,
  required = false,
  helpText,
  error,
  className,
  children,
}) {
  const describedBy = [helpText ? `${htmlFor}-help` : null, error ? `${htmlFor}-error` : null].filter(Boolean).join(' ') || undefined;
  const control = typeof children === 'function'
    ? children({ describedBy, invalid: Boolean(error) })
    : children;

  return (
    <div className={cn('grid gap-2.5', className)}>
      {label ? (
        <label htmlFor={htmlFor} className="text-sm font-semibold text-[var(--color-text)]">
          {label}
          {required ? <span className="ml-1 text-[var(--color-danger)]">*</span> : null}
        </label>
      ) : null}
      {control}
      {helpText ? <p id={`${htmlFor}-help`} className="text-sm text-[var(--color-text-muted)]">{helpText}</p> : null}
      {error ? <p id={`${htmlFor}-error`} className="text-sm text-[var(--color-danger)]">{error}</p> : null}
    </div>
  );
}
