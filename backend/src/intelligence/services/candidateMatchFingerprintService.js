import { createFingerprint } from './governanceService.js';

const SOURCE_VERSION = 'candidate-job-match-source-v1';
const SCHEMA_VERSION = '1.0.0';
const RESULT_VERSION = 'candidate-job-match-v1';
const PROMPT_KEY = 'CANDIDATE_JOB_MATCH_FOUNDATION';
const PROMPT_VERSION = '1.0.0';

function compactArray(value = []) {
  return Array.isArray(value)
    ? [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))].sort()
    : [];
}

function summarizeResumeAsset(resumeAsset) {
  if (!resumeAsset) return null;
  return {
    id: resumeAsset.id,
    parsingStatus: resumeAsset.parsingStatus || null,
    externalResumeVersion: resumeAsset.externalResumeVersion || null,
    parsedDataDigest: resumeAsset.parsedData ? createFingerprint(resumeAsset.parsedData) : null,
  };
}

function summarizeCandidate(candidate) {
  return {
    fullName: candidate.fullName || null,
    headline: candidate.headline || null,
    currentTitle: candidate.currentTitle || null,
    currentEmployer: candidate.currentEmployer || null,
    location: candidate.location || null,
    totalExperience: candidate.totalExperience ?? null,
    expectedCtcLpa: candidate.expectedCtcLpa ?? null,
    noticePeriodDays: candidate.noticePeriodDays ?? null,
    workplacePreferences: compactArray(candidate.workplacePreferences),
    employmentPreferences: compactArray(candidate.employmentPreferences),
    skills: compactArray(candidate.skills),
    functionalSkills: compactArray(candidate.functionalSkills),
    tools: compactArray(candidate.tools),
    frameworks: compactArray(candidate.frameworks),
    cloudPlatforms: compactArray(candidate.cloudPlatforms),
    databases: compactArray(candidate.databases),
    educationEntries: Array.isArray(candidate.educationEntries) ? candidate.educationEntries : [],
    linkedInUrlNormalized: candidate.linkedInUrlNormalized || null,
    searchableProfile: Boolean(candidate.searchableProfile),
  };
}

function summarizeJob(job) {
  return {
    title: job.title || null,
    description: job.description || null,
    skillsRequired: compactArray(job.skillsRequired),
    skillsPreferred: compactArray(job.skillsPreferred),
    experienceMin: job.experienceMin ?? null,
    experienceMax: job.experienceMax ?? null,
    location: job.location || null,
    employmentType: job.employmentType || null,
    workplaceType: job.workplaceType || null,
    salaryMin: job.salaryMin ?? null,
    salaryMax: job.salaryMax ?? null,
    currency: job.currency || null,
  };
}

export function buildCandidateJobMatchSourceFingerprint({
  candidate,
  job,
  resumeAsset = null,
  candidateIntelligenceState = null,
  jobDescriptionState = null,
  scoringProfileVersion = null,
  provider = 'DISABLED',
  model = null,
}) {
  return createFingerprint({
    candidate: summarizeCandidate(candidate),
    job: summarizeJob(job),
    resumeAsset: summarizeResumeAsset(resumeAsset),
    candidateIntelligence: candidateIntelligenceState ? {
      id: candidateIntelligenceState.id,
      status: candidateIntelligenceState.status,
      latestResultId: candidateIntelligenceState.latestResultId || null,
      sourceFingerprint: candidateIntelligenceState.sourceFingerprint || null,
      resultVersion: candidateIntelligenceState.resultVersion || null,
    } : null,
    jobDescription: jobDescriptionState ? {
      id: jobDescriptionState.id,
      status: jobDescriptionState.status,
      latestResultId: jobDescriptionState.latestResultId || null,
      sourceFingerprint: jobDescriptionState.sourceFingerprint || null,
      resultVersion: jobDescriptionState.resultVersion || null,
    } : null,
    promptKey: PROMPT_KEY,
    promptVersion: PROMPT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    resultVersion: RESULT_VERSION,
    scoringProfileVersion: scoringProfileVersion ? {
      id: scoringProfileVersion.id,
      version: scoringProfileVersion.version,
      profileId: scoringProfileVersion.profileId,
      normalizationVersion: scoringProfileVersion.normalizationVersion,
      resultVersion: scoringProfileVersion.resultVersion,
    } : null,
    provider,
    model,
    sourceVersion: SOURCE_VERSION,
  });
}

export function getCandidateJobMatchContractVersions() {
  return {
    sourceVersion: SOURCE_VERSION,
    schemaVersion: SCHEMA_VERSION,
    resultVersion: RESULT_VERSION,
    promptKey: PROMPT_KEY,
    promptVersion: PROMPT_VERSION,
  };
}
