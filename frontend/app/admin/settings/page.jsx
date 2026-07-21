import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { getCurrentUser } from '@/lib/auth';
import { adminNav } from '@/lib/navigation';
import { getAdminSettings, getMeetingProviders } from '@/lib/api';
import {
  connectMeetingProviderAction,
  disconnectMeetingProviderAction,
  resetInitialSetupAction,
  updateAdminSettingsAction,
  validateMeetingProviderAction,
} from '../actions';

export default async function AdminSettingsPage() {
  const currentUser = await getCurrentUser();
  let settings = null;
  let providers = [];
  let error = '';
  try {
    [settings, providers] = await Promise.all([
      getAdminSettings(),
      getMeetingProviders(),
    ]);
  } catch (caught) {
    error = caught.message;
  }

  const scheduling = settings?.interviewSchedulingSettings || {};

  return (
    <WorkspaceShell brand="Enterprise Admin" items={adminNav}>
      <PageHeader eyebrow="Organization settings" title="Configure organization settings and defaults" description="Update timezone, currency, language, date format, experience bands, and organization-level branding settings." breadcrumb={[{ label: 'Admin' }, { label: 'Settings' }]} />
      {error ? <Card><p className="text-sm text-[var(--muted)]">{error}</p></Card> : null}
      {settings ? (
        <div className="space-y-6">
          <Card>
            <h2 className="font-[var(--font-display)] text-2xl font-semibold">Meeting providers</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">Connect Google Workspace or Zoom at the organization level. Custom links remain available when enabled in scheduling settings.</p>
            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              {['GOOGLE_MEET', 'ZOOM', 'CUSTOM'].map((providerKey) => {
                const provider = providers.find((item) => item.provider === providerKey);
                const isCustom = providerKey === 'CUSTOM';
                return (
                  <div key={providerKey} className="rounded-[28px] border border-[var(--line)] p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">{providerKey === 'GOOGLE_MEET' ? 'Google Calendar / Meet' : providerKey === 'ZOOM' ? 'Zoom' : 'Custom meeting links'}</h3>
                        <p className="mt-1 text-sm text-[var(--muted)]">{provider?.connectedEmail || (isCustom ? 'Manual HTTPS links supported.' : 'No account connected yet.')}</p>
                      </div>
                      <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold text-[var(--muted)]">{provider?.status || (isCustom ? 'AVAILABLE' : 'DISCONNECTED')}</span>
                    </div>
                    {!isCustom ? (
                      <div className="mt-4 flex flex-wrap gap-3">
                        <form action={connectMeetingProviderAction}>
                          <input type="hidden" name="provider" value={providerKey} />
                          <button className="rounded-2xl bg-[var(--brand)] px-4 py-3 font-semibold text-white">{provider ? 'Reconnect' : 'Connect'}</button>
                        </form>
                        {provider ? (
                          <>
                            <form action={validateMeetingProviderAction}>
                              <input type="hidden" name="provider" value={providerKey} />
                              <button className="rounded-2xl border border-[var(--line)] px-4 py-3 font-semibold">Validate</button>
                            </form>
                            <form action={disconnectMeetingProviderAction}>
                              <input type="hidden" name="provider" value={providerKey} />
                              <button className="rounded-2xl border border-[var(--line)] px-4 py-3 font-semibold">Disconnect</button>
                            </form>
                          </>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <form action={updateAdminSettingsAction} className="grid gap-3 text-sm md:grid-cols-2">
              <input name="timezone" defaultValue={settings.timezone || ''} className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Timezone" />
              <input name="currency" defaultValue={settings.currency || ''} className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Currency" />
              <input name="language" defaultValue={settings.language || ''} className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Language" />
              <input name="dateFormat" defaultValue={settings.dateFormat || ''} className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Date format" />
              <input name="employmentTypes" defaultValue={(settings.employmentTypes || []).join(', ')} className="rounded-2xl border border-[var(--line)] px-4 py-3 md:col-span-2" placeholder="Employment types, comma separated" />
              <input name="workModes" defaultValue={(settings.workModes || []).join(', ')} className="rounded-2xl border border-[var(--line)] px-4 py-3 md:col-span-2" placeholder="Work modes, comma separated" />
              <textarea name="experienceBands" defaultValue={JSON.stringify(settings.experienceBands || [], null, 2)} className="min-h-32 rounded-2xl border border-[var(--line)] px-4 py-3 md:col-span-2" placeholder="Experience bands JSON" />

              <div className="rounded-[28px] border border-[var(--line)] p-4 md:col-span-2">
                <h3 className="font-semibold">Interview scheduling settings</h3>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="text-sm">
                    <span className="mb-1 block font-medium">Default meeting provider</span>
                    <select name="defaultMeetingProvider" defaultValue={scheduling.defaultMeetingProvider || 'CUSTOM'} className="w-full rounded-2xl border border-[var(--line)] px-4 py-3">
                      <option value="CUSTOM">Custom</option>
                      <option value="GOOGLE_MEET">Google Meet</option>
                      <option value="ZOOM">Zoom</option>
                    </select>
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block font-medium">Reminder intervals (minutes)</span>
                    <input name="reminderIntervalsMinutes" defaultValue={(scheduling.reminderIntervalsMinutes || [1440, 60, 15]).join(', ')} className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block font-medium">Default duration</span>
                    <input name="defaultInterviewDuration" type="number" min="15" max="480" defaultValue={scheduling.defaultInterviewDuration || 60} className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block font-medium">Minimum notice (minutes)</span>
                    <input name="minimumSchedulingNoticeMinutes" type="number" min="0" defaultValue={scheduling.minimumSchedulingNoticeMinutes || 0} className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block font-medium">Max candidate requests</span>
                    <input name="maximumCandidateRequests" type="number" min="0" defaultValue={scheduling.maximumCandidateRequests || 3} className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block font-medium">Max reschedules</span>
                    <input name="maximumRescheduleCount" type="number" min="0" defaultValue={scheduling.maximumRescheduleCount || 10} className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" />
                  </label>
                  <label className="text-sm md:col-span-2">
                    <span className="mb-2 block font-medium">Allowed providers</span>
                    <div className="flex flex-wrap gap-4">
                      {['CUSTOM', 'GOOGLE_MEET', 'ZOOM'].map((provider) => (
                        <label key={provider} className="inline-flex items-center gap-2">
                          <input type="checkbox" name="allowedProviders" value={provider} defaultChecked={(scheduling.allowedProviders || ['CUSTOM']).includes(provider)} />
                          <span>{provider}</span>
                        </label>
                      ))}
                    </div>
                  </label>
                  {[
                    ['includeRecruiterInInvite', 'Include recruiter in invites'],
                    ['includeCoordinatorInInvite', 'Include coordinator in invites'],
                    ['allowAvailabilityChecks', 'Allow availability checks'],
                    ['allowManualCustomLink', 'Allow manual custom links'],
                    ['candidateRescheduleEnabled', 'Allow candidate reschedule requests'],
                    ['interviewerRescheduleEnabled', 'Allow interviewer reschedule requests'],
                    ['zoomWaitingRoomDefault', 'Enable Zoom waiting room by default'],
                    ['cancellationReasonRequired', 'Require cancellation reasons'],
                  ].map(([name, label]) => (
                    <label key={name} className="inline-flex items-center gap-2 rounded-2xl border border-[var(--line)] px-4 py-3">
                      <input type="checkbox" name={name} defaultChecked={scheduling[name] !== false} />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <textarea name="careerPageSettings" defaultValue={JSON.stringify(settings.careerPageSettings || {}, null, 2)} className="min-h-32 rounded-2xl border border-[var(--line)] px-4 py-3 md:col-span-2" placeholder="Career page settings JSON" />
              <textarea name="emailBranding" defaultValue={JSON.stringify(settings.emailBranding || {}, null, 2)} className="min-h-32 rounded-2xl border border-[var(--line)] px-4 py-3 md:col-span-2" placeholder="Email branding JSON" />
              <button type="submit" className="rounded-full bg-[var(--brand)] px-5 py-3 font-semibold text-white md:col-span-2">Save settings</button>
            </form>
          </Card>

          {currentUser?.role === 'ADMIN' ? (
            <Card>
              <h2 className="font-[var(--font-display)] text-2xl font-semibold">Initial setup reset</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">Use this only to reopen bootstrap on a non-operational installation. Reset is blocked once the system contains jobs, applications, interviews, offers, or multiple organizations/users.</p>
              <form action={resetInitialSetupAction} className="mt-5 grid gap-3 md:max-w-md">
                <input type="password" name="password" className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Confirm your password" />
                <button type="submit" className="rounded-full bg-red-600 px-5 py-3 font-semibold text-white">Reset Initial Setup</button>
              </form>
            </Card>
          ) : null}
        </div>
      ) : null}
    </WorkspaceShell>
  );
}
