import { Database, SearchCode, Sparkles } from 'lucide-react';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { recruiterNav } from '@/lib/navigation';
import { buildQueryString } from '@/lib/query-internal';
import {
  getApprovedRequisitions,
  getCurrentOrganisation,
  getRecruiterCandidatePreview,
  getRecruiterJobs,
  getRecruiterSavedSearches,
  getRecruiterTalentPools,
  getSavedCandidates,
  searchCandidates,
} from '@/lib/api';
import {
  buildResumeSearchQueryEntries,
  buildResumeSearchRequestParams,
  buildSavedSearchHref,
  decorateResumeCandidate,
  decorateResumePreview,
  normalizeResumeSearchParams,
  savedSearchPresets,
} from '@/lib/recruiter-resume-search';
import { RecruiterResumeSearchFilters } from '@/components/sections/recruiter-resume-search-filters';
import { RecruiterResumeSearchWorkbench } from '@/components/sections/recruiter-resume-search-workbench';

export default async function RecruiterDatabasePage({ searchParams }) {
  const rawParams = await searchParams;
  const normalizedParams = normalizeResumeSearchParams(rawParams || {});
  const requestParams = buildResumeSearchRequestParams(rawParams || {});
  const queryEntries = buildResumeSearchQueryEntries(rawParams || {});
  const queryString = buildQueryString(queryEntries).replace(/^\?/, '');

  let result = { items: [], meta: null };
  let saved = { items: [], meta: null };
  let savedSearches = { items: [], recent: [] };
  let talentPools = [];
  let organisation = null;
  let jobs = [];
  let requisitions = [];
  let preview = null;
  let errorMessage = '';

  try {
    [organisation, result, saved, savedSearches, talentPools, jobs, requisitions] = await Promise.all([
      getCurrentOrganisation(),
      searchCandidates(queryString),
      getSavedCandidates(''),
      getRecruiterSavedSearches(),
      getRecruiterTalentPools(),
      getRecruiterJobs(),
      getApprovedRequisitions(),
    ]);

    const previewId = normalizedParams.preview || result.items[0]?.id;
    if (previewId) {
      const detail = await getRecruiterCandidatePreview(previewId);
      preview = decorateResumePreview(detail);
    }
  } catch (error) {
    errorMessage = error.message;
  }

  const decoratedResults = result.items.map((candidate) => decorateResumeCandidate(candidate, requestParams));
  const totalResults = result.meta?.total || decoratedResults.length;
  const filters = (
    <RecruiterResumeSearchFilters
      params={normalizedParams}
      savedSearches={(savedSearches.items?.length ? savedSearches.items : savedSearchPresets).map((item) => ({
        label: item.label,
        params: item.query || item.params,
      }))}
      recentSearches={(savedSearches.recent?.length ? savedSearches.recent : savedSearchPresets.slice(0, 2)).map((item) => ({
        label: item.label,
        href: buildSavedSearchHref(item.query || item.params),
      }))}
      jobs={jobs}
      requisitions={requisitions}
    />
  );

  return (
    <WorkspaceShell brand={organisation?.name || 'Careeriz Hire'} items={recruiterNav}>
      <PageHeader
        eyebrow={organisation?.slug || 'Careeriz Hire'}
        title="Resume Search"
        description="Recruiter-grade candidate discovery with AI query support, structured filters, bulk workflows, and ATS-aware preview context."
        breadcrumb={[{ label: 'Recruiter' }, { label: 'Resume Search' }]}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-[var(--surface)]">
          <div className="flex items-start gap-3">
            <span className="rounded-[16px] bg-[var(--color-primary-soft)] p-3 text-[var(--color-primary)]">
              <SearchCode size={18} aria-hidden="true" />
            </span>
            <div>
              <p className="font-semibold text-[var(--color-text)]">Search Modes</p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Keyword, AI, boolean, saved, and recent searches in one module.</p>
            </div>
          </div>
        </Card>
        <Card className="bg-[var(--surface)]">
          <div className="flex items-start gap-3">
            <span className="rounded-[16px] bg-[var(--color-primary-soft)] p-3 text-[var(--color-primary)]">
              <Database size={18} aria-hidden="true" />
            </span>
            <div>
              <p className="font-semibold text-[var(--color-text)]">Server-backed Results</p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{totalResults} candidates returned with pagination and lazy preview loading.</p>
            </div>
          </div>
        </Card>
        <Card className="bg-[var(--surface)]">
          <div className="flex items-start gap-3">
            <span className="rounded-[16px] bg-[var(--color-primary-soft)] p-3 text-[var(--color-primary)]">
              <Sparkles size={18} aria-hidden="true" />
            </span>
            <div>
              <p className="font-semibold text-[var(--color-text)]">Protected Signals</p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Global hiring status stays generic while recruiter ATS context remains organisation-specific.</p>
            </div>
          </div>
        </Card>
      </div>

      {errorMessage ? (
        <Card>
          <h2 className="text-xl font-semibold text-[var(--color-text)]">Resume Search unavailable</h2>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{errorMessage}</p>
        </Card>
      ) : (
        <div className="grid gap-6">
          {result.meta?.warning ? (
            <Card>
              <p className="text-sm text-[var(--color-text-secondary)]">{result.meta.warning}</p>
            </Card>
          ) : null}
          <div className="grid gap-6 xl:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)_minmax(20rem,28rem)]">
          <div className="min-w-0 xl:max-h-[calc(100vh-9rem)] xl:overflow-auto xl:[resize:horizontal]">
            {filters}
          </div>
          <div className="min-w-0 xl:col-span-2">
            <RecruiterResumeSearchWorkbench
              candidates={decoratedResults}
              preview={preview}
              meta={result.meta}
              savedCandidates={saved.items || []}
              queryParams={normalizedParams}
              jobs={jobs}
              requisitions={requisitions}
              talentPools={talentPools}
            />
          </div>
        </div>
        </div>
      )}
    </WorkspaceShell>
  );
}
