'use client';

import { useActionState, useEffect, useRef } from 'react';
import { requestCandidateAccountDeactivationAction, submitCandidateSettingsFormAction } from '@/app/candidate/actions';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FormActions, FormSection } from '@/components/ui/form-layout';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

const initialState = {
  status: 'idle',
  message: '',
  fieldErrors: {},
};

function fieldState(state, name) {
  const error = state.fieldErrors?.[name]?.[0];
  return {
    error,
  };
}

export function CandidateSettingsForm({ settings }) {
  const [state, formAction, pending] = useActionState(submitCandidateSettingsFormAction, initialState);
  const [deactivationState, deactivationAction, deactivationPending] = useActionState(requestCandidateAccountDeactivationAction, initialState);
  const summaryRef = useRef(null);

  useEffect(() => {
    if (state.status === 'error' && summaryRef.current) {
      summaryRef.current.focus();
    }
  }, [state]);

  const profileVisibility = fieldState(state, 'profileVisibility');
  const preferredLocations = fieldState(state, 'preferredLocations');

  return (
    <form action={formAction} className="grid gap-6" noValidate>
      {state.status !== 'idle' ? (
        <Alert
          ref={summaryRef}
          tone={state.status === 'error' ? 'danger' : 'success'}
          title={state.status === 'error' ? 'Settings could not be saved' : 'Settings saved'}
          tabIndex={-1}
        >
          {state.message}
        </Alert>
      ) : null}

      <FormSection title="Role preferences" description="Tell Careeriz which roles and employers fit your search.">
        <Input name="preferredRoles" label="Preferred job titles" defaultValue={(settings.preferredRoles || []).join(', ')} />
        <Input name="preferredIndustries" label="Preferred industries" defaultValue={(settings.preferredIndustries || []).join(', ')} />
        <Input name="preferredCompanySizes" label="Preferred company sizes" defaultValue={(settings.preferredCompanySizes || []).join(', ')} />
      </FormSection>

      <FormSection title="Location and work mode" description="Control where and how you want to work.">
        <Input name="preferredLocations" label="Preferred job locations" defaultValue={(settings.preferredLocations || []).join(', ')} error={preferredLocations.error} />
        <Checkbox name="willingToRelocate" defaultChecked={settings.willingToRelocate} label="Open to relocation" />
        <fieldset className="grid gap-3">
          <legend className="text-sm font-semibold text-[var(--color-text)]">Preferred workplace types</legend>
          <div className="flex flex-wrap gap-4">
            {['REMOTE', 'HYBRID', 'ONSITE'].map((value) => (
              <Checkbox key={value} name="workplacePreferences" value={value} defaultChecked={(settings.workplacePreferences || []).includes(value)} label={value.replaceAll('_', ' ')} />
            ))}
          </div>
        </fieldset>
        <fieldset className="grid gap-3">
          <legend className="text-sm font-semibold text-[var(--color-text)]">Preferred employment types</legend>
          <div className="flex flex-wrap gap-4">
            {['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'].map((value) => (
              <Checkbox key={value} name="employmentPreferences" value={value} defaultChecked={(settings.employmentPreferences || []).includes(value)} label={value.replaceAll('_', ' ')} />
            ))}
          </div>
        </fieldset>
      </FormSection>

      <FormSection title="Compensation and availability">
        <div className="grid gap-4 md:grid-cols-2">
          <Input name="minExpectedSalary" label="Minimum expected salary" type="number" defaultValue={settings.minExpectedSalary || ''} />
          <Input name="preferredCurrency" label="Preferred currency" defaultValue={settings.preferredCurrency || ''} />
          <Select name="availability" label="Availability" defaultValue={settings.availability || 'IMMEDIATE'}>
            <option value="IMMEDIATE">Immediate</option>
            <option value="TWO_WEEKS">Two weeks</option>
            <option value="ONE_MONTH">One month</option>
            <option value="NOT_LOOKING">Not looking</option>
          </Select>
          <Input name="noticePeriodDays" label="Notice period in days" type="number" defaultValue={settings.noticePeriodDays || ''} />
        </div>
      </FormSection>

      <FormSection title="Work authorization">
        <div className="grid gap-4 md:grid-cols-2">
          <Input name="workAuthorization" label="Work authorization" defaultValue={settings.workAuthorization || ''} />
          <Input name="travelWillingness" label="Travel willingness" defaultValue={settings.travelWillingness || ''} />
        </div>
        <Checkbox name="requiresVisaSponsorship" defaultChecked={settings.requiresVisaSponsorship} label="Requires visa sponsorship" />
      </FormSection>

      <FormSection title="Alerts and notifications" description="Control which candidate updates appear in-app.">
        <Select name="profileVisibility" label="Profile visibility" defaultValue={settings.profileVisibility || 'PRIVATE'} error={profileVisibility.error}>
            <option value="PRIVATE">Private profile</option>
            <option value="RECRUITERS_ONLY">Recruiters only</option>
            <option value="PUBLIC">Public profile</option>
        </Select>
        <Checkbox name="recommendationEnabled" defaultChecked={settings.recommendationEnabled} label="Enable recommendations" />
        <Checkbox name="jobAlertEnabled" defaultChecked={settings.jobAlertEnabled} label="Enable job alerts" />
        <Checkbox name="searchableProfile" defaultChecked={settings.searchableProfile} label="Allow recruiter discovery where Careeriz permissions allow it" />
        <Checkbox name="phoneVisibleToRecruiters" defaultChecked={settings.phoneVisibleToRecruiters} label="Allow recruiters to view phone number when permitted" />
        <Checkbox name="salaryVisibleToRecruiters" defaultChecked={settings.salaryVisibleToRecruiters} label="Allow recruiters to view salary details when permitted" />
        <Checkbox name="resumeVisibleToRecruiters" defaultChecked={settings.resumeVisibleToRecruiters ?? true} label="Allow recruiters to view resume when permitted" />
        <Select name="jobAlertFrequency" label="Job alert frequency" defaultValue={settings.jobAlertFrequency || 'WEEKLY'}>
            <option value="IMMEDIATE">Immediate</option>
            <option value="DAILY">Daily</option>
            <option value="WEEKLY">Weekly</option>
            <option value="DISABLED">Disabled</option>
        </Select>
        <div className="grid gap-3">
          <Checkbox name="notifyForApplicationUpdates" defaultChecked={settings.notifyForApplicationUpdates} label="Application updates" />
          <Checkbox name="notifyForInterviews" defaultChecked={settings.notifyForInterviews} label="Interview updates" />
          <Checkbox name="notifyForOffers" defaultChecked={settings.notifyForOffers} label="Offer updates" />
          <Checkbox name="notifyForSavedJobUpdates" defaultChecked={settings.notifyForSavedJobUpdates} label="Saved-job updates" />
          <Checkbox name="notifyForRecommendations" defaultChecked={settings.notifyForRecommendations} label="Recommendation refreshes" />
          <Checkbox name="notifyForProfileReminders" defaultChecked={settings.notifyForProfileReminders} label="Profile reminders" />
          <Checkbox name="notifyForMarketing" defaultChecked={settings.notifyForMarketing} label="Product updates" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
            <p className="text-sm font-semibold text-[var(--color-text)]">Email preferences</p>
            <div className="mt-3 grid gap-3">
              <Checkbox name="emailApplicationUpdates" defaultChecked={settings.notificationPreferences?.email?.applicationUpdates ?? true} label="Application updates" />
              <Checkbox name="emailInterviewUpdates" defaultChecked={settings.notificationPreferences?.email?.interviewUpdates ?? true} label="Interview updates" />
              <Checkbox name="emailOfferUpdates" defaultChecked={settings.notificationPreferences?.email?.offerUpdates ?? true} label="Offer updates" />
              <Checkbox name="emailJobRecommendations" defaultChecked={settings.notificationPreferences?.email?.jobRecommendations ?? settings.notifyForRecommendations} label="Job recommendations" />
              <Checkbox name="emailJobAlerts" defaultChecked={settings.notificationPreferences?.email?.jobAlerts ?? settings.jobAlertEnabled} label="Job alerts" />
              <Checkbox name="emailProductAnnouncements" defaultChecked={settings.notificationPreferences?.email?.productAnnouncements ?? settings.notifyForMarketing} label="Product announcements" />
              <Checkbox name="emailSecurityAlerts" defaultChecked disabled label="Security alerts (required)" />
            </div>
          </div>
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
            <p className="text-sm font-semibold text-[var(--color-text)]">In-app preferences</p>
            <div className="mt-3 grid gap-3">
              <Checkbox name="inAppApplicationUpdates" defaultChecked={settings.notificationPreferences?.inApp?.applicationUpdates ?? settings.notifyForApplicationUpdates} label="Application updates" />
              <Checkbox name="inAppInterviewUpdates" defaultChecked={settings.notificationPreferences?.inApp?.interviewUpdates ?? settings.notifyForInterviews} label="Interview updates" />
              <Checkbox name="inAppOfferUpdates" defaultChecked={settings.notificationPreferences?.inApp?.offerUpdates ?? settings.notifyForOffers} label="Offer updates" />
              <Checkbox name="inAppJobRecommendations" defaultChecked={settings.notificationPreferences?.inApp?.jobRecommendations ?? settings.notifyForRecommendations} label="Job recommendations" />
              <Checkbox name="inAppJobAlerts" defaultChecked={settings.notificationPreferences?.inApp?.jobAlerts ?? settings.notifyForSavedJobUpdates} label="Job alerts and saved job updates" />
              <Checkbox name="inAppProductAnnouncements" defaultChecked={settings.notificationPreferences?.inApp?.productAnnouncements ?? settings.notifyForMarketing} label="Product announcements" />
              <Checkbox name="inAppSecurityAlerts" defaultChecked disabled label="Security alerts (required)" />
            </div>
          </div>
        </div>
      </FormSection>

      <FormSection title="Account and data" description="Use the current auth architecture for password changes. Session management remains unchanged in this milestone.">
        <div className="flex flex-wrap gap-3">
          <a href="/api/candidate/export" className="inline-flex min-h-11 items-center rounded-[var(--radius-md)] border border-[var(--color-border-strong)] px-4 text-sm font-semibold text-[var(--color-text)]">Download data export</a>
          <a href="/auth" className="inline-flex min-h-11 items-center rounded-[var(--radius-md)] border border-[var(--color-border-strong)] px-4 text-sm font-semibold text-[var(--color-text)]">Open password reset flow</a>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-strong)] p-4 text-sm text-[var(--color-text-muted)]">
          Candidate deletion uses a deactivation-request workflow in this milestone so application, interview, offer, and audit records remain intact.
        </div>
        <div className="rounded-[var(--radius-lg)] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <p className="font-semibold">Request account deactivation</p>
          <p className="mt-2">This records a reviewed deactivation request instead of destroying regulated recruitment history immediately.</p>
          <form action={deactivationAction} className="mt-4 grid gap-3">
            <Input name="reason" label="Reason for request" required />
            <Button type="submit" variant="danger" disabled={deactivationPending} loading={deactivationPending}>
              {deactivationPending ? 'Submitting request...' : 'Request deactivation'}
            </Button>
            {deactivationState.status !== 'idle' ? (
              <Alert tone={deactivationState.status === 'error' ? 'danger' : 'success'} title={deactivationState.status === 'error' ? 'Request failed' : 'Request recorded'}>
                {deactivationState.message}
              </Alert>
            ) : null}
          </form>
        </div>
      </FormSection>

      <FormActions>
        <Button type="submit" disabled={pending} loading={pending}>
          {pending ? 'Saving settings...' : 'Save preferences'}
        </Button>
      </FormActions>
    </form>
  );
}
