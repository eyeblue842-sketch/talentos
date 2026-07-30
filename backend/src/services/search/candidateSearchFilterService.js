import {
  extractEducationEntries,
  extractExperienceEntries,
  normalizeString,
  normalizeStringArray,
} from './searchUtils.js';

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
  const entries = extractExperienceEntries(candidate);
  if (!entries.length) return false;

  if (mode === 'current') {
    return matchesLooseText(entries[0]?.company, companyQuery);
  }

  return entries.some((entry) => matchesLooseText(entry.company, companyQuery));
}

export function matchesResumeAttachment(candidate, resumeAttachment) {
  if (!resumeAttachment) return true;
  const hasResume = Boolean(candidate.resumeUrl || candidate.latestResumeAssetId || candidate.resumeBuilder);
  return resumeAttachment === 'Available' ? hasResume : !hasResume;
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
  const education = normalizeString(filters.education);
  const industry = normalizeString(filters.industry);
  const noticePeriod = normalizeString(filters.noticePeriod);
  const resumeAttachment = normalizeString(filters.resumeAttachment);

  return rows.filter((candidate) => {
    if (!matchesSkills(candidate.skills, skills)) return false;
    if (!matchesCompany(candidate, currentCompany, 'current')) return false;
    if (!matchesCompany(candidate, previousCompany, 'any')) return false;
    if (!matchesEducation(candidate, education)) return false;
    if (industry && !(candidate.preferredIndustries || []).some((item) => matchesLooseText(item, industry))) return false;
    if (!matchesNoticePeriod(candidate, noticePeriod)) return false;
    if (!matchesResumeAttachment(candidate, resumeAttachment)) return false;
    return true;
  });
}
