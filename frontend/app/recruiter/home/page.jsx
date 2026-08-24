import Link from 'next/link';
import { Bell, BriefcaseBusiness, Plus, Search, ShieldCheck } from 'lucide-react';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { recruiterNav } from '@/lib/navigation';
import { getCurrentOrganisation, getNotifications, getPublicOrganisation, getRecruiterDashboard } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { CompanyAboutSection, CompanyHeaderCard, CompanyInsightsSection, CompanyJobsSection, CompanyPeopleInsightsSection, CompanyPeoplePreview, CompanyPostsSection } from '@/components/sections/company-profile-sections';
import { createOrganisationPostAction } from '@/app/recruiter/actions';

const COMPANY_TABS = new Set(['home', 'about', 'jobs', 'people', 'insights']);

function NotificationBell({ unreadCount }) {
  const displayCount = unreadCount > 99 ? '99+' : String(unreadCount);
  const ariaLabel = unreadCount > 0 ? `Notifications, ${displayCount} unread` : 'Notifications';

  return (
    <Link
      href="/recruiter/notifications"
      aria-label={ariaLabel}
      className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--color-border)] bg-white text-[var(--color-text)] shadow-sm transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
    >
      <Bell size={18} aria-hidden="true" />
      {unreadCount > 0 ? (
        <span className="absolute -right-1 -top-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-[var(--color-primary)] px-1.5 py-0.5 text-[11px] font-semibold text-white">
          {displayCount}
        </span>
      ) : null}
    </Link>
  );
}

export default async function RecruiterHomePage({ searchParams }) {
  const queryParams = await searchParams;
  const activeTab = COMPANY_TABS.has(String(queryParams?.tab || 'home')) ? String(queryParams?.tab || 'home') : 'home';

  let organisation = null;
  let companyData = null;
  let dashboard = null;
  let notifications = [];
  let currentUser = null;
  let error = '';

  try {
    [organisation, dashboard, notifications, currentUser] = await Promise.all([
      getCurrentOrganisation(),
      getRecruiterDashboard(),
      getNotifications(),
      getCurrentUser(),
    ]);

    companyData = await getPublicOrganisation(organisation.slug);
  } catch (caught) {
    error = caught.message || 'Recruiter home could not be loaded.';
  }

  const unreadNotificationsCount = (notifications || []).filter((item) => !item.readAt).length;
  const canEditOrganisation = ['OWNER', 'ADMIN'].includes(currentUser?.activeMembership?.role || '');
  const canCreatePost = ['OWNER', 'ADMIN', 'RECRUITER', 'HIRING_MANAGER'].includes(currentUser?.activeMembership?.role || '');
  const basePath = '/recruiter/home';

  const hiringSnapshot = [
    { label: 'Open jobs', value: dashboard?.activeJobsCount, href: `${basePath}?tab=jobs` },
    { label: 'Pipeline candidates', value: dashboard?.applicantsCount, href: '/recruiter/ats' },
    { label: 'Interviews scheduled', value: dashboard?.upcomingInterviews?.length, href: '/recruiter/interviews' },
    { label: 'Offers pending', value: dashboard ? (dashboard.offersPendingApprovalCount + dashboard.offersReleasedCount) : null, href: '/recruiter' },
    { label: 'Upcoming joiners', value: dashboard?.upcomingJoinersCount, href: '/recruiter' },
  ].filter((item) => typeof item.value === 'number');

  return (
    <WorkspaceShell brand={organisation?.name || 'Careeriz Hire'} items={recruiterNav} sidebarCollapsible>
      <div className="grid gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid gap-2">
            <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-muted)]">
              <span>Recruiter</span>
              <span aria-hidden="true">/</span>
              <span>Home</span>
            </nav>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-[var(--color-text)]">Recruiter home</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <NotificationBell unreadCount={unreadNotificationsCount} />
            <Button as="a" href="/recruiter/jobs" className="gap-2">
              <Plus size={16} aria-hidden="true" />
              Post a Job
            </Button>
            <Button as="a" href="/recruiter/database" variant="outline" className="gap-2">
              <Search size={16} aria-hidden="true" />
              Search Resumes
            </Button>
            <Button as="a" href="/recruiter/ats" variant="outline" className="gap-2">
              <BriefcaseBusiness size={16} aria-hidden="true" />
              View Pipeline
            </Button>
            {currentUser?.role === 'RECRUITER_ADMIN' ? (
              <Button as="a" href="/admin" variant="outline" className="gap-2">
                <ShieldCheck size={16} aria-hidden="true" />
                Admin Console
              </Button>
            ) : null}
          </div>
        </div>

        {error ? (
          <Alert tone="danger" title="Home unavailable">
            {error}
          </Alert>
        ) : null}

        {!error && companyData ? (
          <>
            <CompanyHeaderCard
              organisation={organisation}
              basePath={basePath}
              activeTab={activeTab}
              mode="recruiter"
              canEdit={canEditOrganisation}
            />

            {activeTab === 'home' ? (
              <div className="grid gap-6">
                {hiringSnapshot.length ? (
                  <Card className="rounded-2xl p-6">
                    <div className="flex items-center justify-between gap-4">
                      <h2 className="text-xl font-semibold text-[var(--color-text)]">Hiring snapshot</h2>
                    </div>
                    <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                      {hiringSnapshot.map((item) => (
                        <Link key={item.label} href={item.href} className="rounded-xl border border-[var(--color-border)] px-4 py-4 transition hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]/40">
                          <p className="text-sm text-[var(--color-text-secondary)]">{item.label}</p>
                          <p className="mt-2 text-2xl font-semibold text-[var(--color-text)]">{item.value}</p>
                        </Link>
                      ))}
                    </div>
                  </Card>
                ) : null}

                <CompanyAboutSection organisation={companyData.organisation} canEdit={canEditOrganisation} preview />
                <CompanyPostsSection
                  organisation={companyData.organisation}
                  posts={companyData.posts}
                  canManage={canCreatePost}
                  createPostAction={createOrganisationPostAction}
                />
                <CompanyJobsSection jobs={companyData.recentJobs} title="Recent job openings" companyName={companyData.organisation.name} />
                <CompanyPeoplePreview peopleInsights={companyData.peopleInsights} basePath={basePath} />
                <CompanyInsightsSection publicInsights={companyData.publicInsights} />
              </div>
            ) : null}

            {activeTab === 'about' ? <CompanyAboutSection organisation={companyData.organisation} canEdit={canEditOrganisation} /> : null}
            {activeTab === 'jobs' ? <CompanyJobsSection jobs={companyData.jobs.items} title="Open jobs" companyName={companyData.organisation.name} /> : null}
            {activeTab === 'people' ? <CompanyPeopleInsightsSection organisation={companyData.organisation} peopleInsights={companyData.peopleInsights} /> : null}
            {activeTab === 'insights' ? <CompanyInsightsSection publicInsights={companyData.publicInsights} /> : null}
          </>
        ) : null}
      </div>
    </WorkspaceShell>
  );
}
