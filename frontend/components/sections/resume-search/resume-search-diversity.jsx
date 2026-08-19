"use client";

import { ShieldCheck } from 'lucide-react';
import { CollapsibleFormSection } from './form-section';

/**
 * Diversity & Inclusion stays a single collapsible section with no filter
 * controls in this pass: Careeriz search must never rank or filter candidates
 * by protected personal characteristics (gender, disability, age, religion,
 * caste, race/ethnicity, marital status, sexual orientation, health status),
 * and no AI inference of these traits is permitted. Non-sensitive, candidate-
 * declared professional signals (e.g. career break status) are a real future
 * candidate for this section once the search backend exposes an authoritative
 * field for it - not implemented here to avoid a control that quietly does
 * nothing.
 */
export function ResumeSearchDiversity() {
  return (
    <CollapsibleFormSection title="Diversity & Inclusion">
      <div className="flex gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-muted)] p-4">
        <ShieldCheck size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--color-primary)]" />
        <div className="space-y-2 text-sm text-[var(--color-text-secondary)]">
          <p>
            Careeriz Resume Search keeps hiring criteria professionally relevant. It does not filter, rank, or score
            candidates by protected personal characteristics such as gender, disability, age, religion, caste,
            race or ethnicity, marital status, sexual orientation, or health status - and never infers them with AI.
          </p>
          <p>
            Voluntary, candidate-provided diversity information is used only for aggregate reporting, inclusion
            programs, and outreach, subject to Careeriz&apos;s privacy and consent rules - never as a recruiter search
            filter.
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">
            Non-sensitive professional signals candidates explicitly report - for example career break or
            return-to-work program participation - are a candidate for this section once Careeriz&apos;s search
            backend has an authoritative field for them.
          </p>
        </div>
      </div>
    </CollapsibleFormSection>
  );
}
