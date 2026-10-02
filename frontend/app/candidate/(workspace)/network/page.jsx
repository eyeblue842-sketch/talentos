import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs } from '@/components/ui/tabs';
import { candidateNav } from '@/lib/navigation';
import {
  getCandidateFeed,
  getNetworkConnections,
  getNetworkPrivacy,
  getNetworkReceivedRequests,
  getNetworkSentRequests,
  getNetworkSuggestions,
  searchNetworkPeople,
} from '@/lib/api';
import { CandidateFeed } from '@/components/candidate/candidate-feed';
import { NetworkPageContent } from '@/components/network/network-page-content';

export default async function CandidateNetworkPage({ searchParams }) {
  const params = await searchParams;
  const [feed, connections, receivedRequests, sentRequests, suggestions, searchResults, privacy] = await Promise.all([
    getCandidateFeed({ pageSize: 10 }).catch(() => ({ items: [], meta: {} })),
    getNetworkConnections({ pageSize: 8 }),
    getNetworkReceivedRequests({ pageSize: 4 }),
    getNetworkSentRequests({ pageSize: 4 }),
    getNetworkSuggestions({ pageSize: 4 }),
    searchNetworkPeople({ ...params, pageSize: 6 }),
    getNetworkPrivacy(),
  ]);

  return (
    <WorkspaceShell brand="Careeriz" items={candidateNav}>
      <PageHeader
        eyebrow="Careeriz community"
        title="Your feed and network"
        description="See updates from companies you follow, share your own, and grow your professional network — all in one place."
        breadcrumb={[{ label: 'Candidate' }, { label: 'Network' }]}
      />
      <Tabs
        defaultValue="feed"
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
                messageBasePath="/candidate/messages"
              />
            ),
          },
        ]}
      />
    </WorkspaceShell>
  );
}
