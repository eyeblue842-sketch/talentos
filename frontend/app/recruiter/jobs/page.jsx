import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { RecruiterJobPostWizard } from '@/components/sections/recruiter-job-post-wizard';
import { recruiterNav } from '@/lib/navigation';
import {
  getCurrentOrganisation,
  getOrganisationMembers,
  getRecruiterJobs,
} from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { createJobAction } from '../actions';

function ErrorState({ message }) {
  return (
    <Card>
      <h2 className="text-xl font-semibold text-[var(--color-text)]">Job Posts unavailable</h2>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{message}</p>
    </Card>
  );
}

export default async function RecruiterJobsPage() {
  let organisation = null;
  let previousJobs = [];
  let members = [];
  let currentUser = null;
  let error = '';

  try {
    [organisation, previousJobs, members, currentUser] = await Promise.all([
      getCurrentOrganisation(),
      getRecruiterJobs(),
      getOrganisationMembers(),
      getCurrentUser(),
    ]);
  } catch (caught) {
    error = caught.message;
  }

  const assignees = members.filter((member) => ['OWNER', 'ADMIN', 'RECRUITER', 'HIRING_MANAGER'].includes(member.role));

  return (
    <WorkspaceShell brand={organisation?.name || 'Careeriz Hire'} items={recruiterNav}>
      <PageHeader
        eyebrow={organisation?.slug || 'Recruitment'}
        title="Post a job"
        description="Create a structured, AI-assisted job post in a few guided stages. Manage existing jobs and applicants from Job Responses."
        breadcrumb={[{ label: 'Recruiter' }, { label: 'Post a job' }]}
      />

      {error ? <ErrorState message={error} /> : (
        <RecruiterJobPostWizard
          organisationName={organisation?.name || 'Careeriz Hire'}
          organisationAbout={organisation?.publicDescription || organisation?.description || ''}
          assignees={assignees}
          recruiterEmail={currentUser?.email || ''}
          previousJobs={Array.isArray(previousJobs) ? previousJobs : []}
          createAction={createJobAction}
        />
      )}
    </WorkspaceShell>
  );
}
