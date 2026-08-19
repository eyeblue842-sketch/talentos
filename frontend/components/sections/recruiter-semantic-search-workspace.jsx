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
  applyHistoryToState,
  applySavedSearchToState,
  buildAiInterpretedState,
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
} from '@/lib/semantic-search';
import {
  parseCandidateIntelligenceResponse,
  parseCandidateIntelligenceStatusResponse,
} from '@/lib/candidate-intelligence';
import {
  parseCandidateJobMatchResponse,
} from '@/lib/match-intelligence';
import { deriveCtcEditorValue, normalizeCtcToLpa } from '@/lib/ctc';
import { filterIndiaLocations } from '@/lib/india-locations';
import { filterCountries, normalizeCountry } from '@/lib/country-master';
import { CandidateAvatar } from '@/components/ui/candidate-avatar';

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

function FilterAccordion({ title, summary, defaultOpen = false, children }) {
  return (
    <details open={defaultOpen} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 marker:content-none">
        <div>
          <p className="text-sm font-semibold text-[var(--color-text)]">{title}</p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">{summary || 'Any'}</p>
        </div>
      </summary>
      <div className="border-t border-[var(--color-border)] px-4 py-4">{children}</div>
    </details>
  );
}

function buildFilterSummary(values = []) {
  const filtered = values.filter(Boolean);
  return filtered.length ? filtered.join(' | ') : 'Any';
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

  // Adjusting state during render (not in an effect) when the dialog
  // opens, so the form starts fresh in the same commit. See:
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setName(initialName || '');
      setDescription('');
    }
  }

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

function highlightText(value, terms = []) {
  const text = String(value || '');
  const needles = [...new Set(terms.map((term) => String(term || '').trim()).filter(Boolean))]
    .sort((left, right) => right.length - left.length);
  if (!text || !needles.length) return text || 'Not added';
  const pattern = new RegExp(`(${needles.map((term) => term.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')).join('|')})`, 'ig');
  return text.split(pattern).map((part, index) => (
    needles.some((needle) => needle.toLowerCase() === part.toLowerCase())
      ? <mark key={`${part}-${index}`} className="rounded bg-[var(--color-primary-soft)] px-0.5 text-[var(--color-primary)]">{part}</mark>
      : <span key={`${part}-${index}`}>{part}</span>
  ));
}

function ResultCard({
  item,
  onCompare,
  onSave,
  onAddToAts,
  selectedJobId,
  selected,
  onToggleSelect,
  returnTo,
}) {
  const summary = buildSearchPreviewSummary(item);
  const badges = buildResultBadges(item);
  const candidate = item.candidate || {};
  const matchedTerms = (item.retrieval?.matchedTerms || []).map((term) => term.term);
  const currentRole = [candidate.currentDesignation, candidate.currentCompany].filter(Boolean).join(' at ');
  const previousRole = [candidate.previousDesignation, candidate.previousCompany].filter(Boolean).join(' at ');
  const salary = candidate.salaryVisible && (candidate.currentSalary != null || candidate.expectedSalary != null)
    ? `INR ${candidate.currentSalary ?? 'NA'}-${candidate.expectedSalary ?? 'NA'} LPA`
    : 'Salary not disclosed';
  const profileParams = new URLSearchParams();
  if (selectedJobId) {
    profileParams.set('jobId', selectedJobId);
    profileParams.set('tab', 'ai-match');
  }
  if (returnTo) profileParams.set('returnTo', returnTo);
  const profileHref = `/recruiter/database/${candidate.id}${profileParams.toString() ? `?${profileParams.toString()}` : ''}`;

  return (
    <Card className="border-[var(--color-border)] p-4">
      <div className="flex flex-wrap items-start gap-4">
        <input type="checkbox" checked={selected} onChange={() => onToggleSelect(candidate.id)} aria-label={`Select ${getResultCandidateName(item)}`} className="mt-1 h-4 w-4 accent-[var(--color-primary)]" />
        <CandidateAvatar src={candidate.profileImageUrl} name={getResultCandidateName(item)} sizeClassName="h-14 w-14" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-[var(--color-text)]">
                <Link className="hover:text-[var(--color-primary)]" href={profileHref}>
                  {highlightText(getResultCandidateName(item), matchedTerms)}
                </Link>
              </h3>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{highlightText(getResultCandidateTitle(item), matchedTerms)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {summary.retrievalScore != null ? <Badge tone="brand">Relevance {formatSemanticSearchScore(summary.retrievalScore)}</Badge> : null}
              {summary.matchScore != null ? <Badge tone="info">Match {formatSemanticSearchScore(summary.matchScore)}</Badge> : null}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-[var(--color-text-secondary)]">
            <span>{candidate.totalExperience != null ? `${candidate.totalExperience} yrs` : 'Experience not provided'}</span>
            <span>{salary}</span>
            <span>{candidate.location || 'Location not provided'}</span>
            <span>{candidate.noticePeriodDays != null ? `${candidate.noticePeriodDays} days notice` : 'Notice not provided'}</span>
          </div>
          <div className="mt-3 grid gap-1 text-sm text-[var(--color-text-secondary)] md:grid-cols-2">
            <p><strong className="font-semibold text-[var(--color-text)]">Current:</strong> {highlightText(currentRole || 'Not added', matchedTerms)}</p>
            <p><strong className="font-semibold text-[var(--color-text)]">Previous:</strong> {highlightText(previousRole || 'Not added', matchedTerms)}</p>
            <p><strong className="font-semibold text-[var(--color-text)]">Education:</strong> {candidate.educationDetail ? `${candidate.educationDetail.degree || 'Qualification'}${candidate.educationDetail.institution ? ` - ${candidate.educationDetail.institution}` : ''}${candidate.educationDetail.completionYear ? ` (${candidate.educationDetail.completionYear})` : ''}` : 'Not added'}</p>
            <p><strong className="font-semibold text-[var(--color-text)]">Preferred:</strong> {candidate.preferredLocations?.length ? candidate.preferredLocations.join(', ') : 'Not specified'}</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(candidate.skills || []).slice(0, 8).map((skill) => <Badge key={skill} tone="neutral">{highlightText(skill, matchedTerms)}</Badge>)}
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-[var(--color-text-muted)]">
            <span>{candidate.resumeAvailable ? 'Resume attached' : 'No resume attached'}</span>
            <span>Modified {candidate.updatedAt ? formatSemanticSearchDate(candidate.updatedAt) : 'Not available'}</span>
            <span>Active {candidate.lastActiveAt ? formatSemanticSearchDate(candidate.lastActiveAt) : 'Not available'}</span>
          </div>
        </div>
        <div className="flex w-full flex-wrap gap-2 md:w-auto md:max-w-40 md:justify-end">
          <Button as={Link} href={profileHref} variant="outline" size="sm">View Profile</Button>
          {candidate.resumeAvailable ? <Button as="a" href={`/api/resumes/candidate/${candidate.id}/download`} variant="outline" size="sm"><Download size={14} aria-hidden="true" />View Resume</Button> : null}
          <Button type="button" variant="outline" size="sm" onClick={() => onSave(candidate.id)}>Save</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onAddToAts(candidate.id)}>{selectedJobId ? 'Add to Job' : 'Add to ATS'}</Button>
        </div>
      </div>
    </Card>
  );
}

export function RecruiterSemanticSearchWorkspace({
  initialState,
  view = 'results',
  showLivePreview = false,
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
  const isResultsView = view === 'results';
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
  const [selectedResultIds, setSelectedResultIds] = useState([]);
  const [preview, setPreview] = useState(null);
  const [candidateInsights, setCandidateInsights] = useState(null);
  const [candidateInsightsStatus, setCandidateInsightsStatus] = useState(null);
  const [matchDetails, setMatchDetails] = useState(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [evidenceState, setEvidenceState] = useState(null);
  const [compareState, setCompareState] = useState(null);
  const [lastPayload, setLastPayload] = useState(null);
  const [aiQuery, setAiQuery] = useState('');
  const [aiResult, setAiResult] = useState(null);
  const [aiError, setAiError] = useState('');
  const [aiPending, setAiPending] = useState(false);
  const [activeUtilityPanel, setActiveUtilityPanel] = useState(null);
  const [locationSearch, setLocationSearch] = useState('');
  const [preferredLocationSearch, setPreferredLocationSearch] = useState('');
  const [workPermitSearch, setWorkPermitSearch] = useState('');
  const initialSalaryMinEditor = useMemo(() => deriveCtcEditorValue(initialState.salaryMin), [initialState.salaryMin]);
  const initialSalaryMaxEditor = useMemo(() => deriveCtcEditorValue(initialState.salaryMax), [initialState.salaryMax]);
  const [salaryMinAmount, setSalaryMinAmount] = useState(initialSalaryMinEditor.amount);
  const [salaryMinUnit, setSalaryMinUnit] = useState(initialSalaryMinEditor.unit);
  const [salaryMaxAmount, setSalaryMaxAmount] = useState(initialSalaryMaxEditor.amount);
  const [salaryMaxUnit, setSalaryMaxUnit] = useState(initialSalaryMaxEditor.unit);

  const selectedJobId = formState.jobId || '';
  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) || null,
    [jobs, selectedJobId],
  );
  const visibleItems = useMemo(
    () => result?.items || [],
    [result?.items],
  );
  const selectedItem = useMemo(
    () => visibleItems.find((item) => item.candidate.id === selectedCandidateId) || result?.items?.find((item) => item.candidate.id === selectedCandidateId) || null,
    [result?.items, selectedCandidateId, visibleItems],
  );
  const totalCount = result?.meta?.total || visibleItems.length;
  const totalPages = result?.meta?.pageCount || 1;
  const currentPage = result?.meta?.page || 1;
  const hasMore = currentPage < totalPages;

  function syncSalaryEditors(nextState) {
    const minEditor = deriveCtcEditorValue(nextState.salaryMin);
    const maxEditor = deriveCtcEditorValue(nextState.salaryMax);
    setSalaryMinAmount(minEditor.amount);
    setSalaryMinUnit(minEditor.unit);
    setSalaryMaxAmount(maxEditor.amount);
    setSalaryMaxUnit(maxEditor.unit);
  }

  function resetResultsState() {
    setResult(null);
    setSelectedCandidateId(null);
    setPreview(null);
    setCandidateInsights(null);
    setCandidateInsightsStatus(null);
    setMatchDetails(null);
    setError('');
    setSelectedResultIds([]);
  }

  function toggleResultSelection(candidateId) {
    setSelectedResultIds((current) => current.includes(candidateId)
      ? current.filter((id) => id !== candidateId)
      : [...current, candidateId]);
  }

  function updateQueryString(nextState) {
    const params = buildSemanticSearchUrlParams(nextState);
    const search = params.toString();
    const pathname = isResultsView ? '/recruiter/database/results' : '/recruiter/database';
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
  }

  function navigateToResults() {
    const nextState = { ...formState, deferSearch: false };
    if (!hasSearchInputs(nextState)) {
      setError('Add at least one search criterion before searching.');
      return;
    }

    const params = buildSemanticSearchUrlParams(nextState);
    router.push(`/recruiter/database/results?${params.toString()}`);
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

  async function runSearch({ append = false, payloadOverride = null, endpoint = '/api/intelligence/search', nextPage = 1, stateOverride = null } = {}) {
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
        updateQueryString(stateOverride || formState);
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

  function applySavedSearch(savedSearch) {
    const nextState = applySavedSearchToState(savedSearch, formState);
    setFormState(nextState);
    syncSalaryEditors(nextState);
    resetResultsState();
    updateQueryString(nextState);
    setActiveUtilityPanel(null);
    push({ tone: 'success', title: 'Saved search loaded', description: `${savedSearch.name} is ready for review.` });
  }

  function applyRecentSearch(entry) {
    const nextState = applyHistoryToState(entry, formState);
    setFormState(nextState);
    resetResultsState();
    updateQueryString(nextState);
    setActiveUtilityPanel(null);
    push({ tone: 'success', title: 'Recent search loaded', description: 'Search criteria were restored for review.' });
  }

  async function interpretAiSearch() {
    setAiPending(true);
    setAiError('');
    setAiResult(null);
    try {
      const payload = await requestJson('/api/intelligence/search/parse', {
        method: 'POST',
        body: JSON.stringify({
          query: aiQuery,
          jobId: formState.jobId || undefined,
        }),
      });
      setAiResult(payload);
    } catch (caught) {
      setAiError(mapSemanticSearchError(caught));
    } finally {
      setAiPending(false);
    }
  }

  function applyAiFilters() {
    if (!aiResult) return;
    const nextState = buildAiInterpretedState(aiResult, formState);
    setFormState(nextState);
    resetResultsState();
    updateQueryString(nextState);
    push({ tone: 'success', title: 'Filters updated', description: 'Review the interpreted recruiter filters before running search.' });
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
    // Inlined here (rather than calling the loadHistory/loadSavedSearches
    // helpers above) so every setState call is inside a genuine .then()
    // callback - a plain call to those async functions would still run
    // their synchronous guard-check prefix inside this effect's own call
    // stack before their first await.
    if (searchHistoryEnabled && canReadHistory) {
      requestJson(`/api/intelligence/search/history?page=1&pageSize=${HISTORY_PAGE_SIZE}`)
        .then((payload) => setHistory(parseSemanticSearchHistoryResponse(payload)))
        .catch(() => {});
    }
    if (savedSearchesEnabled && canReadSavedSearches) {
      requestJson('/api/intelligence/saved-searches')
        .then((payload) => setSavedSearches(parseSavedCandidateSearchList(payload)))
        .catch(() => {});
    }
    if (isResultsView && hasSearchInputs(initialState) && !initialState.deferSearch) {
      // runSearch's own synchronous prefix (setError/setLoading) would
      // otherwise run inside this effect's call stack the same way; a
      // microtask defers just the call itself past that prefix without
      // introducing any observable delay or changing request/cancellation
      // behavior.
      queueMicrotask(() => {
        runSearch({ payloadOverride: buildSemanticSearchPayload(initialState, 1, SEARCH_PAGE_SIZE) }).catch(() => {});
      });
    }
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const previewGuardTrigger = {
    canReadCandidateIntelligence,
    canReadCandidateMatch,
    candidateIntelligenceEnabled,
    candidateMatchingEnabled,
    selectedCandidateId,
    selectedJobId,
    isResultsView,
    showLivePreview,
  };
  // Adjusting state during render (not in an effect): clear the preview
  // panel immediately when it should no longer be shown, instead of
  // waiting for an effect to run. The fetch-and-populate path below stays
  // in the effect since it's a genuine async round trip.
  const [prevPreviewGuardTrigger, setPrevPreviewGuardTrigger] = useState(previewGuardTrigger);
  const previewGuardChanged = Object.keys(previewGuardTrigger).some(
    (key) => previewGuardTrigger[key] !== prevPreviewGuardTrigger[key],
  );
  if (previewGuardChanged) {
    setPrevPreviewGuardTrigger(previewGuardTrigger);
    if (!showLivePreview || !isResultsView || !selectedCandidateId) {
      setPreview(null);
      setCandidateInsights(null);
      setCandidateInsightsStatus(null);
      setMatchDetails(null);
    } else {
      setPreviewLoading(true);
    }
  }

  useEffect(() => {
    if (!showLivePreview || !isResultsView || !selectedCandidateId) {
      return;
    }

    let cancelled = false;

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
    isResultsView,
    showLivePreview,
  ]);

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

  async function handleResultAction(action, candidateIdOrIds) {
    const candidateIds = Array.isArray(candidateIdOrIds) ? candidateIdOrIds : [candidateIdOrIds];
    try {
      if (action === 'save') {
        await Promise.all(candidateIds.map((candidateId) => requestJson(`/api/recruiter/candidates/${candidateId}/save`, {
          method: 'POST',
          body: JSON.stringify({}),
        })));
        push({ tone: 'success', title: 'Candidate saved', description: 'The candidate is now available in saved profiles.' });
        return;
      }

      if (!selectedJobId) {
        push({ tone: 'warning', title: 'Select a job first', description: 'Choose a job context before adding a candidate to the ATS workflow.' });
        return;
      }

      await requestJson('/api/recruiter/resume-search/actions', {
        method: 'POST',
        body: JSON.stringify({
          action: 'addToAts',
          payload: {
            candidateIds,
            jobId: selectedJobId,
            action: 'ADD_TO_ATS',
          },
        }),
      });
      push({ tone: 'success', title: 'Candidate added', description: 'The candidate was added to the selected job workflow.' });
    } catch (caught) {
      const message = mapSemanticSearchError(caught);
      setError(message);
      push({ tone: 'error', title: 'Action unavailable', description: message });
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
      <div className={isResultsView && showLivePreview ? 'grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)]' : isResultsView ? 'grid gap-6 xl:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)]' : 'space-y-4'}>
        <div className={isResultsView && !showLivePreview ? 'contents' : 'min-w-0 space-y-4'}>
          {!isResultsView ? <SearchSection
            title="AI Assist"
            description="Describe the candidate you are looking for. Careeriz will interpret the requirement and populate structured recruiter filters for review."
          >
            <div className="space-y-4">
              <textarea
                value={aiQuery}
                onChange={(event) => setAiQuery(event.target.value)}
                placeholder="Find a Java developer in Bengaluru with Spring Boot and AWS, 6-10 years experience and maximum 30 days notice."
                className="min-h-28 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3.5 py-3 text-sm text-[var(--color-text)] shadow-[var(--shadow-sm)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:rgba(79,156,249,0.22)]"
              />
              <div className="flex flex-wrap gap-3">
                <Button type="button" disabled={aiPending || aiQuery.trim().length < 8} onClick={interpretAiSearch}>
                  <Sparkles size={16} aria-hidden="true" />
                  {aiPending ? 'Interpreting...' : 'Interpret Search'}
                </Button>
                {aiResult ? (
                  <Button type="button" variant="outline" onClick={applyAiFilters}>
                    Apply filters
                  </Button>
                ) : null}
              </div>
              {aiError ? <p className="text-sm text-rose-600">{aiError}</p> : null}
              {aiResult ? (
                <div className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-bg-muted)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">Interpreted filters</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(aiResult.interpretedFilters || []).map((item) => (
                      <span key={item} className="rounded-full border border-[var(--color-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)]">
                        {item}
                      </span>
                    ))}
                    {!aiResult.interpretedFilters?.length ? <span className="text-sm text-[var(--color-text-muted)]">No structured filters detected yet.</span> : null}
                  </div>
                </div>
              ) : null}
            </div>
          </SearchSection> : null}

          <div className={isResultsView ? 'min-w-0' : ''}>
          <SearchSection
            title="Search Criteria"
            description="Review and refine structured recruiter filters before running the existing Careeriz semantic search."
            action={(
              <div className="flex flex-wrap gap-2">
                {searchSuggestionsEnabled ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const nextOpen = activeUtilityPanel === 'suggestions' ? null : 'suggestions';
                      setActiveUtilityPanel(nextOpen);
                      if (nextOpen === 'suggestions' && !suggestions.length) {
                        loadSuggestions().catch(() => {});
                      }
                    }}
                  >
                    <WandSparkles size={15} aria-hidden="true" />
                    Suggestions
                  </Button>
                ) : null}
                {savedSearchesEnabled && canReadSavedSearches ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => setActiveUtilityPanel((current) => current === 'saved' ? null : 'saved')}>
                    <Save size={15} aria-hidden="true" />
                    Saved Searches
                  </Button>
                ) : null}
                {searchHistoryEnabled && canReadHistory ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => setActiveUtilityPanel((current) => current === 'recent' ? null : 'recent')}>
                    <History size={15} aria-hidden="true" />
                    Recent Searches
                  </Button>
                ) : null}
              </div>
            )}
          >
            <div className="space-y-4">
              {activeUtilityPanel === 'suggestions' ? (
                <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-muted)] p-4">
                  {suggestions.length ? (
                    <div className="flex flex-wrap gap-2">
                      {suggestions.map((item) => (
                        <button
                          key={`${item.source}-${item.text}`}
                          type="button"
                          onClick={() => setFormState((current) => ({ ...current, query: item.text }))}
                          className="rounded-full border border-[var(--color-border)] bg-white px-3 py-1.5 text-left text-xs font-semibold text-[var(--color-text-secondary)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                        >
                          {item.text}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--color-text-secondary)]">{suggestionsLoading ? 'Loading suggestions...' : 'No search suggestions are available yet for the current recruiter input.'}</p>
                  )}
                </div>
              ) : null}

              {activeUtilityPanel === 'saved' ? (
                <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-muted)] p-4">
                  {savedSearches.length ? (
                    <div className="space-y-2">
                      {savedSearches.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => applySavedSearch(item)}
                          className="flex w-full items-start justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 py-3 text-left transition hover:border-[var(--color-primary)]"
                        >
                          <span>
                            <span className="block text-sm font-semibold text-[var(--color-text)]">{item.name}</span>
                            <span className="mt-1 block text-xs text-[var(--color-text-muted)]">{item.description || item.rawQuery || 'Saved recruiter search'}</span>
                          </span>
                          <span className="text-xs font-semibold text-[var(--color-primary)]">Apply</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--color-text-secondary)]">Saved searches will appear here after you store the current filter set.</p>
                  )}
                </div>
              ) : null}

              {activeUtilityPanel === 'recent' ? (
                <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-muted)] p-4">
                  {history.items.length ? (
                    <div className="space-y-2">
                      {history.items.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => applyRecentSearch(item)}
                          className="flex w-full items-start justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 py-3 text-left transition hover:border-[var(--color-primary)]"
                        >
                          <span>
                            <span className="block text-sm font-semibold text-[var(--color-text)]">{item.rawQuery || item.normalizedQuery || item.searchMode}</span>
                            <span className="mt-1 block text-xs text-[var(--color-text-muted)]">{formatSemanticSearchDate(item.createdAt)}</span>
                          </span>
                          <SearchStatusBadge status={item.latestExecution?.status || 'READY'} />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--color-text-secondary)]">Recent searches will appear here after the first recruiter search execution.</p>
                  )}
                </div>
              ) : null}

              <FilterAccordion
                title="Keywords"
                defaultOpen
                summary={buildFilterSummary([
                  formState.query && `Query: ${formState.query}`,
                  formState.requiredSkills && `Skills: ${formState.requiredSkills}`,
                  formState.optionalSkills && `Optional / excluded: ${formState.optionalSkills}`,
                  formState.mode && `Mode: ${semanticSearchModes.find((mode) => mode.value === formState.mode)?.label || formState.mode}`,
                ])}
              >
                <div className="grid gap-3">
                  <Input
                    label="Keywords"
                    value={formState.query}
                    onChange={(event) => setFormState((current) => ({ ...current, query: event.target.value, deferSearch: false }))}
                    placeholder="Enter skills, designation, technologies or companies"
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
                    <Input label="Required skills" value={formState.requiredSkills} onChange={(event) => setFormState((current) => ({ ...current, requiredSkills: event.target.value }))} placeholder="Java, Spring Boot, AWS" />
                    <Input label="Optional / exclude keywords" value={formState.optionalSkills} onChange={(event) => setFormState((current) => ({ ...current, optionalSkills: event.target.value }))} placeholder="Tableau, legacy PHP" />
                  </div>
                </div>
              </FilterAccordion>
              <FilterAccordion
                title="Experience"
                summary={buildFilterSummary([
                  (formState.minExperience !== '' || formState.maxExperience !== '') && `${formState.minExperience || 0}-${formState.maxExperience || 'Any'} Years`,
                ])}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input label="Min Experience" type="number" value={formState.minExperience} onChange={(event) => setFormState((current) => ({ ...current, minExperience: event.target.value }))} />
                  <Input label="Max Experience" type="number" value={formState.maxExperience} onChange={(event) => setFormState((current) => ({ ...current, maxExperience: event.target.value }))} />
                </div>
              </FilterAccordion>
              <FilterAccordion
                title="Location"
                summary={buildFilterSummary(formState.locations?.length ? formState.locations : [formState.location])}
              >
                <div className="space-y-3">
                  <Input
                    label="Search current locations"
                    value={locationSearch}
                    onChange={(event) => setLocationSearch(event.target.value)}
                    placeholder="Search city or state, for example Bengaluru or Karnataka"
                  />
                  <div className="flex flex-wrap gap-2">
                    {(formState.locations || []).map((location) => (
                      <button
                        key={location}
                        type="button"
                        className="rounded-full bg-[var(--color-primary-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--color-primary)]"
                        onClick={() => setFormState((current) => ({
                          ...current,
                          locations: (current.locations || []).filter((item) => item !== location),
                        }))}
                      >
                        {location} ×
                      </button>
                    ))}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {filterIndiaLocations(locationSearch).filter((location) => !(formState.locations || []).includes(location)).slice(0, 8).map((location) => (
                      <button
                        key={location}
                        type="button"
                        className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-left text-sm text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                        onClick={() => setFormState((current) => ({
                          ...current,
                          locations: [...(current.locations || []), location],
                          location: '',
                        }))}
                      >
                        {location}
                      </button>
                    ))}
                  </div>
                  <Input label="Other current location" value={formState.location} onChange={(event) => setFormState((current) => ({ ...current, location: event.target.value }))} placeholder="Use a candidate-entered location when it is not in the selector" />
                  <div className="border-t border-[var(--color-border)] pt-3">
                    <p className="text-sm font-semibold text-[var(--color-text)]">Preferred location</p>
                    <Input label="Search preferred locations" value={preferredLocationSearch} onChange={(event) => setPreferredLocationSearch(event.target.value)} placeholder="Search a preferred city or state" />
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(formState.preferredLocations || []).map((location) => (
                        <button key={location} type="button" className="rounded-full bg-[var(--color-primary-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--color-primary)]" onClick={() => setFormState((current) => ({ ...current, preferredLocations: (current.preferredLocations || []).filter((item) => item !== location) }))}>{location} Ã—</button>
                      ))}
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {preferredLocationSearch.trim() ? filterIndiaLocations(preferredLocationSearch).filter((location) => !(formState.preferredLocations || []).includes(location)).slice(0, 6).map((location) => (
                        <button key={location} type="button" className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-left text-sm text-[var(--color-text-secondary)] hover:border-[var(--color-primary)]" onClick={() => setFormState((current) => ({ ...current, preferredLocations: [...(current.preferredLocations || []), location] }))}>{location}</button>
                      )) : null}
                    </div>
                    <label className="mt-3 flex items-center gap-2 text-sm text-[var(--color-text-secondary)]"><input type="checkbox" checked={Boolean(formState.includeWillingToRelocate)} onChange={(event) => setFormState((current) => ({ ...current, includeWillingToRelocate: event.target.checked }))} /> Include candidates willing to relocate</label>
                  </div>
                </div>
              </FilterAccordion>
              <FilterAccordion
                title="Annual Salary"
                summary={buildFilterSummary([
                  formState.salaryMin !== '' && `Min ${formState.salaryMin} LPA`,
                  formState.salaryMax !== '' && `Max ${formState.salaryMax} LPA`,
                ])}
              >
                <div className="grid gap-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <span className="text-sm font-semibold text-[var(--color-text)]">Min salary</span>
                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
                        <Input value={salaryMinAmount} onChange={(event) => {
                          const nextValue = event.target.value;
                          setSalaryMinAmount(nextValue);
                          setFormState((current) => ({ ...current, salaryMin: normalizeCtcToLpa(nextValue, salaryMinUnit) ?? '' }));
                        }} placeholder="20" />
                        <select value={salaryMinUnit} onChange={(event) => {
                          const nextUnit = event.target.value;
                          setSalaryMinUnit(nextUnit);
                          setFormState((current) => ({ ...current, salaryMin: normalizeCtcToLpa(salaryMinAmount, nextUnit) ?? '' }));
                        }} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-text)]">
                          <option value="LAKH_PER_ANNUM">Lakh</option>
                          <option value="CRORE_PER_ANNUM">Crore</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <span className="text-sm font-semibold text-[var(--color-text)]">Max salary</span>
                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
                        <Input value={salaryMaxAmount} onChange={(event) => {
                          const nextValue = event.target.value;
                          setSalaryMaxAmount(nextValue);
                          setFormState((current) => ({ ...current, salaryMax: normalizeCtcToLpa(nextValue, salaryMaxUnit) ?? '' }));
                        }} placeholder="1.5" />
                        <select value={salaryMaxUnit} onChange={(event) => {
                          const nextUnit = event.target.value;
                          setSalaryMaxUnit(nextUnit);
                          setFormState((current) => ({ ...current, salaryMax: normalizeCtcToLpa(salaryMaxAmount, nextUnit) ?? '' }));
                        }} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-text)]">
                          <option value="LAKH_PER_ANNUM">Lakh</option>
                          <option value="CRORE_PER_ANNUM">Crore</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)]">Enter annual salary in lakh or crore. Careeriz converts the filter to canonical LPA values for search.</p>
                </div>
              </FilterAccordion>
              <FilterAccordion
                title="Employment Details"
                summary={buildFilterSummary([
                  formState.currentEmployer && `Current company: ${formState.currentEmployer}`,
                  formState.currentDesignation && `Designation: ${formState.currentDesignation}`,
                  formState.employmentType,
                  formState.workMode,
                  formState.previousEmployer && `Previous company: ${formState.previousEmployer}`,
                ])}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input label="Current company" value={formState.currentEmployer} onChange={(event) => setFormState((current) => ({ ...current, currentEmployer: event.target.value }))} />
                  <Input label="Previous company" value={formState.previousEmployer} onChange={(event) => setFormState((current) => ({ ...current, previousEmployer: event.target.value }))} />
                  <Input label="Current designation" value={formState.currentDesignation || ''} onChange={(event) => setFormState((current) => ({ ...current, currentDesignation: event.target.value }))} />
                  <label className="grid gap-2"><span className="text-sm font-semibold text-[var(--color-text)]">Company search scope</span><select value={formState.companyScope || 'current'} onChange={(event) => setFormState((current) => ({ ...current, companyScope: event.target.value }))} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm"><option value="current">Current company</option><option value="previous">Previous company</option><option value="any">Any company</option></select></label>
                  <label className="grid gap-2"><span className="text-sm font-semibold text-[var(--color-text)]">Designation search scope</span><select value={formState.designationScope || 'current'} onChange={(event) => setFormState((current) => ({ ...current, designationScope: event.target.value }))} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm"><option value="current">Current designation</option><option value="previous">Previous designation</option><option value="any">Any designation</option></select></label>
                  <Input label="Employment Type" value={formState.employmentType} onChange={(event) => setFormState((current) => ({ ...current, employmentType: event.target.value }))} />
                  <Input label="Workplace Preference" value={formState.workMode} onChange={(event) => setFormState((current) => ({ ...current, workMode: event.target.value }))} />
                  <Input label="Work authorization" value={formState.workAuthorization || ''} onChange={(event) => setFormState((current) => ({ ...current, workAuthorization: event.target.value }))} placeholder="Country or authorization category" />
                </div>
              </FilterAccordion>
              <FilterAccordion
                title="Notice Period / Availability"
                summary={buildFilterSummary([
                  formState.noticePeriodDaysMax !== '' && `${formState.noticePeriodDaysMax} days max notice`,
                ])}
              >
                <Input label="Notice period days" type="number" value={formState.noticePeriodDaysMax} onChange={(event) => setFormState((current) => ({ ...current, noticePeriodDaysMax: event.target.value }))} />
              </FilterAccordion>
              <FilterAccordion
                title="Education"
                summary={buildFilterSummary([formState.education, formState.educationFilters?.ug?.course && `UG: ${formState.educationFilters.ug.course}`, formState.educationFilters?.pg?.course && `PG: ${formState.educationFilters.pg.course}`, formState.educationFilters?.ppg?.course && `PPG: ${formState.educationFilters.ppg.course}`])}
              >
                <div className="space-y-4">
                  <Input label="Legacy qualification keyword" value={formState.education} onChange={(event) => setFormState((current) => ({ ...current, education: event.target.value }))} placeholder="Optional broad qualification search" />
                  {[
                    ['ug', 'UG qualification'],
                    ['pg', 'PG qualification'],
                    ['ppg', 'PPG / Doctorate qualification'],
                  ].map(([level, label]) => {
                    const value = formState.educationFilters?.[level] || { mode: 'ANY' };
                    return <div key={level} className="grid gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] p-3 sm:grid-cols-2">
                      <label className="grid gap-2 sm:col-span-2"><span className="text-sm font-semibold text-[var(--color-text)]">{label}</span><select value={value.mode || 'ANY'} onChange={(event) => setFormState((current) => ({ ...current, educationFilters: { ...(current.educationFilters || {}), [level]: { ...value, mode: event.target.value } } }))} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm"><option value="ANY">Any qualification</option><option value="SPECIFIC">Specific qualification</option><option value="NONE">No qualification</option></select></label>
                      {value.mode === 'SPECIFIC' ? <><Input label="Course" value={value.course || ''} onChange={(event) => setFormState((current) => ({ ...current, educationFilters: { ...(current.educationFilters || {}), [level]: { ...value, course: event.target.value } } }))} placeholder="B.Tech, MBA, PhD" /><Input label="Institute" value={value.institute || ''} onChange={(event) => setFormState((current) => ({ ...current, educationFilters: { ...(current.educationFilters || {}), [level]: { ...value, institute: event.target.value } } }))} /><Input label="Education type" value={value.educationType || ''} onChange={(event) => setFormState((current) => ({ ...current, educationFilters: { ...(current.educationFilters || {}), [level]: { ...value, educationType: event.target.value } } }))} placeholder="Full Time / Part Time / Correspondence" /><Input label="Completion year from" type="number" value={value.completionYearFrom || ''} onChange={(event) => setFormState((current) => ({ ...current, educationFilters: { ...(current.educationFilters || {}), [level]: { ...value, completionYearFrom: event.target.value } } }))} /><Input label="Completion year to" type="number" value={value.completionYearTo || ''} onChange={(event) => setFormState((current) => ({ ...current, educationFilters: { ...(current.educationFilters || {}), [level]: { ...value, completionYearTo: event.target.value } } }))} /></> : null}
                    </div>;
                  })}
                  <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]"><input type="checkbox" checked={Boolean(formState.educationFilters?.requireUgPg)} onChange={(event) => setFormState((current) => ({ ...current, educationFilters: { ...(current.educationFilters || {}), requireUgPg: event.target.checked } }))} /> Require both UG and PG</label>
                  <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]"><input type="checkbox" checked={Boolean(formState.educationFilters?.requirePgPpg)} onChange={(event) => setFormState((current) => ({ ...current, educationFilters: { ...(current.educationFilters || {}), requirePgPpg: event.target.checked } }))} /> Require both PG and PPG</label>
                </div>
              </FilterAccordion>
              <FilterAccordion
                title="Additional Details"
                summary={buildFilterSummary([
                  formState.candidateName && `Candidate: ${formState.candidateName}`,
                  formState.jobTypes?.length && `Job type: ${formState.jobTypes.join(', ')}`,
                  formState.employmentTypes?.length && `Employment: ${formState.employmentTypes.join(', ')}`,
                  formState.activeWithin && `Active in ${formState.activeWithin} days`,
                  selectedJob ? `Job context: ${selectedJob.title}` : null,
                ])}
              >
                <div className="grid gap-3">
                  <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-3">
                    <p className="text-sm font-semibold text-[var(--color-text)]">Candidate details</p>
                    <p className="mt-2 text-xs text-[var(--color-text-muted)]">Candidate age is unavailable because Careeriz does not currently store an authoritative date of birth or age. Age is not inferred from resumes.</p>
                  </div>
                  <div className="grid gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] p-3">
                    <p className="text-sm font-semibold text-[var(--color-text)]">Work details</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">Job type</p><div className="grid gap-2 text-sm text-[var(--color-text-secondary)]"><label className="flex items-center gap-2"><input type="checkbox" checked={formState.jobTypes?.includes('PERMANENT')} onChange={(event) => setFormState((current) => ({ ...current, jobTypes: event.target.checked ? [...(current.jobTypes || []), 'PERMANENT'] : (current.jobTypes || []).filter((item) => item !== 'PERMANENT') }))} /> Permanent</label><label className="flex items-center gap-2"><input type="checkbox" checked={formState.jobTypes?.includes('CONTRACT')} onChange={(event) => setFormState((current) => ({ ...current, jobTypes: event.target.checked ? [...(current.jobTypes || []), 'CONTRACT'] : (current.jobTypes || []).filter((item) => item !== 'CONTRACT') }))} /> Contract</label><label className="flex items-center gap-2 text-[var(--color-text-muted)]"><input type="checkbox" disabled /> Temporary <span className="text-xs">(not stored)</span></label></div></div>
                      <div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">Employment type</p><div className="grid gap-2 text-sm text-[var(--color-text-secondary)]">{[['FULL_TIME', 'Full Time'], ['PART_TIME', 'Part Time'], ['INTERN', 'Intern']].map(([value, label]) => <label key={value} className="flex items-center gap-2"><input type="checkbox" checked={formState.employmentTypes?.includes(value)} onChange={(event) => setFormState((current) => ({ ...current, employmentTypes: event.target.checked ? [...(current.employmentTypes || []), value] : (current.employmentTypes || []).filter((item) => item !== value) }))} /> {label}</label>)}</div></div>
                    </div>
                    <Input label="Search work permit countries" value={workPermitSearch} onChange={(event) => setWorkPermitSearch(event.target.value)} placeholder="Search country, for example Canada or UK" />
                    <div className="flex flex-wrap gap-2">{(formState.workPermitCountries || []).map((country) => <button key={country} type="button" className="rounded-full bg-[var(--color-primary-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--color-primary)]" onClick={() => setFormState((current) => ({ ...current, workPermitCountries: (current.workPermitCountries || []).filter((item) => item !== country) }))}>{country} Ã—</button>)}</div>
                    <div className="grid gap-2 sm:grid-cols-3">{filterCountries(workPermitSearch).filter((country) => !(formState.workPermitCountries || []).includes(country.name)).slice(0, 9).map((country) => <button key={country.code} type="button" className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-left text-sm text-[var(--color-text-secondary)] hover:border-[var(--color-primary)]" onClick={() => setFormState((current) => ({ ...current, workPermitCountries: [...(current.workPermitCountries || []), normalizeCountry(country.name)] }))}>{country.name}</button>)}</div>
                  </div>
                  <div className="grid gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] p-3">
                    <p className="text-sm font-semibold text-[var(--color-text)]">Display details</p>
                    <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-2"><span className="text-sm font-semibold text-[var(--color-text)]">Show</span><select value={formState.displayCandidateType || 'ALL'} onChange={(event) => setFormState((current) => ({ ...current, displayCandidateType: event.target.value }))} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm"><option value="ALL">All candidates</option><option value="NEW_REGISTRATIONS">New registrations</option><option value="MODIFIED">Modified candidates</option></select></label><Input label="Within days" type="number" value={formState.profileRecencyDays || ''} onChange={(event) => setFormState((current) => ({ ...current, profileRecencyDays: event.target.value }))} placeholder="Defaults to 30" /></div>
                    <div><p className="mb-2 text-sm font-semibold text-[var(--color-text)]">Show only candidates with</p><div className="grid gap-2 text-sm text-[var(--color-text-secondary)]"><label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(formState.emailVerified)} onChange={(event) => setFormState((current) => ({ ...current, emailVerified: event.target.checked }))} /> Verified email ID</label><label className="flex items-center gap-2"><input type="checkbox" checked={formState.resumeAttachment === 'Available'} onChange={(event) => setFormState((current) => ({ ...current, resumeAttachment: event.target.checked ? 'Available' : '' }))} /> Attached resume</label><span className="text-xs text-[var(--color-text-muted)]">Verified mobile is unavailable because no authoritative mobile-verification state is stored.</span></div></div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
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
                  <div className="grid gap-3 text-sm text-[var(--color-text-secondary)]">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={formState.expansionEnabled} onChange={(event) => setFormState((current) => ({ ...current, expansionEnabled: event.target.checked }))} />
                      Expansion enabled
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={formState.transferableSkillsEnabled} onChange={(event) => setFormState((current) => ({ ...current, transferableSkillsEnabled: event.target.checked }))} />
                      Transferable skills enabled
                    </label>
                  </div>
                  <label className="grid gap-2"><span className="text-sm font-semibold text-[var(--color-text)]">Active in</span><select value={formState.activeWithin || ''} onChange={(event) => setFormState((current) => ({ ...current, activeWithin: event.target.value }))} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm"><option value="">All resumes</option><option value="1">1 day</option><option value="3">3 days</option><option value="7">7 days</option><option value="15">15 days</option><option value="30">30 days</option><option value="60">2 months</option><option value="90">3 months</option><option value="180">6 months</option><option value="365">12 months / 1 year</option></select></label>
                </div>
              </FilterAccordion>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  type="button"
                  className="flex-1"
                  disabled={!canExecute || loading}
                  loading={loading}
                  onClick={() => (isResultsView
                    ? runSearch({ payloadOverride: buildSemanticSearchPayload(formState, 1, SEARCH_PAGE_SIZE) })
                    : navigateToResults())}
                >
                  <Search size={16} aria-hidden="true" />
                  Search Candidates
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    const cleared = {
                      ...initialState,
                      deferSearch: false,
                      query: '',
                      jobId: '',
                      candidateName: '',
                    };
                    setFormState(cleared);
                    syncSalaryEditors(cleared);
                    resetResultsState();
                    updateQueryString(cleared);
                  }}
                >
                  <X size={16} aria-hidden="true" />
                  Clear
                </Button>
                {savedSearchesEnabled && canManageSavedSearches ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    disabled={!hasSearchInputs(formState)}
                    onClick={() => setSaveDialogOpen(true)}
                  >
                    <Save size={16} aria-hidden="true" />
                    Save Search
                  </Button>
                ) : null}
              </div>
            </div>
          </SearchSection>
          </div>
          <div className={isResultsView ? 'min-w-0 space-y-4' : ''}>
          {isResultsView ? (
            <SearchSection
              title="Candidate Results"
              description={result ? `${totalCount} profiles found${formState.query ? ` for ${formState.query}` : ''}` : 'Running the search criteria...'}
              action={result?.execution?.status ? <SearchStatusBadge status={result.execution.status} /> : null}
            >
              {result ? (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] pb-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={visibleItems.length > 0 && visibleItems.every((item) => selectedResultIds.includes(item.candidate.id))}
                        onChange={(event) => setSelectedResultIds(event.target.checked ? visibleItems.map((item) => item.candidate.id) : [])}
                        className="h-4 w-4 accent-[var(--color-primary)]"
                      />
                      Select all on page
                    </label>
                    {selectedResultIds.length ? <span>{selectedResultIds.length} selected</span> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedResultIds.length ? (
                      <>
                        <Button type="button" variant="outline" size="sm" onClick={() => handleResultAction('save', selectedResultIds)}>Save candidates</Button>
                        {selectedJobId ? <Button type="button" variant="outline" size="sm" onClick={() => handleResultAction('addToAts', selectedResultIds)}>Add to Job</Button> : null}
                      </>
                    ) : null}
                    <Button type="button" variant="outline" size="sm" onClick={() => setSaveDialogOpen(true)} disabled={!hasSearchInputs(formState)}>Save Search</Button>
                    <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                      <span>Sort by</span>
                      <select
                        aria-label="Sort results"
                        value={formState.sortBy || 'relevance'}
                        onChange={(event) => {
                          const nextState = { ...formState, sortBy: event.target.value, page: 1, pageSize: formState.pageSize || 20 };
                          setFormState(nextState);
                          runSearch({ payloadOverride: buildSemanticSearchPayload(nextState, 1, SEARCH_PAGE_SIZE), stateOverride: nextState });
                        }}
                        className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-2 py-1.5 text-xs text-[var(--color-text)]"
                      >
                        <option value="relevance">Relevance</option>
                        <option value="experience">Experience</option>
                        <option value="resumeFreshness">Recently updated</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                      <span>Show</span>
                      <select
                        aria-label="Results per page"
                        value={formState.pageSize || 20}
                        onChange={(event) => {
                          const nextState = { ...formState, page: 1, pageSize: Number(event.target.value) };
                          setFormState(nextState);
                          runSearch({ payloadOverride: buildSemanticSearchPayload(nextState, 1, SEARCH_PAGE_SIZE), stateOverride: nextState });
                        }}
                        className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-2 py-1.5 text-xs text-[var(--color-text)]"
                      >
                        <option value="20">20</option>
                        <option value="50">50</option>
                      </select>
                    </label>
                  </div>
                </div>
              ) : null}
              {error ? (
                <div className="rounded-[var(--radius-lg)] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                  {error}
                </div>
              ) : null}
              {result?.warnings?.length ? (
                <div className="space-y-2">
                  {result.warnings.map((warning, index) => (
                    <div key={`${warning}-${index}`} className="rounded-[var(--radius-lg)] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                      {warning}
                    </div>
                  ))}
                </div>
              ) : null}
            </SearchSection>
          ) : null}

          {isResultsView && loading && !result ? (
            <Card>
              <div className="flex items-center gap-3 text-sm text-[var(--color-text-secondary)]">
                <LoaderCircle className="animate-spin" size={18} aria-hidden="true" />
                Running semantic search…
              </div>
            </Card>
          ) : null}

          {isResultsView && !loading && !result ? (
            <Card>
              <EmptyState
                icon={Database}
                title="Start a recruiter search"
                description="Review the structured recruiter filters and run Search Candidates to retrieve matching profiles."
              />
            </Card>
          ) : null}

          {isResultsView && result && !visibleItems.length ? (
            <Card>
              <EmptyState
                icon={FileSearch}
                title="No matching candidates in this view"
                description="Adjust the search query, filters, or high-confidence filter to broaden the candidate set."
              />
            </Card>
          ) : null}

          {isResultsView && visibleItems.length ? (
            <div className="space-y-4">
              {visibleItems.map((item) => (
                <ResultCard
                  key={`${item.candidate.id}-${item.metadata?.executionId || 'current'}`}
                  item={item}
                  onSave={(candidateId) => handleResultAction('save', candidateId)}
                  onAddToAts={(candidateId) => handleResultAction('addToAts', candidateId)}
                  selected={selectedResultIds.includes(item.candidate.id)}
                  onToggleSelect={toggleResultSelection}
                  returnTo={`/recruiter/database/results?${buildSemanticSearchUrlParams(formState).toString()}`}
                  onCompare={(target) => {
                    if (!selectedItem || selectedItem.candidate.id === target.candidate.id) return;
                    setCompareState({ base: { ...selectedItem, preview }, target });
                  }}
                  selectedJobId={selectedJobId}
                />
              ))}
              <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-4">
                <Button type="button" variant="outline" size="sm" disabled={currentPage <= 1 || loading} onClick={() => {
                  const nextState = { ...formState, page: currentPage - 1 };
                  setFormState(nextState);
                  runSearch({ payloadOverride: buildSemanticSearchPayload(nextState, currentPage - 1, SEARCH_PAGE_SIZE), nextPage: currentPage - 1, stateOverride: nextState });
                }}>Previous</Button>
                <span className="text-sm text-[var(--color-text-secondary)]">Page {currentPage} of {totalPages}</span>
                <Button type="button" variant="outline" size="sm" disabled={!hasMore || loading} onClick={() => {
                  const nextState = { ...formState, page: currentPage + 1 };
                  setFormState(nextState);
                  runSearch({ payloadOverride: buildSemanticSearchPayload(nextState, currentPage + 1, SEARCH_PAGE_SIZE), nextPage: currentPage + 1, stateOverride: nextState });
                }}>Next</Button>
              </div>
            </div>
          ) : null}
          </div>
        </div>

        {showLivePreview && isResultsView ? <div className="min-w-0 space-y-4 xl:sticky xl:top-6 xl:max-h-[calc(100vh-8rem)] xl:overflow-auto">
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
        </div> : null}
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
