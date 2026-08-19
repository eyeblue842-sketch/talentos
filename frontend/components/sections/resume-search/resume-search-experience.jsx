"use client";

import { Input } from '@/components/ui/input';
import { FormSection } from './form-section';

export function ResumeSearchExperience({ formState, onPatch }) {
  return (
    <FormSection title="Experience">
      <div className="flex flex-wrap items-end gap-3">
        <Input label="Min experience" type="number" min="0" value={formState.minExperience} onChange={(event) => onPatch({ minExperience: event.target.value })} className="w-32" />
        <span className="pb-2.5 text-sm text-[var(--color-text-muted)]">to</span>
        <Input label="Max experience" type="number" min="0" value={formState.maxExperience} onChange={(event) => onPatch({ maxExperience: event.target.value })} className="w-32" />
        <span className="pb-2.5 text-sm text-[var(--color-text-muted)]">Years</span>
      </div>
    </FormSection>
  );
}
