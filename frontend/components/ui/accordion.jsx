"use client";

import { useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * A single controlled disclosure section with explicit aria-expanded/
 * aria-controls wiring (rather than the native <details> element used
 * elsewhere in the app for simpler filter accordions), for cases that need
 * precise ARIA semantics and a state the parent can read/preserve - see
 * Preferred Candidate Profile in the job-post wizard, which must keep its
 * field values intact whether the box is open or closed.
 */
export function Accordion({
  title,
  summary,
  optionalLabel,
  open,
  onToggle,
  children,
  className,
}) {
  const panelId = useId();
  const buttonId = useId();

  return (
    <div className={cn('rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white', className)}>
      <h3 className="m-0">
        <button
          type="button"
          id={buttonId}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left"
        >
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
              {title}
              {optionalLabel ? (
                <span className="rounded-full bg-[var(--color-bg-muted)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                  {optionalLabel}
                </span>
              ) : null}
            </span>
            {!open && summary ? (
              <span className="truncate text-xs text-[var(--color-text-muted)]">{summary}</span>
            ) : null}
          </span>
          <ChevronDown
            aria-hidden="true"
            size={18}
            className={cn('shrink-0 text-[var(--color-text-muted)] transition-transform duration-150', open && 'rotate-180')}
          />
        </button>
      </h3>
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        hidden={!open}
        className="border-t border-[var(--color-border)] px-4 py-4"
      >
        {children}
      </div>
    </div>
  );
}
