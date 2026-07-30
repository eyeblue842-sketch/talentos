import { normalizeString, normalizeStringArray } from './searchUtils.js';

function matchesLooseText(source, query) {
  return !query || normalizeString(source).toLowerCase().includes(normalizeString(query).toLowerCase());
}

export function computeRelevanceScore(candidate, filters = {}, buildKeywordMatch) {
  const requestedSkills = normalizeStringArray(filters.skills);
  const keyword = normalizeString(filters.keyword || filters.booleanQuery);
  const scoreFromSkills = requestedSkills.length
    ? buildKeywordMatch(requestedSkills, candidate.skills || [])
    : 60;
  const keywordBonus = keyword && (
    matchesLooseText(candidate.fullName, keyword)
    || matchesLooseText(candidate.headline, keyword)
    || matchesLooseText(candidate.currentTitle, keyword)
  ) ? 20 : 0;
  const locationBonus = normalizeString(filters.location) && matchesLooseText(candidate.location, filters.location) ? 10 : 0;
  return Math.max(0, Math.min(100, scoreFromSkills + keywordBonus + locationBonus));
}

export function sortCandidateRows(rows, filters = {}) {
  const sortBy = normalizeString(filters.sortBy || 'relevance');
  if (sortBy === 'resumeFreshness') {
    return rows.sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt));
  }
  if (sortBy === 'experience') {
    return rows.sort((left, right) => (right.totalExperience || 0) - (left.totalExperience || 0));
  }
  return rows.sort((left, right) => (right.__relevanceScore || 0) - (left.__relevanceScore || 0));
}
