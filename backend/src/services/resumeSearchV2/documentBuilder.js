import crypto from 'crypto';
import { sanitizeResumeString } from '../resumeImportUtils.js';
import { normalizeCandidateProfileForPresentation } from '../candidateProfileSanitizer.js';
import { RESUME_SEARCH_INDEX_SCHEMA_VERSION } from './mapping.js';
import { sanitizeResumeSearchText, sanitizeResumeSearchTextList } from './privacy.js';
import { resolveResumeVisibilityClassification, RESUME_VISIBILITY_CLASSIFICATIONS } from './visibility.js';

function normalizeText(value = '') {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizeKeywordList(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => normalizeText(value)).filter(Boolean))];
}

function joinText(parts = []) {
  return sanitizeResumeSearchText(
    sanitizeResumeString(parts.map((part) => normalizeText(part)).filter(Boolean).join('\n')),
  ).slice(0, 60000);
}

function buildSourceVersion(candidate, resume) {
  return crypto.createHash('sha256').update(JSON.stringify({
    candidateId: candidate.id,
    candidateUpdatedAt: candidate.updatedAt,
    resumeId: resume?.id || null,
    resumeUpdatedAt: resume?.updatedAt || null,
    parserVersion: candidate.parserVersion || null,
    reviewRequired: candidate.profileStatus === 'REVIEW_REQUIRED',
  })).digest('hex');
}

function toMonths(years) {
  if (!Number.isFinite(Number(years))) return 0;
  return Math.max(0, Math.round(Number(years) * 12));
}

export function buildResumeSearchDocument(candidate, resume = null, options = {}) {
  const safe = normalizeCandidateProfileForPresentation(candidate);
  const salarySearchable = Boolean(safe.salaryVisibleToRecruiters && options.allowSalaryIndexing !== false);
  const visibilityClassification = resolveResumeVisibilityClassification(safe, resume);
  const currentTitles = (safe.experienceEntries || []).filter((entry) => entry.isCurrent || entry.currentlyWorking).map((entry) => entry.title).filter(Boolean);
  const previousTitles = (safe.experienceEntries || []).filter((entry) => !entry.isCurrent && !entry.currentlyWorking).map((entry) => entry.title).filter(Boolean);
  const previousEmployers = (safe.experienceEntries || []).filter((entry) => !entry.isCurrent && !entry.currentlyWorking).map((entry) => entry.company || entry.employer).filter(Boolean);
  const certifications = (safe.certificationEntries || []).map((entry) => entry.name).filter(Boolean);
  const languages = (safe.languageEntries || []).map((entry) => entry.language || entry.name).filter(Boolean);
  const industries = normalizeKeywordList(safe.preferredIndustries || []);
  const sourceVersion = buildSourceVersion(safe, resume);
  const documentId = `candidate:${safe.id}`;

  return {
    documentId,
    candidateId: safe.id,
    resumeId: resume?.id || safe.latestResumeAssetId || null,
    importItemId: safe.provenanceMetadata?.resumeParsing?.sourceItemId || safe.provenanceMetadata?.sourceItemId || safe.provenanceMetadata?.importItemId || null,
    resumeSource: normalizeText(safe.source || ''),
    sourceOrganisationId: safe.organisationId || null,
    visibilityClassification,
    contactVisibilityClassification: safe.phoneVisibleToRecruiters ? 'RECRUITER_VISIBLE' : 'HIDDEN',
    searchableProfile: visibilityClassification !== RESUME_VISIBILITY_CLASSIFICATIONS.NOT_SEARCHABLE,
    normalizedName: normalizeText(safe.fullName),
    currentTitle: normalizeText(safe.currentTitle || safe.headline || currentTitles[0] || ''),
    previousTitles: sanitizeResumeSearchTextList(normalizeKeywordList(previousTitles)),
    normalizedSkills: normalizeKeywordList([
      ...(safe.skills || []),
      ...(safe.functionalSkills || []),
      ...(safe.tools || []),
      ...(safe.frameworks || []),
      ...(safe.cloudPlatforms || []),
      ...(safe.databases || []),
    ]),
    rawSkills: normalizeKeywordList(safe.skills || []),
    totalExperienceMonths: toMonths(safe.totalExperience),
    currentEmployer: normalizeText(safe.currentEmployer || ''),
    previousEmployers: sanitizeResumeSearchTextList(normalizeKeywordList(previousEmployers)),
    industries,
    employmentHistoryText: joinText((safe.experienceEntries || []).flatMap((entry) => [entry.title, entry.company, entry.summary, ...(entry.skills || [])])),
    projectsText: joinText((safe.projectEntries || []).flatMap((entry) => [entry.projectName, entry.summary, ...(entry.skills || [])])),
    educationText: joinText((safe.educationEntries || []).flatMap((entry) => [entry.degree, entry.institution, entry.specialization])),
    certifications: sanitizeResumeSearchTextList(normalizeKeywordList(certifications)),
    languages: sanitizeResumeSearchTextList(normalizeKeywordList(languages)),
    currentLocation: normalizeText(safe.location).toLowerCase() || null,
    preferredLocations: sanitizeResumeSearchTextList(normalizeKeywordList(safe.preferredLocations || []).map((item) => item.toLowerCase())),
    noticePeriodDays: Number.isFinite(Number(safe.noticePeriodDays)) ? Number(safe.noticePeriodDays) : null,
    salarySearchable,
    currentSalaryNormalized: salarySearchable && Number.isFinite(Number(safe.currentCtcLpa)) ? Math.round(Number(safe.currentCtcLpa)) : null,
    expectedSalaryNormalized: salarySearchable && Number.isFinite(Number(safe.expectedCtcLpa)) ? Math.round(Number(safe.expectedCtcLpa)) : null,
    parsingConfidence: typeof safe.parserMetadata?.parsedData === 'object'
      ? Number(safe.parserMetadata?.parsedData?.metadata?.documentProcessor?.extractionConfidence || 0) || null
      : null,
    reviewRequired: safe.profileStatus === 'REVIEW_REQUIRED' || Boolean(safe.resumeReviewNeeded),
    resumeUpdatedAt: resume?.updatedAt?.toISOString?.() || safe.updatedAt?.toISOString?.() || null,
    profileUpdatedAt: safe.updatedAt?.toISOString?.() || null,
    sourceVersion,
    indexSchemaVersion: RESUME_SEARCH_INDEX_SCHEMA_VERSION,
  };
}
