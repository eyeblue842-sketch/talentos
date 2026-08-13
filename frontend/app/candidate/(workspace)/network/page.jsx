import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { PageHeader } from '@/components/ui/page-header';
import { candidateNav } from '@/lib/navigation';
import {
  getNetworkConnections,
  getNetworkPrivacy,
  getNetworkReceivedRequests,
  getNetworkSentRequests,
  getNetworkSuggestions,
  searchNetworkPeople,
} from '@/lib/api';
import { NetworkPageContent } from '@/components/network/network-page-content';

export default async function CandidateNetworkPage({ searchParams }) {
  const params = await searchParams;
  const [connections, receivedRequests, sentRequests, suggestions, searchResults, privacy] = await Promise.all([
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
        eyebrow="Candidate network"
        title="Build your professional network"
        description="Connect with recruiters and peers through Careeriz-native discovery, privacy, and connection workflows."
        breadcrumb={[{ label: 'Candidate' }, { label: 'Network' }]}
      />
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
    </WorkspaceShell>
  );
}
