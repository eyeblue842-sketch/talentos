import { redirect } from 'next/navigation';
import { Alert } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { getRecruiterOnboardingState } from '@/lib/api';
import { RecruiterOnboardingForm } from '@/components/sections/recruiter-onboarding-form';

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
    redirect('/recruiter/home');
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-8 lg:px-10">
      <div className="mx-auto w-full max-w-4xl">
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

          <RecruiterOnboardingForm initialValues={{
            organisationName: state?.organisation?.name || state?.recruiterProfile?.companyName || '',
            workspaceSlug: state?.organisation?.slug || '',
            companyWebsite: state?.organisation?.website || state?.recruiterProfile?.website || '',
            industry: state?.organisation?.industry || state?.recruiterProfile?.industryDomain || '',
            companySize: state?.organisation?.organisationSize || state?.recruiterProfile?.companySize || '',
            location: state?.organisation?.headquarters || state?.recruiterProfile?.headquartersLocation || '',
            designation: state?.recruiterProfile?.designation || '',
            teamInvitationEmail: '',
            teamInvitationRole: 'RECRUITER',
          }} invitationRoles={invitationRoles} />
        </Card>
      </div>
    </main>
  );
}
