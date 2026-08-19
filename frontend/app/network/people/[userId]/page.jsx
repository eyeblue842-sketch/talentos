import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { MutualConnectionsPanel } from '@/components/network/mutual-connections-panel';
import { NetworkProfileActions } from '@/components/network/network-profile-actions';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { getCurrentUser } from '@/lib/auth';
import { getNetworkMutualConnections, getProfessionalProfile } from '@/lib/api';
import { candidateNav, recruiterNav } from '@/lib/navigation';

export default async function ProfessionalProfilePage({ params, searchParams }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/auth');
  }

  if (!['CANDIDATE', 'CANDIDATE_ADMIN', 'RECRUITER', 'RECRUITER_ADMIN'].includes(user.role)) {
    redirect(user.role === 'PLATFORM_ADMIN' || user.role === 'ADMIN' ? '/admin' : '/auth');
  }

  const { userId } = await params;
  const query = await searchParams;
  const mutualPage = Math.max(1, Number(query?.mutualPage) || 1);

  let data;
  try {
    data = await getProfessionalProfile(userId);
  } catch (error) {
    if (error.statusCode === 404) notFound();
    throw error;
  }

  const mutual = await getNetworkMutualConnections(userId, { page: mutualPage, pageSize: 6 }).catch(() => ({
    items: [],
    meta: { total: 0, page: 1, pageSize: 6, pageCount: 1 },
  }));
  const nav = user.role.startsWith('RECRUITER') ? recruiterNav : candidateNav;
  const brand = user.role.startsWith('RECRUITER') ? 'Careeriz Hire' : 'Careeriz';
  const profile = data.profile;
  const redirectTo = `/network/people/${profile.userId}`;

  return (
    <WorkspaceShell brand={brand} items={nav}>
      <PageHeader
        eyebrow="Professional profile"
        title={profile.fullName}
        description={profile.headline || 'Careeriz professional'}
        breadcrumb={[{ label: user.role === 'RECRUITER' ? 'Recruiter' : 'Candidate' }, { label: 'Network' }, { label: profile.fullName }]}
      />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-[32px] p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-[var(--font-display)] text-4xl font-semibold">{profile.fullName}</h1>
                <Badge tone={profile.role.startsWith('RECRUITER') ? 'brand' : 'neutral'}>
                  {profile.role.startsWith('RECRUITER') ? 'Recruiter' : 'Candidate'}
                </Badge>
                {profile.connectionStatus === 'ACCEPTED' ? <Badge tone="success">Connected</Badge> : null}
                {profile.connectionStatus === 'PENDING' ? <Badge tone="warning">Pending</Badge> : null}
              </div>
              <p className="mt-3 text-lg text-[var(--color-text-secondary)]">
                {profile.designation || profile.headline || 'Careeriz professional'}
                {profile.company ? ` • ${profile.company}` : ''}
              </p>
              {profile.location ? <p className="mt-2 text-sm text-[var(--color-text-muted)]">{profile.location}</p> : null}
            </div>

            <NetworkProfileActions
              profile={profile}
              redirectTo={redirectTo}
              source="PROFILE"
              allowViewProfile={false}
              className="min-w-[12rem]"
              messageHref={`${user.role.startsWith('RECRUITER') ? '/recruiter/messages' : '/candidate/messages'}?user=${profile.userId}`}
            />
          </div>

          {profile.skills?.length ? (
            <div className="mt-6 flex flex-wrap gap-2">
              {profile.skills.map((skill) => (
                <span key={skill} className="rounded-full bg-[var(--color-bg-muted)] px-3 py-1 text-xs font-semibold text-[var(--color-primary)]">{skill}</span>
              ))}
            </div>
          ) : null}

          {data.about ? (
            <div className="mt-8">
              <h2 className="font-[var(--font-display)] text-2xl font-semibold">About</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--color-text-secondary)]">{data.about}</p>
            </div>
          ) : null}
        </Card>

        <div className="space-y-6">
          <MutualConnectionsPanel mutual={mutual} basePath={redirectTo} params={query || {}} />

          <Card className="rounded-[32px] p-6">
            <h2 className="font-[var(--font-display)] text-2xl font-semibold">Visibility</h2>
            <dl className="mt-4 grid gap-3 text-sm">
              <div><dt className="font-semibold text-[var(--color-text)]">People search</dt><dd className="text-[var(--color-text-secondary)]">{data.visibility.showInPeopleSearch ? 'Visible where allowed' : 'Hidden from people search'}</dd></div>
              <div><dt className="font-semibold text-[var(--color-text)]">Connections</dt><dd className="text-[var(--color-text-secondary)]">{data.visibility.connectionVisibility.replaceAll('_', ' ')}</dd></div>
              <div><dt className="font-semibold text-[var(--color-text)]">Requests</dt><dd className="text-[var(--color-text-secondary)]">{data.visibility.allowConnectionRequestsFrom.replaceAll('_', ' ')}</dd></div>
            </dl>
            <Link href={user.role === 'RECRUITER' ? '/recruiter/network' : '/candidate/network'} className="mt-5 inline-flex text-sm font-semibold text-[var(--color-primary)]">
              Back to network
            </Link>
          </Card>
        </div>
      </div>
    </WorkspaceShell>
  );
}
