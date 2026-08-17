import crypto from 'crypto';
import { resumeSearchV2RequestSchema } from '@careeriz/shared';
import { buildConceptVariants, getSearchFields } from './synonyms.js';

const HIGHLIGHT_FIELDS = [
  'normalizedSkills',
  'currentTitle',
  'previousTitles',
  'employmentHistoryText',
  'projectsText',
  'certifications',
];

function stableStringify(value) {
  if (value == null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function nonEmptyStrings(values = []) {
  return [...new Set((Array.isArray(values) ? values : [values]).map((value) => String(value || '').trim()).filter(Boolean))];
}

function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildShouldClausesForTerm(term) {
  const concept = buildConceptVariants(term);
  const fields = getSearchFields(concept.fieldMode);
  const should = [];

  for (const variant of concept.variants) {
    const normalizedVariant = variant.trim().toLowerCase();
    const isShortAbbreviationVariant = Boolean(
      concept.ambiguousAbbreviation
      && ['it', 'hr', 'bd', 'c'].includes(normalizedVariant),
    );

    if (concept.exactOnly || concept.ambiguousAbbreviation || concept.punctuationSensitive) {
      should.push({
        term: {
          'normalizedSkills.raw': {
            value: variant.toLowerCase(),
            boost: 10,
          },
        },
      });
      should.push({
        term: {
          'currentTitle.raw': {
            value: variant.toLowerCase(),
            boost: 7,
          },
        },
      });
      if (concept.ambiguousAbbreviation) {
        should.push({
          regexp: {
            'currentTitle.raw': {
              value: `.*(^|[^a-z0-9])${escapeRegex(normalizedVariant)}([^a-z0-9]|$).*`,
              case_insensitive: true,
            },
          },
        });
      }
      if (concept.exactOnly) {
        should.push({
          regexp: {
            'currentTitle.raw': {
              value: `.*(^|[^a-z0-9])${escapeRegex(normalizedVariant)}([^a-z0-9]|$).*`,
              case_insensitive: true,
            },
          },
        });
      }
    }

    if (isShortAbbreviationVariant || concept.exactOnly) {
      continue;
    }

    if (concept.phraseFirst || /\s|[.+#/]/.test(variant)) {
      should.push({
        multi_match: {
          query: variant,
          type: 'phrase',
          fields,
          boost: 4,
        },
      });
    }

    should.push({
      multi_match: {
        query: variant,
        fields,
        operator: concept.exactOnly ? 'and' : 'or',
        fuzziness: concept.exactOnly || variant.length < 5 ? '0' : 'AUTO:5,7',
      },
    });
  }

  return { should, concept };
}

function buildKeywordClause(keyword) {
  const { should } = buildShouldClausesForTerm(keyword.term);
  return {
    bool: {
      should,
      minimum_should_match: 1,
    },
  };
}

function buildPhraseClause(phrase) {
  return {
    bool: {
      should: [
        {
          multi_match: {
            query: phrase,
            type: 'phrase',
            fields: getSearchFields('phrase'),
            boost: 5,
          },
        },
        {
          multi_match: {
            query: phrase,
            fields: getSearchFields('phrase'),
            operator: 'and',
            fuzziness: '0',
          },
        },
      ],
      minimum_should_match: 1,
    },
  };
}

function buildFilterClauses(filters = {}, { allowSalaryFilters = false } = {}) {
  const clauses = [];

  if (filters.minExperienceMonths != null || filters.maxExperienceMonths != null) {
    clauses.push({
      range: {
        totalExperienceMonths: {
          gte: filters.minExperienceMonths ?? undefined,
          lte: filters.maxExperienceMonths ?? undefined,
        },
      },
    });
  }

  for (const [field, source] of [
    ['currentLocation', filters.currentLocation],
    ['preferredLocations', filters.preferredLocation],
    ['industries', filters.industry],
    ['languages', filters.availability],
    ['resumeSource', filters.resumeSource],
  ]) {
    const values = nonEmptyStrings(source);
    if (values.length) clauses.push({ terms: { [field]: values.map((value) => value.toLowerCase()) } });
  }

  for (const [field, values] of [
    ['currentEmployer.raw', filters.currentEmployer],
    ['currentTitle.raw', filters.currentTitle],
  ]) {
    const normalized = nonEmptyStrings(values).map((value) => value.toLowerCase());
    if (normalized.length) clauses.push({ terms: { [field]: normalized } });
  }

  if (nonEmptyStrings(filters.skills).length) {
    clauses.push({
      bool: {
        must: nonEmptyStrings(filters.skills).map((skill) => ({
          multi_match: {
            query: skill,
            fields: ['normalizedSkills^5', 'rawSkills^2'],
            operator: 'and',
          },
        })),
      },
    });
  }

  const excludedCompanies = nonEmptyStrings(filters.excludedCompanies).map((value) => value.toLowerCase());
  if (excludedCompanies.length) {
    clauses.push({
      bool: {
        must_not: [
          { terms: { 'currentEmployer.raw': excludedCompanies } },
          ...excludedCompanies.map((value) => ({ match_phrase: { previousEmployers: value } })),
        ],
      },
    });
  }

  if (nonEmptyStrings(filters.education).length) {
    clauses.push({
      bool: {
        should: nonEmptyStrings(filters.education).map((value) => ({
          match_phrase: { educationText: { query: value, boost: 3 } },
        })),
        minimum_should_match: 1,
      },
    });
  }

  if (filters.noticePeriodDaysMax != null) {
    clauses.push({ range: { noticePeriodDays: { lte: filters.noticePeriodDaysMax } } });
  }

  if (allowSalaryFilters && (filters.salaryMin != null || filters.salaryMax != null)) {
    clauses.push({ term: { salarySearchable: true } });
    if (filters.salaryMin != null) clauses.push({ range: { currentSalaryNormalized: { gte: filters.salaryMin } } });
    if (filters.salaryMax != null) clauses.push({ range: { expectedSalaryNormalized: { lte: filters.salaryMax } } });
  }

  if (filters.lastUpdatedFrom || filters.lastUpdatedTo) {
    clauses.push({
      range: {
        profileUpdatedAt: {
          gte: filters.lastUpdatedFrom || undefined,
          lte: filters.lastUpdatedTo || undefined,
        },
      },
    });
  }

  if (filters.searchableProfile != null) {
    clauses.push({ term: { searchableProfile: Boolean(filters.searchableProfile) } });
  }

  const reviewStatuses = nonEmptyStrings(filters.parsingReviewStatus);
  if (reviewStatuses.length === 1) {
    clauses.push({ term: { reviewRequired: reviewStatuses[0] === 'REVIEW_REQUIRED' } });
  }

  clauses.push({ term: { searchableProfile: true } });

  return clauses;
}

export function computeResumeSearchQueryFingerprint(payload) {
  return crypto.createHash('sha256').update(stableStringify({
    ...payload,
    cursor: null,
  })).digest('hex');
}

export function compileResumeSearchV2Query(input, { allowSalaryFilters = false } = {}) {
  const payload = resumeSearchV2RequestSchema.parse(input || {});
  const must = [];
  const should = [];
  const mustNot = [];
  const filter = buildFilterClauses(payload.filters, { allowSalaryFilters });

  for (const keyword of payload.keywords) {
    const clause = buildKeywordClause(keyword);
    if (keyword.mode === 'MUST') must.push(clause);
    if (keyword.mode === 'SHOULD') should.push(clause);
    if (keyword.mode === 'MUST_NOT') mustNot.push(clause);
  }

  for (const phrase of payload.phrases) {
    should.push(buildPhraseClause(phrase));
  }

  const bool = {
    filter,
    must,
    must_not: mustNot,
    should,
    minimum_should_match: !must.length && should.length ? 1 : 0,
  };

  const sort = payload.sort === 'PROFILE_UPDATED_AT_DESC'
    ? [{ profileUpdatedAt: 'desc' }, { candidateId: 'asc' }]
    : payload.sort === 'RESUME_UPDATED_AT_DESC'
      ? [{ resumeUpdatedAt: 'desc' }, { candidateId: 'asc' }]
      : [{ _score: 'desc' }, { profileUpdatedAt: 'desc' }, { candidateId: 'asc' }];

  return {
    payload,
    queryFingerprint: computeResumeSearchQueryFingerprint(payload),
    searchRequest: {
      size: payload.pageSize,
      track_total_hits: true,
      sort,
      query: { bool },
      highlight: payload.includeHighlights ? {
        pre_tags: ['<mark>'],
        post_tags: ['</mark>'],
        fields: Object.fromEntries(HIGHLIGHT_FIELDS.map((field) => [field, { number_of_fragments: 2, fragment_size: 140 }])),
      } : undefined,
      _source: {
        excludes: ['currentSalaryNormalized', 'expectedSalaryNormalized'],
      },
    },
  };
}
