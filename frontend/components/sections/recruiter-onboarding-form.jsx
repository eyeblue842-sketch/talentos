'use client';

import { useActionState, useState } from 'react';
import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OnboardingSubmitButton } from '@/components/sections/onboarding-submit-button';
import { completeRecruiterOnboardingAction, editRecruiterOrganisationAction } from '@/app/recruiter/actions';

const initialActionState = { status: 'idle', message: '', fieldErrors: {}, formErrors: [], values: {} };

export function RecruiterOnboardingForm({ initialValues, invitationRoles, edit = false, action }) {
  const resolvedAction = action || (edit ? editRecruiterOrganisationAction : completeRecruiterOnboardingAction);
  const [state, formAction] = useActionState(resolvedAction, initialActionState);
  const values = { ...initialValues, ...(state.values || {}) };
  const initialLocations = Array.isArray(values.companyLocations)
    ? values.companyLocations
    : (() => { try { return JSON.parse(values.companyLocationsJson || '[]'); } catch { return []; } })();
  const [locations, setLocations] = useState(initialLocations);
  const [locationInput, setLocationInput] = useState('');
  const errorFor = (name) => state.fieldErrors?.[name]?.[0];
  const field = (name, label, props = {}) => (
    <label className="grid min-w-0 gap-1.5 text-sm font-semibold" htmlFor={`onboarding-${name}`}>
      {label}
      <input id={`onboarding-${name}`} name={name} defaultValue={values[name] || ''} className={`min-w-0 rounded-2xl border px-4 py-3 font-normal ${errorFor(name) ? 'border-red-500' : 'border-[var(--line)]'}`} {...props} />
      {errorFor(name) ? <span className="text-xs font-normal text-red-600">{errorFor(name)}</span> : null}
    </label>
  );

  return (
    <form action={formAction} className="mt-6 grid min-w-0 gap-4 md:grid-cols-2">
      {field('organisationName', 'Organisation name', { required: true })}
      {field('workspaceSlug', 'Workspace slug', { required: true, placeholder: 'workspace-slug' })}
      {field('companyWebsite', 'Company website', { placeholder: 'https://example.com', inputMode: 'url' })}
      {field('industry', 'Industry', { required: true })}
      {field('companySize', 'Company size', { required: true })}
      {field('location', 'Headquarters or primary location', { required: true })}
      {field('designation', 'Your designation', { required: true })}
      {edit ? <>
        <div className="grid min-w-0 gap-1.5 text-sm font-semibold md:col-span-2">
          <span>Company locations</span>
          <div className="flex min-w-0 flex-wrap gap-2 rounded-2xl border border-[var(--line)] p-3">
            {locations.map((location) => <span key={location} className="inline-flex max-w-full items-center gap-2 rounded-full bg-[var(--soft)] px-3 py-1 text-xs"><span className="max-w-full break-words">{location}</span><button type="button" onClick={() => setLocations((current) => current.filter((item) => item !== location))} aria-label={`Remove ${location}`}>×</button></span>)}
            <input value={locationInput} onChange={(event) => setLocationInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && locationInput.trim()) { event.preventDefault(); const next = locationInput.trim(); setLocations((current) => current.includes(next) ? current : [...current, next]); setLocationInput(''); } }} placeholder="Add a city or office" className="min-w-[12rem] flex-1 border-0 px-2 py-1 text-sm outline-none" />
          </div>
          <span className="text-xs font-normal text-[var(--muted)]">Press Enter to add locations. Duplicates are ignored.</span>
          <input type="hidden" name="companyLocationsJson" value={JSON.stringify(locations)} />
        </div>
        <div className="grid min-w-0 gap-1.5 text-sm font-semibold md:col-span-2">
          <span>About the company</span>
          <span className="text-xs font-normal text-[var(--muted)]">Describe your organisation, its services, expertise and what makes it different.</span>
          <textarea name="publicDescription" defaultValue={values.publicDescription || ''} maxLength={4000} className="min-h-32 min-w-0 max-w-full rounded-2xl border border-[var(--line)] px-4 py-3 font-normal" />
          <span className="text-right text-xs font-normal text-[var(--muted)]">{String(values.publicDescription || '').length}/4000</span>
        </div>
        <div className="grid min-w-0 gap-1.5 text-sm font-semibold md:col-span-2">
          <span>Company culture</span>
          <span className="text-xs font-normal text-[var(--muted)]">Describe your workplace culture, values, employee experience and working environment.</span>
          <textarea name="cultureSummary" defaultValue={values.cultureSummary || ''} maxLength={2000} className="min-h-32 min-w-0 max-w-full rounded-2xl border border-[var(--line)] px-4 py-3 font-normal" />
          <span className="text-right text-xs font-normal text-[var(--muted)]">{String(values.cultureSummary || '').length}/2000</span>
        </div>
      </> : null}
      {!edit ? <div className="min-w-0 rounded-2xl border border-[var(--line)] p-4 md:col-span-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]"><Mail size={16} aria-hidden="true" />Team invitation</div>
        <p className="mt-2 text-sm text-[var(--muted)]">Optional. Send one secure workspace invitation while finishing setup.</p>
        <div className="mt-4 grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
          {field('teamInvitationEmail', 'Email', { placeholder: 'teammate@company.com' })}
          <label className="grid min-w-0 gap-1.5 text-sm font-semibold" htmlFor="onboarding-teamInvitationRole">Role<select id="onboarding-teamInvitationRole" name="teamInvitationRole" defaultValue={values.teamInvitationRole || 'RECRUITER'} className="rounded-2xl border border-[var(--line)] px-4 py-3 font-normal">{invitationRoles.map((role) => <option key={role} value={role}>{role}</option>)}</select></label>
        </div>
      </div> : null}
      {state.status === 'error' ? <div className="grid gap-1 text-sm text-red-600 md:col-span-2"><span>{state.message}</span>{state.formErrors?.map((message) => <span key={message}>{message}</span>)}</div> : null}
      <div className="flex flex-wrap items-center gap-3 md:col-span-2"><OnboardingSubmitButton edit={edit} /><Button as="a" href="/recruiter/home?tab=about" variant="outline">Cancel</Button></div>
    </form>
  );
}
