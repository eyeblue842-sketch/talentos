import { Sidebar } from '@/components/layout/sidebar';
import { StatCard } from '@/components/ui/stat-card';
import { Card } from '@/components/ui/card';
import { getCandidateDashboard } from '@/lib/api';
import { candidateNav } from '@/lib/navigation';

export default async function CandidateDashboardPage() {
  const dashboard = await getCandidateDashboard();

  return (
    <main className="mx-auto grid min-h-screen max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[280px_1fr] lg:px-10">
      <Sidebar brand="Careeriz" items={candidateNav} />
      <section className="space-y-6">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-[var(--brand)]">Candidate dashboard</p>
          <h1 className="mt-2 font-[var(--font-display)] text-4xl font-semibold">Manage your search with real profile and job data</h1>
          <p className="mt-2 text-[var(--muted)]">Track profile completion, saved jobs, applications, interviews, and deterministic recommendations.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard label="Saved jobs" value={dashboard.metrics.savedJobsCount} helper="Roles you can revisit quickly" />
          <StatCard label="Applications" value={dashboard.metrics.applicationsCount} helper="Recent candidate activity" />
          <StatCard label="Profile completion" value={`${dashboard.completion.percentage}%`} helper={dashboard.completion.recommendedNextAction} />
        </div>
        <Card>
          <h3 className="font-[var(--font-display)] text-xl font-semibold">Recent applications</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {dashboard.recentApplications.length ? dashboard.recentApplications.map((item) => (
              <div key={item.id} className="rounded-2xl border border-[var(--line)] p-4">
                <p className="font-semibold">{item.job.title}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">{item.job.organisation?.name || 'Careeriz employer'}</p>
                <p className="mt-4 text-sm text-[var(--muted)]">{item.statusLabel}</p>
              </div>
            )) : <p className="text-sm text-[var(--muted)]">You have not applied to any roles yet.</p>}
          </div>
        </Card>
        <Card>
          <h3 className="font-[var(--font-display)] text-xl font-semibold">Recommended for you</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {dashboard.recommendations.recommendedJobs.length ? dashboard.recommendations.recommendedJobs.map((job) => (
              <div key={job.id} className="rounded-2xl border border-[var(--line)] p-4">
                <p className="font-semibold">{job.title}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">{job.organisation?.name || 'Careeriz employer'}</p>
                <p className="mt-3 text-sm text-[var(--muted)]">{job.location} | {job.workplaceType || 'Flexible'} | {job.employmentType.replaceAll('_', ' ')}</p>
              </div>
            )) : <p className="text-sm text-[var(--muted)]">{dashboard.recommendations.prompt || 'Recommendations will appear as your profile grows.'}</p>}
          </div>
        </Card>
      </section>
    </main>
  );
}
