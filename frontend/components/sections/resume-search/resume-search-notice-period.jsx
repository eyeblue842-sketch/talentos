"use client";

import { cn } from '@/lib/utils';
import { FormSection } from './form-section';

const NOTICE_PILLS = [
  { value: '', label: 'Any' },
  { value: '15', label: '0-15 days' },
  { value: '30', label: '1 month' },
  { value: '60', label: '2 months' },
  { value: '90', label: '3 months' },
];

/**
 * Notice period as selectable pills, not free text. Only the five values the
 * backend actually resolves end to end (candidateRetrieverService converts
 * noticePeriodDaysMax into the "<N> Days" string candidateSearchFilterService
 * matches exactly) are offered. "More than 3 months" and "Currently serving"
 * are intentionally omitted - Careeriz has no bucket for either today.
 */
export function ResumeSearchNoticePeriod({ formState, onPatch }) {
  const current = formState.noticePeriodDaysMax === '' || formState.noticePeriodDaysMax == null ? '' : String(formState.noticePeriodDaysMax);

  return (
    <FormSection title="Notice Period / Availability">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Notice period">
        {NOTICE_PILLS.map((pill) => (
          <button
            key={pill.value || 'any'}
            type="button"
            aria-pressed={current === pill.value}
            onClick={() => onPatch({ noticePeriodDaysMax: pill.value === '' ? '' : Number(pill.value) })}
            className={cn(
              'rounded-full border px-4 py-1.5 text-sm font-semibold transition',
              current === pill.value
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)]',
            )}
          >
            {pill.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-[var(--color-text-muted)]">&ldquo;More than 3 months&rdquo; and &ldquo;Currently serving notice period&rdquo; are not available yet - Careeriz Resume Search does not store a matching notice-period bucket.</p>
    </FormSection>
  );
}
