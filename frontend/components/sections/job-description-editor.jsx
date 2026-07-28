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
        label="Job Description"
        value={value.summary}
        onChange={(event) => onFieldChange('summary', event.target.value)}
        helpText="Primary description that will be applied to the live job."
        error={errors.summary}
        disabled={disabled}
        textareaClassName="min-h-40"
      />

      <ArrayField
        label="Responsibilities"
        value={value.responsibilities}
        onChange={(nextValue) => onFieldChange('responsibilities', nextValue)}
        helpText="Enter one responsibility per line."
        error={errors.responsibilities}
        disabled={disabled}
      />

      <ArrayField
        label="Required Skills"
        value={value.requiredSkills}
        onChange={(nextValue) => onFieldChange('requiredSkills', nextValue)}
        helpText="Enter one required skill per line."
        error={errors.requiredSkills}
        disabled={disabled}
      />

      <ArrayField
        label="Preferred Skills"
        value={value.preferredSkills}
        onChange={(nextValue) => onFieldChange('preferredSkills', nextValue)}
        helpText="Enter one preferred skill per line."
        error={errors.preferredSkills}
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
