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

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-muted)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
        Looking for role preferences, location &amp; work mode, compensation, or work authorization? Those now live on your <a href="/candidate/profile" className="font-semibold text-[var(--color-primary)] underline">Profile</a> under <span className="font-semibold">Career profile</span>.
      </div>

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
