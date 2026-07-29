import { semanticSearchIntentResponseSchema } from '@careeriz/shared';
import { buildDeterministicQueryParse } from './talentSearchService.js';

function normalizeTitleCase(value = '') {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function nullableString(value) {
  const normalized = String(value || '').trim();
  return normalized ? normalized : null;
}

function detectSeniority(query = '') {
  const mappings = ['intern', 'junior', 'mid', 'senior', 'lead', 'principal', 'staff', 'manager', 'director'];
  const found = mappings.find((token) => new RegExp(`\\b${token}\\b`, 'i').test(query));
  return found ? normalizeTitleCase(found) : null;
}

function uniqueStrings(values = []) {
  return [...new Set(values.map((item) => String(item || '').trim()).filter(Boolean))];
}

export function extractSearchIntent(parsedQuery, { semanticEnabled = false } = {}) {
  const deterministic = buildDeterministicQueryParse(parsedQuery.originalQuery || '');
  const filters = {
    ...parsedQuery.filters,
    minExperience: parsedQuery.filters.minExperience ?? deterministic.minExperience ?? null,
    maxExperience: parsedQuery.filters.maxExperience ?? deterministic.maxExperience ?? null,
    location: nullableString(parsedQuery.filters.location ?? deterministic.location ?? null),
    workMode: nullableString(parsedQuery.filters.workMode ?? deterministic.workMode ?? null),
    role: nullableString(parsedQuery.filters.role ?? deterministic.currentTitle ?? null),
    noticePeriodDaysMax: parsedQuery.filters.noticePeriodDaysMax ?? deterministic.noticePeriodDaysMax ?? null,
    education: nullableString(parsedQuery.filters.education ?? deterministic.education ?? null),
    certifications: uniqueStrings([...(parsedQuery.filters.certifications || []), ...(deterministic.certifications || [])]),
    skills: uniqueStrings([...(parsedQuery.filters.skills || []), ...(deterministic.skills || [])]),
  };

  const keyword = parsedQuery.canonicalKeyword || parsedQuery.originalQuery || '';
  const structuredFilters = [
    filters.location ? `Location: ${filters.location}` : null,
    filters.workMode ? `Work mode: ${filters.workMode}` : null,
    filters.role ? `Role: ${filters.role}` : null,
    filters.minExperience != null || filters.maxExperience != null
      ? `Experience: ${filters.minExperience ?? 0}-${filters.maxExperience ?? 'any'}`
      : null,
    filters.noticePeriodDaysMax != null ? `Notice period <= ${filters.noticePeriodDaysMax} days` : null,
    filters.skills.length ? `Skills: ${filters.skills.join(', ')}` : null,
  ].filter(Boolean);

  return semanticSearchIntentResponseSchema.parse({
    mode: parsedQuery.mode,
    semanticEnabled,
    keyword,
    filters,
    role: filters.role ? normalizeTitleCase(filters.role) : null,
    seniority: nullableString(filters.seniority) ?? detectSeniority(keyword),
    years: {
      min: filters.minExperience ?? null,
      max: filters.maxExperience ?? null,
    },
    structuredFilters,
    warnings: [...(parsedQuery.warnings || []), ...(deterministic.warnings || [])],
  });
}
