import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { PageHeader } from '@/components/ui/page-header';
import { recruiterNav } from '@/lib/navigation';
import {
  getNetworkConnections,
  getNetworkPrivacy,
  getNetworkReceivedRequests,
  getNetworkSentRequests,
  getNetworkSuggestions,
  searchNetworkPeople,
} from '@/lib/api';
import { NetworkPageContent } from '@/components/network/network-page-content';

export default async function RecruiterNetworkPage({ searchParams }) {
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
    <WorkspaceShell brand="Careeriz Hire" items={recruiterNav}>
      <PageHeader
        eyebrow="Recruiter network"
        title="Manage your professional network"
        description="Connect with candidates, recruiters, and company stakeholders through Careeriz-native networking workflows."
        breadcrumb={[{ label: 'Recruiter' }, { label: 'Network' }]}
      />
      <NetworkPageContent
        connections={connections}
        receivedRequests={receivedRequests}
        sentRequests={sentRequests}
        suggestions={suggestions}
        searchResults={searchResults}
        privacy={privacy}
        searchParams={params || {}}
        redirectTo="/recruiter/network"
        messageBasePath="/recruiter/messages"
      />
    </WorkspaceShell>
  );
}
