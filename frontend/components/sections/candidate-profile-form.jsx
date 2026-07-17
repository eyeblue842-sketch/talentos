'use client';

import { useActionState, useEffect, useRef } from 'react';
import { submitCandidateProfileFormAction } from '@/app/candidate/actions';

const initialState = {
  status: 'idle',
  message: '',
  fieldErrors: {},
};

function fieldState(state, name) {
  const error = state.fieldErrors?.[name]?.[0];
  return {
    error,
    describedBy: error ? `${name}-error` : undefined,
  };
}

function InputField({ label, name, required = false, children, error }) {
  return (
    <label className="grid gap-2 text-sm font-medium text-[var(--text)]">
      <span>
        {label}
        {required ? <span className="ml-1 text-[var(--accent)]">*</span> : null}
      </span>
      {children}
      {error ? <span id={`${name}-error`} className="text-sm text-rose-700">{error}</span> : null}
    </label>
  );
}

export function CandidateProfileForm({ profile }) {
  const [state, formAction, pending] = useActionState(submitCandidateProfileFormAction, initialState);
  const summaryRef = useRef(null);

  useEffect(() => {
    if (state.status === 'error' && summaryRef.current) {
      summaryRef.current.focus();
    }
  }, [state]);

  const fullName = fieldState(state, 'fullName');
  const headline = fieldState(state, 'headline');
  const currentTitle = fieldState(state, 'currentTitle');
  const location = fieldState(state, 'location');
  const totalExperience = fieldState(state, 'totalExperience');
  const noticePeriodDays = fieldState(state, 'noticePeriodDays');
  const skills = fieldState(state, 'skills');
  const preferredRoles = fieldState(state, 'preferredRoles');
  const preferredLocations = fieldState(state, 'preferredLocations');
  const currentCtcLpa = fieldState(state, 'currentCtcLpa');
  const expectedCtcLpa = fieldState(state, 'expectedCtcLpa');
  const availability = fieldState(state, 'availability');
  const profileVisibility = fieldState(state, 'profileVisibility');
  const summary = fieldState(state, 'summary');
  const portfolioUrl = fieldState(state, 'portfolioUrl');
  const linkedInUrl = fieldState(state, 'linkedInUrl');
  const githubUrl = fieldState(state, 'githubUrl');
  const profileImageUrl = fieldState(state, 'profileImageUrl');

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      {state.status !== 'idle' ? (
        <div
          ref={summaryRef}
          tabIndex={-1}
          role={state.status === 'error' ? 'alert' : 'status'}
          className={state.status === 'error'
            ? 'rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800'
            : 'rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800'}
        >
          {state.message}
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <InputField label="Full name" name="fullName" required error={fullName.error}>
          <input name="fullName" required defaultValue={profile.fullName || ''} aria-invalid={Boolean(fullName.error)} aria-describedby={fullName.describedBy} className="rounded-2xl border border-[var(--line)] px-4 py-3" />
        </InputField>
        <InputField label="Current title" name="currentTitle" error={currentTitle.error}>
          <input name="currentTitle" defaultValue={profile.currentTitle || ''} aria-invalid={Boolean(currentTitle.error)} aria-describedby={currentTitle.describedBy} className="rounded-2xl border border-[var(--line)] px-4 py-3" />
        </InputField>
        <InputField label="Professional headline" name="headline" error={headline.error}>
          <input name="headline" defaultValue={profile.headline || ''} aria-invalid={Boolean(headline.error)} aria-describedby={headline.describedBy} className="rounded-2xl border border-[var(--line)] px-4 py-3" />
        </InputField>
        <InputField label="Current location" name="location" error={location.error}>
          <input name="location" defaultValue={profile.location || ''} aria-invalid={Boolean(location.error)} aria-describedby={location.describedBy} className="rounded-2xl border border-[var(--line)] px-4 py-3" />
        </InputField>
        <InputField label="Total experience (years)" name="totalExperience" error={totalExperience.error}>
          <input name="totalExperience" type="number" min="0" defaultValue={profile.totalExperience || 0} aria-invalid={Boolean(totalExperience.error)} aria-describedby={totalExperience.describedBy} className="rounded-2xl border border-[var(--line)] px-4 py-3" />
        </InputField>
        <InputField label="Notice period (days)" name="noticePeriodDays" error={noticePeriodDays.error}>
          <input name="noticePeriodDays" type="number" min="0" defaultValue={profile.noticePeriodDays || ''} aria-invalid={Boolean(noticePeriodDays.error)} aria-describedby={noticePeriodDays.describedBy} className="rounded-2xl border border-[var(--line)] px-4 py-3" />
        </InputField>
        <InputField label="Skills" name="skills" error={skills.error}>
          <input name="skills" defaultValue={(profile.skills || []).join(', ')} aria-invalid={Boolean(skills.error)} aria-describedby={skills.describedBy} className="rounded-2xl border border-[var(--line)] px-4 py-3 md:col-span-2" />
        </InputField>
        <InputField label="Preferred roles" name="preferredRoles" error={preferredRoles.error}>
          <input name="preferredRoles" defaultValue={(profile.preferredRoles || []).join(', ')} aria-invalid={Boolean(preferredRoles.error)} aria-describedby={preferredRoles.describedBy} className="rounded-2xl border border-[var(--line)] px-4 py-3" />
        </InputField>
        <InputField label="Preferred locations" name="preferredLocations" error={preferredLocations.error}>
          <input name="preferredLocations" defaultValue={(profile.preferredLocations || []).join(', ')} aria-invalid={Boolean(preferredLocations.error)} aria-describedby={preferredLocations.describedBy} className="rounded-2xl border border-[var(--line)] px-4 py-3" />
        </InputField>
        <InputField label="Current salary (LPA)" name="currentCtcLpa" error={currentCtcLpa.error}>
          <input name="currentCtcLpa" type="number" min="0" defaultValue={profile.currentCtcLpa || ''} aria-invalid={Boolean(currentCtcLpa.error)} aria-describedby={currentCtcLpa.describedBy} className="rounded-2xl border border-[var(--line)] px-4 py-3" />
        </InputField>
        <InputField label="Expected salary (LPA)" name="expectedCtcLpa" error={expectedCtcLpa.error}>
          <input name="expectedCtcLpa" type="number" min="0" defaultValue={profile.expectedCtcLpa || ''} aria-invalid={Boolean(expectedCtcLpa.error)} aria-describedby={expectedCtcLpa.describedBy} className="rounded-2xl border border-[var(--line)] px-4 py-3" />
        </InputField>
        <InputField label="Availability" name="availability" error={availability.error}>
          <select name="availability" defaultValue={profile.availability || 'IMMEDIATE'} aria-invalid={Boolean(availability.error)} aria-describedby={availability.describedBy} className="rounded-2xl border border-[var(--line)] px-4 py-3">
            <option value="IMMEDIATE">Immediate</option>
            <option value="TWO_WEEKS">Two weeks</option>
            <option value="ONE_MONTH">One month</option>
            <option value="NOT_LOOKING">Not looking</option>
          </select>
        </InputField>
        <InputField label="Profile visibility" name="profileVisibility" error={profileVisibility.error}>
          <select name="profileVisibility" defaultValue={profile.profileVisibility || 'PRIVATE'} aria-invalid={Boolean(profileVisibility.error)} aria-describedby={profileVisibility.describedBy} className="rounded-2xl border border-[var(--line)] px-4 py-3">
            <option value="PRIVATE">Private</option>
            <option value="RECRUITERS_ONLY">Recruiters only</option>
            <option value="PUBLIC">Public</option>
          </select>
        </InputField>
      </div>
      <fieldset className="grid gap-3">
        <legend className="font-semibold">Workplace preferences</legend>
        <div className="flex flex-wrap gap-4">
          {['REMOTE', 'HYBRID', 'ONSITE'].map((value) => (
            <label key={value} className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" name="workplacePreferences" value={value} defaultChecked={(profile.workplacePreferences || []).includes(value)} className="h-4 w-4 accent-[var(--brand)]" />
              {value.replaceAll('_', ' ')}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="grid gap-3">
        <legend className="font-semibold">Employment preferences</legend>
        <div className="flex flex-wrap gap-4">
          {['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'].map((value) => (
            <label key={value} className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" name="employmentPreferences" value={value} defaultChecked={(profile.employmentPreferences || []).includes(value)} className="h-4 w-4 accent-[var(--brand)]" />
              {value.replaceAll('_', ' ')}
            </label>
          ))}
        </div>
      </fieldset>
      <InputField label="Professional summary" name="summary" error={summary.error}>
        <textarea name="summary" defaultValue={profile.summary || ''} rows={6} aria-invalid={Boolean(summary.error)} aria-describedby={summary.describedBy} className="rounded-[24px] border border-[var(--line)] px-4 py-3" />
      </InputField>
      <div className="grid gap-4 md:grid-cols-2">
        <InputField label="Portfolio URL" name="portfolioUrl" error={portfolioUrl.error}>
          <input name="portfolioUrl" defaultValue={profile.portfolioUrl || ''} aria-invalid={Boolean(portfolioUrl.error)} aria-describedby={portfolioUrl.describedBy} className="rounded-2xl border border-[var(--line)] px-4 py-3" />
        </InputField>
        <InputField label="LinkedIn URL" name="linkedInUrl" error={linkedInUrl.error}>
          <input name="linkedInUrl" defaultValue={profile.linkedInUrl || ''} aria-invalid={Boolean(linkedInUrl.error)} aria-describedby={linkedInUrl.describedBy} className="rounded-2xl border border-[var(--line)] px-4 py-3" />
        </InputField>
        <InputField label="GitHub URL" name="githubUrl" error={githubUrl.error}>
          <input name="githubUrl" defaultValue={profile.githubUrl || ''} aria-invalid={Boolean(githubUrl.error)} aria-describedby={githubUrl.describedBy} className="rounded-2xl border border-[var(--line)] px-4 py-3" />
        </InputField>
        <InputField label="Profile image URL" name="profileImageUrl" error={profileImageUrl.error}>
          <input name="profileImageUrl" defaultValue={profile.profileImageUrl || ''} aria-invalid={Boolean(profileImageUrl.error)} aria-describedby={profileImageUrl.describedBy} className="rounded-2xl border border-[var(--line)] px-4 py-3" />
        </InputField>
      </div>
      <button type="submit" disabled={pending} className="rounded-2xl bg-[var(--brand)] px-5 py-3 font-semibold text-white disabled:opacity-60">
        {pending ? 'Saving profile...' : 'Save profile'}
      </button>
    </form>
  );
}

