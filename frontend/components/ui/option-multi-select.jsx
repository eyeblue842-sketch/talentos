"use client";

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Searchable multi-select dropdown with chips, the same look as the job-location picker.
 * `groups` is [{ label, options: string[] }]; a flat list can be passed as one group.
 * Values are the option strings themselves. Values that are not in the list (for example
 * older free-text entries) are still shown as chips so nothing a candidate saved disappears.
 */
export function OptionMultiSelect({
  label,
  placeholder = 'Select',
  searchPlaceholder = 'Search',
  groups = [],
  values = [],
  onChange,
  maxItems = null,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [limitReached, setLimitReached] = useState(false);
  const containerRef = useRef(null);
  const searchId = useId();

  useEffect(() => {
    if (!open) return undefined;
    function handlePointerDown(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false);
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const visibleGroups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return groups
      .map((group) => ({
        ...group,
        options: needle ? group.options.filter((option) => option.toLowerCase().includes(needle)) : group.options,
      }))
      .filter((group) => group.options.length);
  }, [groups, query]);

  function toggle(option) {
    if (values.includes(option)) {
      setLimitReached(false);
      onChange(values.filter((item) => item !== option));
      return;
    }
    if (maxItems && values.length >= maxItems) {
      setLimitReached(true);
      return;
    }
    setLimitReached(false);
    onChange([...values, option]);
  }

  return (
    <div className="grid gap-2" ref={containerRef}>
      {label ? <span className="text-sm font-semibold text-[var(--color-text)]">{label}</span> : null}
      <div className="relative">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={typeof label === 'string' ? label : undefined}
          onClick={() => setOpen((current) => !current)}
          className={cn(
            'flex min-h-[2.75rem] w-full flex-wrap items-center gap-1.5 rounded-[var(--radius-md)] border bg-[var(--color-bg-card)] px-3 py-2 text-left text-sm shadow-[var(--shadow-sm)]',
            'border-[var(--color-border)] hover:border-[var(--color-border-strong)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:rgba(79,156,249,0.22)]',
          )}
        >
          {values.length ? (
            values.map((value) => (
              <span
                key={value}
                role="button"
                tabIndex={0}
                aria-label={`Remove ${value}`}
                onClick={(event) => { event.stopPropagation(); toggle(value); }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); toggle(value); }
                }}
                className="inline-flex items-center gap-1 rounded-full bg-[var(--color-primary-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--color-primary)]"
              >
                {value}
                <X size={12} aria-hidden="true" />
              </span>
            ))
          ) : (
            <span className="text-[var(--color-text-muted)]">{placeholder}</span>
          )}
          <ChevronDown size={16} aria-hidden="true" className="ml-auto shrink-0 text-[var(--color-text-muted)]" />
        </button>

        {open ? (
          <div className="absolute z-20 mt-2 w-full min-w-[18rem] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-3 shadow-[var(--shadow-lg)]">
            <label htmlFor={searchId} className="sr-only">{searchPlaceholder}</label>
            <input
              id={searchId}
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:rgba(79,156,249,0.22)]"
            />
            {maxItems ? (
              <p className={cn('mt-2 text-xs', limitReached ? 'font-semibold text-[var(--color-danger)]' : 'text-[var(--color-text-muted)]')} role={limitReached ? 'alert' : undefined}>
                {limitReached ? `You can select up to ${maxItems}. Remove one to add another.` : `Select up to ${maxItems} (${values.length}/${maxItems} selected).`}
              </p>
            ) : null}
            <div className="mt-2 max-h-72 overflow-y-auto" role="listbox" aria-multiselectable="true">
              {visibleGroups.length === 0 ? <p className="px-2 py-3 text-sm text-[var(--color-text-muted)]">No matches.</p> : null}
              {visibleGroups.map((group) => (
                <div key={group.label || 'options'} className="mb-1">
                  {group.label ? (
                    <p className="px-1 pb-1 pt-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">{group.label}</p>
                  ) : null}
                  {group.options.map((option) => (
                    <label key={option} className="flex cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)]">
                      <input type="checkbox" checked={values.includes(option)} onChange={() => toggle(option)} className="h-4 w-4 shrink-0 accent-[var(--color-primary)]" />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-end border-t border-[var(--color-border)] pt-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-[var(--radius-md)] px-3 py-1.5 text-xs font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]">
                Done
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
