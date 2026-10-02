import { redirect } from 'next/navigation';
import { Alert } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { CompanyLogoUploader } from '@/components/sections/company-logo-uploader';
import { RecruiterOnboardingForm } from '@/components/sections/recruiter-onboarding-form';
import { getCurrentUser } from '@/lib/auth';
import { getRecruiterOnboardingState } from '@/lib/api';

const invitationRoles = ['ADMIN', 'RECRUITER', 'HIRING_MANAGER', 'INTERVIEWER', 'VIEWER'];

export default async function RecruiterCompanyEditPage() {
  const [user, state] = await Promise.all([getCurrentUser(), getRecruiterOnboardingState()]);
  if (!['OWNER', 'ADMIN'].includes(user?.activeMembership?.role || '')) {
    redirect('/recruiter/home?tab=about');
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-8 lg:px-10">
      <div className="mx-auto w-full max-w-4xl">
        <Card>
          <p className="text-sm uppercase tracking-[0.24em] text-[var(--brand)]">Company profile</p>
          <h1 className="mt-2 font-[var(--font-display)] text-3xl font-semibold">Edit company profile</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Update the existing organisation workspace. This never creates a new organisation.</p>

          <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-muted)] p-4 sm:flex-row sm:items-center">
            <CompanyLogoUploader organisation={state?.organisation} canEdit />
            <div className="grid gap-1">
              <p className="text-sm font-semibold text-[var(--color-text)]">Company logo</p>
              <p className="text-xs text-[var(--color-text-secondary)]">Click the logo to upload a new one. PNG, JPG, WEBP or SVG. It appears on your company page, job posts and the workspace sidebar.</p>
            </div>
          </div>

          <RecruiterOnboardingForm
            edit
            initialValues={{
              organisationName: state?.organisation?.name || state?.recruiterProfile?.companyName || '',
              workspaceSlug: state?.organisation?.slug || '',
              companyWebsite: state?.organisation?.website || state?.recruiterProfile?.website || '',
              industry: state?.organisation?.industry || state?.recruiterProfile?.industryDomain || '',
              companySize: state?.organisation?.organisationSize || state?.recruiterProfile?.companySize || '',
              location: state?.organisation?.headquarters || state?.recruiterProfile?.headquartersLocation || '',
              designation: state?.recruiterProfile?.designation || '',
              companyLocations: state?.organisation?.publicLocations || [],
              publicDescription: state?.organisation?.publicDescription || '',
              cultureSummary: state?.organisation?.cultureSummary || '',
              teamInvitationEmail: '',
              teamInvitationRole: 'RECRUITER',
            }}
            invitationRoles={invitationRoles}
          />
          {!state ? <Alert tone="danger" className="mt-6" title="Unable to load company profile">Please try again.</Alert> : null}
        </Card>
      </div>
    </main>
  );
}
