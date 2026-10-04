import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs } from '@/components/ui/tabs';
import { candidateNav } from '@/lib/navigation';
import {
  createMessageConversation,
  getCandidateFeed,
  getConversationMessages,
  getMessageConversation,
  getMessageConversations,
  getNetworkConnections,
  getNetworkPrivacy,
  getNetworkReceivedRequests,
  getNetworkSentRequests,
  getNetworkSuggestions,
  searchNetworkPeople,
} from '@/lib/api';
import { CandidateFeed } from '@/components/candidate/candidate-feed';
import { MessagesWorkspace } from '@/components/messaging/messages-workspace';
import { NetworkPageContent } from '@/components/network/network-page-content';

export default async function CandidateNetworkPage({ searchParams }) {
  const params = await searchParams;

  let activeConversationId = typeof params?.conversation === 'string' ? params.conversation : '';
  if (!activeConversationId && typeof params?.user === 'string') {
    const conversation = await createMessageConversation(params.user).catch(() => null);
    activeConversationId = conversation?.id || '';
  }
  const messagesRequested = Boolean(activeConversationId) || params?.tab === 'messages';

  const [feed, connections, receivedRequests, sentRequests, suggestions, searchResults, privacy, conversations, activeConversation, messages] = await Promise.all([
    getCandidateFeed({ pageSize: 10 }).catch(() => ({ items: [], meta: {} })),
    getNetworkConnections({ pageSize: 8 }),
    getNetworkReceivedRequests({ pageSize: 4 }),
    getNetworkSentRequests({ pageSize: 4 }),
    getNetworkSuggestions({ pageSize: 4 }),
    searchNetworkPeople({ ...params, pageSize: 6 }),
    getNetworkPrivacy(),
    getMessageConversations({ pageSize: 20 }).catch(() => ({ items: [], meta: {} })),
    activeConversationId ? getMessageConversation(activeConversationId).catch(() => null) : Promise.resolve(null),
    activeConversationId
      ? getConversationMessages(activeConversationId, { limit: 25 }).catch(() => ({ items: [], meta: { nextCursor: null } }))
      : Promise.resolve({ items: [], meta: { nextCursor: null } }),
  ]);

  const defaultTab = messagesRequested ? 'messages' : 'feed';

  return (
    <WorkspaceShell brand="Careeriz" items={candidateNav}>
      <PageHeader
        eyebrow="Careeriz community"
        title="Your feed, network and messages"
        description="See updates from companies you follow, share your own, grow your network, and message your connections — all in one place."
        breadcrumb={[{ label: 'Candidate' }, { label: 'Network' }]}
      />
      <Tabs
        defaultValue={defaultTab}
        items={[
          {
            value: 'feed',
            label: 'Feed',
            content: <CandidateFeed initialItems={feed.items} initialMeta={feed.meta} />,
          },
          {
            value: 'network',
            label: 'Network',
            content: (
              <NetworkPageContent
                connections={connections}
                receivedRequests={receivedRequests}
                sentRequests={sentRequests}
                suggestions={suggestions}
                searchResults={searchResults}
                privacy={privacy}
                searchParams={params || {}}
                redirectTo="/candidate/network"
                messageBasePath="/candidate/network"
              />
            ),
          },
          {
            value: 'messages',
            label: 'Messages',
            content: (
              <MessagesWorkspace
                initialConversations={conversations.items}
                initialConversation={activeConversation}
                initialMessages={messages.items}
                initialMessagesMeta={messages.meta}
                activeConversationId={activeConversationId}
                basePath="/candidate/network"
              />
            ),
          },
        ]}
      />
    </WorkspaceShell>
  );
}
