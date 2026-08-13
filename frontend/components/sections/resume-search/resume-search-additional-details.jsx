"use client";

import { Input } from '@/components/ui/input';
import { FormSection } from './form-section';
import { WorkPermitSelect } from './work-permit-select';

export function ResumeSearchAdditionalDetails({ formState, onPatch }) {
  return (
    <FormSection title="Additional Details">
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">Work details</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-semibold text-[var(--color-text)]">Job Type</p>
              <div className="grid gap-2 text-sm text-[var(--color-text-secondary)]">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={formState.jobTypes?.includes('PERMANENT')} onChange={(event) => onPatch({ jobTypes: event.target.checked ? [...(formState.jobTypes || []), 'PERMANENT'] : (formState.jobTypes || []).filter((item) => item !== 'PERMANENT') })} className="h-4 w-4 accent-[var(--color-primary)]" />
                  Permanent
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={formState.jobTypes?.includes('CONTRACT')} onChange={(event) => onPatch({ jobTypes: event.target.checked ? [...(formState.jobTypes || []), 'CONTRACT'] : (formState.jobTypes || []).filter((item) => item !== 'CONTRACT') })} className="h-4 w-4 accent-[var(--color-primary)]" />
                  Contract
                </label>
                <label className="flex items-center gap-2 text-[var(--color-text-muted)]">
                  <input type="checkbox" disabled className="h-4 w-4" />
                  Temporary <span className="text-xs">(not stored)</span>
                </label>
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-[var(--color-text)]">Employment Type</p>
              <div className="grid gap-2 text-sm text-[var(--color-text-secondary)]">
                {[['FULL_TIME', 'Full Time'], ['PART_TIME', 'Part Time'], ['INTERN', 'Intern']].map(([value, label]) => (
                  <label key={value} className="flex items-center gap-2">
                    <input type="checkbox" checked={formState.employmentTypes?.includes(value)} onChange={(event) => onPatch({ employmentTypes: event.target.checked ? [...(formState.employmentTypes || []), value] : (formState.employmentTypes || []).filter((item) => item !== value) })} className="h-4 w-4 accent-[var(--color-primary)]" />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4">
            <WorkPermitSelect
              values={formState.workPermitCountries || []}
              onChange={(workPermitCountries) => onPatch({ workPermitCountries })}
            />
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">Display details</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-[var(--color-text)]">Show</span>
              <select value={formState.displayCandidateType || 'ALL'} onChange={(event) => onPatch({ displayCandidateType: event.target.value })} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-text)]">
                <option value="ALL">All Candidates</option>
                <option value="NEW_REGISTRATIONS">New Registrations</option>
                <option value="MODIFIED">Modified Candidates</option>
              </select>
            </label>
            <Input label="Within days" type="number" value={formState.profileRecencyDays || ''} onChange={(event) => onPatch({ profileRecencyDays: event.target.value })} placeholder="Defaults to 30" />
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-[var(--color-text)]">Show only candidates with</p>
          <div className="grid gap-2 text-sm text-[var(--color-text-secondary)]">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={Boolean(formState.emailVerified)} onChange={(event) => onPatch({ emailVerified: event.target.checked })} className="h-4 w-4 accent-[var(--color-primary)]" />
              Verified Email
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={formState.resumeAttachment === 'Available'} onChange={(event) => onPatch({ resumeAttachment: event.target.checked ? 'Available' : '' })} className="h-4 w-4 accent-[var(--color-primary)]" />
              Attached Resume
            </label>
            <p className="text-xs text-[var(--color-text-muted)]">Verified mobile and candidate age are not available: Careeriz does not store authoritative mobile-verification state or date of birth, and age is never inferred from a resume.</p>
          </div>
        </div>
      </div>
    </FormSection>
  );
}
