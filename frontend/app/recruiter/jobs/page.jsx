import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { JobsTable } from '@/components/sections/jobs-table';
import { RecruiterJobPostWizard } from '@/components/sections/recruiter-job-post-wizard';
import { recruiterNav } from '@/lib/navigation';
import {
  getApprovedRequisitions,
  getCurrentOrganisation,
  getOrganisationMembers,
  getRecruiterJobsPage,
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

export default async function RecruiterJobsPage({ searchParams }) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.status) query.set('status', params.status);
  if (params?.page) query.set('page', params.page);

  let organisation = null;
  let jobsResult = { items: [], meta: null };
  let members = [];
  let requisitions = [];
  let currentUser = null;
  let error = '';

  try {
    [organisation, jobsResult, members, requisitions, currentUser] = await Promise.all([
      getCurrentOrganisation(),
      getRecruiterJobsPage(query.toString()),
      getOrganisationMembers(),
      getApprovedRequisitions(),
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
        title="Job Posts"
        description="Create structured job definitions, capture screening questions, and manage the public job portfolio from one recruiter workflow."
        breadcrumb={[{ label: 'Recruiter' }, { label: 'Job Posts' }]}
      />

      {!error ? (
        <RecruiterJobPostWizard
          organisationName={organisation?.name || 'Careeriz Hire'}
          organisationAbout={organisation?.publicDescription || organisation?.description || ''}
          assignees={assignees}
          requisitions={requisitions}
          recruiterEmail={currentUser?.email || ''}
          createAction={createJobAction}
        />
      ) : null}

      <Card className="grid gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-[var(--color-text)]">Manage Jobs</h2>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Review live, draft, and closed jobs without leaving the recruiter posting workflow.</p>
          </div>
          {params?.notice ? <p className="rounded-full bg-[var(--color-primary-soft)] px-4 py-2 text-sm font-semibold text-[var(--color-primary)]">{params.notice}</p> : null}
        </div>
        <form className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
          <input
            name="search"
            defaultValue={params?.search || ''}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--color-text)]"
            placeholder="Search jobs by title"
          />
          <select
            name="status"
            defaultValue={params?.status || ''}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--color-text)]"
          >
            <option value="">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="OPEN">Open</option>
            <option value="CLOSED">Closed</option>
            <option value="ON_HOLD">On hold</option>
            <option value="ARCHIVED">Archived</option>
          </select>
          <button className="rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white">Apply filters</button>
        </form>
      </Card>

      {error ? <ErrorState message={error} /> : null}
      {!error && jobsResult.items.length > 0 ? <JobsTable jobs={jobsResult.items} /> : null}
      {!error && jobsResult.items.length === 0 ? (
        <Card>
          <h2 className="text-xl font-semibold text-[var(--color-text)]">No jobs yet</h2>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Create the first organisation job to start collecting applicants and moving candidates through Job Responses and ATS.</p>
        </Card>
      ) : null}
    </WorkspaceShell>
  );
}
