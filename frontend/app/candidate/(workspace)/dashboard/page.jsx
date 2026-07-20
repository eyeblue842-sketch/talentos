import Link from 'next/link';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { StatCard } from '@/components/ui/stat-card';
import { Card } from '@/components/ui/card';
import { clearRecentJobsAction } from '@/app/candidate/actions';
import { getCandidateDashboard } from '@/lib/api';
import { candidateNav } from '@/lib/navigation';
import { PageHeader } from '@/components/ui/page-header';

export default async function CandidateDashboardPage() {
  const dashboard = await getCandidateDashboard();
  const completionUpdatedLabel = dashboard.completion.updatedAt
    ? new Date(dashboard.completion.updatedAt).toLocaleDateString()
    : 'Not available';

  return (
    <WorkspaceShell brand="Careeriz" items={candidateNav}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <PageHeader
          eyebrow="Candidate dashboard"
          title="Keep your search moving with clear next actions"
          description="Track applications, profile completion, notifications, saved jobs, and recently viewed roles from one place."
          breadcrumb={[{ label: 'Candidate' }, { label: 'Dashboard' }]}
        />
        <div className="flex flex-wrap gap-3 lg:justify-end">
          {dashboard.quickActions.map((action) => (
            <Link key={action.href} href={action.href} className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold text-[var(--text)] transition hover:border-[var(--brand)] hover:text-[var(--brand)]">
              {action.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Profile completion" value={`${dashboard.completion.percentage}%`} helper={dashboard.completion.recommendedNextAction} />
        <StatCard label="Active applications" value={dashboard.metrics.activeApplicationsCount} helper={`${dashboard.metrics.interviewApplicationsCount} in interview stage`} />
        <StatCard label="Unread notifications" value={dashboard.metrics.unreadNotificationsCount} helper={`${dashboard.metrics.savedJobsCount} saved jobs`} />
      </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-[var(--font-display)] text-2xl font-semibold">Profile completion</h2>
                <p className="mt-2 text-sm text-[var(--muted)]">Updated {completionUpdatedLabel}</p>
              </div>
              <div className="rounded-full bg-[var(--soft)] px-4 py-2 text-sm font-semibold text-[var(--brand)]">{dashboard.completion.percentage}%</div>
            </div>
            <div className="mt-5 space-y-3">
              {dashboard.completion.missingSections.length ? dashboard.completion.missingSections.map((section) => (
                <div key={section} className="rounded-2xl border border-[var(--line)] px-4 py-3 text-sm">
                  {section}
                </div>
              )) : (
                <p className="text-sm text-[var(--muted)]">Your core profile sections are complete.</p>
              )}
            </div>
          </Card>

          <Card>
            <h2 className="font-[var(--font-display)] text-2xl font-semibold">Application summary</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[var(--line)] p-4 text-sm"><p className="font-semibold">Active</p><p className="mt-2 text-2xl font-semibold">{dashboard.metrics.activeApplicationsCount}</p></div>
              <div className="rounded-2xl border border-[var(--line)] p-4 text-sm"><p className="font-semibold">Interviews</p><p className="mt-2 text-2xl font-semibold">{dashboard.metrics.interviewApplicationsCount}</p></div>
              <div className="rounded-2xl border border-[var(--line)] p-4 text-sm"><p className="font-semibold">Closed</p><p className="mt-2 text-2xl font-semibold">{dashboard.metrics.closedApplicationsCount}</p></div>
              <div className="rounded-2xl border border-[var(--line)] p-4 text-sm"><p className="font-semibold">Withdrawn</p><p className="mt-2 text-2xl font-semibold">{dashboard.metrics.withdrawnApplicationsCount}</p></div>
            </div>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <Card>
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-[var(--font-display)] text-2xl font-semibold">Recent application updates</h2>
              <Link href="/candidate/applications" className="text-sm font-semibold text-[var(--brand)]">View all</Link>
            </div>
            <div className="mt-5 space-y-3">
              {dashboard.recentUpdates.length ? dashboard.recentUpdates.map((item) => (
                <Link key={item.id} href={item.link} className="block rounded-2xl border border-[var(--line)] p-4 text-sm transition hover:border-[var(--brand)]">
                  <p className="font-semibold">{item.title}</p>
                  <p className="mt-2 text-[var(--muted)]">{item.message}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.14em] text-[var(--muted)]">{new Date(item.createdAt).toLocaleString()}</p>
                </Link>
              )) : <p className="text-sm text-[var(--muted)]">No candidate-visible application updates yet.</p>}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-[var(--font-display)] text-2xl font-semibold">Recently viewed jobs</h2>
              <form action={clearRecentJobsAction}>
                <button type="submit" className="text-sm font-semibold text-[var(--brand)]">Clear history</button>
              </form>
            </div>
            <div className="mt-5 space-y-3">
              {dashboard.recentJobs.length ? dashboard.recentJobs.map((item) => (
                <Link key={item.id} href={`/jobs/${item.job.slug}`} className="block rounded-2xl border border-[var(--line)] p-4 transition hover:border-[var(--brand)]">
                  <p className="font-semibold">{item.job.title}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{item.job.organisation?.name || 'Careeriz employer'} | {item.job.location}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Viewed {new Date(item.viewedAt).toLocaleString()}</p>
                </Link>
              )) : <p className="text-sm text-[var(--muted)]">No recent job history yet. Browse open jobs to build a shortlist.</p>}
            </div>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <Card>
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-[var(--font-display)] text-2xl font-semibold">Saved jobs</h2>
              <Link href="/candidate/saved-jobs" className="text-sm font-semibold text-[var(--brand)]">Manage</Link>
            </div>
            <div className="mt-5 grid gap-3">
              {dashboard.savedJobs.length ? dashboard.savedJobs.map((item) => (
                <Link key={item.id} href={item.job ? `/jobs/${item.job.slug}` : '/candidate/saved-jobs'} className="block rounded-2xl border border-[var(--line)] p-4 transition hover:border-[var(--brand)]">
                  <p className="font-semibold">{item.job?.title || item.snapshot.title}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{item.job?.organisation?.name || item.snapshot.organisationName}</p>
                </Link>
              )) : <p className="text-sm text-[var(--muted)]">No saved jobs yet. Save roles you want to revisit later.</p>}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-[var(--font-display)] text-2xl font-semibold">Recommended jobs</h2>
              <Link href="/candidate/jobs" className="text-sm font-semibold text-[var(--brand)]">Browse jobs</Link>
            </div>
            <div className="mt-5 grid gap-3">
              {dashboard.recommendations.recommendedJobs.length ? dashboard.recommendations.recommendedJobs.map((job) => (
                <Link key={job.id} href={`/jobs/${job.slug}`} className="block rounded-2xl border border-[var(--line)] p-4 transition hover:border-[var(--brand)]">
                  <p className="font-semibold">{job.title}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{job.organisation?.name || 'Careeriz employer'} | {job.location}</p>
                  <p className="mt-2 text-sm text-[var(--muted)]">{(job.reasons || []).join(' | ') || 'Recommended for your current profile.'}</p>
                </Link>
              )) : <p className="text-sm text-[var(--muted)]">{dashboard.recommendations.prompt || 'Recommendations will appear as your profile grows.'}</p>}
            </div>
          </Card>
        </div>
    </WorkspaceShell>
  );
}
