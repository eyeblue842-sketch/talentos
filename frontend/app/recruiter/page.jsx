import { Sidebar } from '@/components/layout/sidebar';
import { StatCard } from '@/components/ui/stat-card';
import { Card } from '@/components/ui/card';
import { JobsTable } from '@/components/sections/jobs-table';
import { recruiterNav } from '@/lib/mock-data';
import { getCurrentOrganisation, getRecruiterDashboard, getRecruiterJobs } from '@/lib/api';

export default async function RecruiterDashboardPage() {
  const [organisation, dashboard, jobs] = await Promise.all([
    getCurrentOrganisation(),
    getRecruiterDashboard(),
    getRecruiterJobs(),
  ]);

  return (
    <main className="mx-auto grid min-h-screen max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[280px_1fr] lg:px-10">
      <Sidebar brand={organisation.name} items={recruiterNav} />
      <section className="space-y-6">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-[var(--brand)]">{organisation.slug}</p>
          <h1 className="mt-2 font-[var(--font-display)] text-4xl font-semibold">Operations command center</h1>
          <p className="mt-2 text-[var(--muted)]">Manage organisation roles, requisitions, candidate flow, and hiring execution inside Careeriz.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard label="Active jobs" value={dashboard.activeJobsCount} helper={`Total jobs: ${dashboard.jobsCount}`} />
          <StatCard label="Total applicants" value={dashboard.applicantsCount} helper="Across all open jobs" />
          <StatCard label="Saved candidates" value={dashboard.savedCandidatesCount} helper={`Open requisitions: ${dashboard.openRequisitions}`} />
        </div>
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
      </section>
    </main>
  );
}

