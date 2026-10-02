import Link from 'next/link';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { recruiterNav } from '@/lib/navigation';
import {
  getCurrentOrganisation,
  getOrganisationMembers,
  getRecruiterJobsPage,
  getRecruiterPipelinePage,
} from '@/lib/api';
import { JobResponsesTriage } from '@/components/recruiter/job-responses-triage';
import {
  formatApplicantCount,
  formatEmploymentLabel,
  formatJobExperienceRange,
  formatRecruitmentDate,
} from '@/lib/recruitment-formatters';

function statusTone(status) {
  if (status === 'OPEN' || status === 'Active') return 'success';
  if (status === 'DRAFT' || status === 'Draft' || status === 'ON_HOLD') return 'warning';
  return 'neutral';
}

function CountPill({ label, value }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-2 text-xl font-semibold text-[var(--color-text)]">{value}</p>
    </div>
  );
}

export default async function RecruiterJobResponsesPage({ searchParams }) {
  const params = await searchParams;
  const jobsQuery = new URLSearchParams();
  if (params?.search) jobsQuery.set('search', params.search);
  if (params?.jobStatus) jobsQuery.set('status', params.jobStatus);
  if (params?.recruiterId) jobsQuery.set('recruiterId', params.recruiterId);

  const selectedJobId = params?.jobId || '';

  let organisation = null;
  let jobsResult = { items: [], meta: {} };
  let members = [];
  let applicationsResult = { items: [], meta: {} };
  let error = '';

  try {
    [organisation, jobsResult, members] = await Promise.all([
      getCurrentOrganisation(),
      getRecruiterJobsPage(jobsQuery.toString()),
      getOrganisationMembers(),
    ]);
    // Responses = applications on the selected job. Use the recruiter pipeline
    // feed (legacy /ats/pipeline) - the V2 /ats/applications route is
    // candidate-only, so a recruiter never had access to it here.
    if (selectedJobId) {
      const responsesQuery = new URLSearchParams();
      responsesQuery.set('jobId', selectedJobId);
      if (params?.stage) responsesQuery.set('stage', params.stage);
      applicationsResult = await getRecruiterPipelinePage(responsesQuery.toString());
    }
  } catch (caught) {
    error = caught.message;
  }
  const selectedJob = jobsResult.items.find((job) => job.id === selectedJobId) || null;
  const statusCounts = jobsResult.items.reduce((accumulator, job) => {
    accumulator[job.status] = (accumulator[job.status] || 0) + 1;
    return accumulator;
  }, {});

  return (
    <WorkspaceShell brand={organisation?.name || 'Careeriz Hire'} brandLogoUrl={organisation?.logoUrl} items={recruiterNav}>
      <PageHeader
        eyebrow={organisation?.slug || 'Recruitment'}
        title="Job Responses"
        description="Manage applicants by job, review response volume, and move qualified candidates into the ATS pipeline."
        breadcrumb={[{ label: 'Recruiter' }, { label: 'Job Responses' }]}
        primaryAction={{ label: 'Post Job', href: '/recruiter/jobs' }}
      />

      <Card className="grid gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-[var(--color-text)]">Response filters</h2>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Search by job title or narrow to a recruiter, job status, or application stage.</p>
          </div>
        </div>
        <form className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_220px_220px_220px_auto]">
          <input
            name="search"
            defaultValue={params?.search || ''}
            placeholder="Search job title, job ID, or reference"
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--color-text)]"
          />
          <select
            name="jobStatus"
            defaultValue={params?.jobStatus || ''}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--color-text)]"
          >
            <option value="">All job statuses</option>
            <option value="OPEN">Active</option>
            <option value="CLOSED">Closed</option>
            <option value="ARCHIVED">Archived</option>
            <option value="DRAFT">Draft</option>
          </select>
          <select
            name="recruiterId"
            defaultValue={params?.recruiterId || ''}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--color-text)]"
          >
            <option value="">Posted by</option>
            {members
              .filter((member) => ['OWNER', 'ADMIN', 'RECRUITER', 'HIRING_MANAGER'].includes(member.role))
              .map((member) => (
                <option key={member.id} value={member.userId}>
                  {member.user?.email || member.userId}
                </option>
              ))}
          </select>
          <select
            name="stage"
            defaultValue={params?.stage || ''}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--color-text)]"
          >
            <option value="">All response stages</option>
            <option value="APPLIED">New</option>
            <option value="SHORTLISTED">Shortlisted</option>
            <option value="INTERVIEW_SCHEDULED">Interview</option>
            <option value="SELECTED">Offer / Selected</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <button className="rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white">
            Apply
          </button>
        </form>
      </Card>

      <div className="grid gap-3 md:grid-cols-4">
        <CountPill label="Active Jobs" value={statusCounts.OPEN || 0} />
        <CountPill label="Closed Jobs" value={statusCounts.CLOSED || 0} />
        <CountPill label="Expired / Archived" value={statusCounts.ARCHIVED || 0} />
        <CountPill label="Drafts" value={statusCounts.DRAFT || 0} />
      </div>

      {error ? (
        <Card>
          <p className="text-sm text-[var(--color-text-secondary)]">{error}</p>
        </Card>
      ) : null}

      <Card className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-[var(--color-text)]">Jobs and responses</h2>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Each row represents one job and its current response volume.</p>
          </div>
          <Badge tone="neutral">{jobsResult.meta?.total || jobsResult.items.length} jobs</Badge>
        </div>
        <div className="space-y-3">
          {jobsResult.items.map((job) => (
            <div key={job.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-semibold text-[var(--color-text)]">{job.title}</h3>
                    <Badge tone={statusTone(job.status)}>{job.status === 'OPEN' ? 'Active' : formatEmploymentLabel(job.status)}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                    {job.location} · {formatEmploymentLabel(job.employmentType)}{job.workplaceType ? ` · ${formatEmploymentLabel(job.workplaceType)}` : ''}
                  </p>
                  <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                    {formatApplicantCount(job.applicationsCount || 0)} · {formatJobExperienceRange(job)} · Posted {formatRecruitmentDate(job.createdAt)}
                  </p>
                  <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                    Posted by {job.recruiter?.email || 'Unassigned recruiter'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/recruiter/job-responses?jobId=${job.id}`}
                    className="inline-flex min-h-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border-strong)] px-4 text-sm font-semibold text-[var(--color-text)]"
                  >
                    View Responses
                  </Link>
                  <Link
                    href={`/recruiter/jobs/${job.id}`}
                    className="inline-flex min-h-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border-strong)] px-4 text-sm font-semibold text-[var(--color-text)]"
                  >
                    Edit
                  </Link>
                  <Link
                    href={`/recruiter/ats?jobId=${job.id}`}
                    className="inline-flex min-h-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-soft)] px-4 text-sm font-semibold text-[var(--color-primary)]"
                  >
                    Open ATS
                  </Link>
                </div>
              </div>
            </div>
          ))}
          {!jobsResult.items.length ? (
            <p className="text-sm text-[var(--color-text-secondary)]">No jobs match the current filters.</p>
          ) : null}
        </div>
      </Card>

      <Card className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-[var(--color-text)]">
              {selectedJob ? `Responses for ${selectedJob.title}` : 'Select a job to review responses'}
            </h2>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              {selectedJob
                ? 'Shortlist or reject applicants, and email selected candidates in bulk.'
                : 'Choose View Responses on a job row to inspect candidate applications for that role.'}
            </p>
          </div>
          {selectedJob ? <Badge tone="info">{applicationsResult.items.length} responses</Badge> : null}
        </div>
        {selectedJob ? (
          <JobResponsesTriage
            jobId={selectedJob.id}
            jobTitle={selectedJob.title}
            responses={applicationsResult.items}
          />
        ) : null}
      </Card>
    </WorkspaceShell>
  );
}
