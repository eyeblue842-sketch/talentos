import { WorkspaceShell } from '@/components/layout/workspace-shell';
import Link from 'next/link';
import { StatCard } from '@/components/ui/stat-card';
import { Card } from '@/components/ui/card';
import { JobsTable } from '@/components/sections/jobs-table';
import { recruiterNav } from '@/lib/navigation';
import { getCurrentOrganisation, getOrganisationInvitations, getRecruiterDashboard, getRecruiterJobs } from '@/lib/api';
import { PageHeader } from '@/components/ui/page-header';

export default async function RecruiterDashboardPage() {
  const [organisation, dashboard, jobs, invitations] = await Promise.all([
    getCurrentOrganisation(),
    getRecruiterDashboard(),
    getRecruiterJobs(),
    getOrganisationInvitations(),
  ]);
  const draftJobsCount = jobs.filter((job) => job.status === 'DRAFT').length;
  const pendingInvitationsCount = invitations.filter((invitation) => invitation.status === 'PENDING').length;
  const showEmptyState = dashboard.jobsCount === 0 && dashboard.openRequisitions === 0;

  return (
    <WorkspaceShell brand={organisation.name} items={recruiterNav}>
      <PageHeader
        eyebrow={organisation.slug}
        title="Operations command center"
        description="Manage organisation roles, requisitions, candidate flow, and hiring execution inside Careeriz."
        breadcrumb={[{ label: 'Recruiter' }, { label: 'Dashboard' }]}
      />
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard label="Active jobs" value={dashboard.activeJobsCount} helper={`Total jobs: ${dashboard.jobsCount}`} />
          <StatCard label="Draft jobs" value={draftJobsCount} helper={`Open requisitions: ${dashboard.openRequisitions}`} />
          <StatCard label="Candidates in ATS" value={dashboard.applicantsCount} helper={`Pending invitations: ${pendingInvitationsCount}`} />
        </div>
        <Card>
          <h3 className="font-[var(--font-display)] text-xl font-semibold">Continue workflow</h3>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/recruiter/onboarding" className="rounded-2xl border border-[var(--line)] px-4 py-3 text-sm font-semibold">Complete workspace setup</Link>
            <Link href="/recruiter/requisitions" className="rounded-2xl border border-[var(--line)] px-4 py-3 text-sm font-semibold">Create requisition</Link>
            <Link href="/recruiter/jobs" className="rounded-2xl border border-[var(--line)] px-4 py-3 text-sm font-semibold">Create job</Link>
            <Link href="/recruiter/database" className="rounded-2xl border border-[var(--line)] px-4 py-3 text-sm font-semibold">Search resumes</Link>
            <Link href="/recruiter/ats" className="rounded-2xl border border-[var(--line)] px-4 py-3 text-sm font-semibold">Open ATS</Link>
            <Link href="/recruiter/members" className="rounded-2xl border border-[var(--line)] px-4 py-3 text-sm font-semibold">Invite team member</Link>
          </div>
        </Card>
        {showEmptyState ? (
          <Card>
            <h3 className="font-[var(--font-display)] text-xl font-semibold">Start this workspace</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">Complete onboarding, open a requisition, create the first job, and then move into Resume Search and ATS from the links above.</p>
          </Card>
        ) : null}
        <JobsTable jobs={jobs.map((job) => ({ ...job, applicants: job.applicationsCount || 0 }))} />
        <Card>
          <h3 className="font-[var(--font-display)] text-xl font-semibold">Recent applications</h3>
          <div className="mt-4 space-y-3">
            {dashboard.recentApplications.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-2xl border border-[var(--line)] p-4">
                <div>
                  <p className="font-semibold">{item.candidate.fullName}</p>
                  <p className="text-sm text-[var(--muted)]">{item.job.title}</p>
                </div>
                <p className="text-sm font-semibold text-[var(--brand)]">{item.matchScore}% match</p>
              </div>
            ))}
          </div>
        </Card>
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <h3 className="font-[var(--font-display)] text-xl font-semibold">Upcoming interviews</h3>
            <div className="mt-4 space-y-3">
              {dashboard.upcomingInterviews?.length ? dashboard.upcomingInterviews.map((item) => (
                <div key={item.id} className="rounded-2xl border border-[var(--line)] p-4">
                  <p className="font-semibold">{item.candidateName}</p>
                  <p className="text-sm text-[var(--muted)]">{item.jobTitle}</p>
                  <p className="text-sm text-[var(--muted)]">{new Date(item.scheduledStartAt).toLocaleString()}</p>
                </div>
              )) : <p className="text-sm text-[var(--muted)]">No upcoming interviews scheduled.</p>}
            </div>
          </Card>
          <Card>
            <h3 className="font-[var(--font-display)] text-xl font-semibold">Jobs closing soon</h3>
            <div className="mt-4 space-y-3">
              {dashboard.jobsClosingSoon?.length ? dashboard.jobsClosingSoon.map((job) => (
                <div key={job.id} className="rounded-2xl border border-[var(--line)] p-4">
                  <p className="font-semibold">{job.title}</p>
                  <p className="text-sm text-[var(--muted)]">{job.location}</p>
                  <p className="text-sm text-[var(--muted)]">{job.applicationDeadline ? new Date(job.applicationDeadline).toLocaleString() : 'No deadline'}</p>
                </div>
              )) : <p className="text-sm text-[var(--muted)]">No open jobs are closing in the next two weeks.</p>}
            </div>
          </Card>
        </div>
    </WorkspaceShell>
  );
}

