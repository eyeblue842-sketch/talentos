import { redirect } from 'next/navigation';
import { ArrowRight, Building2, Mail, ShieldCheck, Users } from 'lucide-react';
import { completeRecruiterOnboardingAction } from '../actions';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getRecruiterOnboardingState } from '@/lib/api';

const invitationRoles = ['ADMIN', 'RECRUITER', 'HIRING_MANAGER', 'INTERVIEWER', 'VIEWER'];

export default async function RecruiterOnboardingPage({ searchParams }) {
  let state = null;
  let error = '';
  const params = await searchParams;

  try {
    state = await getRecruiterOnboardingState();
  } catch (caught) {
    error = caught.message;
  }

  if (state?.onboardingCompleted) {
    redirect('/recruiter');
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-8 lg:px-10">
      <div className="grid gap-6 lg:grid-cols-[0.88fr_1.12fr]">
        <Card className="bg-[#102418] text-white">
          <p className="text-sm uppercase tracking-[0.24em] text-white/60">Recruiter Onboarding</p>
          <h1 className="mt-4 font-[var(--font-display)] text-4xl font-semibold">Complete your workspace before entering Careeriz Hire.</h1>
          <div className="mt-8 space-y-4 text-sm text-white/78">
            <div className="flex gap-3">
              <Building2 size={18} className="mt-1 shrink-0" />
              <span>Use the organisation already created during registration. This flow only completes the missing workspace details.</span>
            </div>
            <div className="flex gap-3">
              <Users size={18} className="mt-1 shrink-0" />
              <span>Invite the first teammate now if you want, or skip it and continue directly to the dashboard.</span>
            </div>
            <div className="flex gap-3">
              <ShieldCheck size={18} className="mt-1 shrink-0" />
              <span>The flow is idempotent. Refreshes and repeat visits do not create duplicate organisations.</span>
            </div>
          </div>
          <div className="mt-10 rounded-[24px] border border-white/12 bg-white/6 p-5 text-sm text-white/78">
            <p className="font-semibold uppercase tracking-[0.18em] text-white/60">Current workspace</p>
            <p className="mt-3 text-lg font-semibold text-white">{state?.organisation?.name || 'Recruiter workspace'}</p>
            <p className="mt-1 text-white/70">{state?.organisation?.slug || 'workspace-slug'}</p>
            <p className="mt-4">Role: {state?.membershipRole || 'RECRUITER'}</p>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-[var(--brand)]">Workspace setup</p>
              <h2 className="mt-2 font-[var(--font-display)] text-3xl font-semibold">Organisation and recruiter details</h2>
            </div>
            <span className="rounded-full bg-[var(--soft)] px-3 py-1 text-xs font-semibold text-[var(--brand)]">Required once per recruiter account</span>
          </div>

          {error ? (
            <Alert tone="danger" className="mt-6" title="Unable to load onboarding">
              {error}
            </Alert>
          ) : null}
          {params?.notice === 'workspace-ready' ? (
            <Alert tone="success" className="mt-6" title="Workspace ready">
              Your recruiter workspace has been completed.
            </Alert>
          ) : null}

          <form action={completeRecruiterOnboardingAction} className="mt-6 grid gap-4 md:grid-cols-2">
            <input name="organisationName" defaultValue={state?.organisation?.name || state?.recruiterProfile?.companyName || ''} className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Organisation name" required />
            <input name="workspaceSlug" defaultValue={state?.organisation?.slug || ''} className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="workspace-slug" required />
            <input name="companyWebsite" defaultValue={state?.organisation?.website || state?.recruiterProfile?.website || ''} className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Company website" />
            <input name="industry" defaultValue={state?.organisation?.industry || state?.recruiterProfile?.industryDomain || ''} className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Industry" required />
            <input name="companySize" defaultValue={state?.organisation?.organisationSize || state?.recruiterProfile?.companySize || ''} className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Company size" required />
            <input name="location" defaultValue={state?.organisation?.headquarters || state?.recruiterProfile?.headquartersLocation || ''} className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Headquarters or primary location" required />
            <input name="designation" defaultValue={state?.recruiterProfile?.designation || ''} className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Your designation" required />

            <div className="rounded-2xl border border-[var(--line)] p-4 md:col-span-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                <Mail size={16} aria-hidden="true" />
                Team invitation
              </div>
              <p className="mt-2 text-sm text-[var(--muted)]">Optional. Send one secure workspace invitation while finishing setup.</p>
              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_220px]">
                <input name="teamInvitationEmail" className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="teammate@company.com" />
                <select name="teamInvitationRole" className="rounded-2xl border border-[var(--line)] px-4 py-3" defaultValue="RECRUITER">
                  {invitationRoles.map((role) => <option key={role} value={role}>{role}</option>)}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 md:col-span-2">
              <Button type="submit" trailingIcon={ArrowRight}>
                Complete workspace setup
              </Button>
              <Button as="a" href="/recruiter" variant="outline">
                Back to recruiter dashboard
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </main>
  );
}
