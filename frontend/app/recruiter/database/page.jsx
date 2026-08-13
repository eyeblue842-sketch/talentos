import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Card } from '@/components/ui/card';
import { RecruiterResumeSearchPage } from '@/components/sections/recruiter-resume-search-page';
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
  const initialState = {
    ...buildInitialSemanticSearchState(rawParams || {}),
    // Criteria is a review-only page. Search execution happens on the results route.
    deferSearch: true,
  };

  let organisation = null;
  let currentUser = null;
  let jobs = [];
  let errorMessage = '';
  const semanticSearchEnabled = isFeatureEnabled('semanticSearch');
  const semanticSearchHistoryEnabled = isFeatureEnabled('searchHistory');
  const semanticSearchSavedEnabled = isFeatureEnabled('savedSearches');

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
  return (
    <WorkspaceShell
      brand={organisation?.name || 'Careeriz Hire'}
      items={recruiterNav}
      maxWidthClassName="max-w-none"
      paddingClassName="px-4 py-4 sm:px-6 sm:py-5 lg:px-6 lg:py-6"
      sidebarCollapsible
    >
      {errorMessage ? (
        <Card>
          <h2 className="text-xl font-semibold text-[var(--color-text)]">Resume Search unavailable</h2>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{errorMessage}</p>
        </Card>
      ) : (
        <RecruiterResumeSearchPage
          initialState={initialState}
          jobs={jobs}
          featureEnabled={semanticSearchEnabled}
          canRead={canReadSemanticSearch}
          canExecute={canExecuteSemanticSearch}
          canReadHistory={canReadSearchHistory}
          canReadSavedSearches={canReadSavedSearches}
          canManageSavedSearches={canManageSavedSearches}
          searchHistoryEnabled={semanticSearchHistoryEnabled}
          savedSearchesEnabled={semanticSearchSavedEnabled}
        />
      )}
    </WorkspaceShell>
  );
}
