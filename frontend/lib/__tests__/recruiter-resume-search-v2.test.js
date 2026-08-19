import { describe, expect, test } from 'vitest';
import {
  buildInitialResumeSearchV2State,
  buildResumeSearchV2RequestKey,
  buildResumeSearchV2UrlParams,
  formatResumeSearchV2Summary,
  sanitizeResumeSearchV2State,
  splitKeywordInputToChips,
} from '@/lib/recruiter-resume-search-v2';

describe('recruiter resume search v2 helpers', () => {
  test('splits punctuation-sensitive keywords and quoted phrases without losing concepts', () => {
    expect(splitKeywordInputToChips('C++, C#, .NET, Node.js, PL/SQL, "Business HR Partner"')).toEqual([
      { term: 'C++', mode: 'SHOULD', kind: 'keyword' },
      { term: 'C#', mode: 'SHOULD', kind: 'keyword' },
      { term: '.NET', mode: 'SHOULD', kind: 'keyword' },
      { term: 'Node.js', mode: 'SHOULD', kind: 'keyword' },
      { term: 'PL/SQL', mode: 'SHOULD', kind: 'keyword' },
      { term: 'Business HR Partner', mode: 'SHOULD', kind: 'phrase' },
    ]);
  });

  test('serializes and restores safe url state', () => {
    const params = buildResumeSearchV2UrlParams({
      keywords: [{ term: 'IT', mode: 'MUST' }, { term: 'Sales', mode: 'MUST' }],
      phrases: [{ term: 'Business HR Partner', mode: 'SHOULD' }],
      filters: {
        minExperienceMonths: 60,
        previousTitles: ['Account Executive', 'Sales Lead'],
        previousTitlesMatchMode: 'ALL',
        profileCompletenessMin: 70,
      },
      sort: 'EXPERIENCE_DESC',
      pageSize: 25,
      cursor: 'opaque-cursor-that-must-not-enter-the-url',
    });

    expect(params.has('cursor')).toBe(false);
    expect(params.toString()).not.toContain('opaque-cursor');

    const restored = buildInitialResumeSearchV2State({
      kw: params.getAll('kw'),
      ph: params.getAll('ph'),
      previousTitles: params.get('previousTitles'),
      previousTitlesMode: params.get('previousTitlesMode'),
      profileCompletenessMin: params.get('profileCompletenessMin'),
      sort: params.get('sort'),
      pageSize: params.get('pageSize'),
      expMin: params.get('expMin'),
    });
    expect(restored.keywords).toEqual([{ term: 'IT', mode: 'MUST' }, { term: 'Sales', mode: 'MUST' }]);
    expect(restored.phrases).toEqual([{ term: 'Business HR Partner', mode: 'SHOULD' }]);
    expect(restored.filters.previousTitles).toEqual(['Account Executive', 'Sales Lead']);
    expect(restored.filters.previousTitlesMatchMode).toBe('ALL');
    expect(restored.sort).toBe('EXPERIENCE_DESC');
    expect(restored.cursor).toBeNull();
  });

  test('falls back safely for malformed url state', () => {
    const restored = buildInitialResumeSearchV2State({
      kw: 'BADMODE:IT',
      expMin: 'not-a-number',
      sort: 'UNSUPPORTED',
      previousTitlesMode: 'BROKEN',
    });

    expect(restored.keywords).toEqual([]);
    expect(restored.filters.minExperienceMonths).toBeUndefined();
    expect(restored.sort).toBe('UNSUPPORTED');
    expect(restored.filters.previousTitlesMatchMode).toBe('ANY');
  });

  test('validates the exact backend-aligned payload contract', () => {
    const sanitized = sanitizeResumeSearchV2State({
      keywords: [{ term: 'IT', mode: 'MUST' }, { term: 'Sales', mode: 'MUST' }],
      phrases: [{ term: 'Business HR Partner', mode: 'SHOULD' }],
      filters: {
        previousTitles: ['Account Executive'],
        previousTitlesMatchMode: 'ANY',
        profileCompletenessMin: 70,
      },
      sort: 'EXPERIENCE_DESC',
      pageSize: 25,
      cursor: null,
    });

    expect(sanitized.ok).toBe(true);
    expect(sanitized.state).toMatchObject({
      keywords: [{ term: 'IT', mode: 'MUST' }, { term: 'Sales', mode: 'MUST' }],
      phrases: [{ term: 'Business HR Partner', mode: 'SHOULD' }],
      filters: {
        previousTitles: ['Account Executive'],
        previousTitlesMatchMode: 'ANY',
        profileCompletenessMin: 70,
      },
      sort: 'EXPERIENCE_DESC',
      pageSize: 25,
      cursor: null,
    });
  });

  test('builds required, optional, and excluded summaries', () => {
    expect(formatResumeSearchV2Summary({
      keywords: [
        { term: 'IT', mode: 'MUST' },
        { term: 'SaaS', mode: 'SHOULD' },
        { term: 'Internship', mode: 'MUST_NOT' },
      ],
      phrases: [{ term: 'Business HR Partner', mode: 'MUST' }],
    })).toEqual({
      required: ['IT', '"Business HR Partner"'],
      optional: ['SaaS'],
      excluded: ['Internship'],
    });
  });

  test('request keys differ when ephemeral cursor state changes', () => {
    const state = sanitizeResumeSearchV2State({
      keywords: [{ term: 'IT', mode: 'MUST' }],
      phrases: [],
      filters: {},
      sort: 'RELEVANCE',
      pageSize: 25,
      cursor: null,
    });

    expect(state.ok).toBe(true);
    const baseKey = buildResumeSearchV2RequestKey(state.state);
    const nextPageKey = buildResumeSearchV2RequestKey({ ...state.state, cursor: 'opaque-next-page' });
    expect(baseKey).not.toBe(nextPageKey);
  });
});
