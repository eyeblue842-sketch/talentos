import {
  extractEducationEntries,
  extractExperienceEntries,
  normalizeString,
  normalizeStringArray,
  locationMatches,
  normalizeCompany,
  countryMatches,
} from './searchUtils.js';
import { educationMatchesLevel, normalizeEducationEntries } from './educationNormalization.js';

function matchesNormalizedCompany(value, query) {
  if (!value || !query) return false;
  if (value === query) return true;
  const queryTokens = query.split(' ');
  const valueTokens = new Set(value.split(' '));
  return queryTokens.length > 1 && queryTokens.every((token) => valueTokens.has(token));
}

export function matchesLooseText(source, query) {
  if (!query) return true;
  return normalizeString(source).toLowerCase().includes(normalizeString(query).toLowerCase());
}

export function matchesSkills(candidateSkills, requestedSkills) {
  if (!requestedSkills.length) return true;
  const haystack = (candidateSkills || []).map((item) => normalizeString(item).toLowerCase());
  return requestedSkills.every((skill) => haystack.some((candidateSkill) => candidateSkill.includes(skill.toLowerCase())));
}

export function matchesEducation(candidate, educationQuery) {
  if (!educationQuery) return true;
  return extractEducationEntries(candidate).some((entry) => (
    matchesLooseText(entry.degree, educationQuery) || matchesLooseText(entry.school, educationQuery)
  ));
}

export function matchesCompany(candidate, companyQuery, mode = 'current') {
  if (!companyQuery) return true;
  const query = normalizeCompany(companyQuery);
  const entries = extractExperienceEntries(candidate);
  const current = normalizeCompany(candidate.currentEmployer || entries.find((entry) => entry.isCurrent || entry.currentlyWorking)?.company || entries[0]?.company);
  const previous = entries
    .filter((entry) => !entry.isCurrent && !entry.currentlyWorking)
    .map((entry) => normalizeCompany(entry.company || entry.employer));

  if (mode === 'current') {
    return matchesNormalizedCompany(current, query);
  }

  if (mode === 'previous') return previous.some((company) => matchesNormalizedCompany(company, query));
  return [current, ...previous].some((company) => matchesNormalizedCompany(company, query));
}

export function matchesDesignation(candidate, designationQuery, mode = 'current') {
  if (!designationQuery) return true;
  const query = normalizeString(designationQuery).toLowerCase();
  const entries = extractExperienceEntries(candidate);
  const current = normalizeString(candidate.currentDesignation || candidate.currentTitle || entries.find((entry) => entry.isCurrent || entry.currentlyWorking)?.title || entries[0]?.title).toLowerCase();
  const previous = entries
    .filter((entry) => !entry.isCurrent && !entry.currentlyWorking)
    .map((entry) => normalizeString(entry.title || entry.jobTitle || entry.designation).toLowerCase());
  const matches = (value) => Boolean(value && (value === query || value.includes(query)));
  if (mode === 'current') return matches(current);
  if (mode === 'previous') return previous.some(matches);
  return [current, ...previous].some(matches);
}

export function matchesLocations(candidate, filters) {
  const currentLocations = normalizeStringArray(filters.locations || filters.location);
  const preferredLocations = normalizeStringArray(filters.preferredLocations);
  const currentMatch = currentLocations.length
    ? currentLocations.some((location) => locationMatches(candidate.location, location))
    : true;
  const preferredMatch = preferredLocations.length
    ? preferredLocations.some((location) => (candidate.preferredLocations || []).some((candidateLocation) => locationMatches(candidateLocation, location)))
    : true;
  if ((currentLocations.length || preferredLocations.length) && filters.includeWillingToRelocate && candidate.willingToRelocate) {
    return true;
  }
  return currentMatch && preferredMatch;
}

export function matchesEducationFilters(candidate, filters) {
  const entries = normalizeEducationEntries(extractEducationEntries(candidate));
  const educationFilters = filters.educationFilters || {};
  const levels = [['UG', educationFilters.ug], ['PG', educationFilters.pg], ['PPG', educationFilters.ppg]];
  if (levels.some(([level, query]) => query && !educationMatchesLevel(entries, level, query))) return false;
  if (educationFilters.requireUgPg && !educationMatchesLevel(entries, 'UG', { mode: 'ANY' })) return false;
  if (educationFilters.requireUgPg && !educationMatchesLevel(entries, 'PG', { mode: 'ANY' })) return false;
  if (educationFilters.requirePgPpg && !educationMatchesLevel(entries, 'PG', { mode: 'ANY' })) return false;
  if (educationFilters.requirePgPpg && !educationMatchesLevel(entries, 'PPG', { mode: 'ANY' })) return false;
  if (filters.education && !matchesEducation(candidate, filters.education)) return false;
  return true;
}

export function matchesResumeAttachment(candidate, resumeAttachment) {
  if (!resumeAttachment) return true;
  const hasResume = candidate.latestResumeAsset
    ? candidate.latestResumeAsset.kind === 'RESUME' && candidate.latestResumeAsset.status === 'ACTIVE'
    : Boolean(candidate.latestResumeAssetId || candidate.resumeUrl);
  return resumeAttachment === 'Available' ? hasResume : !hasResume;
}

export function matchesWorkPreferences(candidate, filters) {
  const employmentTypes = normalizeStringArray(filters.employmentTypes);
  if (employmentTypes.length && !employmentTypes.some((type) => (candidate.employmentPreferences || []).includes(type))) return false;

  const jobTypes = normalizeStringArray(filters.jobTypes);
  if (jobTypes.length) {
    const supported = jobTypes.filter((type) => type === 'PERMANENT' || type === 'CONTRACT');
    if (!supported.length) return false;
    const matches = supported.some((type) => type === 'PERMANENT'
      ? (candidate.employmentPreferences || []).includes('FULL_TIME')
      : (candidate.employmentPreferences || []).includes('CONTRACT'));
    if (!matches) return false;
  }

  const workPermitCountries = normalizeStringArray(filters.workPermitCountries);
  if (workPermitCountries.length) {
    const candidateCountries = normalizeStringArray(candidate.workAuthorization);
    if (!workPermitCountries.some((country) => candidateCountries.some((candidateCountry) => countryMatches(candidateCountry, country)))) return false;
  }
  return true;
}

function modifiedAt(candidate) {
  const values = [candidate.updatedAt, candidate.latestResumeAsset?.updatedAt].filter(Boolean).map((value) => new Date(value).getTime());
  return values.length ? Math.max(...values) : 0;
}

export function matchesNoticePeriod(candidate, noticePeriod) {
  if (!noticePeriod) return true;
  const days = candidate.noticePeriodDays;
  if (days == null) {
    return noticePeriod === 'Immediate' ? candidate.availability === 'IMMEDIATE' : true;
  }

  switch (noticePeriod) {
    case 'Immediate':
      return days === 0;
    case '15 Days':
      return days <= 15;
    case '30 Days':
      return days <= 30;
    case '60 Days':
      return days <= 60;
    case '90 Days':
      return days <= 90;
    default:
      return true;
  }
}

export function filterCandidateRows(rows, filters = {}) {
  const skills = normalizeStringArray(filters.skills);
  const currentCompany = normalizeString(filters.currentCompany);
  const previousCompany = normalizeString(filters.previousCompany);
  const industry = normalizeString(filters.industry);
  const noticePeriod = normalizeString(filters.noticePeriod);
  const resumeAttachment = normalizeString(filters.resumeAttachment);

  return rows.filter((candidate) => {
    if (!matchesSkills(candidate.skills, skills)) return false;
    const companyScope = normalizeString(filters.companyScope).toLowerCase() || 'current';
    const designationScope = normalizeString(filters.designationScope).toLowerCase() || 'current';
    if (!matchesCompany(candidate, currentCompany, companyScope === 'any' ? 'any' : companyScope)) return false;
    if (!matchesCompany(candidate, previousCompany, 'previous')) return false;
    if (!matchesDesignation(candidate, filters.designation || filters.currentDesignation, designationScope)) return false;
    if (!matchesEducationFilters(candidate, filters)) return false;
    if (!matchesLocations(candidate, filters)) return false;
    if (industry && !(candidate.preferredIndustries || []).some((item) => matchesLooseText(item, industry))) return false;
    if (filters.workAuthorization && !matchesLooseText(candidate.workAuthorization, filters.workAuthorization)) return false;
    if (!matchesWorkPreferences(candidate, filters)) return false;
    const salaryMin = Number(filters.salaryMin ?? filters.currentSalary);
    const salaryMax = Number(filters.salaryMax);
    if (Number.isFinite(salaryMin) && (candidate.currentCtcLpa == null || Number(candidate.currentCtcLpa) < salaryMin)) return false;
    if (Number.isFinite(salaryMax) && (candidate.currentCtcLpa == null || Number(candidate.currentCtcLpa) > salaryMax)) return false;
    if (!matchesNoticePeriod(candidate, noticePeriod)) return false;
    if (!matchesResumeAttachment(candidate, resumeAttachment)) return false;
    if (filters.emailVerified && !candidate.user?.emailVerifiedAt) return false;
    const recencyDays = Number(filters.profileRecencyDays) || 30;
    const displayType = filters.displayCandidateType || (filters.profileRecency === 'NEW' ? 'NEW_REGISTRATIONS' : filters.profileRecency === 'MODIFIED' ? 'MODIFIED' : 'ALL');
    if (displayType === 'NEW_REGISTRATIONS' && new Date(candidate.createdAt) < new Date(Date.now() - recencyDays * 86400000)) return false;
    if (displayType === 'MODIFIED' && modifiedAt(candidate) < Date.now() - recencyDays * 86400000) return false;
    if (filters.activeWithin != null && (!candidate.lastActiveAt || new Date(candidate.lastActiveAt) < new Date(Date.now() - Number(filters.activeWithin) * 86400000))) return false;
    return true;
  });
}
