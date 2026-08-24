import Link from 'next/link';
import { Bell, BriefcaseBusiness, CalendarClock, CircleCheck, WalletCards } from 'lucide-react';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Card } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { clearRecentJobsAction } from '@/app/candidate/actions';
import { getCandidateDashboard } from '@/lib/api';
import { candidateNav } from '@/lib/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { CandidateProfileSnapshot } from '@/components/sections/candidate-profile-snapshot';
import { CandidateResumeSuggestionBanner } from '@/components/sections/candidate-resume-suggestion-banner';

export default async function CandidateDashboardPage() {
  const dashboard = await getCandidateDashboard();
  const resumeStatus = dashboard.resumeStatus || { hasResume: false, primaryResume: null };
  const unreadNotificationsCount = Number(dashboard.metrics?.unreadNotificationsCount || 0);
  const unreadNotificationsBadge = unreadNotificationsCount > 99 ? '99+' : String(unreadNotificationsCount);
  const notificationsLabel = unreadNotificationsCount > 0
    ? `Notifications, ${unreadNotificationsCount} unread`
    : 'Notifications';
  const quickLinks = [
    { id: 'resume', label: 'Resume', href: '/candidate/resumes' },
    { id: 'resume-headline', label: 'Resume headline', href: '/candidate/profile#resume-headline' },
    { id: 'key-skills', label: 'Key skills', href: '/candidate/profile#key-skills' },
    { id: 'employment', label: 'Employment', href: '/candidate/profile#employment' },
    { id: 'education', label: 'Education', href: '/candidate/profile#education' },
    { id: 'projects', label: 'Projects', href: '/candidate/profile#projects' },
    { id: 'profile-summary', label: 'Profile summary', href: '/candidate/profile#professional-story' },
    { id: 'career-profile', label: 'Career profile', href: '/candidate/profile#preferences' },
  ];

  return (
    <WorkspaceShell brand="Careeriz" items={candidateNav}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <PageHeader
          title="Candidate dashboard"
          breadcrumb={[{ label: 'Candidate' }, { label: 'Dashboard' }]}
        />
        <div className="flex flex-wrap gap-3 lg:justify-end">
          <Link
            href="/candidate/notifications"
            aria-label={notificationsLabel}
            className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line)] text-[var(--color-text)] transition hover:border-[var(--brand)] hover:text-[var(--brand)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:rgba(79,156,249,0.22)]"
          >
            <Bell size={18} aria-hidden="true" />
            {unreadNotificationsCount > 0 ? (
              <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--brand)] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                {unreadNotificationsBadge}
              </span>
            ) : null}
          </Link>
          {dashboard.quickActions.map((action) => (
            <Link key={action.href} href={action.href} className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold text-[var(--text)] transition hover:border-[var(--brand)] hover:text-[var(--brand)]">
              {action.label}
            </Link>
          ))}
        </div>
      </div>

      <CandidateResumeSuggestionBanner suggestions={dashboard.resumeSuggestions} compact />
      <CandidateProfileSnapshot snapshot={dashboard.snapshot} quickLinks={quickLinks} />
      <Card>
        <h2 className="font-[var(--font-display)] text-2xl font-semibold">Application summary</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Active" value={dashboard.metrics.activeApplicationsCount} icon={BriefcaseBusiness} />
          <StatCard label="Interviews" value={dashboard.metrics.interviewApplicationsCount} icon={CalendarClock} />
          <StatCard label="Closed" value={dashboard.metrics.closedApplicationsCount} icon={CircleCheck} />
          <StatCard label="Withdrawn" value={dashboard.metrics.withdrawnApplicationsCount} icon={WalletCards} />
        </div>
      </Card>

        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <Card>
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-[var(--font-display)] text-2xl font-semibold">Resume status</h2>
              <Link href="/candidate/resumes" className="text-sm font-semibold text-[var(--brand)]">Manage resumes</Link>
            </div>
            <div className="mt-5 space-y-3 text-sm">
              <p><span className="font-semibold">Resume uploaded:</span> {resumeStatus.hasResume ? 'Yes' : 'No'}</p>
              <p><span className="font-semibold">Primary resume:</span> {resumeStatus.primaryResume?.filename || 'Not set'}</p>
              <p><span className="font-semibold">Parsing status:</span> {resumeStatus.parsingStatusLabel || 'Not available'}</p>
              <p className="text-[var(--muted)]">{resumeStatus.parsingStatusMessage}</p>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-[var(--font-display)] text-2xl font-semibold">Active offers</h2>
              <Link href="/candidate/offers" className="text-sm font-semibold text-[var(--brand)]">Open offer center</Link>
            </div>
            <div className="mt-5 space-y-3">
              {dashboard.activeOffers?.length ? dashboard.activeOffers.map((offer) => (
                <Link key={offer.id} href={`/candidate/offers/${offer.id}`} className="block rounded-2xl border border-[var(--line)] p-4 transition hover:border-[var(--brand)]">
                  <p className="font-semibold">{offer.job?.title || 'Offer'} | {offer.referenceNumber}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{offer.status} | {offer.currency} {Number(offer.totalCompensation || 0).toLocaleString('en-IN')}</p>
                </Link>
              )) : <p className="text-sm text-[var(--muted)]">No active offers right now.</p>}
            </div>
          </Card>

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
              <h2 className="font-[var(--font-display)] text-2xl font-semibold">Upcoming interviews</h2>
              <Link href="/candidate/interviews" className="text-sm font-semibold text-[var(--brand)]">Open interview center</Link>
            </div>
            <div className="mt-5 space-y-3">
              {dashboard.upcomingInterviews?.length ? dashboard.upcomingInterviews.map((item) => (
                <div key={item.id} className="rounded-2xl border border-[var(--line)] p-4 text-sm">
                  <p className="font-semibold">{item.roundName}</p>
                  <p className="mt-1 text-[var(--muted)]">{item.job?.title || 'Interview'} | {new Date(item.scheduledStartAt).toLocaleString()}</p>
                  <p className="mt-2 text-[var(--muted)]">{item.candidateInstructions || 'Watch your application detail page for joining instructions and updates.'}</p>
                </div>
              )) : <p className="text-sm text-[var(--muted)]">No upcoming interviews scheduled.</p>}
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
