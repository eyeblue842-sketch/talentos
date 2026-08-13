import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { RecruiterSemanticSearchWorkspace } from '@/components/sections/recruiter-semantic-search-workspace';
import { recruiterNav } from '@/lib/navigation';
import { getCurrentOrganisation, getRecruiterJobs } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { hasUserPermission } from '@/lib/enterprise-permissions';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { buildInitialSemanticSearchState } from '@/lib/semantic-search';

export default async function RecruiterDatabaseResultsPage({ searchParams }) {
  const rawParams = await searchParams;
  const initialState = {
    ...buildInitialSemanticSearchState(rawParams || {}),
    deferSearch: false,
  };

  let organisation = null;
  let currentUser = null;
  let jobs = [];
  let errorMessage = '';

  const featureFlags = {
    semanticSearchEnabled: isFeatureEnabled('semanticSearch'),
    semanticSearchHistoryEnabled: isFeatureEnabled('searchHistory'),
    semanticSearchSavedEnabled: isFeatureEnabled('savedSearches'),
    semanticSearchSuggestionsEnabled: isFeatureEnabled('searchSuggestions'),
    similarCandidateSearchEnabled: isFeatureEnabled('similarCandidateSearch'),
    similarJobSearchEnabled: isFeatureEnabled('similarJobSearch'),
    candidateIntelligenceEnabled: isFeatureEnabled('candidateIntelligence'),
    candidateMatchingEnabled: isFeatureEnabled('candidateMatching'),
  };

  try {
    [organisation, jobs, currentUser] = await Promise.all([
      getCurrentOrganisation(),
      getRecruiterJobs(),
      getCurrentUser(),
    ]);
  } catch (error) {
    errorMessage = error.message;
  }

  const permissions = {
    canReadSemanticSearch: hasUserPermission(currentUser, 'intelligence.search.read') || hasUserPermission(currentUser, 'intelligence.search.execute'),
    canExecuteSemanticSearch: hasUserPermission(currentUser, 'intelligence.search.execute'),
    canReadSearchHistory: hasUserPermission(currentUser, 'intelligence.search.history.read'),
    canReadSavedSearches: hasUserPermission(currentUser, 'intelligence.saved_search.read'),
    canManageSavedSearches: hasUserPermission(currentUser, 'intelligence.saved_search.manage'),
    canReadCandidateIntelligence: hasUserPermission(currentUser, 'intelligence.candidate.read'),
    canReadCandidateMatch: hasUserPermission(currentUser, 'intelligence.match.read'),
  };

  return (
    <WorkspaceShell brand={organisation?.name || 'Careeriz Hire'} items={recruiterNav}>
      <PageHeader
        eyebrow={organisation?.slug || 'Careeriz Hire'}
        title="Candidate Search Results"
        description="Review recruiter-safe profiles returned by your Careeriz search criteria."
        breadcrumb={[{ label: 'Recruiter' }, { label: 'Resume Search', href: '/recruiter/database' }, { label: 'Results' }]}
        secondaryActions={[{ label: 'Modify Search', href: '/recruiter/database' }]}
      />

      {errorMessage ? (
        <Card>
          <h2 className="text-xl font-semibold text-[var(--color-text)]">Search Results unavailable</h2>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{errorMessage}</p>
        </Card>
      ) : (
        <RecruiterSemanticSearchWorkspace
          initialState={initialState}
          view="results"
          organisationName={organisation?.name || 'Careeriz Hire'}
          jobs={jobs}
          featureEnabled={featureFlags.semanticSearchEnabled}
          canRead={permissions.canReadSemanticSearch}
          canExecute={permissions.canExecuteSemanticSearch}
          canReadHistory={permissions.canReadSearchHistory}
          canReadSavedSearches={permissions.canReadSavedSearches}
          canManageSavedSearches={permissions.canManageSavedSearches}
          canReadCandidateIntelligence={permissions.canReadCandidateIntelligence}
          canReadCandidateMatch={permissions.canReadCandidateMatch}
          candidateIntelligenceEnabled={featureFlags.candidateIntelligenceEnabled}
          candidateMatchingEnabled={featureFlags.candidateMatchingEnabled}
          searchSuggestionsEnabled={featureFlags.semanticSearchSuggestionsEnabled}
          savedSearchesEnabled={featureFlags.semanticSearchSavedEnabled}
          searchHistoryEnabled={featureFlags.semanticSearchHistoryEnabled}
          similarCandidateSearchEnabled={featureFlags.similarCandidateSearchEnabled}
          similarJobSearchEnabled={featureFlags.similarJobSearchEnabled}
        />
      )}
    </WorkspaceShell>
  );
}
