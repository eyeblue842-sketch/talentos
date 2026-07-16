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
          <StatCard label="Total jobs posted" value={dashboard.jobsCount} helper="Active and archived requisitions" />
          <StatCard label="Total applicants" value={dashboard.applicantsCount} helper="Across all open jobs" />
          <StatCard label="Interview stage" value={dashboard.pipelineCounts?.find((item) => item.currentStage === 'INTERVIEW_SCHEDULED')?._count.currentStage || 0} helper="Candidates moving through interviews" />
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
      </section>
    </main>
  );
}

