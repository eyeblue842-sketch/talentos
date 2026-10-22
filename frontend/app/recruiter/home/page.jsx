import Link from 'next/link';
import { Bell, BriefcaseBusiness, Plus, Search, ShieldCheck } from 'lucide-react';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { recruiterNav } from '@/lib/navigation';
import { getCurrentOrganisation, getNotifications, getPublicOrganisation, getRecruiterDashboard } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { CompanyAboutSection, RecruiterCompanyHeader, CompanyTabsNav, CompanyInsightsSection, CompanyJobsSection, CompanyPeopleInsightsSection, CompanyPeoplePreview, CompanyPostsSection } from '@/components/sections/company-profile-sections';
import { createOrganisationPostAction, deleteOrganisationPostAction, updateOrganisationPostAction } from '@/app/recruiter/actions';
import {
  getConversationMessages,
  getMessageConversation,
  getMessageConversations,
  getNetworkConnections,
  getNetworkFeed,
  getNetworkReceivedRequests,
  getNetworkSentRequests,
  getNetworkPrivacy,
  getNetworkSuggestions,
  getOrganisationInvitations,
  getOrganisationMembers,
  searchNetworkPeople,
} from '@/lib/api';
import { MessagesWorkspace } from '@/components/messaging/messages-workspace';
import { ConnectionsSections } from '@/components/connections/connections-sections';

const COMPANY_TABS = new Set(['home', 'about', 'blog', 'jobs', 'connections', 'insights']);
const CONNECTION_SECTIONS = new Set(['feed', 'company-people', 'discover', 'my-connections', 'invitations', 'messages']);

function NotificationBell({ unreadCount }) {
  const displayCount = unreadCount > 99 ? '99+' : String(unreadCount);
  const ariaLabel = unreadCount > 0 ? `Notifications, ${displayCount} unread` : 'Notifications';

  return (
    <Link
      href="/recruiter/notifications"
      aria-label={ariaLabel}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white text-[var(--color-text)] shadow-sm transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
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
  const connectionSection = CONNECTION_SECTIONS.has(String(queryParams?.section || 'feed'))
    ? String(queryParams?.section || 'feed')
    : 'feed';

  let organisation = null;
  let companyData = null;
  let dashboard = null;
  let notifications = [];
  let currentUser = null;
  let connectionData = null;
  let error = '';

  try {
    [organisation, dashboard, notifications, currentUser] = await Promise.all([
      getCurrentOrganisation(),
      getRecruiterDashboard(),
      getNotifications(),
      getCurrentUser(),
    ]);

    companyData = await getPublicOrganisation(organisation.slug);
    if (activeTab === 'connections') {
      const params = queryParams || {};
      const [connections, receivedRequests, sentRequests, suggestions, searchResults, privacy, members, invitations, conversations, feed] = await Promise.all([
        getNetworkConnections({ pageSize: 8 }),
        getNetworkReceivedRequests({ pageSize: 8 }),
        getNetworkSentRequests({ pageSize: 8 }),
        getNetworkSuggestions({ pageSize: 8 }),
        searchNetworkPeople({ ...params, pageSize: 8 }),
        getNetworkPrivacy(),
        getOrganisationMembers(),
        getOrganisationInvitations(),
        getMessageConversations({ pageSize: 20 }),
        connectionSection === 'feed' ? getNetworkFeed({ pageSize: 10 }) : Promise.resolve({ items: [], meta: {} }),
      ]);
      const activeConversationId = typeof params.conversation === 'string' ? params.conversation : '';
      const [activeConversation, messages] = await Promise.all([
        activeConversationId ? getMessageConversation(activeConversationId).catch(() => null) : Promise.resolve(null),
        activeConversationId ? getConversationMessages(activeConversationId, { limit: 25 }).catch(() => ({ items: [], meta: { nextCursor: null } })) : Promise.resolve({ items: [], meta: { nextCursor: null } }),
      ]);
      connectionData = { feed, openJobs: (companyData?.jobs?.items || []).filter((job) => job.slug).map((job) => ({ slug: job.slug, title: job.title })), connections, receivedRequests, sentRequests, suggestions, searchResults, privacy, members, invitations, conversations, activeConversation, messages, activeConversationId };
    }
  } catch (caught) {
    error = caught.message || 'Recruiter home could not be loaded.';
  }

  const unreadNotificationsCount = (notifications || []).filter((item) => !item.readAt).length;
  const canEditOrganisation = ['OWNER', 'ADMIN'].includes(currentUser?.activeMembership?.role || '');
  const canManagePosts = ['OWNER', 'ADMIN'].includes(currentUser?.activeMembership?.role || '');
  const basePath = '/recruiter/home';

  const hiringSnapshot = [
    { label: 'Open jobs', value: dashboard?.activeJobsCount, href: `${basePath}?tab=jobs` },
    { label: 'Pipeline candidates', value: dashboard?.applicantsCount, href: '/recruiter/ats' },
    { label: 'Interviews scheduled', value: dashboard?.upcomingInterviews?.length, href: '/recruiter/interviews' },
    { label: 'Offers pending', value: dashboard ? (dashboard.offersPendingApprovalCount + dashboard.offersReleasedCount) : null, href: '/recruiter' },
    { label: 'Upcoming joiners', value: dashboard?.upcomingJoinersCount, href: '/recruiter' },
  ].filter((item) => typeof item.value === 'number');

  return (
    <WorkspaceShell brand={organisation?.name || 'Careeriz Hire'} brandLogoUrl={organisation?.logoUrl} items={recruiterNav} sidebarCollapsible>
      <div className="grid gap-6">
        {error ? (
          <Alert tone="danger" title="Home unavailable">
            {error}
          </Alert>
        ) : null}

        {!error && companyData ? (
          <>
            <div className="grid gap-5">
              <RecruiterCompanyHeader
                organisation={organisation}
                canEdit={canEditOrganisation}
                actions={(
                  <>
                    <NotificationBell unreadCount={unreadNotificationsCount} />
                    <Link href="/recruiter/database" className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-md)] px-3.5 text-sm font-semibold transition-colors border border-[var(--color-border-strong)] bg-white text-[var(--color-text)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"><Search size={16} aria-hidden="true" />Search resumes</Link>
                    <Link href="/recruiter/ats" className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-md)] px-3.5 text-sm font-semibold transition-colors border border-[var(--color-border-strong)] bg-white text-[var(--color-text)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"><BriefcaseBusiness size={16} aria-hidden="true" />Pipeline</Link>
                    {currentUser?.role === 'RECRUITER_ADMIN' ? (
                      <Link href="/admin" className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-md)] px-3.5 text-sm font-semibold transition-colors text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)]"><ShieldCheck size={16} aria-hidden="true" />Admin</Link>
                    ) : null}
                    <Link href="/recruiter/jobs" className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-md)] px-3.5 text-sm font-semibold transition-colors bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]"><Plus size={16} aria-hidden="true" />Post a job</Link>
                  </>
                )}
              />
              <CompanyTabsNav basePath={basePath} activeTab={activeTab} mode="recruiter" variant="underline" />
            </div>

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
                <CompanyJobsSection jobs={companyData.recentJobs} title="Recent job openings" companyName={companyData.organisation.name} />
                <CompanyPeoplePreview peopleInsights={companyData.peopleInsights} basePath={basePath} />
                <CompanyInsightsSection publicInsights={companyData.publicInsights} />
              </div>
            ) : null}

            {activeTab === 'about' ? <CompanyAboutSection organisation={companyData.organisation} canEdit={canEditOrganisation} /> : null}
            {activeTab === 'blog' ? (
              <CompanyPostsSection
                organisation={companyData.organisation}
                posts={companyData.posts}
                canManage={canManagePosts}
                createPostAction={createOrganisationPostAction}
                updatePostAction={updateOrganisationPostAction}
                deletePostAction={deleteOrganisationPostAction}
              />
            ) : null}
            {activeTab === 'jobs' ? <CompanyJobsSection jobs={companyData.jobs.items} title="Open jobs" companyName={companyData.organisation.name} /> : null}
            {activeTab === 'connections' && connectionData ? (
              <ConnectionsSections
                section={connectionSection}
                organisation={organisation}
                data={connectionData}
                redirectTo={`${basePath}?tab=connections&section=${connectionSection}`}
              />
            ) : null}
            {activeTab === 'insights' ? <CompanyInsightsSection publicInsights={companyData.publicInsights} /> : null}
          </>
        ) : null}
      </div>
    </WorkspaceShell>
  );
}
