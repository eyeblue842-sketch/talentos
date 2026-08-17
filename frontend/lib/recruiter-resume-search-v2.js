import {
  resumeSearchV2RequestSchema,
  resumeSearchV2ResponseSchema,
} from '@careeriz/shared';

const DEFAULT_PAGE_SIZE = 25;
const DEFAULT_SORT = 'RELEVANCE';
const CHIP_MODES = new Set(['MUST', 'SHOULD', 'MUST_NOT']);
const PREVIOUS_TITLE_MATCH_MODES = new Set(['ANY', 'ALL']);
const RECRUITER_SAFE_HIGHLIGHT_FIELDS = new Set([
  'normalizedSkills',
  'currentTitle',
  'previousTitles',
  'employmentHistoryText',
  'projectsText',
  'certifications',
]);

function normalizeWhitespace(value) {
  return String(value || '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function splitCsv(value) {
  return String(value || '')
    .split(',')
    .map((item) => normalizeWhitespace(item))
    .filter(Boolean);
}

function parseNumber(value, fallback = undefined) {
  if (value == null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function normalizeChipTerm(value) {
  return normalizeWhitespace(value).replace(/^["']|["']$/g, '');
}

function dedupeByModeAndTerm(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    const normalizedTerm = normalizeChipTerm(item?.term || '');
    const mode = CHIP_MODES.has(item?.mode) ? item.mode : 'SHOULD';
    const key = `${mode}:${normalizedTerm.toLowerCase()}`;
    if (!normalizedTerm || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  }).map((item) => ({
    term: normalizeChipTerm(item.term),
    mode: CHIP_MODES.has(item.mode) ? item.mode : 'SHOULD',
  }));
}

function coerceChipArray(rawItems = [], defaultMode = 'SHOULD') {
  return dedupeByModeAndTerm(
    rawItems
      .filter(Boolean)
      .map((item) => {
        if (typeof item === 'string') {
          return { term: item, mode: defaultMode };
        }
        return {
          term: item?.term,
          mode: item?.mode || defaultMode,
        };
      }),
  );
}

function encodeChipParam(item) {
  return `${item.mode}:${item.term}`;
}

function decodeChipParam(value) {
  const text = String(value || '');
  const separatorIndex = text.indexOf(':');
  if (separatorIndex <= 0) return null;
  const mode = text.slice(0, separatorIndex);
  const term = text.slice(separatorIndex + 1);
  if (!CHIP_MODES.has(mode)) return null;
  const normalizedTerm = normalizeChipTerm(term);
  if (!normalizedTerm) return null;
  return { mode, term: normalizedTerm };
}

function encodeArrayFilter(items = []) {
  return items.map((item) => normalizeWhitespace(item)).filter(Boolean).join(',');
}

function normalizeArrayFilter(items = []) {
  return [...new Set(
    items
      .map((item) => normalizeWhitespace(item))
      .filter(Boolean),
  )];
}

function toIsoDateStart(value) {
  if (!value) return undefined;
  const normalized = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return undefined;
  return `${normalized}T00:00:00.000Z`;
}

function toIsoDateEnd(value) {
  if (!value) return undefined;
  const normalized = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return undefined;
  return `${normalized}T23:59:59.999Z`;
}

function fromIsoDate(value) {
  if (!value) return '';
  const text = String(value);
  return /^\d{4}-\d{2}-\d{2}T/.test(text) ? text.slice(0, 10) : '';
}

export const resumeSearchV2SortOptions = [
  { value: 'RELEVANCE', label: 'Relevance' },
  { value: 'EXPERIENCE_DESC', label: 'Experience high to low' },
  { value: 'EXPERIENCE_ASC', label: 'Experience low to high' },
  { value: 'PROFILE_UPDATED_AT_DESC', label: 'Profile recently updated' },
  { value: 'RESUME_UPDATED_AT_DESC', label: 'Resume recently updated' },
];

export function buildInitialResumeSearchV2State(searchParams = {}) {
  const rawKeywords = Array.isArray(searchParams.kw)
    ? searchParams.kw
    : typeof searchParams.kw === 'string'
      ? [searchParams.kw]
      : [];
  const rawPhrases = Array.isArray(searchParams.ph)
    ? searchParams.ph
    : typeof searchParams.ph === 'string'
      ? [searchParams.ph]
      : [];

  return {
    keywords: coerceChipArray(rawKeywords.map(decodeChipParam).filter(Boolean)),
    phrases: coerceChipArray(rawPhrases.map(decodeChipParam).filter(Boolean)),
    sort: typeof searchParams.sort === 'string' ? searchParams.sort : DEFAULT_SORT,
    pageSize: parseNumber(searchParams.pageSize, DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE,
    cursor: null,
    filters: {
      minExperienceMonths: parseNumber(searchParams.expMin),
      maxExperienceMonths: parseNumber(searchParams.expMax),
      currentLocation: normalizeArrayFilter(splitCsv(searchParams.currentLocation)),
      preferredLocation: normalizeArrayFilter(splitCsv(searchParams.preferredLocation)),
      currentEmployer: normalizeArrayFilter(splitCsv(searchParams.currentEmployer)),
      excludedCompanies: normalizeArrayFilter(splitCsv(searchParams.excludedCompanies)),
      industry: normalizeArrayFilter(splitCsv(searchParams.industry)),
      currentTitle: normalizeArrayFilter(splitCsv(searchParams.currentTitle)),
      previousTitles: normalizeArrayFilter(splitCsv(searchParams.previousTitles)),
      previousTitlesMatchMode: PREVIOUS_TITLE_MATCH_MODES.has(searchParams.previousTitlesMode) ? searchParams.previousTitlesMode : 'ANY',
      skills: normalizeArrayFilter(splitCsv(searchParams.skills)),
      education: normalizeArrayFilter(splitCsv(searchParams.education)),
      noticePeriodDaysMax: parseNumber(searchParams.noticeMax),
      lastUpdatedFrom: toIsoDateStart(searchParams.updatedFrom),
      lastUpdatedTo: toIsoDateEnd(searchParams.updatedTo),
      profileCompletenessMin: parseNumber(searchParams.profileCompletenessMin),
      profileCompletenessMax: parseNumber(searchParams.profileCompletenessMax),
      availability: normalizeArrayFilter(splitCsv(searchParams.availability)),
      parsingReviewStatus: normalizeArrayFilter(splitCsv(searchParams.reviewStatus)),
      resumeSource: normalizeArrayFilter(splitCsv(searchParams.resumeSource)),
      searchableProfile: typeof searchParams.searchableProfile === 'string'
        ? parseBoolean(searchParams.searchableProfile)
        : undefined,
      salaryMin: parseNumber(searchParams.salaryMin),
      salaryMax: parseNumber(searchParams.salaryMax),
      salaryAuthorized: typeof searchParams.salaryAuthorized === 'string'
        ? parseBoolean(searchParams.salaryAuthorized)
        : undefined,
    },
  };
}

export function sanitizeResumeSearchV2State(rawState = {}, options = {}) {
  const includeSalary = Boolean(options.includeSalary);
  const input = {
    keywords: coerceChipArray(rawState.keywords),
    phrases: coerceChipArray(rawState.phrases),
    sort: rawState.sort || DEFAULT_SORT,
    pageSize: parseNumber(rawState.pageSize, DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE,
    cursor: typeof rawState.cursor === 'string' && rawState.cursor.trim() ? rawState.cursor.trim() : null,
    includeHighlights: true,
    includeExplain: false,
    filters: {
      minExperienceMonths: parseNumber(rawState.filters?.minExperienceMonths),
      maxExperienceMonths: parseNumber(rawState.filters?.maxExperienceMonths),
      currentLocation: normalizeArrayFilter(rawState.filters?.currentLocation || []),
      preferredLocation: normalizeArrayFilter(rawState.filters?.preferredLocation || []),
      currentEmployer: normalizeArrayFilter(rawState.filters?.currentEmployer || []),
      excludedCompanies: normalizeArrayFilter(rawState.filters?.excludedCompanies || []),
      industry: normalizeArrayFilter(rawState.filters?.industry || []),
      currentTitle: normalizeArrayFilter(rawState.filters?.currentTitle || []),
      previousTitles: normalizeArrayFilter(rawState.filters?.previousTitles || []),
      previousTitlesMatchMode: PREVIOUS_TITLE_MATCH_MODES.has(rawState.filters?.previousTitlesMatchMode) ? rawState.filters.previousTitlesMatchMode : 'ANY',
      skills: normalizeArrayFilter(rawState.filters?.skills || []),
      education: normalizeArrayFilter(rawState.filters?.education || []),
      noticePeriodDaysMax: parseNumber(rawState.filters?.noticePeriodDaysMax),
      lastUpdatedFrom: rawState.filters?.lastUpdatedFrom || undefined,
      lastUpdatedTo: rawState.filters?.lastUpdatedTo || undefined,
      profileCompletenessMin: parseNumber(rawState.filters?.profileCompletenessMin),
      profileCompletenessMax: parseNumber(rawState.filters?.profileCompletenessMax),
      availability: normalizeArrayFilter(rawState.filters?.availability || []),
      parsingReviewStatus: normalizeArrayFilter(rawState.filters?.parsingReviewStatus || []),
      resumeSource: normalizeArrayFilter(rawState.filters?.resumeSource || []),
      searchableProfile: typeof rawState.filters?.searchableProfile === 'boolean'
        ? rawState.filters.searchableProfile
        : undefined,
      salaryMin: includeSalary ? parseNumber(rawState.filters?.salaryMin) : undefined,
      salaryMax: includeSalary ? parseNumber(rawState.filters?.salaryMax) : undefined,
      salaryAuthorized: includeSalary ? true : undefined,
    },
  };

  const parsed = resumeSearchV2RequestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      state: buildInitialResumeSearchV2State({}),
      errors: parsed.error.issues.map((issue) => issue.message),
    };
  }

  return {
    ok: true,
    state: parsed.data,
    errors: [],
  };
}

export function buildResumeSearchV2UrlParams(rawState = {}, options = {}) {
  const { ok, state } = sanitizeResumeSearchV2State(rawState, options);
  const safeState = ok ? state : buildInitialResumeSearchV2State({});
  const params = new URLSearchParams();

  safeState.keywords.forEach((item) => params.append('kw', encodeChipParam(item)));
  safeState.phrases.forEach((item) => params.append('ph', encodeChipParam(item)));
  if (safeState.sort !== DEFAULT_SORT) params.set('sort', safeState.sort);
  if (safeState.pageSize !== DEFAULT_PAGE_SIZE) params.set('pageSize', String(safeState.pageSize));

  const { filters } = safeState;
  if (filters.minExperienceMonths != null) params.set('expMin', String(filters.minExperienceMonths));
  if (filters.maxExperienceMonths != null) params.set('expMax', String(filters.maxExperienceMonths));
  if (filters.currentLocation.length) params.set('currentLocation', encodeArrayFilter(filters.currentLocation));
  if (filters.preferredLocation.length) params.set('preferredLocation', encodeArrayFilter(filters.preferredLocation));
  if (filters.currentEmployer.length) params.set('currentEmployer', encodeArrayFilter(filters.currentEmployer));
  if (filters.excludedCompanies.length) params.set('excludedCompanies', encodeArrayFilter(filters.excludedCompanies));
  if (filters.industry.length) params.set('industry', encodeArrayFilter(filters.industry));
  if (filters.currentTitle.length) params.set('currentTitle', encodeArrayFilter(filters.currentTitle));
  if (filters.previousTitles.length) params.set('previousTitles', encodeArrayFilter(filters.previousTitles));
  if (filters.previousTitlesMatchMode !== 'ANY') params.set('previousTitlesMode', filters.previousTitlesMatchMode);
  if (filters.skills.length) params.set('skills', encodeArrayFilter(filters.skills));
  if (filters.education.length) params.set('education', encodeArrayFilter(filters.education));
  if (filters.noticePeriodDaysMax != null) params.set('noticeMax', String(filters.noticePeriodDaysMax));
  if (filters.lastUpdatedFrom) params.set('updatedFrom', fromIsoDate(filters.lastUpdatedFrom));
  if (filters.lastUpdatedTo) params.set('updatedTo', fromIsoDate(filters.lastUpdatedTo));
  if (filters.profileCompletenessMin != null) params.set('profileCompletenessMin', String(filters.profileCompletenessMin));
  if (filters.profileCompletenessMax != null) params.set('profileCompletenessMax', String(filters.profileCompletenessMax));
  if (filters.availability.length) params.set('availability', encodeArrayFilter(filters.availability));
  if (filters.parsingReviewStatus.length) params.set('reviewStatus', encodeArrayFilter(filters.parsingReviewStatus));
  if (filters.resumeSource.length) params.set('resumeSource', encodeArrayFilter(filters.resumeSource));
  if (typeof filters.searchableProfile === 'boolean') params.set('searchableProfile', String(filters.searchableProfile));
  if (options.includeSalary && filters.salaryMin != null) params.set('salaryMin', String(filters.salaryMin));
  if (options.includeSalary && filters.salaryMax != null) params.set('salaryMax', String(filters.salaryMax));

  return params;
}

export function parseResumeSearchV2Response(payload) {
  return resumeSearchV2ResponseSchema.parse(payload);
}

export function buildResumeSearchV2RequestKey(state = {}) {
  const payload = {
    keywords: state.keywords || [],
    phrases: state.phrases || [],
    filters: state.filters || {},
    sort: state.sort || DEFAULT_SORT,
    pageSize: state.pageSize || DEFAULT_PAGE_SIZE,
    cursor: state.cursor || null,
  };
  return JSON.stringify(payload);
}

export function mapResumeSearchV2Error(error) {
  const status = error?.statusCode || error?.status || 500;
  if (status === 400) return 'The recruiter search request is invalid. Review the keywords, phrases, or filters.';
  if (status === 401) return 'Your session expired. Sign in again to continue.';
  if (status === 403) return 'You do not have access to Resume Search V2 in this workspace.';
  if (status === 409) return 'This cursor is no longer valid for the current search. Run the search again.';
  if (status === 422) return 'The search request could not be validated.';
  if ([502, 503].includes(status)) return 'Resume Search V2 is temporarily unavailable. Try again shortly.';
  return error?.message || 'Resume Search V2 could not be completed.';
}

export function createResumeSearchV2Chip(rawTerm, { phrase = false, mode = 'SHOULD' } = {}) {
  const normalizedTerm = normalizeChipTerm(rawTerm);
  if (!normalizedTerm) {
    return null;
  }
  return {
    term: normalizedTerm,
    mode: CHIP_MODES.has(mode) ? mode : 'SHOULD',
    kind: phrase ? 'phrase' : 'keyword',
  };
}

export function splitKeywordInputToChips(rawValue) {
  const value = String(rawValue || '');
  const chips = [];
  let current = '';
  let quote = null;

  for (const char of value) {
    if ((char === '"' || char === '\'') && !quote) {
      quote = char;
      current += char;
      continue;
    }

    if (quote && char === quote) {
      current += char;
      quote = null;
      continue;
    }

    if (!quote && (char === ',' || char === '\n')) {
      const trimmed = current.trim();
      if (trimmed) chips.push(trimmed);
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim()) chips.push(current.trim());

  return chips.map((item) => {
    const normalized = normalizeWhitespace(item);
    const isPhrase = /^".+"$|^'.+'$/u.test(normalized);
    return createResumeSearchV2Chip(normalized, { phrase: isPhrase });
  }).filter(Boolean);
}

export function formatResumeSearchV2Summary({ keywords = [], phrases = [] } = {}) {
  const formatGroup = (items, withQuotes = false) => items.map((item) => withQuotes ? `"${item.term}"` : item.term);

  return {
    required: [
      ...formatGroup(keywords.filter((item) => item.mode === 'MUST')),
      ...formatGroup(phrases.filter((item) => item.mode === 'MUST'), true),
    ],
    optional: [
      ...formatGroup(keywords.filter((item) => item.mode === 'SHOULD')),
      ...formatGroup(phrases.filter((item) => item.mode === 'SHOULD'), true),
    ],
    excluded: [
      ...formatGroup(keywords.filter((item) => item.mode === 'MUST_NOT')),
      ...formatGroup(phrases.filter((item) => item.mode === 'MUST_NOT'), true),
    ],
  };
}

export function countActiveResumeSearchV2Filters(filters = {}, { includeSalary = false } = {}) {
  let count = 0;
  const incrementIf = (condition) => {
    if (condition) count += 1;
  };

  incrementIf(filters.minExperienceMonths != null);
  incrementIf(filters.maxExperienceMonths != null);
  incrementIf(filters.currentLocation?.length);
  incrementIf(filters.preferredLocation?.length);
  incrementIf(filters.currentEmployer?.length);
  incrementIf(filters.excludedCompanies?.length);
  incrementIf(filters.industry?.length);
  incrementIf(filters.currentTitle?.length);
  incrementIf(filters.previousTitles?.length);
  incrementIf(filters.skills?.length);
  incrementIf(filters.education?.length);
  incrementIf(filters.noticePeriodDaysMax != null);
  incrementIf(filters.lastUpdatedFrom);
  incrementIf(filters.lastUpdatedTo);
  incrementIf(filters.profileCompletenessMin != null);
  incrementIf(filters.profileCompletenessMax != null);
  incrementIf(filters.availability?.length);
  incrementIf(filters.parsingReviewStatus?.length);
  incrementIf(filters.resumeSource?.length);
  incrementIf(typeof filters.searchableProfile === 'boolean');
  if (includeSalary) {
    incrementIf(filters.salaryMin != null);
    incrementIf(filters.salaryMax != null);
  }
  return count;
}

export function sanitizeResumeSearchV2Highlights(highlights = []) {
  return (Array.isArray(highlights) ? highlights : [])
    .filter((item) => RECRUITER_SAFE_HIGHLIGHT_FIELDS.has(item?.field))
    .map((item) => ({
      field: item.field,
      snippets: (item.snippets || []).map((snippet) => String(snippet || '').replace(/[<>]/g, '')).filter(Boolean),
    }))
    .filter((item) => item.snippets.length);
}

export function formatExperienceMonths(months) {
  if (!Number.isFinite(months)) return 'Experience not shared';
  const years = Math.floor(months / 12);
  const remainderMonths = months % 12;
  if (!years) return `${remainderMonths} month${remainderMonths === 1 ? '' : 's'}`;
  if (!remainderMonths) return `${years} year${years === 1 ? '' : 's'}`;
  return `${years} year${years === 1 ? '' : 's'} ${remainderMonths} month${remainderMonths === 1 ? '' : 's'}`;
}
