"use client";

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { filterWorkPermitCountries } from '@/lib/country-master';

/**
 * "Work Permit For" - international countries only. India is never listed
 * here: a work permit is a foreign-country concept, distinct from the India
 * location tree used for candidate location filters.
 */
export function WorkPermitSelect({ values = [], onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef(null);

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

  function toggle(name) {
    onChange(values.includes(name) ? values.filter((item) => item !== name) : [...values, name]);
  }

  const matches = filterWorkPermitCountries(query);

  return (
    <div className="grid gap-2" ref={containerRef}>
      <span className="text-sm font-semibold text-[var(--color-text)]">Work Permit For</span>
      <div className="relative">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className="flex min-h-[2.75rem] w-full flex-wrap items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-left text-sm shadow-[var(--shadow-sm)] hover:border-[var(--color-border-strong)]"
        >
          {values.length ? values.map((country) => (
            <span
              key={country}
              role="button"
              tabIndex={0}
              aria-label={`Remove ${country}`}
              onClick={(event) => { event.stopPropagation(); toggle(country); }}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); toggle(country); } }}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--color-primary-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--color-primary)]"
            >
              {country}<X size={12} aria-hidden="true" />
            </span>
          )) : <span className="text-[var(--color-text-muted)]">Add country</span>}
          <ChevronDown size={16} aria-hidden="true" className="ml-auto shrink-0 text-[var(--color-text-muted)]" />
        </button>
        {open ? (
          <div className="absolute z-20 mt-2 w-full min-w-[18rem] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-3 shadow-[var(--shadow-lg)]">
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search country (e.g. US, UK, UAE)"
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:rgba(79,156,249,0.22)]"
            />
            <div role="listbox" aria-multiselectable="true" className="mt-2 max-h-64 overflow-y-auto">
              {matches.length === 0 ? <p className="px-2 py-3 text-sm text-[var(--color-text-muted)]">No matching countries.</p> : null}
              {matches.map((country) => (
                <label key={country.code} className="flex cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)]">
                  <input type="checkbox" checked={values.includes(country.name)} onChange={() => toggle(country.name)} className="h-4 w-4 accent-[var(--color-primary)]" />
                  {country.name}
                </label>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
