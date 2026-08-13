"use client";

import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ACTIVE_IN_OPTIONS = [
  { value: '', label: 'All resumes' },
  { value: '1', label: '1 day' },
  { value: '3', label: '3 days' },
  { value: '7', label: '7 days' },
  { value: '15', label: '15 days' },
  { value: '30', label: '30 days' },
  { value: '60', label: '2 months' },
  { value: '90', label: '3 months' },
  { value: '180', label: '6 months' },
  { value: '365', label: '12 months / 1 year' },
];

/**
 * Compact sticky action bar: Active In + Search Candidates. Sticks to the
 * bottom of the viewport while the page itself scrolls, spanning only the
 * Resume Search content column (not the right rail) since it lives inside
 * that column's flex flow rather than a full-width fixed overlay.
 */
export function ResumeSearchActionBar({ activeWithin, onActiveWithinChange, onSearch, disabled = false }) {
  return (
    <div className="sticky bottom-0 z-10 mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] bg-[var(--color-bg-page)]/95 py-4 backdrop-blur">
      <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
        <span className="font-semibold text-[var(--color-text)]">Active in</span>
        <select
          value={activeWithin || ''}
          onChange={(event) => onActiveWithinChange(event.target.value)}
          className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-text)]"
        >
          {ACTIVE_IN_OPTIONS.map((option) => <option key={option.value || 'all'} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <Button type="button" disabled={disabled} onClick={onSearch}>
        <Search size={16} aria-hidden="true" />
        Search candidates
      </Button>
    </div>
  );
}
