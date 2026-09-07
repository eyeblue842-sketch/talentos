"use client";

import { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { ChipInput } from '@/components/ui/chip-input';
import { EDUCATION_LEVELS, filterEducationCourses } from '@/lib/education-taxonomy';
import { INDUSTRY_TAXONOMY } from '@/lib/industry-taxonomy';
import { DEPARTMENT_ROLE_TAXONOMY } from '@/lib/department-role-taxonomy';

export const NOTICE_PERIOD_OPTIONS = [
  { value: '', label: 'Any notice period' },
  { value: 'IMMEDIATE', label: 'Immediate' },
  { value: 'UPTO_15_DAYS', label: '15 days or less' },
  { value: 'ONE_MONTH', label: '1 month' },
  { value: 'TWO_MONTHS', label: '2 months' },
  { value: 'THREE_MONTHS', label: '3 months' },
  { value: 'MORE_THAN_THREE_MONTHS', label: 'More than 3 months' },
];

/**
 * Structured "Candidate Qualifications" box for the Job Description step.
 * experienceMin/experienceMax/department are existing top-level Job fields
 * (Job.experienceMin, Job.experienceMax, Job.department) relocated here to
 * match Naukri's grouping, not duplicated - they stay wired to the same
 * wizard state and form field names as before. Everything else in `value`
 * is new, stored server-side as Job.candidateQualifications (JSON).
 */
export function CandidateQualificationsFields({
  experienceMin,
  experienceMax,
  onExperienceMinChange,
  onExperienceMaxChange,
  department,
  onDepartmentChange,
  value,
  onChange,
}) {
  const courseGroups = useMemo(
    () => filterEducationCourses(value.minimumQualification || 'ug', ''),
    [value.minimumQualification],
  );

  function set(field, fieldValue) {
    onChange({ ...value, [field]: fieldValue });
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-4">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-[var(--color-text)]">Candidate Qualifications</h3>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">Set the screening criteria candidates are matched and filtered against.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Input label="Minimum experience (years)" type="number" min="0" name="experienceMin" value={experienceMin} onChange={(event) => onExperienceMinChange(event.target.value)} required />
        <Input label="Maximum experience (years)" type="number" min="0" name="experienceMax" value={experienceMax} onChange={(event) => onExperienceMaxChange(event.target.value)} required />
        <Input label="Relevant experience (years)" type="number" min="0" value={value.relevantExperience || ''} onChange={(event) => set('relevantExperience', event.target.value)} helpText="Experience specifically in the skills required for this role." />
        <Select label="Minimum qualification" value={value.minimumQualification || ''} onChange={(event) => set('minimumQualification', event.target.value || null)}>
          <option value="">Any qualification</option>
          {EDUCATION_LEVELS.map((level) => <option key={level.value} value={level.value}>{level.label}</option>)}
        </Select>
        <Select label="Education / course" value={value.educationCourse || ''} onChange={(event) => set('educationCourse', event.target.value || null)} disabled={!value.minimumQualification}>
          <option value="">{value.minimumQualification ? 'Any course' : 'Select a minimum qualification first'}</option>
          {courseGroups.map((group) => (
            <optgroup key={group.category} label={group.category}>
              {group.courses.map((course) => <option key={course} value={course}>{course}</option>)}
            </optgroup>
          ))}
        </Select>
        <Input
          label="Specialization"
          value={value.specialization || ''}
          onChange={(event) => set('specialization', event.target.value)}
          placeholder="e.g. Computer Science, Marketing"
          list="candidate-qualifications-specialization"
        />
        <Input
          label="Department / functional area"
          name="department"
          value={department || ''}
          onChange={(event) => onDepartmentChange(event.target.value)}
          placeholder="e.g. Engineering - Software & QA"
          list="candidate-qualifications-department"
        />
        <Input
          label="Industry"
          value={value.industry || ''}
          onChange={(event) => set('industry', event.target.value)}
          placeholder="e.g. IT Services & Consulting"
          list="candidate-qualifications-industry"
        />
        <Select label="Notice period / availability" value={value.noticePeriod || ''} onChange={(event) => set('noticePeriod', event.target.value || null)}>
          {NOTICE_PERIOD_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </Select>
      </div>
      <div className="mt-4">
        <ChipInput label="Certifications" value={value.certifications || []} onChange={(next) => set('certifications', next)} placeholder="e.g. PMP, AWS Certified Solutions Architect" />
      </div>
      <datalist id="candidate-qualifications-department">
        {DEPARTMENT_ROLE_TAXONOMY.map((group) => <option key={group.department} value={group.department} />)}
      </datalist>
      <datalist id="candidate-qualifications-industry">
        {INDUSTRY_TAXONOMY.map((industry) => <option key={industry} value={industry} />)}
      </datalist>
    </div>
  );
}
