"use client";

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { filterIndustries } from '@/lib/industry-taxonomy';

export function IndustrySelector({ values = [], onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function handlePointerDown(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  function toggle(industry) {
    onChange(values.includes(industry) ? values.filter((item) => item !== industry) : [...values, industry]);
  }

  return (
    <div className="grid gap-2" ref={containerRef}>
      <span className="text-sm font-semibold text-[var(--color-text)]">Industry</span>
      <button
        type="button"
        aria-expanded={open}
        aria-label="Selected industries"
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-[2.75rem] w-full flex-wrap items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-left text-sm"
      >
        {values.length ? values.map((industry) => (
          <span key={industry} role="button" tabIndex={0} aria-label={`Remove ${industry}`} onClick={(event) => { event.stopPropagation(); toggle(industry); }} onKeyDown={(event) => { if (event.key === 'Enter') { event.stopPropagation(); toggle(industry); } }} className="inline-flex items-center gap-1 rounded-full bg-[var(--color-primary-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--color-primary)]">
            {industry}<X size={12} aria-hidden="true" />
          </span>
        )) : <span className="text-[var(--color-text-muted)]">Select industries</span>}
        <ChevronDown size={16} aria-hidden="true" className="ml-auto text-[var(--color-text-muted)]" />
      </button>
      {open ? (
        <div className="relative">
          <div className="absolute z-20 mt-1 w-full rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-3 shadow-[var(--shadow-lg)]">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search industry" className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-sm" />
            <div role="listbox" aria-multiselectable="true" className="mt-2 max-h-56 overflow-y-auto">
              {filterIndustries(query).map((industry) => (
                <label key={industry} className="flex cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)]">
                  <input type="checkbox" checked={values.includes(industry)} onChange={() => toggle(industry)} className="h-4 w-4 accent-[var(--color-primary)]" />
                  {industry}
                </label>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
