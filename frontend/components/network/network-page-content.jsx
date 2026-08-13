import Link from 'next/link';
import {
  followCompanyAction,
  unfollowCompanyAction,
} from '@/app/network/actions';
import { NetworkProfileActions } from '@/components/network/network-profile-actions';
import { NetworkPrivacyForm } from '@/components/network/network-privacy-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

function formatDate(value) {
  if (!value) return 'Not connected yet';
  return new Date(value).toLocaleDateString();
}

function ProfileCard({ profile, subtitle, footer, redirectTo, source = 'PROFILE', messageBasePath = '/candidate/messages' }) {
  return (
    <Card data-testid={`network-user-${profile.userId}`} className="rounded-[28px] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-[var(--font-display)] text-xl font-semibold text-[var(--color-text)]">{profile.fullName}</h3>
            <Badge tone={profile.role.startsWith('RECRUITER') ? 'brand' : 'neutral'}>
              {profile.role.startsWith('RECRUITER') ? 'Recruiter' : 'Candidate'}
            </Badge>
            {profile.connectionStatus === 'ACCEPTED' ? <Badge tone="success">Connected</Badge> : null}
            {profile.connectionStatus === 'PENDING' ? <Badge tone="warning">Pending</Badge> : null}
            {profile.connectionStatus === 'BLOCKED' ? <Badge tone="danger">Blocked</Badge> : null}
          </div>
          <p className="mt-1 text-sm font-medium text-[var(--color-text-secondary)]">
            {profile.designation || profile.headline || 'Careeriz professional'}
            {profile.company ? ` • ${profile.company}` : ''}
          </p>
          {profile.location ? <p className="mt-2 text-sm text-[var(--color-text-muted)]">{profile.location}</p> : null}
          {profile.skills?.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {profile.skills.slice(0, 4).map((skill) => (
                <span key={skill} className="rounded-full bg-[var(--color-bg-muted)] px-3 py-1 text-xs font-semibold text-[var(--color-primary)]">{skill}</span>
              ))}
            </div>
          ) : null}
          {subtitle ? <p className="mt-3 text-sm text-[var(--color-text-secondary)]">{subtitle}</p> : null}
          {footer ? <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{footer}</p> : null}
        </div>
        <NetworkProfileActions profile={profile} redirectTo={redirectTo} source={source} messageHref={`${messageBasePath}?user=${profile.userId}`} />
      </div>
    </Card>
  );
}

function SectionHeader({ title, count, copy }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h2 className="font-[var(--font-display)] text-2xl font-semibold text-[var(--color-text)]">{title}</h2>
        {copy ? <p className="mt-1 text-sm text-[var(--color-text-muted)]">{copy}</p> : null}
      </div>
      {typeof count === 'number' ? <Badge tone="brand">{count}</Badge> : null}
    </div>
  );
}

export function NetworkPageContent({
  connections,
  receivedRequests,
  sentRequests,
  suggestions,
  searchResults,
  privacy,
  searchParams,
  redirectTo,
  messageBasePath = '/candidate/messages',
}) {
  const searchQuery = searchParams?.q || '';
  const designationQuery = searchParams?.designation || '';
  const skillsQuery = searchParams?.skills || '';
  const locationQuery = searchParams?.location || '';

  return (
    <div className="space-y-6">
      <Card className="rounded-[32px] border-none bg-[linear-gradient(135deg,var(--color-primary),#0f766e)] p-7 text-white shadow-[var(--shadow-floating)]">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">Careeriz Professional Network</p>
        <div className="mt-4 grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
          <div>
            <h1 className="font-[var(--font-display)] text-4xl font-semibold">Build direct professional relationships inside Careeriz.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/80">
              Manage accepted connections, pending requests, discovery, and company follows without exposing private resume data outside the existing Careeriz privacy model.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[24px] bg-white/10 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-white/70">Connections</p>
              <p className="mt-2 text-3xl font-semibold">{connections.meta.total}</p>
            </div>
            <div className="rounded-[24px] bg-white/10 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-white/70">Incoming</p>
              <p className="mt-2 text-3xl font-semibold">{receivedRequests.meta.total}</p>
            </div>
            <div className="rounded-[24px] bg-white/10 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-white/70">Outgoing</p>
              <p className="mt-2 text-3xl font-semibold">{sentRequests.meta.total}</p>
            </div>
            <div className="rounded-[24px] bg-white/10 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-white/70">Suggestions</p>
              <p className="mt-2 text-3xl font-semibold">{suggestions.meta.total}</p>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <Card className="rounded-[32px] p-6">
            <SectionHeader title="Search People" copy="Search candidates and recruiters with connection-aware actions." />
            <form method="GET" className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <input name="q" defaultValue={searchQuery} placeholder="Name or keyword" className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm" />
              <input name="designation" defaultValue={designationQuery} placeholder="Designation" className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm" />
              <input name="skills" defaultValue={skillsQuery} placeholder="Skills" className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm" />
              <div className="flex gap-3">
                <input name="location" defaultValue={locationQuery} placeholder="Location" className="min-w-0 flex-1 rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm" />
                <Button type="submit">Search</Button>
              </div>
            </form>
            <div className="mt-5 grid gap-4">
              {searchResults.items.length ? searchResults.items.map((profile) => (
                <ProfileCard
                  key={profile.userId}
                  profile={profile}
                  subtitle={profile.mutualConnections.count ? `${profile.mutualConnections.count} mutual connection${profile.mutualConnections.count === 1 ? '' : 's'}` : 'Open to professional networking'}
                  redirectTo={redirectTo}
                  source="PEOPLE_SEARCH"
                  messageBasePath={messageBasePath}
                />
              )) : (
                <p className="text-sm text-[var(--color-text-muted)]">Search Careeriz professionals by name, title, skills, or location.</p>
              )}
            </div>
          </Card>

          <Card className="rounded-[32px] p-6">
            <SectionHeader title="My Network" count={connections.meta.total} copy="Accepted two-way connections." />
            <div className="mt-5 grid gap-4">
              {connections.items.length ? connections.items.map((item) => (
                <ProfileCard
                  key={item.connectionId}
                  profile={{ ...item.profile, connectionId: item.connectionId }}
                  subtitle={item.profile.mutualConnections.count ? `${item.profile.mutualConnections.count} mutual connection${item.profile.mutualConnections.count === 1 ? '' : 's'}` : 'Connected on Careeriz'}
                  footer={`Connected ${formatDate(item.connectedAt)}`}
                  redirectTo={redirectTo}
                  messageBasePath={messageBasePath}
                />
              )) : (
                <p className="text-sm text-[var(--color-text-muted)]">No accepted connections yet.</p>
              )}
            </div>
          </Card>

          <Card className="rounded-[32px] p-6">
            <SectionHeader title="Suggested Connections" count={suggestions.meta.total} copy="Explainable recommendations based on mutuals, role fit, skills, and company context." />
            <div className="mt-5 grid gap-4">
              {suggestions.items.length ? suggestions.items.map((item) => (
                <ProfileCard
                  key={item.profile.userId}
                  profile={item.profile}
                  subtitle={item.reason}
                  footer={item.explanations?.join(' • ')}
                  redirectTo={redirectTo}
                  source="SUGGESTION"
                  messageBasePath={messageBasePath}
                />
              )) : (
                <p className="text-sm text-[var(--color-text-muted)]">Suggestions will appear as more professional data and mutuals accumulate.</p>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="rounded-[32px] p-6">
            <SectionHeader title="Received Requests" count={receivedRequests.meta.total} />
            <div className="mt-5 grid gap-4">
              {receivedRequests.items.length ? receivedRequests.items.map((item) => (
                <ProfileCard
                  key={item.requestId}
                  profile={{ ...item.profile, requestId: item.requestId, pendingDirection: 'INCOMING' }}
                  subtitle={item.profile.mutualConnections.count ? `${item.profile.mutualConnections.count} mutual connection${item.profile.mutualConnections.count === 1 ? '' : 's'}` : 'Pending your review'}
                  footer={`Requested ${formatDate(item.sentAt)}`}
                  redirectTo={redirectTo}
                  messageBasePath={messageBasePath}
                />
              )) : (
                <p className="text-sm text-[var(--color-text-muted)]">No incoming requests.</p>
              )}
            </div>
          </Card>

          <Card className="rounded-[32px] p-6">
            <SectionHeader title="Sent Requests" count={sentRequests.meta.total} />
            <div className="mt-5 grid gap-4">
              {sentRequests.items.length ? sentRequests.items.map((item) => (
                <ProfileCard
                  key={item.requestId}
                  profile={{ ...item.profile, requestId: item.requestId, pendingDirection: 'OUTGOING' }}
                  subtitle={item.profile.mutualConnections.count ? `${item.profile.mutualConnections.count} mutual connection${item.profile.mutualConnections.count === 1 ? '' : 's'}` : 'Awaiting response'}
                  footer={`Sent ${formatDate(item.sentAt)}`}
                  redirectTo={redirectTo}
                  messageBasePath={messageBasePath}
                />
              )) : (
                <p className="text-sm text-[var(--color-text-muted)]">No sent requests.</p>
              )}
            </div>
          </Card>

          <Card className="rounded-[32px] p-6">
            <SectionHeader title="Network Privacy" copy="These settings apply to people search, requests, and recruiter identity visibility." />
            <div className="mt-5">
              <NetworkPrivacyForm settings={privacy.settings} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export function CompanyFollowToggle({ organisationId, following, redirectTo }) {
  if (!organisationId) return null;
  return following ? (
    <form action={unfollowCompanyAction}>
      <input type="hidden" name="organisationId" value={organisationId} />
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <Button type="submit" variant="outline">Unfollow company</Button>
    </form>
  ) : (
    <form action={followCompanyAction}>
      <input type="hidden" name="organisationId" value={organisationId} />
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <Button type="submit">Follow company</Button>
    </form>
  );
}
