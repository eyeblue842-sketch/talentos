"use client";

import { useState } from 'react';
import { X } from 'lucide-react';

/**
 * Free-text, comma/Enter-committed chip input with case-insensitive
 * duplicate prevention - shared by Candidate Qualifications' Certifications
 * field and Preferred Candidate Profile's Preferred Certifications field.
 */
export function ChipInput({ label, value = [], onChange, placeholder }) {
  const [draft, setDraft] = useState('');

  function commit() {
    const item = draft.trim();
    if (!item) return;
    if (value.some((existing) => existing.toLowerCase() === item.toLowerCase())) {
      setDraft('');
      return;
    }
    onChange([...value, item]);
    setDraft('');
  }

  return (
    <div className="grid min-w-0 gap-2">
      {label ? <span className="text-sm font-semibold text-[var(--color-text)]">{label}</span> : null}
      <div className="flex min-h-[2.75rem] w-full min-w-0 flex-wrap items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-2.5 py-2">
        {value.map((item) => (
          <span key={item} className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-[var(--color-bg-muted)] px-3 py-1 text-xs font-semibold text-[var(--color-text)]">
            <span className="truncate">{item}</span>
            <button type="button" aria-label={`Remove ${item}`} onClick={() => onChange(value.filter((existing) => existing !== item))} className="shrink-0">
              <X size={12} aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          className="min-w-[8rem] flex-1 border-none bg-transparent text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)]"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',') {
              event.preventDefault();
              commit();
            }
          }}
          onBlur={commit}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}
