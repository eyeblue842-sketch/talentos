import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { RecruiterSemanticSearchWorkspace } from '@/components/sections/recruiter-semantic-search-workspace';
import { recruiterNav } from '@/lib/navigation';
import {
  getCurrentOrganisation,
  getRecruiterJobs,
} from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { hasUserPermission } from '@/lib/enterprise-permissions';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { buildInitialSemanticSearchState } from '@/lib/semantic-search';

export default async function RecruiterDatabasePage({ searchParams }) {
  const rawParams = await searchParams;
  const initialState = buildInitialSemanticSearchState(rawParams || {});

  let organisation = null;
  let currentUser = null;
  let jobs = [];
  let errorMessage = '';
  const semanticSearchEnabled = isFeatureEnabled('semanticSearch');
  const semanticSearchHistoryEnabled = isFeatureEnabled('searchHistory');
  const semanticSearchSavedEnabled = isFeatureEnabled('savedSearches');
  const semanticSearchSuggestionsEnabled = isFeatureEnabled('searchSuggestions');
  const similarCandidateSearchEnabled = isFeatureEnabled('similarCandidateSearch');
  const similarJobSearchEnabled = isFeatureEnabled('similarJobSearch');
  const candidateIntelligenceEnabled = isFeatureEnabled('candidateIntelligence');
  const candidateMatchingEnabled = isFeatureEnabled('candidateMatching');

  try {
    [organisation, jobs, currentUser] = await Promise.all([
      getCurrentOrganisation(),
      getRecruiterJobs(),
      getCurrentUser(),
    ]);
  } catch (error) {
    errorMessage = error.message;
  }

  const canReadSemanticSearch = hasUserPermission(currentUser, 'intelligence.search.read') || hasUserPermission(currentUser, 'intelligence.search.execute');
  const canExecuteSemanticSearch = hasUserPermission(currentUser, 'intelligence.search.execute');
  const canReadSearchHistory = hasUserPermission(currentUser, 'intelligence.search.history.read');
  const canReadSavedSearches = hasUserPermission(currentUser, 'intelligence.saved_search.read');
  const canManageSavedSearches = hasUserPermission(currentUser, 'intelligence.saved_search.manage');
  const canReadCandidateIntelligence = hasUserPermission(currentUser, 'intelligence.candidate.read');
  const canReadCandidateMatch = hasUserPermission(currentUser, 'intelligence.match.read');

  return (
    <WorkspaceShell brand={organisation?.name || 'Careeriz Hire'} items={recruiterNav}>
      <PageHeader
        eyebrow={organisation?.slug || 'Careeriz Hire'}
        title="Resume Search"
        description="Recruiter-grade semantic candidate discovery with structured filters, saved searches, live preview, and optional AI match enrichment."
        breadcrumb={[{ label: 'Recruiter' }, { label: 'Resume Search' }]}
      />

      {errorMessage ? (
        <Card>
          <h2 className="text-xl font-semibold text-[var(--color-text)]">Resume Search unavailable</h2>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{errorMessage}</p>
        </Card>
      ) : (
        <RecruiterSemanticSearchWorkspace
          initialState={initialState}
          organisationName={organisation?.name || 'Careeriz Hire'}
          jobs={jobs}
          featureEnabled={semanticSearchEnabled}
          canRead={canReadSemanticSearch}
          canExecute={canExecuteSemanticSearch}
          canReadHistory={canReadSearchHistory}
          canReadSavedSearches={canReadSavedSearches}
          canManageSavedSearches={canManageSavedSearches}
          canReadCandidateIntelligence={canReadCandidateIntelligence}
          canReadCandidateMatch={canReadCandidateMatch}
          candidateIntelligenceEnabled={candidateIntelligenceEnabled}
          candidateMatchingEnabled={candidateMatchingEnabled}
          searchSuggestionsEnabled={semanticSearchSuggestionsEnabled}
          savedSearchesEnabled={semanticSearchSavedEnabled}
          searchHistoryEnabled={semanticSearchHistoryEnabled}
          similarCandidateSearchEnabled={similarCandidateSearchEnabled}
          similarJobSearchEnabled={similarJobSearchEnabled}
        />
      )}
    </WorkspaceShell>
  );
}
