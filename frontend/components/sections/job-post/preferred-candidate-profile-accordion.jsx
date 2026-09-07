"use client";

import { useState } from 'react';
import { Accordion } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { ChipInput } from '@/components/ui/chip-input';
import { EDUCATION_LEVELS } from '@/lib/education-taxonomy';
import { INDUSTRY_TAXONOMY } from '@/lib/industry-taxonomy';
import { DEPARTMENT_ROLE_TAXONOMY } from '@/lib/department-role-taxonomy';
import { INDIA_RECRUITER_LOCATIONS } from '@/lib/india-locations';
import { NOTICE_PERIOD_OPTIONS } from '@/components/sections/job-post/candidate-qualifications-fields';

const WORK_AUTHORIZATION_OPTIONS = [
  { value: '', label: 'Not specified' },
  { value: 'NOT_REQUIRED', label: 'No work authorization required' },
  { value: 'AUTHORIZED_NO_SPONSORSHIP', label: 'Must already be authorized to work (no sponsorship)' },
  { value: 'SPONSORSHIP_AVAILABLE', label: 'Sponsorship available for the right candidate' },
];

const RELOCATION_OPTIONS = [
  { value: '', label: 'No preference' },
  { value: 'YES', label: 'Must be willing to relocate' },
  { value: 'FLEXIBLE', label: 'Open to relocation, not required' },
  { value: 'NO', label: 'Local candidates only' },
];

const departmentRoleSuggestions = DEPARTMENT_ROLE_TAXONOMY.flatMap((group) => [group.department, ...group.roles]);

function buildSummary(value) {
  const parts = [];
  if (value.preferredExperience) parts.push(`${value.preferredExperience} yrs exp`);
  if (value.preferredIndustry) parts.push(value.preferredIndustry);
  if (value.preferredDepartmentRole) parts.push(value.preferredDepartmentRole);
  if (value.preferredCurrentLocation) parts.push(value.preferredCurrentLocation);
  if (value.willingToRelocate) parts.push(RELOCATION_OPTIONS.find((option) => option.value === value.willingToRelocate)?.label);
  return parts.filter(Boolean).slice(0, 3).join(' • ') || 'No preferences set yet';
}

/**
 * Naukri-style "Preferred Candidate Profile" collapsible box. Deliberately
 * excludes any protected/discriminatory personal attribute (age, gender,
 * marital status, religion, disability, etc.) - only job-relevant
 * screening preferences and standard work-authorization/relocation
 * logistics, matching Careeriz's non-discriminatory hiring stance.
 */
export function PreferredCandidateProfileAccordion({ value, onChange }) {
  const [open, setOpen] = useState(false);

  function set(field, fieldValue) {
    onChange({ ...value, [field]: fieldValue });
  }

  return (
    <Accordion
      title="Preferred Candidate Profile"
      optionalLabel="Optional"
      summary={buildSummary(value)}
      open={open}
      onToggle={() => setOpen((current) => !current)}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Input label="Preferred experience (years)" type="number" min="0" value={value.preferredExperience || ''} onChange={(event) => set('preferredExperience', event.target.value)} />
        <Input
          label="Preferred industry"
          value={value.preferredIndustry || ''}
          onChange={(event) => set('preferredIndustry', event.target.value)}
          list="preferred-profile-industry"
          placeholder="e.g. Software Product"
        />
        <Input
          label="Preferred department / role"
          value={value.preferredDepartmentRole || ''}
          onChange={(event) => set('preferredDepartmentRole', event.target.value)}
          list="preferred-profile-department-role"
          placeholder="e.g. Engineering Manager"
        />
        <Select label="Preferred education" value={value.preferredEducation || ''} onChange={(event) => set('preferredEducation', event.target.value || null)}>
          <option value="">No preference</option>
          {EDUCATION_LEVELS.map((level) => <option key={level.value} value={level.value}>{level.label}</option>)}
        </Select>
        <Select label="Preferred notice period" value={value.preferredNoticePeriod || ''} onChange={(event) => set('preferredNoticePeriod', event.target.value || null)}>
          {NOTICE_PERIOD_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </Select>
        <Input
          label="Preferred current location"
          value={value.preferredCurrentLocation || ''}
          onChange={(event) => set('preferredCurrentLocation', event.target.value)}
          list="preferred-profile-location"
          placeholder="e.g. Bengaluru, Karnataka"
        />
        <Select label="Willingness to relocate" value={value.willingToRelocate || ''} onChange={(event) => set('willingToRelocate', event.target.value || null)}>
          {RELOCATION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </Select>
        <Select label="Work authorization" value={value.workAuthorization || ''} onChange={(event) => set('workAuthorization', event.target.value || null)}>
          {WORK_AUTHORIZATION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </Select>
      </div>
      <div className="mt-4">
        <ChipInput label="Preferred certifications" value={value.preferredCertifications || []} onChange={(next) => set('preferredCertifications', next)} placeholder="e.g. Scrum Master, Six Sigma" />
      </div>
      <label className="mt-4 grid gap-2">
        <span className="text-sm font-semibold text-[var(--color-text)]">Additional preferred-profile notes</span>
        <textarea
          value={value.additionalNotes || ''}
          onChange={(event) => set('additionalNotes', event.target.value)}
          rows={3}
          maxLength={2000}
          className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--color-text)]"
          placeholder="Any other preference that helps recruiters shortlist faster."
        />
      </label>
      <datalist id="preferred-profile-industry">
        {INDUSTRY_TAXONOMY.map((industry) => <option key={industry} value={industry} />)}
      </datalist>
      <datalist id="preferred-profile-department-role">
        {departmentRoleSuggestions.map((item) => <option key={item} value={item} />)}
      </datalist>
      <datalist id="preferred-profile-location">
        {INDIA_RECRUITER_LOCATIONS.map((location) => <option key={location} value={location} />)}
      </datalist>
    </Accordion>
  );
}
