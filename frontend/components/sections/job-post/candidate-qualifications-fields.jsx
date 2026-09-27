"use client";

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { CascadeSelect, toCascadeOptions } from '@/components/ui/cascade-select';
import { ChipInput } from '@/components/ui/chip-input';
import { EDUCATION_LEVELS, educationCourseTree, specializationsForDegree } from '@/lib/education-taxonomy';
import { INDUSTRY_TREE } from '@/lib/industry-taxonomy';
import { DEPARTMENT_OPTIONS, rolesForDepartment } from '@/lib/department-role-taxonomy';

// Sentinel leaf for "type my own" on Department/Role - selecting it reveals a
// free-text box, and the typed value is stored directly (Job.department is a
// real column used by matching/search, so we never persist a placeholder there).
const OTHER_VALUE = '__OTHER__';

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
  const courseTree = useMemo(
    () => educationCourseTree(value.minimumQualification || 'ug'),
    [value.minimumQualification],
  );
  // Specialization options follow the chosen Degree, plus an "Other" escape
  // hatch that reveals a custom box (mirrors the create wizard).
  const specializationOptions = useMemo(
    () => toCascadeOptions([...specializationsForDegree(value.educationCourse), 'Other']),
    [value.educationCourse],
  );
  const departmentOptions = useMemo(() => [...DEPARTMENT_OPTIONS, { label: 'Other', value: OTHER_VALUE }], []);
  const roleOptions = useMemo(() => [...rolesForDepartment(department), { label: 'Other', value: OTHER_VALUE }], [department]);

  // Custom-entry mode is on when a saved value isn't part of the taxonomy, so
  // editing a job with a hand-typed department/role reopens the custom box.
  const [departmentCustom, setDepartmentCustom] = useState(
    () => Boolean(department) && !DEPARTMENT_OPTIONS.some((option) => option.value === department),
  );
  const [roleCustom, setRoleCustom] = useState(
    () => Boolean(value.role) && !rolesForDepartment(department).some((option) => option.value === value.role),
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
      <div className="grid items-start gap-4 md:grid-cols-2">
        <Input label="Minimum experience (years)" type="number" min="0" name="experienceMin" value={experienceMin} onChange={(event) => onExperienceMinChange(event.target.value)} required />
        <Input label="Maximum experience (years)" type="number" min="0" name="experienceMax" value={experienceMax} onChange={(event) => onExperienceMaxChange(event.target.value)} required />
        <Input label="Relevant experience (years)" type="number" min="0" value={value.relevantExperience || ''} onChange={(event) => set('relevantExperience', event.target.value)} helpText="Experience specifically in the skills required for this role." />
        <Select label="Minimum qualification" value={value.minimumQualification || ''} onChange={(event) => set('minimumQualification', event.target.value || null)}>
          <option value="">Any qualification</option>
          {EDUCATION_LEVELS.map((level) => <option key={level.value} value={level.value}>{level.label}</option>)}
        </Select>
        <CascadeSelect
          label="Education / course"
          options={courseTree}
          value={value.educationCourse || ''}
          onChange={(next) => set('educationCourse', next || null)}
          disabled={!value.minimumQualification}
          placeholder={value.minimumQualification ? 'Any course' : 'Select a minimum qualification first'}
        />
        <div className="grid gap-2.5">
          <CascadeSelect
            label="Specialization"
            options={specializationOptions}
            value={value.specialization || ''}
            onChange={(next) => set('specialization', next || null)}
            placeholder="Any specialization"
          />
          {value.specialization === 'Other' ? (
            <Input aria-label="Custom specialization" value={value.specializationOther || ''} onChange={(event) => set('specializationOther', event.target.value)} placeholder="Enter specialization" />
          ) : null}
        </div>
        <div className="grid gap-2.5">
          <CascadeSelect
            label="Department / functional area"
            options={departmentOptions}
            value={departmentCustom ? OTHER_VALUE : (department || '')}
            onChange={(next) => {
              if (next === OTHER_VALUE) { setDepartmentCustom(true); onDepartmentChange(''); }
              else { setDepartmentCustom(false); onDepartmentChange(next || ''); }
            }}
            placeholder="Any department"
          />
          {departmentCustom ? (
            <Input aria-label="Custom department" value={department || ''} onChange={(event) => onDepartmentChange(event.target.value)} placeholder="Enter department" />
          ) : null}
        </div>
        <div className="grid gap-2.5">
          <CascadeSelect
            label="Role"
            options={roleOptions}
            value={roleCustom ? OTHER_VALUE : (value.role || '')}
            onChange={(next) => {
              if (next === OTHER_VALUE) { setRoleCustom(true); set('role', ''); }
              else { setRoleCustom(false); set('role', next || null); }
            }}
            disabled={!department}
            placeholder={department ? 'Any role' : 'Select a department first'}
          />
          {roleCustom && department ? (
            <Input aria-label="Custom role" value={value.role || ''} onChange={(event) => set('role', event.target.value)} placeholder="Enter role" />
          ) : null}
        </div>
        <CascadeSelect
          label="Industry"
          options={INDUSTRY_TREE}
          value={value.industry || ''}
          onChange={(next) => set('industry', next || null)}
          placeholder="Any industry"
        />
        <Select label="Notice period / availability" value={value.noticePeriod || ''} onChange={(event) => set('noticePeriod', event.target.value || null)}>
          {NOTICE_PERIOD_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </Select>
      </div>
      <div className="mt-4">
        <ChipInput label="Certifications" value={value.certifications || []} onChange={(next) => set('certifications', next)} placeholder="e.g. PMP, AWS Certified Solutions Architect" />
      </div>
    </div>
  );
}
