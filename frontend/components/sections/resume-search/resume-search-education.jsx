"use client";

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { EDUCATION_LEVELS, EDUCATION_TYPES, filterEducationCourses } from '@/lib/education-taxonomy';
import { FormSection } from './form-section';

function SpecificCourseSelector({ level, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const groups = filterEducationCourses(level, query);

  return (
    <div className="grid gap-2">
      <span className="text-sm font-semibold text-[var(--color-text)]">Course</span>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex min-h-[2.75rem] items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-left text-sm text-[var(--color-text-secondary)]"
      >
        {value || 'Select a course'}
      </button>
      {open ? (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-3 shadow-[var(--shadow-lg)]">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search course category" className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-sm" />
          <div className="mt-2 grid max-h-56 grid-cols-2 gap-3 overflow-y-auto">
            {groups.map((group) => (
              <div key={group.category}>
                <p className="px-1 pb-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">{group.category}</p>
                {group.courses.map((course) => (
                  <button
                    key={course}
                    type="button"
                    onClick={() => { onChange(course); setOpen(false); }}
                    className={cn(
                      'block w-full rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-sm hover:bg-[var(--color-bg-muted)]',
                      value === course ? 'font-semibold text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)]',
                    )}
                  >
                    {course}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function QualificationBlock({ level, label, value, onChange }) {
  const current = value || { mode: 'ANY' };

  return (
    <div className="grid gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
      <label className="grid gap-2">
        <span className="text-sm font-semibold text-[var(--color-text)]">{label}</span>
        <select
          value={current.mode || 'ANY'}
          onChange={(event) => onChange({ ...current, mode: event.target.value })}
          className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-text)]"
        >
          <option value="ANY">Any {label}</option>
          <option value="SPECIFIC">Specific {label}</option>
          <option value="NONE">No {label}</option>
        </select>
      </label>

      {current.mode === 'SPECIFIC' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <SpecificCourseSelector level={level} value={current.course || ''} onChange={(course) => onChange({ ...current, course })} />
          <Input label="Institute" value={current.institute || ''} onChange={(event) => onChange({ ...current, institute: event.target.value })} />
          <label className="grid gap-2 sm:col-span-2">
            <span className="text-sm font-semibold text-[var(--color-text)]">Education type</span>
            <select
              value={current.educationType || ''}
              onChange={(event) => onChange({ ...current, educationType: event.target.value })}
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-text)]"
            >
              <option value="">Any</option>
              {EDUCATION_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
          <Input label="Completion year from" type="number" value={current.completionYearFrom || ''} onChange={(event) => onChange({ ...current, completionYearFrom: event.target.value })} />
          <Input label="Completion year to" type="number" value={current.completionYearTo || ''} onChange={(event) => onChange({ ...current, completionYearTo: event.target.value })} />
        </div>
      ) : null}
    </div>
  );
}

export function ResumeSearchEducation({ formState, onPatch }) {
  function setLevel(level, value) {
    onPatch({ educationFilters: { ...(formState.educationFilters || {}), [level]: value } });
  }

  return (
    <FormSection title="Education Details">
      <div className="space-y-4">
        {EDUCATION_LEVELS.map(({ value: level, label }) => (
          <QualificationBlock key={level} level={level} label={label} value={formState.educationFilters?.[level]} onChange={(next) => setLevel(level, next)} />
        ))}

        <div className="grid gap-2 text-sm text-[var(--color-text-secondary)]">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={Boolean(formState.educationFilters?.requireUgPg)} onChange={(event) => onPatch({ educationFilters: { ...(formState.educationFilters || {}), requireUgPg: event.target.checked } })} className="h-4 w-4 accent-[var(--color-primary)]" />
            Require both UG and PG
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={Boolean(formState.educationFilters?.requirePgPpg)} onChange={(event) => onPatch({ educationFilters: { ...(formState.educationFilters || {}), requirePgPpg: event.target.checked } })} className="h-4 w-4 accent-[var(--color-primary)]" />
            Require both PG and PPG
          </label>
        </div>
      </div>
    </FormSection>
  );
}
