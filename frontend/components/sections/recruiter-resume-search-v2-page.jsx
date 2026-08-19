"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  CircleX,
  Filter,
  LoaderCircle,
  Quote,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  StarOff,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Tooltip } from '@/components/ui/tooltip';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import {
  buildInitialResumeSearchV2State,
  buildResumeSearchV2RequestKey,
  buildResumeSearchV2UrlParams,
  countActiveResumeSearchV2Filters,
  formatExperienceMonths,
  formatResumeSearchV2Summary,
  mapResumeSearchV2Error,
  parseResumeSearchV2Response,
  sanitizeResumeSearchV2Highlights,
  sanitizeResumeSearchV2State,
  splitKeywordInputToChips,
  resumeSearchV2SortOptions,
} from '@/lib/recruiter-resume-search-v2';

function formatCandidateName(item) {
  if (item.normalizedName) return item.normalizedName;
  return `Candidate ${String(item.candidateId || item.documentId || '').slice(-6) || 'profile'}`;
}

function formatDate(value) {
  if (!value) return 'Not shared';
  try {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(value));
  } catch {
    return 'Not shared';
  }
}

function formatParsingConfidence(value) {
  if (!Number.isFinite(value)) return 'Not shared';
  return `${Math.round(Number(value) * 100)}%`;
}

function cloneFilters(filters = {}) {
  return {
    ...filters,
    currentLocation: [...(filters.currentLocation || [])],
    preferredLocation: [...(filters.preferredLocation || [])],
    currentEmployer: [...(filters.currentEmployer || [])],
    excludedCompanies: [...(filters.excludedCompanies || [])],
    industry: [...(filters.industry || [])],
    currentTitle: [...(filters.currentTitle || [])],
    previousTitles: [...(filters.previousTitles || [])],
    skills: [...(filters.skills || [])],
    education: [...(filters.education || [])],
    availability: [...(filters.availability || [])],
    parsingReviewStatus: [...(filters.parsingReviewStatus || [])],
    resumeSource: [...(filters.resumeSource || [])],
  };
}

function csvValue(items = []) {
  return Array.isArray(items) ? items.join(', ') : '';
}

function parseCsvInput(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.replace(/\s+/gu, ' ').trim())
    .filter(Boolean);
}

function toDateInputValue(value) {
  return typeof value === 'string' && value.includes('T') ? value.slice(0, 10) : '';
}

function toDateStart(value) {
  return value ? `${value}T00:00:00.000Z` : undefined;
}

function toDateEnd(value) {
  return value ? `${value}T23:59:59.999Z` : undefined;
}

function clearFilters() {
  return buildInitialResumeSearchV2State({}).filters;
}

function useMediaQuery(query) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const mediaQuery = window.matchMedia(query);
    const apply = () => setMatches(mediaQuery.matches);
    apply();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', apply);
      return () => mediaQuery.removeEventListener('change', apply);
    }

    mediaQuery.addListener(apply);
    return () => mediaQuery.removeListener(apply);
  }, [query]);

  return matches;
}

function SearchModeSummary({ summary }) {
  return (
    <Card className="rounded-[28px] border-[var(--color-border-strong)] bg-[linear-gradient(180deg,rgba(79,156,249,0.08),rgba(255,255,255,0.96))]">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-[var(--color-primary-soft)] p-2 text-[var(--color-primary)]">
          <Sparkles size={18} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">Search logic</h2>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            Results must match every required keyword. Optional keywords improve relevance. Excluded keywords remove matching candidates.
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <div className="rounded-[20px] border border-[var(--color-border)] bg-white/90 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-primary)]">Required</p>
          <p className="mt-2 text-sm text-[var(--color-text)]">{summary.required.length ? summary.required.join(' AND ') : 'None'}</p>
        </div>
        <div className="rounded-[20px] border border-[var(--color-border)] bg-white/90 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">Optional</p>
          <p className="mt-2 text-sm text-[var(--color-text)]">{summary.optional.length ? summary.optional.join(', ') : 'None'}</p>
        </div>
        <div className="rounded-[20px] border border-[var(--color-border)] bg-white/90 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-danger)]">Excluded</p>
          <p className="mt-2 text-sm text-[var(--color-text)]">{summary.excluded.length ? summary.excluded.join(', ') : 'None'}</p>
        </div>
      </div>
    </Card>
  );
}

function SearchChip({ item, phrase = false, onModeChange, onRemove }) {
  const isRequired = item.mode === 'MUST';
  const isExcluded = item.mode === 'MUST_NOT';

  return (
    <div className={`inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-2 text-sm ${isExcluded ? 'border-rose-200 bg-rose-50 text-rose-800' : isRequired ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]' : 'border-[var(--color-border)] bg-white text-[var(--color-text)]'}`}>
      {phrase ? <Quote size={14} aria-hidden="true" /> : null}
      <span className="truncate font-medium">{phrase ? `"${item.term}"` : item.term}</span>
      {phrase ? <Badge tone="neutral">Phrase</Badge> : null}
      {isRequired ? <Badge tone="brand">Required</Badge> : null}
      {isExcluded ? <Badge tone="danger">Excluded</Badge> : null}
      <Tooltip content={isRequired ? 'Candidate must match this keyword' : 'Click to require this keyword'}>
        <button
          type="button"
          aria-label={isRequired ? 'Required keyword' : 'Optional keyword'}
          aria-pressed={isRequired}
          onClick={() => onModeChange(isRequired ? 'SHOULD' : 'MUST')}
          className={`inline-flex h-8 w-8 items-center justify-center rounded-full border ${isRequired ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white' : 'border-[var(--color-border)] bg-white text-[var(--color-text-secondary)]'}`}
        >
          {isRequired ? <Star size={15} aria-hidden="true" /> : <StarOff size={15} aria-hidden="true" />}
        </button>
      </Tooltip>
      <DropdownMenu
        trigger={(
          <button type="button" className="inline-flex h-8 items-center rounded-full border border-[var(--color-border)] px-3 text-xs font-semibold text-[var(--color-text-secondary)]">
            Actions
          </button>
        )}
        items={[
          {
            label: isExcluded ? 'Restore optional' : 'Exclude keyword',
            icon: CircleX,
            onSelect: () => onModeChange(isExcluded ? 'SHOULD' : 'MUST_NOT'),
          },
          {
            label: 'Remove',
            icon: X,
            onSelect: onRemove,
          },
        ]}
      />
    </div>
  );
}

function SearchChipsInput({
  label,
  value,
  onChange,
  onSubmit,
  placeholder,
}) {
  return (
    <div className="grid gap-2">
      <label className="text-sm font-semibold text-[var(--color-text)]">{label}</label>
      <div className="flex gap-3">
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',') {
              event.preventDefault();
              onSubmit();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={onSubmit}>Add</Button>
      </div>
    </div>
  );
}

function FilterGroup({ title, description, children }) {
  return (
    <Card className="rounded-[24px] p-4">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-[var(--color-text)]">{title}</h3>
        {description ? <p className="mt-1 text-xs text-[var(--color-text-muted)]">{description}</p> : null}
      </div>
      <div className="grid gap-4">{children}</div>
    </Card>
  );
}

function ResultCard({ item, selected, onSelect, compactLayout = false }) {
  const highlights = sanitizeResumeSearchV2Highlights(item.highlights);
  return (
    <Card className={`rounded-[28px] p-5 transition ${selected ? 'border-[var(--color-primary)] shadow-[var(--shadow-lg)]' : ''}`}>
      <button type="button" onClick={onSelect} className="w-full text-left">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold text-[var(--color-text)]">{formatCandidateName(item)}</h3>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{item.currentTitle || 'Current title not shared'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {item.reviewRequired ? <Badge tone="warning">Review required</Badge> : null}
            {Number.isFinite(item.score) ? <Badge tone="brand">Relevance {Math.round(item.score)}</Badge> : null}
          </div>
        </div>

        <div className="mt-4 grid gap-2 text-sm text-[var(--color-text-secondary)] md:grid-cols-2">
          <p>{formatExperienceMonths(item.totalExperienceMonths)}</p>
          <p>{item.currentEmployer || 'Current employer not shared'}</p>
          <p>{item.currentLocation || 'Location not shared'}</p>
          <p>Resume updated {formatDate(item.resumeUpdatedAt)}</p>
        </div>

        {item.normalizedSkills?.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {item.normalizedSkills.slice(0, 8).map((skill) => <Badge key={skill} tone="neutral">{skill}</Badge>)}
          </div>
        ) : null}

        {item.explanations?.length ? (
          <div className="mt-4 space-y-2">
            {item.explanations.slice(0, 3).map((explanation, index) => (
              <p key={`${explanation.field}-${index}`} className="text-sm text-[var(--color-text)]">{explanation.text}</p>
            ))}
          </div>
        ) : null}

        {highlights.length ? (
          <div className="mt-4 space-y-2">
            {highlights.slice(0, 2).map((highlight) => (
              <div key={highlight.field} className="rounded-[18px] bg-[var(--color-bg-muted)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">
                <span className="font-semibold text-[var(--color-text)]">{highlight.field}: </span>
                {highlight.snippets[0]}
              </div>
            ))}
          </div>
        ) : null}
      </button>
      {compactLayout ? (
        <div className="mt-4 flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={onSelect}>Preview</Button>
        </div>
      ) : null}
    </Card>
  );
}

function PreviewPanel({ item }) {
  if (!item) {
    return (
      <Card className="sticky top-24 rounded-[28px]">
        <h2 className="text-lg font-semibold text-[var(--color-text)]">Candidate preview</h2>
        <p className="mt-3 text-sm text-[var(--color-text-muted)]">Select a recruiter-safe result to inspect match explanations, sanitized highlights, and searchable profile details.</p>
      </Card>
    );
  }

  const highlights = sanitizeResumeSearchV2Highlights(item.highlights);

  return (
    <div className="sticky top-24 space-y-4">
      <Card className="rounded-[28px]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-[var(--color-text)]">{formatCandidateName(item)}</h2>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{item.currentTitle || 'Current title not shared'}</p>
          </div>
          {item.reviewRequired ? <Badge tone="warning">Review required</Badge> : <Badge tone="success">Ready</Badge>}
        </div>
        <div className="mt-4 grid gap-2 text-sm text-[var(--color-text-secondary)]">
          <p>Employer: {item.currentEmployer || 'Not shared'}</p>
          <p>Location: {item.currentLocation || 'Not shared'}</p>
          <p>Experience: {formatExperienceMonths(item.totalExperienceMonths)}</p>
          <p>Parsing confidence: {formatParsingConfidence(item.parsingConfidence)}</p>
          <p>Profile updated: {formatDate(item.profileUpdatedAt)}</p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {(item.normalizedSkills || []).map((skill) => <Badge key={skill} tone="neutral">{skill}</Badge>)}
        </div>
        <div className="mt-5 flex gap-3">
          <Button as={Link} href={`/recruiter/database/${item.candidateId}`} variant="outline">View profile</Button>
        </div>
      </Card>

      <Card className="rounded-[28px]">
        <h3 className="text-lg font-semibold text-[var(--color-text)]">Why this candidate?</h3>
        {item.explanations?.length ? (
          <div className="mt-4 space-y-3">
            {item.explanations.map((explanation, index) => (
              <div key={`${explanation.field}-${index}`} className="rounded-[18px] border border-[var(--color-border)] px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">{explanation.field}</p>
                <p className="mt-2 text-sm text-[var(--color-text)]">{explanation.text}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-[var(--color-text-muted)]">No match explanations were returned for this result.</p>
        )}
      </Card>

      <Card className="rounded-[28px]">
        <h3 className="text-lg font-semibold text-[var(--color-text)]">Safe highlights</h3>
        {highlights.length ? (
          <div className="mt-4 space-y-3">
            {highlights.map((highlight) => (
              <div key={highlight.field} className="rounded-[18px] border border-[var(--color-border)] px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">{highlight.field}</p>
                {highlight.snippets.map((snippet) => (
                  <p key={snippet} className="mt-2 text-sm text-[var(--color-text-secondary)]">{snippet}</p>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-[var(--color-text-muted)]">No highlights available for this result.</p>
        )}
      </Card>

      {(item.educationSummary || item.certifications?.length) ? (
        <Card className="rounded-[28px]">
          <h3 className="text-lg font-semibold text-[var(--color-text)]">Education and certifications</h3>
          {item.educationSummary ? <p className="mt-4 text-sm text-[var(--color-text-secondary)]">{item.educationSummary}</p> : null}
          {item.certifications?.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {item.certifications.map((certification) => <Badge key={certification} tone="neutral">{certification}</Badge>)}
            </div>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}

async function requestResumeSearchV2(payload, signal) {
  const response = await fetch('/api/recruiter/resume-search/v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
    signal,
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.success === false) {
    const error = new Error(body?.message || 'Request failed.');
    error.statusCode = response.status;
    error.details = body?.details;
    throw error;
  }

  // The API returns { success, data: [...items], meta } - data and meta
  // are siblings, not nested - but resumeSearchV2ResponseSchema expects
  // { items, meta }.
  return parseResumeSearchV2Response({ items: body?.data, meta: body?.meta });
}

export function RecruiterResumeSearchV2Page({
  initialState,
  featureEnabled,
  canRead,
  canExecute,
  canUseSalaryFilters = false,
  view = 'criteria',
}) {
  const router = useRouter();
  const { push } = useToast();
  const hydrated = useMemo(() => sanitizeResumeSearchV2State(initialState, { includeSalary: canUseSalaryFilters }), [initialState, canUseSalaryFilters]);
  const [searchState, setSearchState] = useState(() => hydrated.state);
  const [appliedState, setAppliedState] = useState(() => hydrated.state);
  const [keywordInput, setKeywordInput] = useState('');
  const [results, setResults] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);
  const [requestValidationError, setRequestValidationError] = useState(hydrated.errors[0] || '');
  const activeRequestIdRef = useRef(0);
  const controllerRef = useRef(null);
  const requestKeyRef = useRef('');
  const mobileFiltersTriggerRef = useRef(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const compactLayout = useMediaQuery('(max-width: 1279px)');

  // Adjusting state during render (not in an effect) whenever URL hydration
  // produces a new `hydrated` value (e.g. navigating with different query
  // params), so the criteria form and applied search reset in the same
  // commit instead of an effect-driven extra render. See:
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prevHydrated, setPrevHydrated] = useState(hydrated);
  if (hydrated !== prevHydrated) {
    setPrevHydrated(hydrated);
    setSearchState(hydrated.state);
    setAppliedState(hydrated.state);
    setRequestValidationError(hydrated.errors[0] || '');
  }

  // Shared with the search-execution effect below so the validity check
  // only runs once per (appliedState, canUseSalaryFilters) pair.
  const appliedValidation = useMemo(
    () => sanitizeResumeSearchV2State(appliedState, { includeSalary: canUseSalaryFilters }),
    [appliedState, canUseSalaryFilters],
  );

  // Same render-time adjustment for when the applied search transitions
  // (view === 'results'): clear stale results for an invalid state, or
  // flip the loading indicator on for a valid one - both immediately,
  // rather than in the effect body. The search-execution effect itself
  // only performs the actual fetch when appliedValidation.ok is true, so
  // this stays the single place that reacts to a genuine transition.
  const [prevSearchTrigger, setPrevSearchTrigger] = useState({ appliedState, canUseSalaryFilters, view });
  if (
    appliedState !== prevSearchTrigger.appliedState
    || canUseSalaryFilters !== prevSearchTrigger.canUseSalaryFilters
    || view !== prevSearchTrigger.view
  ) {
    setPrevSearchTrigger({ appliedState, canUseSalaryFilters, view });
    if (view === 'results') {
      if (!appliedValidation.ok) {
        setResults([]);
        setMeta(null);
        setSelectedCandidateId(null);
        setRequestValidationError(appliedValidation.errors[0] || 'Invalid search configuration.');
      } else {
        setLoading(true);
        setErrorMessage('');
        setRequestValidationError('');
      }
    }
  }

  useEffect(() => {
    if (view !== 'results') {
      return undefined;
    }
    if (!appliedValidation.ok) {
      return undefined;
    }

    const { state } = appliedValidation;
    const requestId = activeRequestIdRef.current + 1;
    activeRequestIdRef.current = requestId;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    requestKeyRef.current = buildResumeSearchV2RequestKey(state);
    requestResumeSearchV2(state, controller.signal)
      .then((response) => {
        if (activeRequestIdRef.current !== requestId) return;
        setResults(response.items);
        setMeta(response.meta);
        setSelectedCandidateId((current) => current && response.items.some((item) => item.candidateId === current)
          ? current
          : response.items[0]?.candidateId || null);
      })
      .catch((error) => {
        if (controller.signal.aborted || activeRequestIdRef.current !== requestId) return;
        const message = mapResumeSearchV2Error(error);
        setResults([]);
        setMeta(null);
        setSelectedCandidateId(null);
        setErrorMessage(message);
        if (error.statusCode === 409) {
          const resetState = { ...state, cursor: null };
          setAppliedState(resetState);
          const params = buildResumeSearchV2UrlParams(resetState, { includeSalary: canUseSalaryFilters });
          router.replace(`/recruiter/database/results?${params.toString()}`);
          push({ tone: 'warning', title: 'Cursor expired', description: 'The next page cursor expired. The search has been reset to the first page.' });
        }
      })
      .finally(() => {
        if (activeRequestIdRef.current === requestId) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [appliedValidation, canUseSalaryFilters, router, push, view]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const selectedItem = useMemo(
    () => results.find((item) => item.candidateId === selectedCandidateId) || results[0] || null,
    [results, selectedCandidateId],
  );
  const summary = useMemo(
    () => formatResumeSearchV2Summary({ keywords: searchState.keywords, phrases: searchState.phrases }),
    [searchState.keywords, searchState.phrases],
  );
  const activeFilterCount = useMemo(
    () => countActiveResumeSearchV2Filters(searchState.filters, { includeSalary: canUseSalaryFilters }),
    [searchState.filters, canUseSalaryFilters],
  );

  function patchState(updater) {
    controllerRef.current?.abort();
    setSearchState((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      return {
        ...next,
        cursor: null,
      };
    });
  }

  function addKeywordChips() {
    const nextItems = splitKeywordInputToChips(keywordInput);
    if (!nextItems.length) return;
    patchState((current) => ({
      ...current,
      keywords: [
        ...current.keywords,
        ...nextItems.filter((item) => item.kind !== 'phrase').map(({ term, mode }) => ({ term, mode })),
      ],
      phrases: [
        ...current.phrases,
        ...nextItems.filter((item) => item.kind === 'phrase').map(({ term, mode }) => ({ term, mode })),
      ],
    }));
    setKeywordInput('');
  }

  function updateChip(kind, index, mode) {
    patchState((current) => {
      const items = [...current[kind]];
      items[index] = { ...items[index], mode };
      return { ...current, [kind]: items };
    });
  }

  function removeChip(kind, index) {
    patchState((current) => ({
      ...current,
      [kind]: current[kind].filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  function updateArrayFilter(field, value) {
    patchState((current) => ({
      ...current,
      filters: {
        ...cloneFilters(current.filters),
        [field]: parseCsvInput(value),
      },
    }));
  }

  function updateFilter(field, value) {
    patchState((current) => ({
      ...current,
      filters: {
        ...cloneFilters(current.filters),
        [field]: value,
      },
    }));
  }

  function runSearch() {
    const sanitized = sanitizeResumeSearchV2State(searchState, { includeSalary: canUseSalaryFilters });
    if (!sanitized.ok) {
      setRequestValidationError(sanitized.errors[0] || 'Invalid recruiter search request.');
      return;
    }

    const nextState = { ...sanitized.state, cursor: null };
    const nextRequestKey = buildResumeSearchV2RequestKey(nextState);
    if (loading && nextRequestKey === requestKeyRef.current) {
      return;
    }

    setRequestValidationError('');
    const params = buildResumeSearchV2UrlParams(nextState, { includeSalary: canUseSalaryFilters });
    if (view === 'results') {
      setAppliedState(nextState);
      router.replace(`/recruiter/database/results?${params.toString()}`);
    } else {
      router.push(`/recruiter/database/results?${params.toString()}`);
    }
  }

  function goToNextPage() {
    if (!meta?.nextCursor || loading) return;
    setAppliedState((current) => ({ ...current, cursor: meta.nextCursor }));
  }

  const filtersContent = (
    <div className="space-y-4">
      <FilterGroup title="Experience and dates" description="Range filters are deterministic and always server-side validated.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <Input label="Minimum experience (months)" type="number" value={searchState.filters.minExperienceMonths ?? ''} onChange={(event) => updateFilter('minExperienceMonths', event.target.value === '' ? undefined : Number(event.target.value))} />
          <Input label="Maximum experience (months)" type="number" value={searchState.filters.maxExperienceMonths ?? ''} onChange={(event) => updateFilter('maxExperienceMonths', event.target.value === '' ? undefined : Number(event.target.value))} />
        </div>
        <div className="grid gap-3">
          <Input label="Updated from" type="date" value={toDateInputValue(searchState.filters.lastUpdatedFrom)} onChange={(event) => updateFilter('lastUpdatedFrom', toDateStart(event.target.value))} />
          <Input label="Updated to" type="date" value={toDateInputValue(searchState.filters.lastUpdatedTo)} onChange={(event) => updateFilter('lastUpdatedTo', toDateEnd(event.target.value))} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <Input label="Profile completeness min" type="number" value={searchState.filters.profileCompletenessMin ?? ''} onChange={(event) => updateFilter('profileCompletenessMin', event.target.value === '' ? undefined : Number(event.target.value))} />
          <Input label="Profile completeness max" type="number" value={searchState.filters.profileCompletenessMax ?? ''} onChange={(event) => updateFilter('profileCompletenessMax', event.target.value === '' ? undefined : Number(event.target.value))} />
        </div>
      </FilterGroup>

      <FilterGroup title="Locations and employers" description="Comma-separated structured filters keep the frontend out of raw Boolean query building.">
        <Input label="Current location" value={csvValue(searchState.filters.currentLocation)} onChange={(event) => updateArrayFilter('currentLocation', event.target.value)} />
        <Input label="Preferred location" value={csvValue(searchState.filters.preferredLocation)} onChange={(event) => updateArrayFilter('preferredLocation', event.target.value)} />
        <Input label="Current employer" value={csvValue(searchState.filters.currentEmployer)} onChange={(event) => updateArrayFilter('currentEmployer', event.target.value)} />
        <Input label="Excluded employers" value={csvValue(searchState.filters.excludedCompanies)} onChange={(event) => updateArrayFilter('excludedCompanies', event.target.value)} />
        <Input label="Industry" value={csvValue(searchState.filters.industry)} onChange={(event) => updateArrayFilter('industry', event.target.value)} />
      </FilterGroup>

      <FilterGroup title="Titles and professional details" description="Previous-title filters stay separate from current title filters.">
        <Input label="Current title" value={csvValue(searchState.filters.currentTitle)} onChange={(event) => updateArrayFilter('currentTitle', event.target.value)} />
        <Input label="Previous titles" value={csvValue(searchState.filters.previousTitles)} onChange={(event) => updateArrayFilter('previousTitles', event.target.value)} />
        <label className="grid gap-2">
          <span className="text-sm font-semibold text-[var(--color-text)]">Previous-title match mode</span>
          <select
            value={searchState.filters.previousTitlesMatchMode}
            onChange={(event) => updateFilter('previousTitlesMatchMode', event.target.value)}
            className="min-h-11 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--color-text)]"
          >
            <option value="ANY">ANY</option>
            <option value="ALL">ALL</option>
          </select>
        </label>
        <Input label="Skills" value={csvValue(searchState.filters.skills)} onChange={(event) => updateArrayFilter('skills', event.target.value)} />
        <Input label="Education" value={csvValue(searchState.filters.education)} onChange={(event) => updateArrayFilter('education', event.target.value)} />
      </FilterGroup>

      <FilterGroup title="Availability and status" description="Salary controls remain hidden unless the current user is explicitly authorized.">
        <Input label="Notice period max (days)" type="number" value={searchState.filters.noticePeriodDaysMax ?? ''} onChange={(event) => updateFilter('noticePeriodDaysMax', event.target.value === '' ? undefined : Number(event.target.value))} />
        <Input label="Availability" value={csvValue(searchState.filters.availability)} onChange={(event) => updateArrayFilter('availability', event.target.value)} />
        <Input label="Parsing and review status" value={csvValue(searchState.filters.parsingReviewStatus)} onChange={(event) => updateArrayFilter('parsingReviewStatus', event.target.value)} placeholder="READY, REVIEW_REQUIRED" />
        <Input label="Resume source" value={csvValue(searchState.filters.resumeSource)} onChange={(event) => updateArrayFilter('resumeSource', event.target.value)} />
        <label className="flex items-center gap-3 text-sm text-[var(--color-text)]">
          <input
            type="checkbox"
            checked={Boolean(searchState.filters.searchableProfile)}
            onChange={(event) => updateFilter('searchableProfile', event.target.checked)}
            className="h-4 w-4 rounded border-[var(--color-border-strong)] accent-[var(--color-primary)]"
          />
          Searchable profiles only
        </label>
        {canUseSalaryFilters ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <Input label="Salary min" type="number" value={searchState.filters.salaryMin ?? ''} onChange={(event) => updateFilter('salaryMin', event.target.value === '' ? undefined : Number(event.target.value))} />
            <Input label="Salary max" type="number" value={searchState.filters.salaryMax ?? ''} onChange={(event) => updateFilter('salaryMax', event.target.value === '' ? undefined : Number(event.target.value))} />
          </div>
        ) : (
          <Badge tone="neutral">Salary filters hidden for this user</Badge>
        )}
      </FilterGroup>

      <div className="flex gap-3">
        <Button variant="outline" onClick={() => patchState((current) => ({ ...current, filters: clearFilters() }))}>Clear filters</Button>
      </div>
    </div>
  );

  if (!featureEnabled) {
    return (
      <Card>
        <EmptyState icon={ShieldCheck} title="Resume Search V2 is disabled" description="The recruiter Resume Search V2 interface is hidden in this environment because the rollout flag is off." />
      </Card>
    );
  }

  if (!canRead) {
    return (
      <Card>
        <EmptyState icon={ShieldCheck} title="You do not have access to Resume Search V2" description="A recruiter with search permissions can review the central resume database here." />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-[32px] border-[var(--color-border-strong)] bg-[linear-gradient(135deg,rgba(79,156,249,0.08),rgba(255,255,255,0.98))]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-primary)]">Resume Search V2</p>
            <h1 className="mt-2 text-3xl font-semibold text-[var(--color-text)]">Deterministic recruiter search with required, optional, and excluded concepts</h1>
            <p className="mt-3 text-sm leading-7 text-[var(--color-text-secondary)]">
              Build keyword chips, structured filters, and recruiter-safe resume results without exposing contact or salary data from the search index.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="brand">Controlled rollout</Badge>
            <Badge tone="neutral">Legacy search preserved</Badge>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          <SearchChipsInput
            label="Keywords and phrases"
            value={keywordInput}
            onChange={setKeywordInput}
            onSubmit={addKeywordChips}
            placeholder='Type `IT`, `Sales`, or "Business HR Partner", then press Enter'
          />
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-[var(--color-text)]">Sort results</span>
            <select
              value={searchState.sort}
              onChange={(event) => patchState((current) => ({ ...current, sort: event.target.value }))}
              className="min-h-11 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--color-text)]"
            >
              {resumeSearchV2SortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </div>

        {(searchState.keywords.length || searchState.phrases.length) ? (
          <div className="mt-5 flex flex-wrap gap-3">
            {searchState.keywords.map((item, index) => (
              <SearchChip
                key={`keyword-${item.mode}-${item.term}-${index}`}
                item={item}
                onModeChange={(mode) => updateChip('keywords', index, mode)}
                onRemove={() => removeChip('keywords', index)}
              />
            ))}
            {searchState.phrases.map((item, index) => (
              <SearchChip
                key={`phrase-${item.mode}-${item.term}-${index}`}
                item={item}
                phrase
                onModeChange={(mode) => updateChip('phrases', index, mode)}
                onRemove={() => removeChip('phrases', index)}
              />
            ))}
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button onClick={runSearch} disabled={!canExecute} leadingIcon={Search}>Search candidates</Button>
          <Button variant="outline" onClick={() => {
            setSearchState(buildInitialResumeSearchV2State({}));
            setKeywordInput('');
            setResults([]);
            setMeta(null);
            setSelectedCandidateId(null);
            setErrorMessage('');
            setRequestValidationError('');
            if (view === 'results') router.push('/recruiter/database');
          }}
          >
            Clear search
          </Button>
          <Badge tone="neutral">{activeFilterCount} active filters</Badge>
          {compactLayout ? (
            <Button
              ref={mobileFiltersTriggerRef}
              type="button"
              variant="outline"
              leadingIcon={Filter}
              onClick={() => setMobileFiltersOpen(true)}
              aria-label={`Open filters, ${activeFilterCount} active`}
            >
              Filters ({activeFilterCount})
            </Button>
          ) : null}
        </div>

        {requestValidationError ? (
          <p role="alert" className="mt-4 text-sm text-[var(--color-danger)]">{requestValidationError}</p>
        ) : null}
      </Card>

      <SearchModeSummary summary={summary} />

      <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)_340px]">
        <div className="hidden space-y-4 xl:block">{filtersContent}</div>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div aria-live="polite" className="text-sm text-[var(--color-text-secondary)]">
              {loading
                ? 'Loading recruiter-safe resume results.'
                : meta
                  ? `${meta.totalValue}+ results`
                  : 'Run a search to review results.'}
            </div>
            {meta?.indexSchemaVersion ? <Badge tone="neutral">{meta.indexSchemaVersion}</Badge> : null}
          </div>

          {errorMessage ? (
            <Card>
              <EmptyState icon={AlertTriangle} title="Search unavailable" description={errorMessage} />
            </Card>
          ) : null}

          {!errorMessage && !loading && !results.length && view === 'results' ? (
            <Card>
              <EmptyState icon={Search} title="No candidates matched" description="Adjust the required, optional, or excluded concepts and try again." />
            </Card>
          ) : null}

          {!errorMessage && !loading && !results.length && view !== 'results' ? (
            <Card>
              <EmptyState icon={Search} title="Build your search" description="Add recruiter keywords, phrases, and structured filters, then run the V2 search." />
            </Card>
          ) : null}

          {loading ? (
            <Card className="flex min-h-60 items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-[var(--color-text-secondary)]">
                <LoaderCircle className="animate-spin" size={18} aria-hidden="true" />
                Running Resume Search V2
              </div>
            </Card>
          ) : null}

          {!loading && results.length ? (
            <div className="space-y-4">
              {results.map((item) => (
                <ResultCard
                  key={item.documentId}
                  item={item}
                  selected={item.candidateId === selectedItem?.candidateId}
                  compactLayout={compactLayout}
                  onSelect={() => {
                    setSelectedCandidateId(item.candidateId);
                    if (compactLayout) {
                      setMobilePreviewOpen(true);
                    }
                  }}
                />
              ))}
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {meta?.nextCursor ? 'More results are available.' : 'You have reached the end of the current result set.'}
                </p>
                <Button variant="outline" onClick={goToNextPage} disabled={!meta?.nextCursor || loading} trailingIcon={ArrowRight}>
                  Next results
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="hidden xl:block">
          <PreviewPanel item={selectedItem} />
        </div>
      </div>

      <Sheet
        open={compactLayout && mobileFiltersOpen}
        onClose={() => setMobileFiltersOpen(false)}
        title="Search filters"
        description="Adjust structured recruiter filters for Resume Search V2."
        side="right"
        restoreFocusRef={mobileFiltersTriggerRef}
      >
        {filtersContent}
      </Sheet>

      <Sheet
        open={compactLayout && mobilePreviewOpen}
        onClose={() => setMobilePreviewOpen(false)}
        title={selectedItem ? formatCandidateName(selectedItem) : 'Candidate preview'}
        description="Recruiter-safe profile preview."
        side="bottom"
        className="max-h-[88dvh]"
      >
        <PreviewPanel item={selectedItem} />
      </Sheet>
    </div>
  );
}
