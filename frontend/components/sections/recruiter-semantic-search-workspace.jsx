"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowUpDown,
  Bot,
  BriefcaseBusiness,
  Clock3,
  Database,
  Download,
  FileSearch,
  History,
  LoaderCircle,
  RefreshCcw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  UserRoundSearch,
  Users,
  WandSparkles,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import {
  buildSemanticSearchPayload,
  buildSearchPreviewSummary,
  buildSemanticSearchUrlParams,
  formatSemanticSearchConfidence,
  formatSemanticSearchDate,
  formatSemanticSearchScore,
  getResultCandidateName,
  getResultCandidateTitle,
  getSemanticSearchStatusMeta,
  hasSearchInputs,
  mapSemanticSearchError,
  parseSavedCandidateSearchList,
  parseSemanticSearchHistoryResponse,
  parseSemanticSearchResponse,
  parseSemanticSearchSuggestionsResponse,
  SEMANTIC_SEARCH_TERMINAL_STATUSES,
  semanticSearchModes,
  shouldDisplayResult,
} from '@/lib/semantic-search';
import {
  parseCandidateIntelligenceResponse,
  parseCandidateIntelligenceStatusResponse,
} from '@/lib/candidate-intelligence';
import {
  parseCandidateJobMatchResponse,
} from '@/lib/match-intelligence';

const SEARCH_PAGE_SIZE = 12;
const HISTORY_PAGE_SIZE = 8;

async function requestJson(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    cache: 'no-store',
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.success === false) {
    const error = new Error(body?.message || 'Request failed.');
    error.statusCode = response.status;
    error.code = body?.code || null;
    throw error;
  }

  return body?.data;
}

function SearchStatusBadge({ status }) {
  const meta = getSemanticSearchStatusMeta(status);
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

function SearchSection({ title, description, action = null, children }) {
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-[var(--color-text)]">{title}</h3>
          {description ? <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </Card>
  );
}

function SearchSummaryCard({ label, value, helper }) {
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-[var(--color-text)]">{value}</p>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{helper}</p>
    </Card>
  );
}

function EvidenceDialog({ state, onClose }) {
  return (
    <Dialog
      open={Boolean(state)}
      onClose={onClose}
      title={state?.title || 'Evidence'}
      description="Evidence stays recruiter-safe and never exposes raw prompts, provider payloads, or full resume blocks."
      className="max-w-3xl"
    >
      <div className="space-y-4">
        {(state?.items || []).length ? (
          state.items.map((item) => (
            <div key={item.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Badge tone="neutral">{String(item.sourceType || 'SOURCE').replaceAll('_', ' ')}</Badge>
                {item.confidence?.label ? <Badge tone="info">{item.confidence.label}</Badge> : null}
              </div>
              <p className="mt-3 text-sm font-semibold text-[var(--color-text)]">{item.fieldPath || 'Evidence reference'}</p>
              <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{item.snippet || 'Safe snippet unavailable.'}</p>
              {item.locator ? <p className="mt-2 text-xs text-[var(--color-text-muted)]">{item.locator}</p> : null}
            </div>
          ))
        ) : (
          <p className="text-sm text-[var(--color-text-secondary)]">No evidence items are available for this signal.</p>
        )}
      </div>
    </Dialog>
  );
}

function SaveSearchDialog({ open, onClose, onSave, pending, initialName }) {
  const [name, setName] = useState(initialName || '');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(initialName || '');
    setDescription('');
  }, [initialName, open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Save recruiter search"
      description="Saved searches preserve the semantic query, structured filters, and optional job context for reuse."
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSave({ name, description });
        }}
      >
        <Input
          label="Search name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
        <label className="grid gap-2">
          <span className="text-sm font-semibold text-[var(--color-text)]">Description</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            className="min-h-24 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3.5 py-2.5 text-sm text-[var(--color-text)]"
          />
        </label>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button type="submit" loading={pending}>Save search</Button>
        </div>
      </form>
    </Dialog>
  );
}

function CompareDialog({ state, onClose }) {
  const base = state?.base;
  const target = state?.target;

  return (
    <Dialog
      open={Boolean(base && target)}
      onClose={onClose}
      title="Candidate comparison"
      description="Comparison is recruiter-side only and uses persisted search and preview data already available in this workspace."
      className="max-w-5xl"
    >
      <div className="grid gap-4 md:grid-cols-2">
        {[base, target].filter(Boolean).map((candidate) => (
          <div key={candidate?.candidate?.id || candidate?.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-4">
            <h3 className="text-lg font-semibold text-[var(--color-text)]">{candidate?.preview?.fullName || getResultCandidateName(candidate)}</h3>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{candidate?.preview?.title || getResultCandidateTitle(candidate)}</p>
            <div className="mt-4 grid gap-2 text-sm text-[var(--color-text-secondary)]">
              <p>Location: {candidate?.preview?.location || candidate?.candidate?.location || 'Not provided'}</p>
              <p>Experience: {candidate?.preview?.totalExperienceLabel || `${candidate?.candidate?.totalExperience || 0} yrs`}</p>
              <p>Retrieval score: {formatSemanticSearchScore(candidate?.retrieval?.score ?? candidate?.retrievalScore ?? null)}</p>
              <p>Match score: {formatSemanticSearchScore(candidate?.match?.effectiveScore ?? candidate?.match?.generatedScore ?? candidate?.candidate?.matchScore ?? null)}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {(candidate?.preview?.skills || candidate?.candidate?.skills || []).slice(0, 12).map((skill) => (
                <Badge key={skill} tone="neutral">{skill}</Badge>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Dialog>
  );
}

function buildResultBadges(item) {
  const badges = [];
  if ((item.match?.effectiveScore ?? item.match?.generatedScore ?? 0) >= 80) badges.push({ tone: 'success', label: 'Strong Match' });
  if ((item.match?.confidence?.score ?? 0) >= 0.75) badges.push({ tone: 'info', label: 'High Confidence' });
  if (item.retrieval?.transferableTerms?.length) badges.push({ tone: 'warning', label: 'Transferable Skills' });
  if (item.candidate?.matchScore != null) badges.push({ tone: 'neutral', label: 'Applied' });
  return badges;
}

function ResultCard({
  item,
  selected,
  onPreview,
  onCompare,
  selectedJobId,
}) {
  const summary = buildSearchPreviewSummary(item);
  const badges = buildResultBadges(item);

  return (
    <Card className={selected ? 'border-[var(--color-primary)] shadow-[var(--shadow-lg)]' : ''}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <button type="button" onClick={() => onPreview(item.candidate.id)} className="min-w-0 flex-1 text-left">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-lg font-semibold text-[var(--color-text)]">{getResultCandidateName(item)}</h3>
              <p className="mt-1 truncate text-sm text-[var(--color-text-secondary)]">{getResultCandidateTitle(item)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="brand">Retrieval {formatSemanticSearchScore(summary.retrievalScore)}</Badge>
              {summary.matchScore != null ? <Badge tone="info">Match {formatSemanticSearchScore(summary.matchScore)}</Badge> : null}
            </div>
          </div>
          <div className="mt-4 grid gap-2 text-sm text-[var(--color-text-secondary)] md:grid-cols-2">
            <p>{item.candidate.location || 'Location not provided'}</p>
            <p>{item.candidate.totalExperience != null ? `${item.candidate.totalExperience} yrs experience` : 'Experience not provided'}</p>
            <p>{item.candidate.currentCompany || 'Current employer not provided'}</p>
            <p>{summary.confidence != null ? `Confidence ${formatSemanticSearchConfidence(summary.confidence)}` : 'Confidence unavailable'}</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {(item.retrieval?.matchedTerms || []).slice(0, 6).map((term, index) => (
              <Badge key={`${term.term}-${index}`} tone="neutral">{term.term}</Badge>
            ))}
          </div>
          {badges.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {badges.map((badge) => <Badge key={badge.label} tone={badge.tone}>{badge.label}</Badge>)}
            </div>
          ) : null}
          {item.retrieval?.reasons?.length ? (
            <p className="mt-4 text-sm leading-6 text-[var(--color-text-secondary)]">{item.retrieval.reasons[0]}</p>
          ) : null}
        </button>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onPreview(item.candidate.id)}>Preview</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onCompare(item)}>Compare</Button>
          <Button as={Link} href={`/recruiter/database/${item.candidate.id}${selectedJobId ? `?jobId=${selectedJobId}&tab=ai-match` : ''}`} variant="outline" size="sm">
            Open Profile
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function RecruiterSemanticSearchWorkspace({
  initialState,
  organisationName,
  jobs = [],
  featureEnabled,
  canRead,
  canExecute,
  canReadHistory,
  canReadSavedSearches,
  canManageSavedSearches,
  canReadCandidateIntelligence,
  canReadCandidateMatch,
  candidateIntelligenceEnabled,
  candidateMatchingEnabled,
  searchSuggestionsEnabled,
  savedSearchesEnabled,
  searchHistoryEnabled,
  similarCandidateSearchEnabled,
  similarJobSearchEnabled,
}) {
  const router = useRouter();
  const { push } = useToast();
  const loadMoreRef = useRef(null);
  const pollTimerRef = useRef(null);

  const [formState, setFormState] = useState(initialState);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [savePending, setSavePending] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState('');
  const [savedSearches, setSavedSearches] = useState([]);
  const [history, setHistory] = useState({ items: [], meta: { total: 0, page: 1, pageSize: HISTORY_PAGE_SIZE, pageCount: 1 } });
  const [suggestions, setSuggestions] = useState([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);
  const [preview, setPreview] = useState(null);
  const [candidateInsights, setCandidateInsights] = useState(null);
  const [candidateInsightsStatus, setCandidateInsightsStatus] = useState(null);
  const [matchDetails, setMatchDetails] = useState(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [evidenceState, setEvidenceState] = useState(null);
  const [compareState, setCompareState] = useState(null);
  const [lastPayload, setLastPayload] = useState(null);

  const selectedJobId = formState.jobId || '';
  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) || null,
    [jobs, selectedJobId],
  );
  const visibleItems = useMemo(
    () => (result?.items || []).filter((item) => shouldDisplayResult(item, formState)),
    [formState, result?.items],
  );
  const selectedItem = useMemo(
    () => visibleItems.find((item) => item.candidate.id === selectedCandidateId) || result?.items?.find((item) => item.candidate.id === selectedCandidateId) || null,
    [result?.items, selectedCandidateId, visibleItems],
  );
  const totalCount = result?.meta?.total || visibleItems.length;
  const totalPages = result?.meta?.pageCount || 1;
  const currentPage = result?.meta?.page || 1;
  const hasMore = currentPage < totalPages;

  function updateQueryString(nextState) {
    const params = buildSemanticSearchUrlParams(nextState);
    const search = params.toString();
    router.replace(search ? `/recruiter/database?${search}` : '/recruiter/database', { scroll: false });
  }

  async function loadSavedSearches() {
    if (!savedSearchesEnabled || !canReadSavedSearches) return;
    const payload = await requestJson('/api/intelligence/saved-searches');
    setSavedSearches(parseSavedCandidateSearchList(payload));
  }

  async function loadHistory() {
    if (!searchHistoryEnabled || !canReadHistory) return;
    const payload = await requestJson(`/api/intelligence/search/history?page=1&pageSize=${HISTORY_PAGE_SIZE}`);
    setHistory(parseSemanticSearchHistoryResponse(payload));
  }

  async function loadSuggestions(queryOverride = '') {
    if (!searchSuggestionsEnabled || !canRead) return;
    setSuggestionsLoading(true);
    try {
      const payload = await requestJson('/api/intelligence/search/suggestions', {
        method: 'POST',
        body: JSON.stringify({
          query: queryOverride || formState.query,
          jobId: formState.jobId || undefined,
          limit: 8,
        }),
      });
      setSuggestions(parseSemanticSearchSuggestionsResponse(payload).suggestions);
    } catch (caught) {
      setSuggestions([]);
      setError(mapSemanticSearchError(caught));
    } finally {
      setSuggestionsLoading(false);
    }
  }

  async function runSearch({ append = false, payloadOverride = null, endpoint = '/api/intelligence/search', nextPage = 1 } = {}) {
    const payload = payloadOverride || buildSemanticSearchPayload(formState, nextPage, SEARCH_PAGE_SIZE);
    if (!hasSearchInputs({ ...formState, query: payload.query, jobId: payload.jobId })) {
      setResult(null);
      setSelectedCandidateId(null);
      setPreview(null);
      setError('');
      return;
    }

    setError('');
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await requestJson(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const parsed = parseSemanticSearchResponse(response);
      setLastPayload(payload);
      setResult((current) => {
        if (!append || !current) return parsed;
        return {
          ...parsed,
          items: [...current.items, ...parsed.items],
        };
      });
      const nextSelectedId = append
        ? selectedCandidateId || parsed.items[0]?.candidate?.id || null
        : (parsed.items[0]?.candidate?.id || null);
      setSelectedCandidateId(nextSelectedId);
      if (!append) {
        updateQueryString(formState);
      }
      if (parsed.execution?.queryId && !SEMANTIC_SEARCH_TERMINAL_STATUSES.has(parsed.execution.status)) {
        startPolling(parsed.execution.queryId);
      }
    } catch (caught) {
      setError(mapSemanticSearchError(caught));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  async function runSavedSearch(savedSearch) {
    try {
      setLoading(true);
      const response = await requestJson(`/api/intelligence/saved-searches/${savedSearch.id}/execute`, {
        method: 'POST',
      });
      const parsed = parseSemanticSearchResponse(response);
      setResult(parsed);
      setSelectedCandidateId(parsed.items[0]?.candidate?.id || null);
      setFormState((current) => ({
        ...current,
        query: savedSearch.rawQuery || '',
        mode: savedSearch.searchMode || current.mode,
        jobId: savedSearch.jobContextId || '',
        currentEmployer: savedSearch.filtersJson?.currentEmployer || '',
        previousEmployer: savedSearch.filtersJson?.previousEmployer || '',
        location: savedSearch.filtersJson?.location || '',
        workMode: savedSearch.filtersJson?.workMode || '',
        employmentType: savedSearch.filtersJson?.employmentType || '',
        education: savedSearch.filtersJson?.education || '',
        requiredSkills: (savedSearch.filtersJson?.requiredSkills || []).join(', '),
        optionalSkills: (savedSearch.filtersJson?.optionalSkills || []).join(', '),
        minExperience: savedSearch.filtersJson?.minExperience ?? '',
        maxExperience: savedSearch.filtersJson?.maxExperience ?? '',
        salaryMin: savedSearch.filtersJson?.salaryMin ?? '',
        salaryMax: savedSearch.filtersJson?.salaryMax ?? '',
        noticePeriodDaysMax: savedSearch.filtersJson?.noticePeriodDaysMax ?? '',
      }));
      push({ tone: 'success', title: 'Saved search loaded', description: savedSearch.name });
    } catch (caught) {
      const message = mapSemanticSearchError(caught);
      setError(message);
      push({ tone: 'error', title: 'Unable to run saved search', description: message });
    } finally {
      setLoading(false);
    }
  }

  function startPolling(queryId) {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);

    async function poll() {
      if (document.hidden) {
        pollTimerRef.current = setTimeout(poll, 5000);
        return;
      }

      try {
        const detail = await requestJson(`/api/intelligence/search/history/${queryId}`);
        const latestExecution = detail?.executions?.[0];
        if (!latestExecution) return;
        setResult((current) => {
          if (!current) return current;
          return {
            ...current,
            execution: {
              ...current.execution,
              status: latestExecution.status,
              executionId: latestExecution.id,
              queryId: latestExecution.queryId,
              generatedAt: latestExecution.completedAt || latestExecution.createdAt,
              completedAt: latestExecution.completedAt || null,
              executionTimeMs: latestExecution.executionTimeMs || current.execution?.executionTimeMs || 0,
              resultCount: latestExecution.resultCount ?? current.execution?.resultCount ?? 0,
              warningCount: latestExecution.warningCount ?? current.execution?.warningCount ?? 0,
            },
          };
        });
        if (!SEMANTIC_SEARCH_TERMINAL_STATUSES.has(latestExecution.status)) {
          pollTimerRef.current = setTimeout(poll, 4000);
        }
      } catch {
        pollTimerRef.current = null;
      }
    }

    pollTimerRef.current = setTimeout(poll, 4000);
  }

  useEffect(() => {
    loadSavedSearches().catch(() => {});
    loadHistory().catch(() => {});
    if (hasSearchInputs(initialState)) {
      runSearch({ payloadOverride: buildSemanticSearchPayload(initialState, 1, SEARCH_PAGE_SIZE) }).catch(() => {});
    }
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedCandidateId) {
      setPreview(null);
      setCandidateInsights(null);
      setCandidateInsightsStatus(null);
      setMatchDetails(null);
      return;
    }

    let cancelled = false;
    setPreviewLoading(true);

    Promise.all([
      requestJson(`/api/recruiter/candidates/${selectedCandidateId}/preview`).catch(() => null),
      candidateIntelligenceEnabled && canReadCandidateIntelligence
        ? requestJson(`/api/intelligence/candidates/${selectedCandidateId}`).catch(() => null)
        : Promise.resolve(null),
      candidateIntelligenceEnabled && canReadCandidateIntelligence
        ? requestJson(`/api/intelligence/candidates/${selectedCandidateId}/status`).catch(() => null)
        : Promise.resolve(null),
      selectedJobId && candidateMatchingEnabled && canReadCandidateMatch
        ? requestJson(`/api/intelligence/jobs/${selectedJobId}/candidates/${selectedCandidateId}/match`).catch(() => null)
        : Promise.resolve(null),
    ])
      .then(([previewPayload, insightsPayload, insightsStatusPayload, matchPayload]) => {
        if (cancelled) return;
        setPreview(previewPayload?.id ? previewPayload : previewPayload?.candidate ? previewPayload.candidate : previewPayload);
        setCandidateInsights(insightsPayload ? parseCandidateIntelligenceResponse(insightsPayload) : null);
        setCandidateInsightsStatus(insightsStatusPayload ? parseCandidateIntelligenceStatusResponse(insightsStatusPayload) : null);
        setMatchDetails(matchPayload ? parseCandidateJobMatchResponse(matchPayload) : null);
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    canReadCandidateIntelligence,
    canReadCandidateMatch,
    candidateIntelligenceEnabled,
    candidateMatchingEnabled,
    selectedCandidateId,
    selectedJobId,
  ]);

  useEffect(() => {
    if (!loadMoreRef.current || !hasMore || loadingMore || loading) return undefined;

    const observer = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting || loadingMore || loading || !hasMore || !lastPayload) return;
      runSearch({
        append: true,
        payloadOverride: buildSemanticSearchPayload(formState, currentPage + 1, SEARCH_PAGE_SIZE),
        nextPage: currentPage + 1,
      }).catch(() => {});
    }, { rootMargin: '200px 0px' });

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [currentPage, formState, hasMore, lastPayload, loading, loadingMore]);

  const previewMatchSummary = matchDetails
    ? {
        score: matchDetails.effective?.overallScore ?? matchDetails.overallScore?.score ?? null,
        recommendation: matchDetails.effective?.recommendation ?? matchDetails.recommendation?.label ?? null,
        confidence: matchDetails.confidence?.score ?? null,
      }
    : selectedItem
      ? buildSearchPreviewSummary(selectedItem)
      : null;

  const insightSummary = candidateInsights?.summary?.professionalSummary?.text
    || candidateInsights?.snapshot?.professionalHeadline?.value
    || preview?.aiSummary
    || 'Candidate summary is not available yet.';

  const previewBadges = buildResultBadges(selectedItem || {});

  async function handleSaveSearch({ name, description }) {
    const payload = buildSemanticSearchPayload(formState, 1, SEARCH_PAGE_SIZE);
    setSavePending(true);
    try {
      await requestJson('/api/intelligence/saved-searches', {
        method: 'POST',
        body: JSON.stringify({
          name,
          description,
          rawQuery: payload.query,
          searchMode: payload.mode,
          filtersJson: payload.filters || {},
          jobContextId: payload.jobId || undefined,
          isShared: false,
        }),
      });
      setSaveDialogOpen(false);
      await loadSavedSearches();
      push({ tone: 'success', title: 'Search saved', description: `${name} is now available in saved searches.` });
    } catch (caught) {
      const message = mapSemanticSearchError(caught);
      setError(message);
      push({ tone: 'error', title: 'Unable to save search', description: message });
    } finally {
      setSavePending(false);
    }
  }

  async function handleSimilarCandidateSearch() {
    if (!selectedCandidateId) return;
    try {
      setLoading(true);
      const response = await requestJson('/api/intelligence/search/similar-candidate', {
        method: 'POST',
        body: JSON.stringify({
          sourceCandidateId: selectedCandidateId,
          jobId: selectedJobId || undefined,
          includeMatch: Boolean(selectedJobId),
          page: 1,
          pageSize: SEARCH_PAGE_SIZE,
        }),
      });
      const parsed = parseSemanticSearchResponse(response);
      setFormState((current) => ({
        ...current,
        query: '',
        mode: 'HYBRID',
      }));
      setResult(parsed);
      setSelectedCandidateId(parsed.items[0]?.candidate?.id || null);
      push({ tone: 'success', title: 'Similar candidate search ready', description: 'Results were refreshed from the selected candidate profile.' });
    } catch (caught) {
      const message = mapSemanticSearchError(caught);
      setError(message);
      push({ tone: 'error', title: 'Unable to search similar candidates', description: message });
    } finally {
      setLoading(false);
    }
  }

  async function handleSimilarJobSearch() {
    if (!selectedJobId) return;
    try {
      setLoading(true);
      const response = await requestJson('/api/intelligence/search/similar-job', {
        method: 'POST',
        body: JSON.stringify({
          sourceJobId: selectedJobId,
          jobId: selectedJobId,
          includeMatch: true,
          page: 1,
          pageSize: SEARCH_PAGE_SIZE,
        }),
      });
      const parsed = parseSemanticSearchResponse(response);
      setResult(parsed);
      setSelectedCandidateId(parsed.items[0]?.candidate?.id || null);
      push({ tone: 'success', title: 'Similar job search ready', description: 'Results were refreshed from the selected job context.' });
    } catch (caught) {
      const message = mapSemanticSearchError(caught);
      setError(message);
      push({ tone: 'error', title: 'Unable to search similar jobs', description: message });
    } finally {
      setLoading(false);
    }
  }

  if (!featureEnabled) {
    return (
      <Card>
        <EmptyState
          icon={ShieldCheck}
          title="Resume Search is disabled"
          description="The semantic resume search workspace is hidden in this environment because the feature flag is turned off."
        />
      </Card>
    );
  }

  if (!canRead) {
    return (
      <Card>
        <EmptyState
          icon={ShieldCheck}
          title="You do not have access to Resume Search"
          description="A recruiter with semantic search permissions can search, preview, and reuse saved candidate discovery workflows here."
        />
      </Card>
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <SearchSummaryCard label="Organisation" value={organisationName || 'Careeriz'} helper="Recruiter semantic search runs with organisation isolation and same-origin API proxies." />
        <SearchSummaryCard label="Results" value={totalCount} helper="Retrieval score remains separate from optional AI match enrichment." />
        <SearchSummaryCard label="Saved Searches" value={savedSearches.length} helper="Reusable recruiter searches stay private unless explicitly shared." />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)_minmax(20rem,28rem)]">
        <div className="min-w-0 space-y-4 xl:max-h-[calc(100vh-10rem)] xl:overflow-auto xl:[resize:horizontal]">
          <SearchSection
            title="AI Search"
            description="Use natural language, boolean, keyword, or hybrid retrieval with structured recruiter filters."
            action={searchSuggestionsEnabled ? (
              <Button type="button" variant="outline" size="sm" onClick={() => loadSuggestions()}>
                <WandSparkles size={15} aria-hidden="true" />
                Suggestions
              </Button>
            ) : null}
          >
            <div className="space-y-4">
              <Input
                label="Search query"
                value={formState.query}
                onChange={(event) => setFormState((current) => ({ ...current, query: event.target.value }))}
                placeholder='Example: Senior Java backend engineer in Bengaluru with Spring Boot and AWS'
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-[var(--color-text)]">Search mode</span>
                  <select
                    value={formState.mode}
                    onChange={(event) => setFormState((current) => ({ ...current, mode: event.target.value }))}
                    className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-text)]"
                  >
                    {semanticSearchModes.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
                  </select>
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-[var(--color-text)]">Job context</span>
                  <select
                    value={formState.jobId}
                    onChange={(event) => setFormState((current) => ({
                      ...current,
                      jobId: event.target.value,
                      includeMatch: Boolean(event.target.value) || current.includeMatch,
                    }))}
                    className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-text)]"
                  >
                    <option value="">No linked job</option>
                    {jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
                  </select>
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Minimum experience" type="number" value={formState.minExperience} onChange={(event) => setFormState((current) => ({ ...current, minExperience: event.target.value }))} />
                <Input label="Maximum experience" type="number" value={formState.maxExperience} onChange={(event) => setFormState((current) => ({ ...current, maxExperience: event.target.value }))} />
                <Input label="Location" value={formState.location} onChange={(event) => setFormState((current) => ({ ...current, location: event.target.value }))} />
                <Input label="Work mode" value={formState.workMode} onChange={(event) => setFormState((current) => ({ ...current, workMode: event.target.value }))} />
                <Input label="Employment type" value={formState.employmentType} onChange={(event) => setFormState((current) => ({ ...current, employmentType: event.target.value }))} />
                <Input label="Education" value={formState.education} onChange={(event) => setFormState((current) => ({ ...current, education: event.target.value }))} />
                <Input label="Current employer" value={formState.currentEmployer} onChange={(event) => setFormState((current) => ({ ...current, currentEmployer: event.target.value }))} />
                <Input label="Previous employer" value={formState.previousEmployer} onChange={(event) => setFormState((current) => ({ ...current, previousEmployer: event.target.value }))} />
                <Input label="Required skills" value={formState.requiredSkills} onChange={(event) => setFormState((current) => ({ ...current, requiredSkills: event.target.value }))} placeholder="Java, Spring Boot, AWS" />
                <Input label="Optional skills" value={formState.optionalSkills} onChange={(event) => setFormState((current) => ({ ...current, optionalSkills: event.target.value }))} placeholder="Kafka, Redis" />
                <Input label="Minimum salary" type="number" value={formState.salaryMin} onChange={(event) => setFormState((current) => ({ ...current, salaryMin: event.target.value }))} />
                <Input label="Maximum salary" type="number" value={formState.salaryMax} onChange={(event) => setFormState((current) => ({ ...current, salaryMax: event.target.value }))} />
                <Input label="Notice period days" type="number" value={formState.noticePeriodDaysMax} onChange={(event) => setFormState((current) => ({ ...current, noticePeriodDaysMax: event.target.value }))} />
                <Input label="Candidate name filter" value={formState.candidateName} onChange={(event) => setFormState((current) => ({ ...current, candidateName: event.target.value }))} />
              </div>
              <div className="grid gap-3 text-sm text-[var(--color-text-secondary)]">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={formState.expansionEnabled} onChange={(event) => setFormState((current) => ({ ...current, expansionEnabled: event.target.checked }))} />
                  Expansion enabled
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={formState.transferableSkillsEnabled} onChange={(event) => setFormState((current) => ({ ...current, transferableSkillsEnabled: event.target.checked }))} />
                  Transferable skills enabled
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={formState.includeMatch} onChange={(event) => setFormState((current) => ({ ...current, includeMatch: event.target.checked }))} />
                  Match only
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={formState.highConfidenceOnly} onChange={(event) => setFormState((current) => ({ ...current, highConfidenceOnly: event.target.checked }))} />
                  High confidence only
                </label>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  type="button"
                  className="flex-1"
                  disabled={!canExecute || loading}
                  loading={loading}
                  onClick={() => runSearch({ payloadOverride: buildSemanticSearchPayload(formState, 1, SEARCH_PAGE_SIZE) })}
                >
                  <Search size={16} aria-hidden="true" />
                  Search
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    const cleared = {
                      ...initialState,
                      query: '',
                      jobId: '',
                      candidateName: '',
                    };
                    setFormState(cleared);
                    setResult(null);
                    setPreview(null);
                    setSelectedCandidateId(null);
                    setError('');
                    updateQueryString(cleared);
                  }}
                >
                  <X size={16} aria-hidden="true" />
                  Clear
                </Button>
              </div>
            </div>
          </SearchSection>

          {searchSuggestionsEnabled ? (
            <SearchSection
              title="Suggestions"
              description="Deterministic query suggestions from your current input, saved searches, and search context."
              action={suggestionsLoading ? <Badge tone="info">Loading</Badge> : null}
            >
              {suggestions.length ? (
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((item) => (
                    <button
                      key={`${item.source}-${item.text}`}
                      type="button"
                      onClick={() => setFormState((current) => ({ ...current, query: item.text }))}
                      className="rounded-full border border-[var(--color-border)] px-3 py-1.5 text-left text-xs font-semibold text-[var(--color-text-secondary)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                    >
                      {item.text}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--color-text-secondary)]">Use the Suggestions button to fetch bounded query suggestions for the current recruiter context.</p>
              )}
            </SearchSection>
          ) : null}

          {savedSearchesEnabled && canReadSavedSearches ? (
            <SearchSection
              title="Saved Searches"
              description="Reusable recruiter search presets stored on the backend."
              action={canManageSavedSearches ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!hasSearchInputs(formState)}
                  onClick={() => setSaveDialogOpen(true)}
                >
                  <Save size={15} aria-hidden="true" />
                  Save current
                </Button>
              ) : null}
            >
              {savedSearches.length ? (
                <div className="space-y-3">
                  {savedSearches.map((item) => (
                    <div key={item.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-[var(--color-text)]">{item.name}</p>
                          {item.description ? <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{item.description}</p> : null}
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={() => runSavedSearch(item)}>
                          Run
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--color-text-secondary)]">Saved searches will appear here after you store the current query and filter set.</p>
              )}
            </SearchSection>
          ) : null}

          {searchHistoryEnabled && canReadHistory ? (
            <SearchSection
              title="Recent Searches"
              description="Your most recent semantic search executions for this organisation."
            >
              {history.items.length ? (
                <div className="space-y-3">
                  {history.items.map((item) => (
                    <div key={item.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-[var(--color-text)]">{item.rawQuery || item.normalizedQuery || item.searchMode}</p>
                          <p className="mt-1 text-xs text-[var(--color-text-muted)]">{formatSemanticSearchDate(item.createdAt)}</p>
                        </div>
                        <SearchStatusBadge status={item.latestExecution?.status || 'READY'} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--color-text-secondary)]">Your search history will appear here after the first semantic search execution.</p>
              )}
            </SearchSection>
          ) : null}
        </div>

        <div className="min-w-0 space-y-4">
          <SearchSection
            title="Candidate results"
            description="Semantic retrieval stays separate from optional AI match enrichment."
            action={result?.execution?.status ? <SearchStatusBadge status={result.execution.status} /> : null}
          >
            <div className="grid gap-4 md:grid-cols-3">
              <SearchSummaryCard label="Visible" value={visibleItems.length} helper="Candidate cards currently shown in this result view." />
              <SearchSummaryCard label="Mode" value={result?.meta?.searchMode || formState.mode} helper="The backend-selected retrieval mode for the last execution." />
              <SearchSummaryCard label="Job Context" value={selectedJob ? 'Linked' : 'None'} helper={selectedJob ? selectedJob.title : 'Optional AI match enrichment is available when a job is linked.'} />
            </div>
            {error ? (
              <div className="mt-4 rounded-[var(--radius-lg)] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                {error}
              </div>
            ) : null}
            {result?.warnings?.length ? (
              <div className="mt-4 space-y-2">
                {result.warnings.map((warning, index) => (
                  <div key={`${warning}-${index}`} className="rounded-[var(--radius-lg)] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    {warning}
                  </div>
                ))}
              </div>
            ) : null}
          </SearchSection>

          {loading && !result ? (
            <Card>
              <div className="flex items-center gap-3 text-sm text-[var(--color-text-secondary)]">
                <LoaderCircle className="animate-spin" size={18} aria-hidden="true" />
                Running semantic search…
              </div>
            </Card>
          ) : null}

          {!loading && !result ? (
            <Card>
              <EmptyState
                icon={Database}
                title="Start a recruiter search"
                description="Enter a natural-language, boolean, keyword, or hybrid query to retrieve candidates. Add a job context when you want optional AI match enrichment alongside retrieval."
              />
            </Card>
          ) : null}

          {result && !visibleItems.length ? (
            <Card>
              <EmptyState
                icon={FileSearch}
                title="No matching candidates in this view"
                description="Adjust the search query, filters, or high-confidence filter to broaden the candidate set."
              />
            </Card>
          ) : null}

          {visibleItems.length ? (
            <div className="space-y-4">
              {visibleItems.map((item) => (
                <ResultCard
                  key={`${item.candidate.id}-${item.metadata?.executionId || 'current'}`}
                  item={item}
                  selected={item.candidate.id === selectedCandidateId}
                  onPreview={setSelectedCandidateId}
                  onCompare={(target) => {
                    if (!selectedItem || selectedItem.candidate.id === target.candidate.id) return;
                    setCompareState({ base: { ...selectedItem, preview }, target });
                  }}
                  selectedJobId={selectedJobId}
                />
              ))}
              <div ref={loadMoreRef} className="flex justify-center py-2">
                {loadingMore ? (
                  <Badge tone="info">Loading more results</Badge>
                ) : hasMore ? (
                  <Button type="button" variant="outline" onClick={() => runSearch({
                    append: true,
                    payloadOverride: buildSemanticSearchPayload(formState, currentPage + 1, SEARCH_PAGE_SIZE),
                    nextPage: currentPage + 1,
                  })}>
                    <ArrowUpDown size={15} aria-hidden="true" />
                    Load more results
                  </Button>
                ) : (
                  <p className="text-xs text-[var(--color-text-muted)]">End of current search results.</p>
                )}
              </div>
            </div>
          ) : null}
        </div>

        <div className="min-w-0 space-y-4 xl:max-h-[calc(100vh-10rem)] xl:overflow-auto xl:[resize:horizontal]">
          <SearchSection
            title="Live candidate preview"
            description="Preview updates for the selected result without leaving recruiter search."
            action={previewLoading ? <Badge tone="info">Loading</Badge> : null}
          >
            {!selectedCandidateId ? (
              <EmptyState
                icon={Users}
                title="No candidate selected"
                description="Select a result card to inspect candidate details, resume access, candidate intelligence, and optional AI match context."
              />
            ) : (
              <div className="space-y-5">
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-2xl font-semibold text-[var(--color-text)]">{preview?.fullName || getResultCandidateName(selectedItem)}</h3>
                      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{preview?.title || getResultCandidateTitle(selectedItem)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {previewBadges.map((badge) => <Badge key={badge.label} tone={badge.tone}>{badge.label}</Badge>)}
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 text-sm text-[var(--color-text-secondary)]">
                    <p>{preview?.location || selectedItem?.candidate?.location || 'Location not provided'}</p>
                    <p>{preview?.totalExperienceLabel || `${selectedItem?.candidate?.totalExperience || 0} yrs experience`}</p>
                    <p>{preview?.currentCompany || selectedItem?.candidate?.currentCompany || 'Current employer not provided'}</p>
                  </div>
                </div>

                <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-muted)] px-4 py-4">
                  <div className="flex items-center gap-2">
                    <Bot size={16} aria-hidden="true" className="text-[var(--color-primary)]" />
                    <p className="text-sm font-semibold text-[var(--color-text)]">Candidate Summary</p>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-[var(--color-text-secondary)]">{insightSummary}</p>
                </div>

                <div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[var(--color-text)]">Resume Preview</p>
                    {preview?.resumeUrl ? (
                      <Button as="a" href={preview.resumeUrl} variant="outline" size="sm">
                        <Download size={15} aria-hidden="true" />
                        Download
                      </Button>
                    ) : null}
                  </div>
                  {preview?.resumeUrl && /\.pdf($|\?)/i.test(preview.resumeUrl) ? (
                    <iframe title="Resume preview" src={preview.resumeUrl} className="mt-3 h-72 w-full rounded-[var(--radius-lg)] border border-[var(--color-border)]" />
                  ) : (
                    <div className="mt-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-4 text-sm text-[var(--color-text-secondary)]">
                      {preview?.resumeUrl ? 'Preview is download-only for this resume format.' : 'No resume preview is available for this candidate.'}
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} aria-hidden="true" className="text-[var(--color-primary)]" />
                    <p className="text-sm font-semibold text-[var(--color-text)]">Candidate Intelligence</p>
                    {candidateInsightsStatus?.status ? <SearchStatusBadge status={candidateInsightsStatus.status} /> : null}
                  </div>
                  {candidateInsights ? (
                    <div className="mt-3 space-y-3">
                      {(candidateInsights.strengths || []).slice(0, 3).map((item, index) => (
                        <div key={`${item.text}-${index}`} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-3">
                          <p className="text-sm font-medium text-[var(--color-text)]">{item.text}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-[var(--color-text-secondary)]">Candidate intelligence is not available for this preview.</p>
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <BriefcaseBusiness size={16} aria-hidden="true" className="text-[var(--color-primary)]" />
                    <p className="text-sm font-semibold text-[var(--color-text)]">AI Match Summary</p>
                  </div>
                  {previewMatchSummary?.score != null ? (
                    <div className="mt-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-3xl font-semibold text-[var(--color-text)]">{formatSemanticSearchScore(previewMatchSummary.score)}</p>
                        <div className="flex flex-wrap gap-2">
                          {previewMatchSummary.recommendation ? <Badge tone="info">{String(previewMatchSummary.recommendation).replaceAll('_', ' ')}</Badge> : null}
                          {previewMatchSummary.confidence != null ? <Badge tone="neutral">{formatSemanticSearchConfidence(previewMatchSummary.confidence)}</Badge> : null}
                        </div>
                      </div>
                      {matchDetails?.recruiterSummary?.text ? (
                        <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">{matchDetails.recruiterSummary.text}</p>
                      ) : selectedItem?.retrieval?.reasons?.[0] ? (
                        <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">{selectedItem.retrieval.reasons[0]}</p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-[var(--color-text-secondary)]">Match enrichment is not available for this result. Link a job and enable Match Only to include it in future searches.</p>
                  )}
                </div>

                {matchDetails?.strengths?.length ? (
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-text)]">Strengths</p>
                    <div className="mt-3 space-y-3">
                      {matchDetails.strengths.slice(0, 3).map((item, index) => (
                        <div key={`${item.text}-${index}`} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-3">
                          <p className="text-sm font-medium text-[var(--color-text)]">{item.text}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-3">
                            {item.confidence?.label ? <Badge tone="info">{item.confidence.label}</Badge> : null}
                            <Button type="button" variant="link" size="sm" className="min-h-0" onClick={() => setEvidenceState({ title: item.text, items: item.evidence || [] })}>
                              View evidence
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {matchDetails?.risks?.length ? (
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-text)]">Risks</p>
                    <div className="mt-3 space-y-3">
                      {matchDetails.risks.slice(0, 3).map((item, index) => (
                        <div key={`${item.text}-${index}`} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-3">
                          <p className="text-sm font-medium text-[var(--color-text)]">{item.text}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-3">
                            {item.confidence?.label ? <Badge tone="warning">{item.confidence.label}</Badge> : null}
                            <Button type="button" variant="link" size="sm" className="min-h-0" onClick={() => setEvidenceState({ title: item.text, items: item.evidence || [] })}>
                              View evidence
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {matchDetails?.skills ? (
                  <div className="grid gap-4">
                    <div>
                      <p className="text-sm font-semibold text-[var(--color-text)]">Missing Skills</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {[...(matchDetails.skills.missingRequired || []), ...(matchDetails.skills.missingPreferred || [])].slice(0, 8).map((item, index) => (
                          <Badge key={`${item.skill}-${index}`} tone="warning">{item.skill}</Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[var(--color-text)]">Transferable Skills</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(matchDetails.skills.transferable || []).slice(0, 8).map((item, index) => (
                          <Badge key={`${item.skill}-${index}`} tone="neutral">{item.skill}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}

                <div>
                  <p className="text-sm font-semibold text-[var(--color-text)]">Quick Actions</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button as={Link} href={`/recruiter/database/${selectedCandidateId}${selectedJobId ? `?jobId=${selectedJobId}&tab=ai-match` : ''}`} variant="outline" size="sm">
                      Open profile
                    </Button>
                    {similarCandidateSearchEnabled ? (
                      <Button type="button" variant="outline" size="sm" onClick={handleSimilarCandidateSearch}>
                        <UserRoundSearch size={15} aria-hidden="true" />
                        Similar Candidate
                      </Button>
                    ) : null}
                    {similarJobSearchEnabled && selectedJobId ? (
                      <Button type="button" variant="outline" size="sm" onClick={handleSimilarJobSearch}>
                        <BriefcaseBusiness size={15} aria-hidden="true" />
                        Similar Job
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            )}
          </SearchSection>
        </div>
      </div>

      <SaveSearchDialog
        open={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        onSave={handleSaveSearch}
        pending={savePending}
        initialName={formState.query ? `${formState.query.slice(0, 40)}${formState.query.length > 40 ? '…' : ''}` : 'Recruiter search'}
      />
      <EvidenceDialog state={evidenceState} onClose={() => setEvidenceState(null)} />
      <CompareDialog state={compareState} onClose={() => setCompareState(null)} />
    </>
  );
}
