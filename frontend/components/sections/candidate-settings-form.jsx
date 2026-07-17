'use client';

import { useActionState, useEffect, useRef } from 'react';
import { submitCandidateSettingsFormAction } from '@/app/candidate/actions';

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

export function CandidateSettingsForm({ settings }) {
  const [state, formAction, pending] = useActionState(submitCandidateSettingsFormAction, initialState);
  const summaryRef = useRef(null);

  useEffect(() => {
    if (state.status === 'error' && summaryRef.current) {
      summaryRef.current.focus();
    }
  }, [state]);

  const profileVisibility = fieldState(state, 'profileVisibility');
  const preferredLocations = fieldState(state, 'preferredLocations');

  return (
    <form action={formAction} className="grid gap-5" noValidate>
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
      <label className="grid gap-2 text-sm font-medium text-[var(--text)]">
        <span>Profile visibility</span>
        <select name="profileVisibility" defaultValue={settings.profileVisibility || 'PRIVATE'} aria-invalid={Boolean(profileVisibility.error)} aria-describedby={profileVisibility.describedBy} className="rounded-2xl border border-[var(--line)] px-4 py-3">
          <option value="PRIVATE">Private profile</option>
          <option value="RECRUITERS_ONLY">Recruiters only</option>
          <option value="PUBLIC">Public profile</option>
        </select>
        {profileVisibility.error ? <span id="profileVisibility-error" className="text-sm text-rose-700">{profileVisibility.error}</span> : null}
      </label>
      <label className="grid gap-2 text-sm font-medium text-[var(--text)]">
        <span>Preferred job locations</span>
        <input name="preferredLocations" defaultValue={(settings.preferredLocations || []).join(', ')} aria-invalid={Boolean(preferredLocations.error)} aria-describedby={preferredLocations.describedBy} className="rounded-2xl border border-[var(--line)] px-4 py-3" />
        {preferredLocations.error ? <span id="preferredLocations-error" className="text-sm text-rose-700">{preferredLocations.error}</span> : null}
      </label>
      <fieldset className="grid gap-3">
        <legend className="font-semibold">Preferred workplace types</legend>
        <div className="flex flex-wrap gap-4">
          {['REMOTE', 'HYBRID', 'ONSITE'].map((value) => (
            <label key={value} className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" name="workplacePreferences" value={value} defaultChecked={(settings.workplacePreferences || []).includes(value)} className="h-4 w-4 accent-[var(--brand)]" />
              {value.replaceAll('_', ' ')}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="grid gap-3">
        <legend className="font-semibold">Preferred employment types</legend>
        <div className="flex flex-wrap gap-4">
          {['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'].map((value) => (
            <label key={value} className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" name="employmentPreferences" value={value} defaultChecked={(settings.employmentPreferences || []).includes(value)} className="h-4 w-4 accent-[var(--brand)]" />
              {value.replaceAll('_', ' ')}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3">
        <label className="inline-flex items-center gap-3 text-sm"><input name="recommendationEnabled" type="checkbox" defaultChecked={settings.recommendationEnabled} className="h-4 w-4 accent-[var(--brand)]" /> Enable recommendations</label>
        <label className="inline-flex items-center gap-3 text-sm"><input name="notifyForSavedJobUpdates" type="checkbox" defaultChecked={settings.notifyForSavedJobUpdates} className="h-4 w-4 accent-[var(--brand)]" /> Notify me when saved jobs change</label>
        <label className="inline-flex items-center gap-3 text-sm"><input name="notifyForRecommendations" type="checkbox" defaultChecked={settings.notifyForRecommendations} className="h-4 w-4 accent-[var(--brand)]" /> Notify me about recommendation refreshes</label>
        <label className="inline-flex items-center gap-3 text-sm"><input name="notifyForInterviews" type="checkbox" defaultChecked={settings.notifyForInterviews} className="h-4 w-4 accent-[var(--brand)]" /> Notify me about interviews</label>
      </div>
      <div className="rounded-[24px] border border-dashed border-[var(--line)] p-4 text-sm text-[var(--muted)]">
        Account deletion is not available in this phase. Contact support for a reviewed deletion request workflow.
      </div>
      <button type="submit" disabled={pending} className="rounded-2xl bg-[var(--brand)] px-5 py-3 font-semibold text-white disabled:opacity-60">
        {pending ? 'Saving settings...' : 'Save settings'}
      </button>
    </form>
  );
}
