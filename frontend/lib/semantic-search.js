import {
  savedCandidateSearchResponseSchema,
  semanticSearchHistoryResponseSchema,
  semanticSearchResponseSchema,
  semanticSearchSuggestionResponseSchema,
} from '@careeriz/shared';

export const SEMANTIC_SEARCH_TERMINAL_STATUSES = new Set([
  'READY',
  'FAILED',
  'PARTIAL',
  'DISABLED',
]);

export const semanticSearchModes = [
  { value: 'HYBRID', label: 'Hybrid' },
  { value: 'SEMANTIC', label: 'Natural Language' },
  { value: 'BOOLEAN', label: 'Boolean' },
  { value: 'KEYWORD', label: 'Keyword' },
];

const statusMeta = {
  READY: {
    label: 'Results ready',
    tone: 'success',
    description: 'Search results are ready to review.',
  },
  PENDING: {
    label: 'Search in progress',
    tone: 'info',
    description: 'Search execution is still running.',
  },
  FAILED: {
    label: 'Search failed',
    tone: 'danger',
    description: 'The last search execution did not complete successfully.',
  },
  PARTIAL: {
    label: 'Partial results',
    tone: 'warning',
    description: 'Some results were returned, but the execution completed with warnings.',
  },
  DISABLED: {
    label: 'Provider disabled',
    tone: 'neutral',
    description: 'Semantic search is disabled in this environment.',
  },
};

function parseNumber(value) {
  if (value == null || value === '') return '';
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : '';
}

function parseBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function splitCsv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseSemanticSearchResponse(payload) {
  return semanticSearchResponseSchema.parse(payload);
}

export function parseSemanticSearchHistoryResponse(payload) {
  return semanticSearchHistoryResponseSchema.parse(payload);
}

export function parseSemanticSearchSuggestionsResponse(payload) {
  return semanticSearchSuggestionResponseSchema.parse(payload);
}

export function parseSavedCandidateSearchList(payload) {
  return Array.isArray(payload) ? payload.map((item) => savedCandidateSearchResponseSchema.parse(item)) : [];
}

export function getSemanticSearchStatusMeta(status) {
  return statusMeta[status] || {
    label: 'Unknown status',
    tone: 'neutral',
    description: status ? `Unrecognized semantic search status: ${status}` : 'Semantic search status is unavailable.',
  };
}

export function mapSemanticSearchError(error) {
  const status = error?.statusCode || error?.status || 500;
  if (status === 400) return 'The search request is invalid. Review the query and filters.';
  if (status === 401) return 'Your session expired. Sign in again to continue.';
  if (status === 403) return 'You do not have access to recruiter semantic search in this workspace.';
  if (status === 404) return 'The requested search resource was not found.';
  if (status === 409) return 'This search request could not be completed in the current state.';
  if (status === 413) return 'The current request is too large. Reduce the query or filters and try again.';
  if (status === 429) return 'Semantic search is temporarily rate limited. Try again shortly.';
  if ([502, 503].includes(status)) return 'Semantic search is temporarily unavailable. Try again shortly.';
  return error?.message || 'Semantic search could not be completed.';
}

export function formatSemanticSearchDate(value) {
  if (!value) return 'Not available';
  try {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(value));
  } catch {
    return 'Not available';
  }
}

export function formatSemanticSearchScore(value, suffix = '%') {
  if (!Number.isFinite(value)) return 'Not available';
  return `${Math.round(Number(value))}${suffix}`;
}

export function formatSemanticSearchConfidence(value) {
  if (!Number.isFinite(value)) return 'Not available';
  return `${Math.round(Number(value) * 100)}%`;
}

export function getResultCandidateName(item) {
  return item?.candidate?.fullName || `Candidate ${String(item?.candidate?.id || '').slice(-6) || 'profile'}`;
}

export function getResultCandidateTitle(item) {
  return item?.candidate?.headline || 'Candidate profile';
}

export function getSemanticSearchSupportReference(result) {
  return [
    result?.execution?.queryId ? `Query ${result.execution.queryId}` : null,
    result?.execution?.executionId ? `Execution ${result.execution.executionId}` : null,
  ]
    .filter(Boolean)
    .join(' | ');
}

export function buildInitialSemanticSearchState(searchParams = {}) {
  return {
    query: typeof searchParams.q === 'string' ? searchParams.q : '',
    mode: typeof searchParams.mode === 'string' ? searchParams.mode : 'HYBRID',
    jobId: typeof searchParams.jobId === 'string' ? searchParams.jobId : '',
    location: typeof searchParams.location === 'string' ? searchParams.location : '',
    workMode: typeof searchParams.workMode === 'string' ? searchParams.workMode : '',
    employmentType: typeof searchParams.employmentType === 'string' ? searchParams.employmentType : '',
    education: typeof searchParams.education === 'string' ? searchParams.education : '',
    currentEmployer: typeof searchParams.currentEmployer === 'string' ? searchParams.currentEmployer : '',
    previousEmployer: typeof searchParams.previousEmployer === 'string' ? searchParams.previousEmployer : '',
    requiredSkills: typeof searchParams.requiredSkills === 'string' ? searchParams.requiredSkills : '',
    optionalSkills: typeof searchParams.optionalSkills === 'string' ? searchParams.optionalSkills : '',
    minExperience: parseNumber(searchParams.minExperience),
    maxExperience: parseNumber(searchParams.maxExperience),
    salaryMin: parseNumber(searchParams.salaryMin),
    salaryMax: parseNumber(searchParams.salaryMax),
    noticePeriodDaysMax: parseNumber(searchParams.noticePeriodDaysMax),
    expansionEnabled: parseBoolean(searchParams.expansionEnabled, true),
    transferableSkillsEnabled: parseBoolean(searchParams.transferableSkillsEnabled, true),
    includeMatch: parseBoolean(searchParams.includeMatch, Boolean(searchParams.jobId)),
    highConfidenceOnly: parseBoolean(searchParams.highConfidenceOnly, false),
    candidateName: typeof searchParams.candidateName === 'string' ? searchParams.candidateName : '',
  };
}

export function hasSearchInputs(state) {
  return Boolean(
    String(state?.query || '').trim()
    || String(state?.jobId || '').trim(),
  );
}

export function buildSemanticSearchPayload(state, page = 1, pageSize = 12) {
  return {
    query: String(state.query || '').trim(),
    mode: state.mode || 'HYBRID',
    jobId: state.jobId || undefined,
    page,
    pageSize,
    includeMatch: Boolean(state.includeMatch),
    expansionEnabled: Boolean(state.expansionEnabled),
    transferableSkillsEnabled: Boolean(state.transferableSkillsEnabled),
    filters: {
      minExperience: state.minExperience === '' ? undefined : Number(state.minExperience),
      maxExperience: state.maxExperience === '' ? undefined : Number(state.maxExperience),
      location: state.location || undefined,
      workMode: state.workMode || undefined,
      employmentType: state.employmentType || undefined,
      noticePeriodDaysMax: state.noticePeriodDaysMax === '' ? undefined : Number(state.noticePeriodDaysMax),
      salaryMin: state.salaryMin === '' ? undefined : Number(state.salaryMin),
      salaryMax: state.salaryMax === '' ? undefined : Number(state.salaryMax),
      currentEmployer: state.currentEmployer || undefined,
      previousEmployer: state.previousEmployer || undefined,
      education: state.education || undefined,
      requiredSkills: splitCsv(state.requiredSkills),
      optionalSkills: splitCsv(state.optionalSkills),
    },
  };
}

export function buildSemanticSearchUrlParams(state) {
  const params = new URLSearchParams();
  if (String(state.query || '').trim()) params.set('q', String(state.query).trim());
  if (state.mode && state.mode !== 'HYBRID') params.set('mode', state.mode);
  if (state.jobId) params.set('jobId', state.jobId);
  if (state.location) params.set('location', state.location);
  if (state.workMode) params.set('workMode', state.workMode);
  if (state.employmentType) params.set('employmentType', state.employmentType);
  if (state.education) params.set('education', state.education);
  if (state.currentEmployer) params.set('currentEmployer', state.currentEmployer);
  if (state.previousEmployer) params.set('previousEmployer', state.previousEmployer);
  if (state.requiredSkills) params.set('requiredSkills', state.requiredSkills);
  if (state.optionalSkills) params.set('optionalSkills', state.optionalSkills);
  if (state.minExperience !== '') params.set('minExperience', String(state.minExperience));
  if (state.maxExperience !== '') params.set('maxExperience', String(state.maxExperience));
  if (state.salaryMin !== '') params.set('salaryMin', String(state.salaryMin));
  if (state.salaryMax !== '') params.set('salaryMax', String(state.salaryMax));
  if (state.noticePeriodDaysMax !== '') params.set('noticePeriodDaysMax', String(state.noticePeriodDaysMax));
  if (!state.expansionEnabled) params.set('expansionEnabled', 'false');
  if (!state.transferableSkillsEnabled) params.set('transferableSkillsEnabled', 'false');
  if (state.includeMatch) params.set('includeMatch', 'true');
  if (state.highConfidenceOnly) params.set('highConfidenceOnly', 'true');
  if (state.candidateName) params.set('candidateName', state.candidateName);
  return params;
}

export function shouldDisplayResult(item, state) {
  if (!item) return false;
  if (state.highConfidenceOnly && (item.match?.confidence?.score || 0) < 0.75) return false;
  if (state.candidateName) {
    const name = getResultCandidateName(item).toLowerCase();
    if (!name.includes(String(state.candidateName).trim().toLowerCase())) return false;
  }
  return true;
}

export function buildSearchPreviewSummary(item) {
  return {
    retrievalScore: item?.retrieval?.score ?? item?.retrievalScore ?? null,
    matchScore: item?.match?.effectiveScore ?? item?.match?.generatedScore ?? item?.candidate?.matchScore ?? null,
    recommendation: item?.match?.recommendation || null,
    confidence: item?.match?.confidence?.score ?? null,
  };
}
