import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NetworkPageContent } from '@/components/network/network-page-content';
import { MessagesWorkspace } from '@/components/messaging/messages-workspace';

const sections = [
  ['company-people', 'Company People'],
  ['discover', 'Discover'],
  ['my-connections', 'My Connections'],
  ['invitations', 'Invitations'],
  ['messages', 'Messages'],
];

function sectionHref(section) {
  return `/recruiter/home?tab=connections&section=${section}`;
}

function CompanyPeople({ organisation, members = [], invitations = [] }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.35fr)]">
      <Card className="min-w-0 rounded-2xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-2xl font-semibold">Company People</h2><p className="mt-1 text-sm text-[var(--color-text-secondary)]">Members officially associated with {organisation?.name || 'this organisation'}.</p></div>
          <Badge tone="brand">{members.length}</Badge>
        </div>
        <div className="mt-5 grid gap-3">
          {members.length ? members.map((member) => (
            <div key={member.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] p-4">
              <div className="min-w-0"><p className="truncate font-semibold">{member.user?.name || member.user?.email || 'Organisation member'}</p><p className="mt-1 truncate text-sm text-[var(--color-text-secondary)]">{member.user?.email || 'Verified member'} · Joined {member.createdAt ? new Date(member.createdAt).toLocaleDateString() : 'recently'}</p></div>
              <div className="flex gap-2"><Badge tone="brand">{member.role}</Badge><Badge tone={member.status === 'ACTIVE' ? 'success' : 'warning'}>{member.status}</Badge></div>
            </div>
          )) : <p className="text-sm text-[var(--color-text-muted)]">No company members found.</p>}
        </div>
      </Card>
      <Card className="rounded-2xl p-6"><h2 className="text-xl font-semibold">Membership invitations</h2><p className="mt-1 text-sm text-[var(--color-text-secondary)]">Company invitations remain separate from professional connection requests.</p><p className="mt-4 text-sm">{invitations.filter((item) => item.status === 'PENDING').length} pending invitation(s).</p><Button as="a" href="/recruiter/members" variant="outline" className="mt-4">Manage members</Button></Card>
    </div>
  );
}

export function ConnectionsSections({ section, organisation, data, redirectTo }) {
  const tabs = (
    <nav aria-label="Connections sections" className="flex max-w-full gap-2 overflow-x-auto border-b border-[var(--color-border)] pb-2">
      {sections.map(([id, label]) => <Link key={id} href={sectionHref(id)} aria-current={section === id ? 'page' : undefined} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium ${section === id ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)]'}`}>{label}</Link>)}
    </nav>
  );

  if (section === 'company-people') return <div className="space-y-6">{tabs}<CompanyPeople organisation={organisation} members={data.members} invitations={data.invitations} /></div>;
  if (section === 'messages') return <div className="space-y-6">{tabs}<MessagesWorkspace initialConversations={data.conversations.items} initialConversation={data.activeConversation} initialMessages={data.messages.items} initialMessagesMeta={data.messages.meta} activeConversationId={data.activeConversationId} basePath="/recruiter/home?tab=connections&section=messages" /></div>;

  const networkProps = {
    connections: data.connections,
    receivedRequests: data.receivedRequests,
    sentRequests: data.sentRequests,
    suggestions: data.suggestions,
    searchResults: data.searchResults,
    privacy: data.privacy,
    searchParams: {},
    redirectTo,
    messageBasePath: '/recruiter/home?tab=connections&section=messages',
    section,
  };
  return <div className="space-y-6">{tabs}<NetworkPageContent {...networkProps} /></div>;
}
