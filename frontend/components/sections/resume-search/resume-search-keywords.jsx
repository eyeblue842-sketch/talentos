"use client";

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { FormSection } from './form-section';

/**
 * Keywords + IT Skills. "Exclude Keywords", the mandatory-keyword checkbox and
 * the "Search keyword in" scope selector are intentionally not rendered here:
 * the current candidateSearchOrchestrator/searchUtils pipeline has no
 * excludeKeywords field, no mandatory-match flag and no search-scope filter,
 * so wiring them would fake functionality that does not exist server-side.
 */
export function ResumeSearchKeywords({ formState, onPatch }) {
  return (
    <FormSection title="Keywords" description="Searches across resume and profile content.">
      <div className="space-y-4">
        <Input
          label="Keywords"
          value={formState.query}
          onChange={(event) => onPatch({ query: event.target.value })}
          placeholder="Enter skills, designation, technologies or companies"
        />

        <div className="flex items-center gap-3">
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

        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="IT Skills (required)"
            value={formState.requiredSkills}
            onChange={(event) => onPatch({ requiredSkills: event.target.value })}
            placeholder="Java, Spring Boot, AWS"
            helpText="Comma separated"
          />
          <Input
            label="IT Skills (optional)"
            value={formState.optionalSkills}
            onChange={(event) => onPatch({ optionalSkills: event.target.value })}
            placeholder="Kafka, Docker"
            helpText="Comma separated"
          />
        </div>
      </div>
    </FormSection>
  );
}
