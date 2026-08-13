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
  const locations = typeof searchParams.locations === 'string'
    ? searchParams.locations.split(',').map((item) => item.trim()).filter(Boolean)
    : [];
  return {
    deferSearch: parseBoolean(searchParams.reviewFilters, false),
    page: parseNumber(searchParams.page) || 1,
    query: typeof searchParams.q === 'string' ? searchParams.q : '',
    mode: typeof searchParams.mode === 'string' ? searchParams.mode : 'HYBRID',
    jobId: typeof searchParams.jobId === 'string' ? searchParams.jobId : '',
    location: typeof searchParams.location === 'string' ? searchParams.location : '',
    locations,
    preferredLocations: typeof searchParams.preferredLocations === 'string' ? searchParams.preferredLocations.split(',').map((item) => item.trim()).filter(Boolean) : [],
    includeWillingToRelocate: parseBoolean(searchParams.includeWillingToRelocate, false),
    workMode: typeof searchParams.workMode === 'string' ? searchParams.workMode : '',
    employmentType: typeof searchParams.employmentType === 'string' ? searchParams.employmentType : '',
    workAuthorization: typeof searchParams.workAuthorization === 'string' ? searchParams.workAuthorization : '',
    education: typeof searchParams.education === 'string' ? searchParams.education : '',
    currentEmployer: typeof searchParams.currentEmployer === 'string' ? searchParams.currentEmployer : '',
    currentDesignation: typeof searchParams.currentDesignation === 'string' ? searchParams.currentDesignation : '',
    previousEmployer: typeof searchParams.previousEmployer === 'string' ? searchParams.previousEmployer : '',
    companyScope: typeof searchParams.companyScope === 'string' ? searchParams.companyScope : 'current',
    designationScope: typeof searchParams.designationScope === 'string' ? searchParams.designationScope : 'current',
    educationFilters: typeof searchParams.educationFilters === 'string'
      ? (() => { try { return JSON.parse(searchParams.educationFilters); } catch { return null; } })()
      : null,
    resumeAttachment: typeof searchParams.resumeAttachment === 'string' ? searchParams.resumeAttachment : '',
    emailVerified: parseBoolean(searchParams.emailVerified, false),
    profileRecency: typeof searchParams.profileRecency === 'string' ? searchParams.profileRecency : 'ALL',
    profileRecencyDays: parseNumber(searchParams.profileRecencyDays),
    jobTypes: typeof searchParams.jobTypes === 'string' ? splitCsv(searchParams.jobTypes) : [],
    employmentTypes: typeof searchParams.employmentTypes === 'string' ? splitCsv(searchParams.employmentTypes) : [],
    workPermitCountries: typeof searchParams.workPermitCountries === 'string' ? splitCsv(searchParams.workPermitCountries) : [],
    displayCandidateType: typeof searchParams.displayCandidateType === 'string' ? searchParams.displayCandidateType : 'ALL',
    activeWithin: parseNumber(searchParams.activeWithin),
    industries: typeof searchParams.industries === 'string' ? splitCsv(searchParams.industries) : [],
    sortBy: typeof searchParams.sortBy === 'string' ? searchParams.sortBy : 'relevance',
    pageSize: parseNumber(searchParams.pageSize) || 20,
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
  const hasNumber = (value) => value !== '' && value !== null && value !== undefined;
  return Boolean(
    String(state?.query || '').trim()
    || String(state?.jobId || '').trim()
    || String(state?.location || '').trim()
    || String(state?.requiredSkills || '').trim()
    || String(state?.optionalSkills || '').trim()
    || String(state?.currentEmployer || '').trim()
    || String(state?.previousEmployer || '').trim()
    || String(state?.education || '').trim()
    || (state?.locations || []).length
    || (state?.preferredLocations || []).length
    || Boolean(state?.educationFilters?.ug || state?.educationFilters?.pg || state?.educationFilters?.ppg)
    || Boolean(state?.resumeAttachment || state?.emailVerified || state?.profileRecency !== 'ALL')
    || Boolean(state?.jobTypes?.length || state?.employmentTypes?.length || state?.workPermitCountries?.length)
    || Boolean(state?.displayCandidateType && state.displayCandidateType !== 'ALL')
    || Boolean(state?.industries?.length)
    || hasNumber(state?.activeWithin)
    || hasNumber(state?.minExperience)
    || hasNumber(state?.maxExperience)
    || hasNumber(state?.salaryMin)
    || hasNumber(state?.salaryMax)
    || hasNumber(state?.noticePeriodDaysMax),
  );
}

export function buildSemanticSearchPayload(state, page = 1, pageSize = 12) {
  const effectivePageSize = Number(state.pageSize) || pageSize;
  return {
    query: String(state.query || '').trim(),
    mode: state.mode || 'HYBRID',
    jobId: state.jobId || undefined,
    page,
    pageSize: effectivePageSize,
    includeMatch: Boolean(state.includeMatch),
    expansionEnabled: Boolean(state.expansionEnabled),
    transferableSkillsEnabled: Boolean(state.transferableSkillsEnabled),
    filters: {
      minExperience: state.minExperience === '' ? undefined : Number(state.minExperience),
      maxExperience: state.maxExperience === '' ? undefined : Number(state.maxExperience),
      location: state.location || undefined,
      locations: Array.isArray(state.locations) && state.locations.length ? state.locations : undefined,
      preferredLocations: Array.isArray(state.preferredLocations) && state.preferredLocations.length ? state.preferredLocations : undefined,
      includeWillingToRelocate: Boolean(state.includeWillingToRelocate) || undefined,
      workMode: state.workMode || undefined,
      employmentType: state.employmentType || undefined,
      workAuthorization: state.workAuthorization || undefined,
      noticePeriodDaysMax: state.noticePeriodDaysMax === '' ? undefined : Number(state.noticePeriodDaysMax),
      salaryMin: state.salaryMin === '' ? undefined : Number(state.salaryMin),
      salaryMax: state.salaryMax === '' ? undefined : Number(state.salaryMax),
      currentEmployer: state.currentEmployer || undefined,
      role: state.currentDesignation || undefined,
      previousEmployer: state.previousEmployer || undefined,
      companyScope: state.companyScope || undefined,
      designation: state.currentDesignation || undefined,
      designationScope: state.designationScope || undefined,
      education: state.education || undefined,
      educationFilters: state.educationFilters || undefined,
      resumeAttachment: state.resumeAttachment || undefined,
      emailVerified: Boolean(state.emailVerified) || undefined,
      profileRecency: state.profileRecency && state.profileRecency !== 'ALL' ? state.profileRecency : undefined,
      profileRecencyDays: state.profileRecencyDays === '' ? undefined : Number(state.profileRecencyDays),
      jobTypes: state.jobTypes?.length ? state.jobTypes : undefined,
      employmentTypes: state.employmentTypes?.length ? state.employmentTypes : undefined,
      workPermitCountries: state.workPermitCountries?.length ? state.workPermitCountries : undefined,
      displayCandidateType: state.displayCandidateType && state.displayCandidateType !== 'ALL' ? state.displayCandidateType : undefined,
      activeWithin: state.activeWithin === '' ? undefined : Number(state.activeWithin),
      industry: state.industries?.length ? state.industries.join(', ') : undefined,
      sortBy: state.sortBy || 'relevance',
      requiredSkills: splitCsv(state.requiredSkills),
      optionalSkills: splitCsv(state.optionalSkills),
    },
  };
}

export function buildSemanticSearchUrlParams(state) {
  const params = new URLSearchParams();
  if (state.deferSearch) params.set('reviewFilters', 'true');
  if (String(state.query || '').trim()) params.set('q', String(state.query).trim());
  if (state.mode && state.mode !== 'HYBRID') params.set('mode', state.mode);
  if (state.jobId) params.set('jobId', state.jobId);
  if (state.location) params.set('location', state.location);
  if (Array.isArray(state.locations) && state.locations.length) params.set('locations', state.locations.join(','));
  if (Array.isArray(state.preferredLocations) && state.preferredLocations.length) params.set('preferredLocations', state.preferredLocations.join(','));
  if (state.includeWillingToRelocate) params.set('includeWillingToRelocate', 'true');
  if (state.workMode) params.set('workMode', state.workMode);
  if (state.employmentType) params.set('employmentType', state.employmentType);
  if (state.workAuthorization) params.set('workAuthorization', state.workAuthorization);
  if (state.education) params.set('education', state.education);
  if (state.educationFilters) params.set('educationFilters', JSON.stringify(state.educationFilters));
  if (state.currentEmployer) params.set('currentEmployer', state.currentEmployer);
  if (state.currentDesignation) params.set('currentDesignation', state.currentDesignation);
  if (state.previousEmployer) params.set('previousEmployer', state.previousEmployer);
  if (state.companyScope && state.companyScope !== 'current') params.set('companyScope', state.companyScope);
  if (state.designationScope && state.designationScope !== 'current') params.set('designationScope', state.designationScope);
  if (state.requiredSkills) params.set('requiredSkills', state.requiredSkills);
  if (state.optionalSkills) params.set('optionalSkills', state.optionalSkills);
  if (state.minExperience !== '') params.set('minExperience', String(state.minExperience));
  if (state.maxExperience !== '') params.set('maxExperience', String(state.maxExperience));
  if (state.salaryMin !== '') params.set('salaryMin', String(state.salaryMin));
  if (state.salaryMax !== '') params.set('salaryMax', String(state.salaryMax));
  if (state.noticePeriodDaysMax !== '') params.set('noticePeriodDaysMax', String(state.noticePeriodDaysMax));
  if (state.resumeAttachment) params.set('resumeAttachment', state.resumeAttachment);
  if (state.emailVerified) params.set('emailVerified', 'true');
  if (state.profileRecency && state.profileRecency !== 'ALL') params.set('profileRecency', state.profileRecency);
  if (state.profileRecencyDays !== '' && state.profileRecencyDays != null) params.set('profileRecencyDays', String(state.profileRecencyDays));
  if (state.jobTypes?.length) params.set('jobTypes', state.jobTypes.join(','));
  if (state.employmentTypes?.length) params.set('employmentTypes', state.employmentTypes.join(','));
  if (state.workPermitCountries?.length) params.set('workPermitCountries', state.workPermitCountries.join(','));
  if (state.displayCandidateType && state.displayCandidateType !== 'ALL') params.set('displayCandidateType', state.displayCandidateType);
  if (state.activeWithin !== '' && state.activeWithin != null) params.set('activeWithin', String(state.activeWithin));
  if (state.industries?.length) params.set('industries', state.industries.join(','));
  if (state.page && Number(state.page) > 1) params.set('page', String(state.page));
  if (state.sortBy && state.sortBy !== 'relevance') params.set('sortBy', state.sortBy);
  if (state.pageSize) params.set('pageSize', String(state.pageSize));
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

export function applySavedSearchToState(savedSearch, currentState) {
  return {
    ...currentState,
    deferSearch: false,
    query: savedSearch.rawQuery || '',
    mode: savedSearch.searchMode || currentState.mode,
    jobId: savedSearch.jobContextId || '',
    currentEmployer: savedSearch.filtersJson?.currentEmployer || '',
    currentDesignation: savedSearch.filtersJson?.role || '',
    previousEmployer: savedSearch.filtersJson?.previousEmployer || '',
    location: savedSearch.filtersJson?.location || '',
    locations: savedSearch.filtersJson?.locations || [],
    preferredLocations: savedSearch.filtersJson?.preferredLocations || [],
    includeWillingToRelocate: Boolean(savedSearch.filtersJson?.includeWillingToRelocate),
    workMode: savedSearch.filtersJson?.workMode || '',
    employmentType: savedSearch.filtersJson?.employmentType || '',
    workAuthorization: savedSearch.filtersJson?.workAuthorization || '',
    education: savedSearch.filtersJson?.education || '',
    requiredSkills: (savedSearch.filtersJson?.requiredSkills || []).join(', '),
    optionalSkills: (savedSearch.filtersJson?.optionalSkills || []).join(', '),
    minExperience: savedSearch.filtersJson?.minExperience ?? '',
    maxExperience: savedSearch.filtersJson?.maxExperience ?? '',
    salaryMin: savedSearch.filtersJson?.salaryMin ?? '',
    salaryMax: savedSearch.filtersJson?.salaryMax ?? '',
    noticePeriodDaysMax: savedSearch.filtersJson?.noticePeriodDaysMax ?? '',
    companyScope: savedSearch.filtersJson?.companyScope || 'current',
    designationScope: savedSearch.filtersJson?.designationScope || 'current',
    educationFilters: savedSearch.filtersJson?.educationFilters || null,
    resumeAttachment: savedSearch.filtersJson?.resumeAttachment || '',
    emailVerified: Boolean(savedSearch.filtersJson?.emailVerified),
    profileRecency: savedSearch.filtersJson?.profileRecency || 'ALL',
    profileRecencyDays: savedSearch.filtersJson?.profileRecencyDays ?? '',
    jobTypes: savedSearch.filtersJson?.jobTypes || [],
    employmentTypes: savedSearch.filtersJson?.employmentTypes || [],
    workPermitCountries: savedSearch.filtersJson?.workPermitCountries || [],
    displayCandidateType: savedSearch.filtersJson?.displayCandidateType || 'ALL',
    activeWithin: savedSearch.filtersJson?.activeWithin ?? '',
    industries: savedSearch.filtersJson?.industry
      ? String(savedSearch.filtersJson.industry).split(',').map((item) => item.trim()).filter(Boolean)
      : (currentState.industries || []),
  };
}

export function applyHistoryToState(entry, currentState) {
  const query = entry.query || {};
  return {
    ...currentState,
    deferSearch: false,
    query: entry.rawQuery || entry.normalizedQuery || query.query || query.keyword || '',
    mode: entry.searchMode || query.mode || currentState.mode,
    jobId: entry.jobContextId || query.jobId || '',
    currentEmployer: query.currentEmployer || currentState.currentEmployer,
    currentDesignation: query.currentDesignation || query.designation || query.role || currentState.currentDesignation,
    previousEmployer: query.previousEmployer || currentState.previousEmployer,
    locations: query.locations || currentState.locations,
    preferredLocations: query.preferredLocations || currentState.preferredLocations,
    includeWillingToRelocate: Boolean(query.includeWillingToRelocate || currentState.includeWillingToRelocate),
    workMode: query.workMode || currentState.workMode,
    employmentType: query.employmentType || currentState.employmentType,
    workAuthorization: query.workAuthorization || currentState.workAuthorization,
    education: query.education || currentState.education,
    requiredSkills: Array.isArray(query.requiredSkills) ? query.requiredSkills.join(', ') : (query.requiredSkills || currentState.requiredSkills),
    optionalSkills: Array.isArray(query.optionalSkills) ? query.optionalSkills.join(', ') : (query.optionalSkills || currentState.optionalSkills),
    minExperience: query.minExperience ?? currentState.minExperience,
    maxExperience: query.maxExperience ?? currentState.maxExperience,
    salaryMin: query.salaryMin ?? currentState.salaryMin,
    salaryMax: query.salaryMax ?? currentState.salaryMax,
    noticePeriodDaysMax: query.noticePeriodDaysMax ?? currentState.noticePeriodDaysMax,
    companyScope: query.companyScope || currentState.companyScope,
    designationScope: query.designationScope || currentState.designationScope,
    educationFilters: query.educationFilters || currentState.educationFilters,
    jobTypes: query.jobTypes || currentState.jobTypes,
    employmentTypes: query.employmentTypes || currentState.employmentTypes,
    workPermitCountries: query.workPermitCountries || currentState.workPermitCountries,
    displayCandidateType: query.displayCandidateType || currentState.displayCandidateType,
    activeWithin: query.activeWithin ?? currentState.activeWithin,
    profileRecency: query.profileRecency || currentState.profileRecency,
    profileRecencyDays: query.profileRecencyDays ?? currentState.profileRecencyDays,
    emailVerified: Boolean(query.emailVerified ?? currentState.emailVerified),
    resumeAttachment: query.resumeAttachment || currentState.resumeAttachment,
    industries: query.industry
      ? String(query.industry).split(',').map((item) => item.trim()).filter(Boolean)
      : (currentState.industries || []),
  };
}

export function buildAiInterpretedState(parsed, currentState) {
  const semantic = parsed?.parsedQuery || {};
  const semanticFilters = semantic?.filters || {};
  const requiredSkills = semanticFilters.requiredSkills?.length
    ? semanticFilters.requiredSkills
    : parsed?.skills || [];

  return {
    ...currentState,
    deferSearch: false,
    query: semantic.originalQuery || parsed?.keyword || parsed?.query || currentState.query,
    mode: semantic.mode || currentState.mode,
    location: parsed?.location || currentState.location,
    locations: parsed?.location
      ? [parsed.location]
      : (semanticFilters.locations?.length ? semanticFilters.locations : currentState.locations),
    education: parsed?.education || currentState.education,
    requiredSkills: requiredSkills.join(', '),
    optionalSkills: (semanticFilters.optionalSkills || []).join(', '),
    minExperience: parsed?.minExperience ?? currentState.minExperience,
    maxExperience: parsed?.maxExperience ?? currentState.maxExperience,
    noticePeriodDaysMax: semanticFilters.noticePeriodDaysMax ?? currentState.noticePeriodDaysMax,
    preferredLocations: semanticFilters.preferredLocations?.length ? semanticFilters.preferredLocations : currentState.preferredLocations,
    includeWillingToRelocate: Boolean(semanticFilters.includeWillingToRelocate || currentState.includeWillingToRelocate),
    educationFilters: semanticFilters.educationFilters || currentState.educationFilters,
    companyScope: semanticFilters.companyScope || currentState.companyScope,
    designationScope: semanticFilters.designationScope || currentState.designationScope,
    resumeAttachment: semanticFilters.resumeAttachment || currentState.resumeAttachment,
    emailVerified: Boolean(semanticFilters.emailVerified || currentState.emailVerified),
    profileRecency: semanticFilters.profileRecency || currentState.profileRecency,
    profileRecencyDays: semanticFilters.profileRecencyDays ?? currentState.profileRecencyDays,
    jobTypes: semanticFilters.jobTypes?.length ? semanticFilters.jobTypes : currentState.jobTypes,
    employmentTypes: semanticFilters.employmentTypes?.length ? semanticFilters.employmentTypes : currentState.employmentTypes,
    workPermitCountries: semanticFilters.workPermitCountries?.length ? semanticFilters.workPermitCountries : currentState.workPermitCountries,
    displayCandidateType: semanticFilters.displayCandidateType || currentState.displayCandidateType,
    activeWithin: semanticFilters.activeWithin ?? currentState.activeWithin,
    candidateName: parsed?.currentTitle || currentState.candidateName,
  };
}
