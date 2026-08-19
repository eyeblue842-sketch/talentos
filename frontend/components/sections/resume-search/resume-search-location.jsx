"use client";

import { FormSection } from './form-section';
import { LocationMultiSelect } from './location-multi-select';

export function ResumeSearchLocation({ formState, onPatch }) {
  return (
    <FormSection title="Current location of candidate">
      <div className="space-y-4">
        <LocationMultiSelect
          values={formState.locations || []}
          onChange={(locations) => onPatch({ locations })}
          placeholder="Add location"
          includeCountries
        />

        <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
          <input
            type="checkbox"
            checked={Boolean(formState.includeWillingToRelocate)}
            onChange={(event) => onPatch({ includeWillingToRelocate: event.target.checked })}
            className="h-4 w-4 accent-[var(--color-primary)]"
          />
          Include candidates who prefer to relocate to above locations
        </label>

        <details className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2">
          <summary className="cursor-pointer text-sm font-semibold text-[var(--color-primary)] marker:content-none">Change preferred location</summary>
          <div className="mt-3">
            <LocationMultiSelect
              label="Preferred location"
              values={formState.preferredLocations || []}
              onChange={(preferredLocations) => onPatch({ preferredLocations })}
              placeholder="Add preferred location"
              includeCountries
            />
          </div>
        </details>
      </div>
    </FormSection>
  );
}
