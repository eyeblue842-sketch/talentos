"use client";

import { cn } from '@/lib/utils';
import { FormSection } from './form-section';
import { KeywordStarChips } from './keyword-star-chips';

/**
 * Keywords section. Skills are entered as chips with a star toggle — a starred
 * (mandatory) chip maps to requiredSkills, an un-starred one to optionalSkills,
 * both of which the search pipeline already weights. A separate free-text field
 * covers name / title / broad resume-text search.
 */
export function ResumeSearchKeywords({ formState, onPatch }) {
  return (
    <FormSection title="Keywords" description="Add skills, a role or a candidate name as chips. Star the mandatory ones.">
      <div className="space-y-4">
        <KeywordStarChips
          requiredSkills={formState.requiredSkills}
          optionalSkills={formState.optionalSkills}
          onChange={(req, opt) => onPatch({ requiredSkills: req, optionalSkills: opt, query: [req, opt].filter(Boolean).join(', ') })}
          query={formState.query}
        />

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-[var(--color-text)]">Boolean</span>
          <div className="inline-flex overflow-hidden rounded-full border border-[var(--color-border)]" role="group" aria-label="Boolean search">
            {[{ value: 'HYBRID', label: 'Off' }, { value: 'BOOLEAN', label: 'On' }].map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={formState.mode === option.value || (option.value === 'HYBRID' && formState.mode !== 'BOOLEAN')}
                onClick={() => onPatch({ mode: option.value })}
                className={cn(
                  'px-3.5 py-1.5 text-xs font-semibold transition',
                  (formState.mode === option.value || (option.value === 'HYBRID' && formState.mode !== 'BOOLEAN'))
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'bg-white text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)]',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <span className="text-xs text-[var(--color-text-muted)]">Use AND / OR / NOT between keywords.</span>
        </div>
      </div>
    </FormSection>
  );
}
