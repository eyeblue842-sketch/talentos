import { normalizeSkillToken, sanitizeParsedCandidateField } from './resumeImportUtils.js';
import { normalizeDegree } from './search/educationNormalization.js';

const CERTIFICATION_STRONG_PATTERN = /\b(certified|certification|certificate|credential|license|licensed|accredited|scrum master|pmp|shrm|anaplan certified|aws certified|microsoft certified|google professional)\b/i;
const CERTIFICATION_REJECT_PATTERN = /\b(work experience|experience|organization|organisation|project|responsibilities|responsibility|environment|task performed|technology|technologies|tools|skills|summary|profile|education|declaration|personal data|personal details|father|nationality|passport|marital|dob|date of birth|phone|mobile|email|e-mail)\b/i;
const TOOL_ONLY_CERTIFICATION_PATTERN = /^(sql|qlikview|qlik sense|datahub|azure|aws|docker|react|node\.?js|postgresql|mysql)$/i;
const INVALID_DEGREE_PATTERN = /^(details|education details|training & education details)$/i;
const MAX_CERTIFICATION_ENTRIES = 20;

function normalizeWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function hasMeaningfulValue(value) {
  if (value == null) return false;
  if (typeof value === 'string') return normalizeWhitespace(value).length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.some((item) => hasMeaningfulValue(item));
  if (typeof value === 'object') return Object.values(value).some((item) => hasMeaningfulValue(item));
  return Boolean(value);
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const key = keyFn(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanStringArray(values = []) {
  return [...new Set(asArray(values)
    .map((value) => normalizeSkillToken(value) || normalizeWhitespace(value))
    .filter(Boolean))];
}

function sanitizePortfolioLinks(entries) {
  return uniqueBy(asArray(entries)
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => ({
      label: normalizeWhitespace(entry.label || entry.name || entry.title) || null,
      url: normalizeWhitespace(entry.url || entry.href) || null,
    }))
    .filter((entry) => entry.url && /^https?:\/\//i.test(entry.url)), (entry) => entry.url.toLowerCase());
}

export function sanitizeCandidateDisplayField(field, value) {
  return sanitizeParsedCandidateField(field, value);
}

export function isStrictCertificationName(value) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return false;
  if (/^certifications?$/i.test(normalized)) return false;
  if (normalized.length > 120) return false;
  if (normalized.split(/\s+/).length > 12) return false;
  if (/@|https?:\/\//i.test(normalized)) return false;
  if (CERTIFICATION_REJECT_PATTERN.test(normalized)) return false;
  if (TOOL_ONLY_CERTIFICATION_PATTERN.test(normalized)) return false;
  return CERTIFICATION_STRONG_PATTERN.test(normalized);
}

export function sanitizeCertificationEntries(entries, { maxEntries = MAX_CERTIFICATION_ENTRIES } = {}) {
  const cleaned = uniqueBy(asArray(entries)
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => {
      const name = normalizeWhitespace(entry.name || entry.certificationName || entry.title);
      if (!isStrictCertificationName(name)) return null;
      return {
        name,
        issuingOrganisation: sanitizeCandidateDisplayField('currentEmployer', entry.issuingOrganisation) || null,
        issueDate: normalizeWhitespace(entry.issueDate) || null,
        expiryDate: normalizeWhitespace(entry.expiryDate) || null,
        credentialId: normalizeWhitespace(entry.credentialId) || null,
        credentialUrl: normalizeWhitespace(entry.credentialUrl) || null,
      };
    })
    .filter(Boolean), (entry) => entry.name.toLowerCase());

  if (cleaned.length > maxEntries) {
    return {
      entries: [],
      reviewNeeded: true,
      contaminated: true,
    };
  }

  return {
    entries: cleaned,
    reviewNeeded: false,
    contaminated: false,
  };
}

export function sanitizeEducationEntries(entries) {
  return uniqueBy(asArray(entries)
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => {
      const degree = normalizeWhitespace(entry.degree);
      if (!degree || INVALID_DEGREE_PATTERN.test(degree)) return null;
      const safeDegree = sanitizeCandidateDisplayField('currentTitle', degree) || degree;
      if (!safeDegree || INVALID_DEGREE_PATTERN.test(safeDegree)) return null;
      const degreeInfo = normalizeDegree(safeDegree);

      return {
        degree: safeDegree,
        institution: sanitizeCandidateDisplayField('currentEmployer', entry.institution) || normalizeWhitespace(entry.institution) || null,
        specialization: normalizeWhitespace(entry.specialization || entry.fieldOfStudy) || null,
        fieldOfStudy: normalizeWhitespace(entry.fieldOfStudy || entry.specialization) || null,
        startYear: normalizeWhitespace(entry.startYear) || null,
        endYear: normalizeWhitespace(entry.endYear) || null,
        year: normalizeWhitespace(entry.year || entry.endYear) || null,
        score: normalizeWhitespace(entry.score) || null,
        location: sanitizeCandidateDisplayField('location', entry.location) || null,
        educationType: normalizeWhitespace(entry.educationType) || null,
        normalizedCourse: degreeInfo?.canonical || null,
        qualificationLevel: degreeInfo?.level || (['UG', 'PG', 'PPG'].includes(String(entry.qualificationLevel || '').toUpperCase()) ? String(entry.qualificationLevel).toUpperCase() : null),
        summary: null,
      };
    })
    .filter((entry) => entry && hasMeaningfulValue(entry.degree)), (entry) => JSON.stringify([entry.degree, entry.institution, entry.year]));
}

export function sanitizeExperienceEntries(entries) {
  return uniqueBy(asArray(entries)
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => {
      const title = sanitizeCandidateDisplayField('currentTitle', entry.title || entry.jobTitle || entry.designation);
      const company = sanitizeCandidateDisplayField('currentEmployer', entry.company || entry.employer);
      const description = normalizeWhitespace(entry.summary || entry.description || '');
      const safeDescription = description && !/^(project|organization|environment|task performed|declaration)\b/i.test(description)
        ? description
        : null;
      const skills = cleanStringArray(entry.skills || entry.technologies);
      if (!title && !company) return null;

      return {
        company: company || null,
        employer: company || null,
        title: title || null,
        jobTitle: title || null,
        designation: title || null,
        employmentType: normalizeWhitespace(entry.employmentType) || null,
        startDate: normalizeWhitespace(entry.startDate) || null,
        endDate: normalizeWhitespace(entry.endDate) || null,
        currentlyWorking: Boolean(entry.currentlyWorking || entry.isCurrent),
        isCurrent: Boolean(entry.currentlyWorking || entry.isCurrent),
        duration: normalizeWhitespace(entry.duration) || null,
        location: sanitizeCandidateDisplayField('location', entry.location) || null,
        project: normalizeWhitespace(entry.project) || null,
        domain: normalizeWhitespace(entry.domain) || null,
        responsibilities: safeDescription ? [safeDescription] : [],
        technologies: skills,
        skills,
        summary: safeDescription,
        description: safeDescription,
      };
    })
    .filter(Boolean), (entry) => JSON.stringify([entry.company, entry.title, entry.startDate, entry.endDate]));
}

export function sanitizeProjectEntries(entries) {
  return uniqueBy(asArray(entries)
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => {
      const projectName = normalizeWhitespace(entry.projectName || entry.name || entry.title);
      if (!projectName || /^(project|projects)$/i.test(projectName)) return null;

      const description = normalizeWhitespace(entry.summary || entry.description || '');
      const safeDescription = description && !/^(declaration|personal details)\b/i.test(description) ? description : null;
      const skills = cleanStringArray(entry.skills || entry.technologies);

      return {
        projectName,
        title: projectName,
        name: projectName,
        role: sanitizeCandidateDisplayField('currentTitle', entry.role) || null,
        company: sanitizeCandidateDisplayField('currentEmployer', entry.company || entry.client) || null,
        client: sanitizeCandidateDisplayField('currentEmployer', entry.client || entry.company) || null,
        startDate: normalizeWhitespace(entry.startDate) || null,
        endDate: normalizeWhitespace(entry.endDate) || null,
        duration: normalizeWhitespace(entry.duration) || null,
        domain: normalizeWhitespace(entry.domain) || null,
        environment: normalizeWhitespace(entry.environment) || null,
        teamSize: normalizeWhitespace(entry.teamSize) || null,
        technologies: skills,
        skills,
        responsibilities: safeDescription ? [safeDescription] : [],
        summary: safeDescription,
        description: safeDescription,
      };
    })
    .filter((entry) => entry && (entry.projectName || entry.summary)), (entry) => JSON.stringify([entry.projectName, entry.company, entry.duration]));
}

export function sanitizeLanguageEntries(entries) {
  return uniqueBy(asArray(entries)
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => {
      const language = normalizeWhitespace(entry.language || entry.name);
      if (!language || /\b(declaration|passport|nationality|personal details)\b/i.test(language)) return null;
      if (!/^[A-Za-z][A-Za-z\s()/-]{1,40}$/.test(language) || language.split(/\s+/).length > 4) return null;
      return {
        language,
        name: language,
        proficiency: normalizeWhitespace(entry.proficiency) || null,
        read: entry.read == null ? null : Boolean(entry.read),
        write: entry.write == null ? null : Boolean(entry.write),
        speak: entry.speak == null ? null : Boolean(entry.speak),
      };
    })
    .filter(Boolean), (entry) => entry.language.toLowerCase());
}

export function sanitizeStructuredCandidateField(field, value) {
  switch (field) {
    case 'experienceEntries':
      return sanitizeExperienceEntries(value);
    case 'educationEntries':
      return sanitizeEducationEntries(value);
    case 'certificationEntries':
      return sanitizeCertificationEntries(value).entries;
    case 'projectEntries':
      return sanitizeProjectEntries(value);
    case 'languageEntries':
      return sanitizeLanguageEntries(value);
    case 'portfolioLinks':
      return sanitizePortfolioLinks(value);
    default:
      return value;
  }
}

export function normalizeCandidateProfileForPresentation(profile) {
  if (!profile) return null;

  const certifications = sanitizeCertificationEntries(profile.certificationEntries);
  const cleaned = {
    ...profile,
    fullName: sanitizeCandidateDisplayField('fullName', profile.fullName),
    phoneNumber: sanitizeCandidateDisplayField('phoneNumber', profile.phoneNumber) || profile.phoneNumber,
    headline: sanitizeCandidateDisplayField('headline', profile.headline),
    currentTitle: sanitizeCandidateDisplayField('currentTitle', profile.currentTitle),
    currentEmployer: sanitizeCandidateDisplayField('currentEmployer', profile.currentEmployer),
    currentDesignation: sanitizeCandidateDisplayField('currentDesignation', profile.currentDesignation),
    location: sanitizeCandidateDisplayField('location', profile.location),
    currentCity: sanitizeCandidateDisplayField('currentCity', profile.currentCity),
    currentState: sanitizeCandidateDisplayField('currentState', profile.currentState),
    currentCountry: sanitizeCandidateDisplayField('currentCountry', profile.currentCountry),
    summary: sanitizeCandidateDisplayField('summary', profile.summary),
    educationEntries: sanitizeEducationEntries(profile.educationEntries),
    certificationEntries: certifications.entries,
    experienceEntries: sanitizeExperienceEntries(profile.experienceEntries),
    projectEntries: sanitizeProjectEntries(profile.projectEntries),
    languageEntries: sanitizeLanguageEntries(profile.languageEntries),
    skills: cleanStringArray(profile.skills),
    functionalSkills: cleanStringArray(profile.functionalSkills),
    tools: cleanStringArray(profile.tools),
    frameworks: cleanStringArray(profile.frameworks),
    cloudPlatforms: cleanStringArray(profile.cloudPlatforms),
    databases: cleanStringArray(profile.databases),
    softSkills: cleanStringArray(profile.softSkills),
    portfolioLinks: sanitizePortfolioLinks(profile.portfolioLinks),
  };

  return {
    ...cleaned,
    resumeReviewNeeded: Boolean(profile.resumeReviewNeeded || certifications.reviewNeeded),
  };
}

export function buildCandidateProfileRepairData(profile) {
  const cleaned = normalizeCandidateProfileForPresentation(profile);
  if (!cleaned) return {};

  const data = {};
  const scalarFields = ['fullName', 'headline', 'currentTitle', 'currentEmployer', 'currentDesignation', 'location', 'currentCity', 'currentState', 'currentCountry', 'summary'];
  for (const field of scalarFields) {
    const before = profile[field] ?? null;
    const after = cleaned[field] ?? null;
    if ((before ?? null) !== (after ?? null)) {
      data[field] = after;
    }
  }

  const arrayFields = ['educationEntries', 'certificationEntries', 'experienceEntries', 'projectEntries', 'languageEntries', 'portfolioLinks', 'skills', 'functionalSkills', 'tools', 'frameworks', 'cloudPlatforms', 'databases', 'softSkills'];
  for (const field of arrayFields) {
    const before = JSON.stringify(profile[field] ?? null);
    const afterValue = cleaned[field];
    const after = JSON.stringify(afterValue);
    if (before !== after) {
      data[field] = Array.isArray(afterValue) ? afterValue : [];
    }
  }

  return data;
}
