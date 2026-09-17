"use client";

import { Textarea } from '@/components/ui/textarea';

function ArrayField({
  label,
  value,
  onChange,
  helpText,
  error,
  disabled = false,
}) {
  return (
    <Textarea
      label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      helpText={helpText}
      error={error}
      disabled={disabled}
      textareaClassName="min-h-32"
    />
  );
}

export function JobDescriptionEditor({
  value,
  errors = {},
  disabled = false,
  onFieldChange,
}) {
  return (
    <div className="grid gap-5">
      <Textarea
        label="Job Summary"
        value={value.title}
        onChange={(event) => onFieldChange('title', event.target.value)}
        helpText="Short recruiter-facing heading for this draft."
        error={errors.title}
        disabled={disabled}
        textareaClassName="min-h-24"
      />

      <Textarea
        label="Opening summary"
        value={value.openingSummary}
        onChange={(event) => onFieldChange('openingSummary', event.target.value)}
        helpText="Concise candidate-facing introduction."
        error={errors.openingSummary}
        disabled={disabled}
        textareaClassName="min-h-24"
      />

      <Textarea
        label="Role overview"
        value={value.roleOverview}
        onChange={(event) => onFieldChange('roleOverview', event.target.value)}
        helpText="2-3 role-specific sentences describing the role."
        error={errors.roleOverview}
        disabled={disabled}
        textareaClassName="min-h-32"
      />

      {Array.isArray(value.additionalSections) && value.additionalSections.length ? (
        <div className="grid gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-muted)] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Additional sections (preserved)</p>
          {value.additionalSections.map((section) => (
            <div key={section.heading}>
              <p className="text-sm font-semibold text-[var(--color-text)]">{section.heading}</p>
              <p className="text-sm text-[var(--color-text-secondary)]">{section.body}</p>
            </div>
          ))}
        </div>
      ) : null}

      <ArrayField
        label="Key Responsibilities"
        value={value.keyResponsibilities}
        onChange={(nextValue) => onFieldChange('keyResponsibilities', nextValue)}
        helpText="Enter one responsibility per line."
        error={errors.keyResponsibilities}
        disabled={disabled}
      />

      <ArrayField
        label="Required Qualifications"
        value={value.requiredQualifications}
        onChange={(nextValue) => onFieldChange('requiredQualifications', nextValue)}
        helpText="Enter one required skill or qualification per line."
        error={errors.requiredQualifications}
        disabled={disabled}
      />

      <ArrayField
        label="Preferred Qualifications"
        value={value.preferredQualifications}
        onChange={(nextValue) => onFieldChange('preferredQualifications', nextValue)}
        helpText="Enter one preferred qualification per line. Leave empty if none."
        error={errors.preferredQualifications}
        disabled={disabled}
      />

      <ArrayField
        label="Screening Questions"
        value={value.screeningQuestions}
        onChange={(nextValue) => onFieldChange('screeningQuestions', nextValue)}
        helpText="Enter one screening question per line."
        error={errors.screeningQuestions}
        disabled={disabled}
      />

      <ArrayField
        label="Interview Focus"
        value={value.interviewFocus}
        onChange={(nextValue) => onFieldChange('interviewFocus', nextValue)}
        helpText="Enter one interview focus area per line."
        error={errors.interviewFocus}
        disabled={disabled}
      />
    </div>
  );
}
