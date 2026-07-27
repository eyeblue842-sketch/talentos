import { prisma } from '../../config/db.js';
import { env } from '../../config/env.js';
import { recordAuditLog } from '../../services/auditLogService.js';
import { enqueueBackgroundTask } from '../../services/backgroundTaskService.js';
import { requireIntelligenceFeature } from './featureAccessService.js';
import {
  completeIntelligenceExecution,
  createFingerprint,
  createIntelligenceExecution,
  getFreshCachedResult,
  recordIntelligenceFailure,
  storeIntelligenceResult,
  supersedeCachedResults,
} from './governanceService.js';
import { executeStructuredPrompt } from './intelligenceRuntimeService.js';

const FEATURE = 'CANDIDATE_INTELLIGENCE';
const ENTITY_TYPE = 'CandidateIntelligence';
const DEFAULT_KIND = 'PROFILE_OVERVIEW';
const SOURCE_VERSION = 'candidate-intelligence-source-v1';
const RESULT_VERSION = 'candidate-intelligence-v1';
const SCHEMA_VERSION = '1.0.0';
const STATE_METADATA_VERSION = '1.0.0';
const PROMPT_KEY = 'CANDIDATE_INTELLIGENCE_PROFILE';
const PROMPT_VERSION = '1.0.0';

const meaningfulCandidateFields = [
  'fullName',
  'headline',
  'currentTitle',
  'currentEmployer',
  'currentDesignation',
  'location',
  'currentCity',
  'currentState',
  'currentCountry',
  'totalExperience',
  'summary',
  'skills',
  'functionalSkills',
  'tools',
  'frameworks',
  'cloudPlatforms',
  'databases',
  'softSkills',
  'preferredRoles',
  'preferredLocations',
  'employmentPreferences',
  'workplacePreferences',
  'noticePeriodDays',
  'skillEntries',
  'experienceEntries',
  'educationEntries',
  'certificationEntries',
  'languageEntries',
  'projectEntries',
  'portfolioLinks',
  'linkedInUrlNormalized',
  'githubUrl',
  'portfolioUrl',
  'profileCompletenessScore',
];

const skillAliasMap = new Map([
  ['springboot', 'Spring Boot'],
  ['spring boot', 'Spring Boot'],
  ['spring framework', 'Spring Boot'],
  ['node', 'Node.js'],
  ['nodejs', 'Node.js'],
  ['node.js', 'Node.js'],
  ['js', 'JavaScript'],
  ['javascript', 'JavaScript'],
  ['ts', 'TypeScript'],
  ['typescript', 'TypeScript'],
  ['reactjs', 'React'],
  ['react.js', 'React'],
  ['react', 'React'],
  ['next', 'Next.js'],
  ['nextjs', 'Next.js'],
  ['next.js', 'Next.js'],
  ['postgres', 'PostgreSQL'],
  ['postgresql', 'PostgreSQL'],
  ['mongo', 'MongoDB'],
  ['mongodb', 'MongoDB'],
  ['aws cloud', 'AWS'],
  ['amazon web services', 'AWS'],
  ['aws', 'AWS'],
]);

function iso(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function scrubText(value = '', maxLength = 240) {
  return String(value || '')
    .replace(/[<>{}`$]/g, ' ')
    .replace(/\b[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, '[REDACTED_EMAIL]')
    .replace(/\+?\d[\d\s\-()]{7,}\d/g, '[REDACTED_PHONE]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObjectArray(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : [];
}

function normalizeSkillName(value) {
  const raw = scrubText(value, 80);
  if (!raw) return null;
  const compact = raw.toLowerCase().replace(/[^\w+.#/ -]/g, '').replace(/\s+/g, ' ').trim();
  return skillAliasMap.get(compact) || raw
    .split(/\s+/)
    .map((part) => part ? part[0].toUpperCase() + part.slice(1) : part)
    .join(' ');
}

function collectNormalizedSkills(candidate = {}, resumeAsset = null, importItem = null) {
  const rawSkills = [
    ...asArray(candidate.skills),
    ...asArray(candidate.functionalSkills),
    ...asArray(candidate.tools),
    ...asArray(candidate.frameworks),
    ...asArray(candidate.cloudPlatforms),
    ...asArray(candidate.databases),
    ...asArray(candidate.softSkills),
    ...asArray(resumeAsset?.parsedData?.suggestedUpdates?.skills),
    ...asArray(importItem?.parsedData?.candidate?.skills?.value),
  ];

  const unique = new Map();
  for (const raw of rawSkills) {
    const normalized = normalizeSkillName(raw);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (!unique.has(key)) {
      unique.set(key, {
        name: normalized,
        aliases: [scrubText(raw, 80)].filter(Boolean),
      });
    } else if (raw) {
      const item = unique.get(key);
      if (!item.aliases.includes(scrubText(raw, 80))) {
        item.aliases.push(scrubText(raw, 80));
      }
    }
  }

  return [...unique.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function buildEvidenceCatalog(candidate, resumeAsset, importItem, normalizedSkills) {
  const evidence = [];
  const pushEvidence = (id, sourceType, sourceId, fieldPath, snippet, locator = null) => {
    evidence.push({
      id,
      sourceType,
      sourceId,
      fieldPath,
      snippet: scrubText(snippet, 180) || null,
      locator,
    });
  };

  pushEvidence('ev_profile_title', 'CANDIDATE_PROFILE', candidate.id, 'currentTitle', candidate.currentTitle || candidate.headline || candidate.fullName, 'candidate.currentTitle');
  pushEvidence('ev_profile_summary', 'CANDIDATE_PROFILE', candidate.id, 'summary', candidate.summary, 'candidate.summary');
  pushEvidence('ev_profile_location', 'CANDIDATE_PROFILE', candidate.id, 'location', candidate.location || candidate.currentCity || candidate.currentCountry, 'candidate.location');
  pushEvidence('ev_skills_explicit', 'CANDIDATE_PROFILE', candidate.id, 'skills', normalizedSkills.map((item) => item.name).slice(0, 8).join(', '), 'candidate.skills');

  const latestExperience = asObjectArray(candidate.experienceEntries)[0];
  pushEvidence(
    'ev_experience_recent',
    'CANDIDATE_PROFILE',
    candidate.id,
    'experienceEntries[0]',
    latestExperience ? `${latestExperience.jobTitle || latestExperience.title || 'Role'} at ${latestExperience.employer || latestExperience.company || 'Employer'}` : 'Structured experience entries are limited or unavailable.',
    'candidate.experienceEntries[0]',
  );

  const latestEducation = asObjectArray(candidate.educationEntries)[0];
  pushEvidence(
    'ev_education_recent',
    'CANDIDATE_PROFILE',
    candidate.id,
    'educationEntries[0]',
    latestEducation ? `${latestEducation.degree || latestEducation.qualification || 'Qualification'} at ${latestEducation.institution || latestEducation.school || 'Institution'}` : 'Structured education entries are limited or unavailable.',
    'candidate.educationEntries[0]',
  );

  pushEvidence(
    'ev_data_gap_education',
    'CANDIDATE_PROFILE',
    candidate.id,
    'educationEntries',
    asObjectArray(candidate.educationEntries).length ? 'Structured education entries exist.' : 'No structured education entries are available.',
    'candidate.educationEntries',
  );

  if (resumeAsset) {
    pushEvidence(
      'ev_resume_asset',
      'RESUME_ASSET',
      resumeAsset.id,
      'originalFilename',
      resumeAsset.originalFilename,
      'resumeAsset.originalFilename',
    );
    pushEvidence(
      'ev_resume_parse',
      'RESUME_ASSET',
      resumeAsset.id,
      'parsedText',
      resumeAsset.parsedText || resumeAsset.parsedData?.summary || 'Parsed resume text is unavailable.',
      'resumeAsset.parsedText',
    );
  }

  if (importItem) {
    pushEvidence(
      'ev_import_parser',
      'RESUME_IMPORT_ITEM',
      importItem.id,
      'parserVersion',
      importItem.parserVersion || importItem.metadata?.extraction?.strategy || 'Imported resume parsing metadata available.',
      'resumeImportItem.parserVersion',
    );
  }

  return evidence.filter((item) => item.snippet);
}

function buildMeaningfulProfileSnapshot(candidate) {
  return meaningfulCandidateFields.reduce((accumulator, field) => {
    accumulator[field] = candidate?.[field] ?? null;
    return accumulator;
  }, {});
}

function buildSourceFingerprint(candidate, resumeAsset, importItem, parserVersion) {
  return createFingerprint({
    candidate: buildMeaningfulProfileSnapshot(candidate),
    resumeAsset: resumeAsset ? {
      id: resumeAsset.id,
      updatedAt: iso(resumeAsset.updatedAt || resumeAsset.createdAt),
      parsingStatus: resumeAsset.parsingStatus,
      parsedData: resumeAsset.parsedData || null,
      parsedTextDigest: resumeAsset.parsedText ? createFingerprint(scrubText(resumeAsset.parsedText, 1200)) : null,
      externalResumeVersion: resumeAsset.externalResumeVersion || null,
    } : null,
    resumeImportItem: importItem ? {
      id: importItem.id,
      updatedAt: iso(importItem.updatedAt),
      parserVersion: importItem.parserVersion || null,
      parsedData: importItem.parsedData || null,
    } : null,
    parserVersion: parserVersion || null,
    promptVersion: PROMPT_VERSION,
    sourceVersion: SOURCE_VERSION,
  });
}

function completenessLabel(score) {
  if (score >= 80) return 'HIGH';
  if (score >= 50) return 'MEDIUM';
  return 'LOW';
}

function buildDeterministicSections(candidate, resumeAsset, importItem) {
  const normalizedSkills = collectNormalizedSkills(candidate, resumeAsset, importItem);
  const experienceEntries = asObjectArray(candidate.experienceEntries);
  const educationEntries = asObjectArray(candidate.educationEntries);
  const certificationEntries = asObjectArray(candidate.certificationEntries);
  const projectEntries = asObjectArray(candidate.projectEntries);
  const languageEntries = asObjectArray(candidate.languageEntries);
  const hasResume = Boolean(candidate.latestResumeAssetId || resumeAsset);
  const missingInformation = [
    !candidate.summary ? { code: 'SUMMARY_MISSING', label: 'Professional summary missing', details: 'Candidate summary is not populated.' } : null,
    !experienceEntries.length ? { code: 'EXPERIENCE_MISSING', label: 'Structured experience missing', details: 'Experience entries need review or completion.' } : null,
    !educationEntries.length ? { code: 'EDUCATION_MISSING', label: 'Structured education missing', details: 'Education entries need review or completion.' } : null,
    !hasResume ? { code: 'RESUME_MISSING', label: 'Resume unavailable', details: 'No active resume asset is linked to this candidate.' } : null,
    !candidate.linkedInUrl && !candidate.githubUrl && !candidate.portfolioUrl ? { code: 'LINKS_MISSING', label: 'Professional links missing', details: 'LinkedIn, GitHub, or portfolio links are not available.' } : null,
  ].filter(Boolean);

  const completenessScore = Math.max(0, Math.min(100,
    (candidate.fullName ? 12 : 0)
    + (candidate.currentTitle || candidate.headline ? 12 : 0)
    + (candidate.location ? 8 : 0)
    + (candidate.totalExperience ? 8 : 0)
    + (candidate.summary ? 15 : 0)
    + (normalizedSkills.length >= 3 ? 15 : normalizedSkills.length ? 8 : 0)
    + (experienceEntries.length ? 15 : 0)
    + (educationEntries.length ? 10 : 0)
    + (hasResume ? 15 : 0)
  ));

  const evidenceCatalog = buildEvidenceCatalog(candidate, resumeAsset, importItem, normalizedSkills);
  const overviewText = candidate.summary
    ? scrubText(candidate.summary, 280)
    : `${candidate.fullName} is currently positioned as ${candidate.currentTitle || candidate.headline || 'a professional'}${candidate.location ? ` in ${candidate.location}` : ''}.`;

  const timeline = experienceEntries.slice(0, 6).map((entry, index) => ({
    id: `timeline-${index + 1}`,
    company: scrubText(entry.employer || entry.company, 120) || null,
    title: scrubText(entry.jobTitle || entry.title, 120) || null,
    startDate: entry.startDate || null,
    endDate: entry.endDate || null,
    currentlyWorking: Boolean(entry.currentlyWorking),
    location: scrubText(entry.location, 120) || null,
  }));

  return {
    normalizedSkills,
    evidenceCatalog,
    deterministicOutput: {
      summary: {
        professionalSummary: {
          text: overviewText,
          confidence: {
            score: candidate.summary ? 0.68 : 0.46,
            label: candidate.summary ? 'MEDIUM' : 'LOW',
          },
          evidence: evidenceCatalog.filter((item) => ['ev_profile_summary', 'ev_profile_title', 'ev_profile_location'].includes(item.id)).slice(0, 2),
          generationType: 'DETERMINISTIC',
        },
        roleThemes: [],
      },
      snapshot: {
        candidateId: candidate.id,
        fullName: candidate.fullName,
        currentTitle: candidate.currentTitle || candidate.headline || null,
        currentEmployer: candidate.currentEmployer || null,
        location: candidate.location || null,
        totalExperience: candidate.totalExperience ?? null,
        resumeAvailable: hasResume,
        latestResumeAssetId: resumeAsset?.id || candidate.latestResumeAssetId || null,
        resumeLastUpdatedAt: iso(resumeAsset?.updatedAt || resumeAsset?.createdAt),
        structuredCounts: {
          skills: normalizedSkills.length,
          experienceEntries: experienceEntries.length,
          educationEntries: educationEntries.length,
          certificationEntries: certificationEntries.length,
          projectEntries: projectEntries.length,
          languageEntries: languageEntries.length,
        },
        freshness: {
          candidateUpdatedAt: iso(candidate.updatedAt),
          resumeUpdatedAt: iso(resumeAsset?.updatedAt || resumeAsset?.createdAt),
          importUpdatedAt: iso(importItem?.updatedAt),
        },
      },
      skills: {
        normalized: normalizedSkills,
        keywordClusters: [],
      },
      timeline,
      strengths: [],
      developmentAreas: [],
      recommendedRoles: [],
      missingInformation,
      profileCompleteness: {
        score: completenessScore,
        label: completenessLabel(completenessScore),
        missingFields: missingInformation.map((item) => item.label),
      },
      confidence: {
        overallScore: candidate.summary ? 0.58 : 0.42,
        overallLabel: candidate.summary ? 'MEDIUM' : 'LOW',
        deterministicCoverage: Math.min(1, (normalizedSkills.length + experienceEntries.length + educationEntries.length + (hasResume ? 2 : 0)) / 12),
        aiSignalCount: 0,
      },
      quality: {
        score: Math.max(0, Math.min(100, Math.round((completenessScore * 0.7) + (hasResume ? 20 : 0) + (experienceEntries.length ? 5 : 0)))),
        label: completenessLabel(Math.round((completenessScore * 0.7) + (hasResume ? 20 : 0))),
      },
      warnings: missingInformation.map((item) => item.label),
    },
  };
}

function confidenceLabel(score) {
  if (score == null || Number.isNaN(score)) return 'UNKNOWN';
  if (score >= 0.8) return 'HIGH';
  if (score >= 0.55) return 'MEDIUM';
  return 'LOW';
}

function mapEvidenceIds(evidenceCatalog, evidenceIds = []) {
  const evidenceMap = new Map(evidenceCatalog.map((item) => [item.id, item]));
  const mapped = evidenceIds.map((id) => evidenceMap.get(id)).filter(Boolean);
  if (!mapped.length) {
    const error = new Error('Candidate intelligence output must include supported evidence.');
    error.code = 'INTELLIGENCE_EVIDENCE_REQUIRED';
    error.retryable = false;
    throw error;
  }
  return mapped;
}

function mapAiStatement(statement, evidenceCatalog) {
  return {
    text: scrubText(statement.text, 400),
    confidence: {
      score: statement.confidence,
      label: confidenceLabel(statement.confidence),
    },
    evidence: mapEvidenceIds(evidenceCatalog, statement.evidenceIds),
    generationType: 'AI_GENERATED',
  };
}

function buildAiEnhancedOutput(aiOutput, deterministicOutput, evidenceCatalog) {
  const strengths = aiOutput.strengths.map((item) => mapAiStatement(item, evidenceCatalog));
  const developmentAreas = aiOutput.developmentAreas.map((item) => mapAiStatement(item, evidenceCatalog));
  const roleThemes = aiOutput.roleThemes.map((item) => mapAiStatement(item, evidenceCatalog));
  const keywordClusters = aiOutput.keywordClusters.map((item) => mapAiStatement(item, evidenceCatalog));
  const recommendedRoles = aiOutput.recommendedRoles.map((item) => ({
    role: scrubText(item.role, 160),
    confidence: {
      score: item.confidence,
      label: confidenceLabel(item.confidence),
    },
    evidence: mapEvidenceIds(evidenceCatalog, item.evidenceIds),
    generationType: 'AI_GENERATED',
    rationale: scrubText(item.rationale, 400),
  }));

  const aiStatements = [
    ...strengths,
    ...developmentAreas,
    ...roleThemes,
    ...keywordClusters,
    ...recommendedRoles.map((item) => ({ confidence: item.confidence })),
  ];
  const averageConfidence = aiStatements.length
    ? aiStatements.reduce((total, item) => total + (item.confidence.score || 0), 0) / aiStatements.length
    : deterministicOutput.confidence.overallScore;

  const qualityScore = Math.max(0, Math.min(100, Math.round(
    (deterministicOutput.profileCompleteness.score * 0.55)
    + (averageConfidence * 35)
    + (aiStatements.length ? 10 : 0)
  )));

  return {
    ...deterministicOutput,
    summary: {
      professionalSummary: mapAiStatement(aiOutput.professionalSummary, evidenceCatalog),
      roleThemes,
    },
    skills: {
      ...deterministicOutput.skills,
      keywordClusters,
    },
    strengths,
    developmentAreas,
    recommendedRoles,
    confidence: {
      overallScore: averageConfidence,
      overallLabel: confidenceLabel(averageConfidence),
      deterministicCoverage: deterministicOutput.confidence.deterministicCoverage,
      aiSignalCount: aiStatements.length,
    },
    quality: {
      score: qualityScore,
      label: completenessLabel(qualityScore),
    },
    warnings: [...new Set([...deterministicOutput.warnings, ...aiOutput.warnings.map((item) => scrubText(item, 160)).filter(Boolean)])],
  };
}

function buildCandidateIntelligenceInput(candidate, resumeAsset, importItem, deterministicSections) {
  return {
    dataClass: 'CANDIDATE_PROFESSIONAL',
    candidateId: candidate.id,
    profile: {
      fullName: scrubText(candidate.fullName, 120),
      headline: scrubText(candidate.headline, 160),
      currentTitle: scrubText(candidate.currentTitle, 160),
      currentEmployer: scrubText(candidate.currentEmployer, 160),
      currentDesignation: scrubText(candidate.currentDesignation, 160),
      location: scrubText(candidate.location, 120),
      totalExperience: candidate.totalExperience ?? null,
      summary: scrubText(candidate.summary, 1800),
      normalizedSkills: deterministicSections.normalizedSkills.map((item) => item.name),
      preferredRoles: asArray(candidate.preferredRoles).map((item) => scrubText(item, 120)).filter(Boolean),
      preferredLocations: asArray(candidate.preferredLocations).map((item) => scrubText(item, 120)).filter(Boolean),
      experienceEntries: asObjectArray(candidate.experienceEntries).slice(0, 8).map((entry) => ({
        company: scrubText(entry.company || entry.employer, 120),
        title: scrubText(entry.title || entry.jobTitle, 120),
        startDate: entry.startDate || null,
        endDate: entry.endDate || null,
        currentlyWorking: Boolean(entry.currentlyWorking),
      })),
      educationEntries: asObjectArray(candidate.educationEntries).slice(0, 6).map((entry) => ({
        institution: scrubText(entry.institution || entry.school, 120),
        degree: scrubText(entry.degree || entry.qualification, 120),
        completionYear: entry.completionYear || entry.endYear || null,
      })),
    },
    resume: {
      available: Boolean(resumeAsset),
      source: resumeAsset?.source || null,
      parsingStatus: resumeAsset?.parsingStatus || null,
      parserVersion: importItem?.parserVersion || candidate.parserVersion || null,
      safeResumeSnippet: scrubText(resumeAsset?.parsedText || candidate.rawResumeText || '', 600),
    },
    dataGaps: deterministicSections.deterministicOutput.missingInformation.map((item) => item.label),
    evidenceCatalog: deterministicSections.evidenceCatalog.map((item) => ({
      id: item.id,
      sourceType: item.sourceType,
      fieldPath: item.fieldPath,
      snippet: item.snippet,
    })),
  };
}

async function getAccessibleCandidate(context, candidateId) {
  const candidate = await prisma.candidateProfile.findFirst({
    where: {
      id: candidateId,
      OR: [
        { organisationId: context.organisationId },
        { applications: { some: { organisationId: context.organisationId } } },
        { savedByRecruiters: { some: { organisationId: context.organisationId } } },
      ],
    },
    include: {
      latestResumeAsset: true,
      importedFromItems: {
        where: { organisationId: context.organisationId },
        orderBy: { updatedAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!candidate) {
    const error = new Error('Candidate not found.');
    error.statusCode = 404;
    throw error;
  }

  return candidate;
}

async function getLatestResultForCandidate(organisationId, candidateId) {
  return prisma.intelligenceResult.findFirst({
    where: {
      organisationId,
      entityType: ENTITY_TYPE,
      entityId: candidateId,
      resultVersion: RESULT_VERSION,
      promptVersion: PROMPT_VERSION,
      dismissedAt: null,
      supersededAt: null,
    },
    include: { execution: true },
    orderBy: { createdAt: 'desc' },
  });
}

async function upsertCandidateIntelligenceState(candidate, payload) {
  const organisationId = payload.organisationId || candidate.organisationId;
  if (!organisationId) {
    const error = new Error('Organisation-scoped candidate intelligence requires an organisation context.');
    error.code = 'CANDIDATE_INTELLIGENCE_ORGANISATION_REQUIRED';
    error.retryable = false;
    throw error;
  }

  return prisma.candidateIntelligenceState.upsert({
    where: {
      organisationId_candidateId_kind: {
        organisationId,
        candidateId: candidate.id,
        kind: payload.kind || DEFAULT_KIND,
      },
    },
    create: {
      organisationId,
      candidateId: candidate.id,
      kind: payload.kind || DEFAULT_KIND,
      status: payload.status || 'PENDING',
      latestExecutionId: payload.latestExecutionId || null,
      latestResultId: payload.latestResultId || null,
      latestResumeAssetId: payload.latestResumeAssetId || null,
      latestImportItemId: payload.latestImportItemId || null,
      sourceFingerprint: payload.sourceFingerprint,
      sourceVersion: SOURCE_VERSION,
      parserVersion: payload.parserVersion || null,
      schemaVersion: SCHEMA_VERSION,
      promptKey: PROMPT_KEY,
      promptVersion: PROMPT_VERSION,
      resultVersion: RESULT_VERSION,
      provider: payload.provider || null,
      providerVersion: payload.providerVersion || null,
      model: payload.model || null,
      modelVersion: payload.modelVersion || null,
      latencyMs: payload.latencyMs || null,
      inputTokens: payload.inputTokens || null,
      outputTokens: payload.outputTokens || null,
      estimatedCost: payload.estimatedCost ?? null,
      generatedAt: payload.generatedAt || null,
      lastGeneratedAt: payload.lastGeneratedAt || payload.generatedAt || null,
      lastSourceChangedAt: payload.lastSourceChangedAt || null,
      staleReason: payload.staleReason || null,
      lastErrorCode: payload.lastErrorCode || null,
      lastErrorMessage: payload.lastErrorMessage || null,
      aiEnabled: Boolean(payload.aiEnabled),
      metadata: payload.metadata || {},
    },
    update: {
      status: payload.status || undefined,
      latestExecutionId: payload.latestExecutionId === undefined ? undefined : payload.latestExecutionId,
      latestResultId: payload.latestResultId === undefined ? undefined : payload.latestResultId,
      latestResumeAssetId: payload.latestResumeAssetId === undefined ? undefined : payload.latestResumeAssetId,
      latestImportItemId: payload.latestImportItemId === undefined ? undefined : payload.latestImportItemId,
      sourceFingerprint: payload.sourceFingerprint,
      sourceVersion: SOURCE_VERSION,
      parserVersion: payload.parserVersion === undefined ? undefined : payload.parserVersion,
      schemaVersion: SCHEMA_VERSION,
      promptKey: PROMPT_KEY,
      promptVersion: PROMPT_VERSION,
      resultVersion: RESULT_VERSION,
      provider: payload.provider === undefined ? undefined : payload.provider,
      providerVersion: payload.providerVersion === undefined ? undefined : payload.providerVersion,
      model: payload.model === undefined ? undefined : payload.model,
      modelVersion: payload.modelVersion === undefined ? undefined : payload.modelVersion,
      latencyMs: payload.latencyMs === undefined ? undefined : payload.latencyMs,
      inputTokens: payload.inputTokens === undefined ? undefined : payload.inputTokens,
      outputTokens: payload.outputTokens === undefined ? undefined : payload.outputTokens,
      estimatedCost: payload.estimatedCost === undefined ? undefined : payload.estimatedCost,
      generatedAt: payload.generatedAt === undefined ? undefined : payload.generatedAt,
      lastGeneratedAt: payload.lastGeneratedAt === undefined ? undefined : payload.lastGeneratedAt,
      lastSourceChangedAt: payload.lastSourceChangedAt === undefined ? undefined : payload.lastSourceChangedAt,
      staleReason: payload.staleReason === undefined ? undefined : payload.staleReason,
      lastErrorCode: payload.lastErrorCode === undefined ? undefined : payload.lastErrorCode,
      lastErrorMessage: payload.lastErrorMessage === undefined ? undefined : payload.lastErrorMessage,
      aiEnabled: payload.aiEnabled === undefined ? undefined : Boolean(payload.aiEnabled),
      metadata: payload.metadata === undefined ? undefined : payload.metadata,
    },
    include: {
      latestExecution: true,
      latestResult: { include: { execution: true } },
    },
  });
}

function buildExecutionSection(state, execution, extra = {}) {
  const projectedStatus = extra.statusOverride
    || (extra.stale
      ? 'STALE'
      : execution?.status === 'SKIPPED'
        ? 'DISABLED'
        : execution?.status === 'SUCCEEDED'
          ? 'READY'
          : state?.status || execution?.status || 'PENDING');
  return {
    stateId: state?.id || null,
    executionId: execution?.id || state?.latestExecutionId || null,
    resultId: state?.latestResultId || null,
    status: projectedStatus,
    cacheHit: Boolean(extra.cacheHit),
    aiEnabled: Boolean(state?.aiEnabled),
    stale: Boolean(extra.stale),
    generatedAt: iso(state?.generatedAt || state?.lastGeneratedAt || execution?.completedAt),
    provider: state?.provider || execution?.provider || 'DISABLED',
    providerVersion: state?.providerVersion || null,
    model: state?.model || execution?.model || null,
    modelVersion: state?.modelVersion || null,
    parserVersion: state?.parserVersion || null,
    schemaVersion: state?.schemaVersion || SCHEMA_VERSION,
    promptKey: state?.promptKey || PROMPT_KEY,
    promptVersion: state?.promptVersion || PROMPT_VERSION,
    resultVersion: state?.resultVersion || RESULT_VERSION,
    sourceVersion: state?.sourceVersion || SOURCE_VERSION,
    latencyMs: state?.latencyMs || execution?.latencyMs || 0,
    inputTokens: state?.inputTokens ?? execution?.promptTokens ?? null,
    outputTokens: state?.outputTokens ?? execution?.completionTokens ?? null,
    estimatedCost: state?.estimatedCost != null ? Number(state.estimatedCost) : (execution?.estimatedCost != null ? Number(execution.estimatedCost) : null),
  };
}

function buildApiResponseFromStoredResult(state, result, extra = {}) {
  const output = result?.normalizedOutput || extra.fallbackOutput;
  return {
    ...(output || {}),
    execution: buildExecutionSection(state, result?.execution, extra),
  };
}

async function ensureGenerationTask(candidate, actorUserId, state, forceRegenerate = false) {
  const existingTask = await prisma.backgroundTask.findFirst({
    where: {
      type: 'CANDIDATE_INTELLIGENCE_GENERATION',
      entityType: 'CandidateProfile',
      entityId: candidate.id,
      status: { in: ['PENDING', 'RUNNING', 'RETRY_SCHEDULED'] },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (existingTask) return existingTask;

  const idempotencyKey = forceRegenerate
    ? `candidate-intelligence:${candidate.id}:${state.kind}:force:${state.lastGeneratedAt?.getTime?.() || 'none'}`
    : `candidate-intelligence:${candidate.id}:${state.kind}:${state.sourceFingerprint}`;

  return enqueueBackgroundTask({
    organisationId: state.organisationId || candidate.organisationId || null,
    type: 'CANDIDATE_INTELLIGENCE_GENERATION',
    entityType: 'CandidateProfile',
    entityId: candidate.id,
    idempotencyKey,
    payload: {
      candidateId: candidate.id,
      kind: state.kind,
      requestedByUserId: actorUserId,
    },
    nextAttemptAt: new Date(),
    createdByUserId: actorUserId || null,
    maxAttempts: Math.max(1, env.intelligenceMaxRetries + 1),
  });
}

async function buildCandidateContext(actorUser, candidateId, mode = 'read') {
  const permissionContext = await requireIntelligenceFeature(actorUser, FEATURE, null, mode);
  const candidate = await getAccessibleCandidate(permissionContext, candidateId);
  const resumeAsset = candidate.latestResumeAsset || null;
  const importItem = candidate.importedFromItems?.[0] || null;
  const parserVersion = importItem?.parserVersion || candidate.parserVersion || resumeAsset?.parsedData?.parser || null;
  const sourceFingerprint = buildSourceFingerprint(candidate, resumeAsset, importItem, parserVersion);
  const deterministicSections = buildDeterministicSections(candidate, resumeAsset, importItem);

  return {
    permissionContext,
    candidate,
    resumeAsset,
    importItem,
    parserVersion,
    sourceFingerprint,
    deterministicSections,
    aiEnabled: Boolean(permissionContext.enabled),
  };
}

async function markStateForCurrentSource(context, existingState = null) {
  const state = await upsertCandidateIntelligenceState(context.candidate, {
    organisationId: context.permissionContext.organisationId,
    kind: DEFAULT_KIND,
    status: existingState?.status || (context.aiEnabled ? 'PENDING' : 'DISABLED'),
    latestExecutionId: existingState?.latestExecutionId || null,
    latestResultId: existingState?.latestResultId || null,
    latestResumeAssetId: context.resumeAsset?.id || null,
    latestImportItemId: context.importItem?.id || null,
    sourceFingerprint: context.sourceFingerprint,
    parserVersion: context.parserVersion,
    provider: context.aiEnabled ? env.intelligenceProvider : 'DISABLED',
    providerVersion: context.aiEnabled ? `provider:${env.intelligenceProvider.toLowerCase()}` : 'provider:disabled',
    model: context.aiEnabled ? (env.awsBedrockModelId || env.intelligenceModel || null) : null,
    modelVersion: context.aiEnabled ? (env.awsBedrockModelId || env.intelligenceModel || null) : null,
    aiEnabled: context.aiEnabled,
    lastSourceChangedAt: existingState?.sourceFingerprint && existingState.sourceFingerprint !== context.sourceFingerprint ? new Date() : (existingState?.lastSourceChangedAt || null),
    staleReason: existingState?.sourceFingerprint && existingState.sourceFingerprint !== context.sourceFingerprint ? 'SOURCE_CHANGED' : (existingState?.staleReason || null),
    metadata: {
      version: STATE_METADATA_VERSION,
      deterministicOnly: !context.aiEnabled,
    },
  });

  if (existingState?.sourceFingerprint && existingState.sourceFingerprint !== context.sourceFingerprint && ['READY', 'FAILED', 'DISABLED'].includes(state.status)) {
    return upsertCandidateIntelligenceState(context.candidate, {
      organisationId: context.permissionContext.organisationId,
      kind: DEFAULT_KIND,
      status: 'STALE',
      latestExecutionId: state.latestExecutionId,
      latestResultId: state.latestResultId,
      latestResumeAssetId: context.resumeAsset?.id || null,
      latestImportItemId: context.importItem?.id || null,
      sourceFingerprint: context.sourceFingerprint,
      parserVersion: context.parserVersion,
      provider: state.provider,
      providerVersion: state.providerVersion,
      model: state.model,
      modelVersion: state.modelVersion,
      aiEnabled: context.aiEnabled,
      lastSourceChangedAt: new Date(),
      staleReason: 'SOURCE_CHANGED',
      metadata: state.metadata || {},
    });
  }

  return state;
}

async function storeDeterministicOnlyResult(context) {
  const execution = await createIntelligenceExecution({
    organisationId: context.permissionContext.organisationId,
    requestedByUserId: null,
    feature: FEATURE,
    promptKey: PROMPT_KEY,
    promptVersion: PROMPT_VERSION,
    provider: 'DISABLED',
    model: null,
    inputPayload: { candidateId: context.candidate.id, kind: DEFAULT_KIND, deterministicOnly: true },
    metadata: { sourceVersion: SOURCE_VERSION, schemaVersion: SCHEMA_VERSION },
  });

  await supersedeCachedResults({
    organisationId: context.permissionContext.organisationId,
    entityType: ENTITY_TYPE,
    entityId: context.candidate.id,
    resultVersion: RESULT_VERSION,
  });

  const stored = await storeIntelligenceResult({
    organisationId: context.permissionContext.organisationId,
    executionId: execution.id,
    entityType: ENTITY_TYPE,
    entityId: context.candidate.id,
    sourceFingerprint: context.sourceFingerprint,
    resultVersion: RESULT_VERSION,
    promptVersion: PROMPT_VERSION,
    normalizedOutput: context.deterministicSections.deterministicOutput,
    explanation: context.deterministicSections.deterministicOutput.summary.professionalSummary.text,
    confidence: Math.round((context.deterministicSections.deterministicOutput.confidence.overallScore || 0) * 100) / 100,
    feature: FEATURE,
  });

  await completeIntelligenceExecution(execution.id, {
    status: 'SKIPPED',
    outputCharacterCount: JSON.stringify(context.deterministicSections.deterministicOutput).length,
  });

  const state = await upsertCandidateIntelligenceState(context.candidate, {
    organisationId: context.permissionContext.organisationId,
    kind: DEFAULT_KIND,
    status: 'DISABLED',
    latestExecutionId: execution.id,
    latestResultId: stored.id,
    latestResumeAssetId: context.resumeAsset?.id || null,
    latestImportItemId: context.importItem?.id || null,
    sourceFingerprint: context.sourceFingerprint,
    parserVersion: context.parserVersion,
    provider: 'DISABLED',
    providerVersion: 'provider:disabled',
    model: null,
    modelVersion: null,
    latencyMs: 0,
    inputTokens: 0,
    outputTokens: 0,
    estimatedCost: 0,
    generatedAt: stored.createdAt,
    lastGeneratedAt: stored.createdAt,
    aiEnabled: false,
    metadata: { version: STATE_METADATA_VERSION, deterministicOnly: true },
  });

  return buildApiResponseFromStoredResult(state, { ...stored, execution }, { cacheHit: false, stale: false });
}

export async function getCandidateIntelligence(actorUser, payload, requestMeta = {}) {
  const candidateId = payload.candidateId;
  const context = await buildCandidateContext(actorUser, candidateId, 'read');
  const existingState = await prisma.candidateIntelligenceState.findUnique({
    where: {
      organisationId_candidateId_kind: {
        organisationId: context.permissionContext.organisationId,
        candidateId,
        kind: DEFAULT_KIND,
      },
    },
    include: {
      latestExecution: true,
      latestResult: { include: { execution: true } },
    },
  });
  const state = await markStateForCurrentSource(context, existingState);

  const cached = await getFreshCachedResult({
    organisationId: context.permissionContext.organisationId,
    entityType: ENTITY_TYPE,
    entityId: candidateId,
    sourceFingerprint: context.sourceFingerprint,
    resultVersion: RESULT_VERSION,
    promptVersion: PROMPT_VERSION,
  });

  if (cached) {
    return buildApiResponseFromStoredResult(state, cached, {
      cacheHit: true,
      stale: false,
      statusOverride: cached.execution?.status === 'SKIPPED' ? 'DISABLED' : 'READY',
    });
  }

  const latest = await getLatestResultForCandidate(context.permissionContext.organisationId, candidateId);

  if (!context.aiEnabled && (!latest || latest.sourceFingerprint !== context.sourceFingerprint)) {
    return storeDeterministicOnlyResult(context);
  }

  await ensureGenerationTask(context.candidate, actorUser.id, state, false).catch(() => null);

  const fallbackOutput = latest?.normalizedOutput || context.deterministicSections.deterministicOutput;
  const fallbackStatus = latest ? 'STALE' : (context.aiEnabled ? 'PENDING' : 'DISABLED');
  const nextState = await upsertCandidateIntelligenceState(context.candidate, {
    organisationId: context.permissionContext.organisationId,
    kind: DEFAULT_KIND,
    status: fallbackStatus,
    latestExecutionId: state.latestExecutionId,
    latestResultId: latest?.id || state.latestResultId || null,
    latestResumeAssetId: context.resumeAsset?.id || null,
    latestImportItemId: context.importItem?.id || null,
    sourceFingerprint: context.sourceFingerprint,
    parserVersion: context.parserVersion,
    provider: state.provider || (context.aiEnabled ? env.intelligenceProvider : 'DISABLED'),
    providerVersion: state.providerVersion,
    model: state.model,
    modelVersion: state.modelVersion,
    aiEnabled: context.aiEnabled,
    lastSourceChangedAt: latest ? new Date() : state.lastSourceChangedAt,
    staleReason: latest ? 'SOURCE_CHANGED' : state.staleReason,
    metadata: state.metadata || {},
  });

  await recordAuditLog({
    organisationId: context.permissionContext.organisationId,
    actorUserId: actorUser.id,
    action: 'intelligence.candidate.read',
    entityType: 'CandidateProfile',
    entityId: candidateId,
    metadata: {
      kind: DEFAULT_KIND,
      cached: false,
      staleServed: Boolean(latest),
    },
    ipAddress: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
  }).catch(() => {});

  return buildApiResponseFromStoredResult(nextState, latest, {
    cacheHit: false,
    stale: Boolean(latest),
    statusOverride: latest ? 'STALE' : fallbackStatus,
    fallbackOutput,
  });
}

export async function getCandidateIntelligenceStatus(actorUser, payload) {
  const context = await buildCandidateContext(actorUser, payload.candidateId, 'read');
  const existingState = await prisma.candidateIntelligenceState.findUnique({
    where: {
      organisationId_candidateId_kind: {
        organisationId: context.permissionContext.organisationId,
        candidateId: payload.candidateId,
        kind: DEFAULT_KIND,
      },
    },
  });
  const state = await markStateForCurrentSource(context, existingState);
  const latest = await getLatestResultForCandidate(context.permissionContext.organisationId, payload.candidateId);

  return {
    candidateId: payload.candidateId,
    kind: DEFAULT_KIND,
    status: latest && latest.sourceFingerprint !== context.sourceFingerprint ? 'STALE' : state.status,
    stale: Boolean(latest && latest.sourceFingerprint !== context.sourceFingerprint),
    aiEnabled: context.aiEnabled,
    generatedAt: iso(state.generatedAt || state.lastGeneratedAt),
    latestExecutionId: state.latestExecutionId,
    latestResultId: state.latestResultId,
    sourceVersion: SOURCE_VERSION,
    promptVersion: PROMPT_VERSION,
    resultVersion: RESULT_VERSION,
  };
}

export async function regenerateCandidateIntelligence(actorUser, payload, requestMeta = {}) {
  const context = await buildCandidateContext(actorUser, payload.candidateId, 'generate');
  const state = await upsertCandidateIntelligenceState(context.candidate, {
    organisationId: context.permissionContext.organisationId,
    kind: DEFAULT_KIND,
    status: context.aiEnabled ? 'PENDING' : 'DISABLED',
    latestResumeAssetId: context.resumeAsset?.id || null,
    latestImportItemId: context.importItem?.id || null,
    sourceFingerprint: context.sourceFingerprint,
    parserVersion: context.parserVersion,
    provider: context.aiEnabled ? env.intelligenceProvider : 'DISABLED',
    providerVersion: context.aiEnabled ? `provider:${env.intelligenceProvider.toLowerCase()}` : 'provider:disabled',
    model: context.aiEnabled ? (env.awsBedrockModelId || env.intelligenceModel || null) : null,
    modelVersion: context.aiEnabled ? (env.awsBedrockModelId || env.intelligenceModel || null) : null,
    aiEnabled: context.aiEnabled,
    lastSourceChangedAt: new Date(),
    staleReason: payload.forceRegenerate ? 'FORCED_REGENERATION' : 'REQUESTED_REGENERATION',
    metadata: { version: STATE_METADATA_VERSION, deterministicOnly: !context.aiEnabled },
  });

  const task = await ensureGenerationTask(context.candidate, actorUser.id, state, payload.forceRegenerate !== false);

  await recordAuditLog({
    organisationId: context.permissionContext.organisationId,
    actorUserId: actorUser.id,
    action: 'intelligence.candidate.regenerate',
    entityType: 'CandidateProfile',
    entityId: context.candidate.id,
    metadata: {
      kind: DEFAULT_KIND,
      taskId: task?.id || null,
      aiEnabled: context.aiEnabled,
    },
    ipAddress: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
  }).catch(() => {});

  return {
    candidateId: context.candidate.id,
    kind: DEFAULT_KIND,
    status: state.status,
    queued: Boolean(task),
    aiEnabled: context.aiEnabled,
    execution: buildExecutionSection(state, null, { cacheHit: false, stale: state.status === 'STALE' }),
  };
}

function providerVersionFor(provider) {
  switch (provider) {
    case 'MOCK':
      return 'provider:mock-v1';
    case 'BEDROCK':
      return 'provider:bedrock-v1';
    case 'DISABLED':
      return 'provider:disabled';
    default:
      return `provider:${String(provider || 'unknown').toLowerCase()}`;
  }
}

export async function runCandidateIntelligenceGenerationTask(task) {
  const candidateId = task.payload?.candidateId || task.entityId;
  const requestedByUserId = task.payload?.requestedByUserId || task.createdByUserId || null;
  if (!candidateId) return 'cancelled';

  const actorUser = requestedByUserId
    ? await prisma.user.findUnique({
        where: { id: requestedByUserId },
        include: { recruiterProfile: true, candidateProfile: true },
      })
    : null;

  if (!actorUser) return 'cancelled';

  const context = await buildCandidateContext(actorUser, candidateId, 'generate');
  const state = await upsertCandidateIntelligenceState(context.candidate, {
    organisationId: context.permissionContext.organisationId,
    kind: DEFAULT_KIND,
    status: context.aiEnabled ? 'PENDING' : 'DISABLED',
    latestResumeAssetId: context.resumeAsset?.id || null,
    latestImportItemId: context.importItem?.id || null,
    sourceFingerprint: context.sourceFingerprint,
    parserVersion: context.parserVersion,
    provider: context.aiEnabled ? env.intelligenceProvider : 'DISABLED',
    providerVersion: providerVersionFor(context.aiEnabled ? env.intelligenceProvider : 'DISABLED'),
    model: context.aiEnabled ? (env.awsBedrockModelId || env.intelligenceModel || null) : null,
    modelVersion: context.aiEnabled ? (env.awsBedrockModelId || env.intelligenceModel || null) : null,
    aiEnabled: context.aiEnabled,
    metadata: { version: STATE_METADATA_VERSION, deterministicOnly: !context.aiEnabled },
  });

  const execution = await createIntelligenceExecution({
    organisationId: context.permissionContext.organisationId,
    requestedByUserId,
    feature: FEATURE,
    promptKey: PROMPT_KEY,
    promptVersion: PROMPT_VERSION,
    provider: context.aiEnabled ? env.intelligenceProvider : 'DISABLED',
    model: context.aiEnabled ? (env.awsBedrockModelId || env.intelligenceModel || null) : null,
    inputPayload: {
      candidateId,
      kind: DEFAULT_KIND,
      sourceFingerprint: context.sourceFingerprint,
    },
    metadata: {
      sourceVersion: SOURCE_VERSION,
      schemaVersion: SCHEMA_VERSION,
      parserVersion: context.parserVersion,
    },
  });

  try {
    let normalizedOutput = context.deterministicSections.deterministicOutput;
    let promptTokens = 0;
    let completionTokens = 0;
    let latencyMs = 0;

    if (context.aiEnabled) {
      const runtime = await executeStructuredPrompt({
        promptKey: PROMPT_KEY,
        input: buildCandidateIntelligenceInput(context.candidate, context.resumeAsset, context.importItem, context.deterministicSections),
      });
      normalizedOutput = buildAiEnhancedOutput(runtime.output, context.deterministicSections.deterministicOutput, context.deterministicSections.evidenceCatalog);
      promptTokens = runtime.promptTokens || 0;
      completionTokens = runtime.completionTokens || 0;
      latencyMs = runtime.latencyMs || 0;
    }

    await supersedeCachedResults({
      organisationId: context.permissionContext.organisationId,
      entityType: ENTITY_TYPE,
      entityId: candidateId,
      resultVersion: RESULT_VERSION,
    });

    const stored = await storeIntelligenceResult({
      organisationId: context.permissionContext.organisationId,
      executionId: execution.id,
      entityType: ENTITY_TYPE,
      entityId: candidateId,
      sourceFingerprint: context.sourceFingerprint,
      resultVersion: RESULT_VERSION,
      promptVersion: PROMPT_VERSION,
      normalizedOutput,
      explanation: normalizedOutput.summary.professionalSummary.text,
      confidence: Math.round((normalizedOutput.quality.score || 0) * 100) / 100,
      feature: FEATURE,
    });

    await completeIntelligenceExecution(execution.id, {
      status: context.aiEnabled ? 'SUCCEEDED' : 'SKIPPED',
      promptTokens,
      completionTokens,
      latencyMs,
      outputCharacterCount: JSON.stringify(normalizedOutput).length,
      cacheHit: false,
      retries: Math.max(0, (task.attemptCount || 1) - 1),
    });

    await upsertCandidateIntelligenceState(context.candidate, {
      organisationId: context.permissionContext.organisationId,
      kind: DEFAULT_KIND,
      status: context.aiEnabled ? 'READY' : 'DISABLED',
      latestExecutionId: execution.id,
      latestResultId: stored.id,
      latestResumeAssetId: context.resumeAsset?.id || null,
      latestImportItemId: context.importItem?.id || null,
      sourceFingerprint: context.sourceFingerprint,
      parserVersion: context.parserVersion,
      provider: context.aiEnabled ? env.intelligenceProvider : 'DISABLED',
      providerVersion: providerVersionFor(context.aiEnabled ? env.intelligenceProvider : 'DISABLED'),
      model: context.aiEnabled ? (env.awsBedrockModelId || env.intelligenceModel || null) : null,
      modelVersion: context.aiEnabled ? (env.awsBedrockModelId || env.intelligenceModel || null) : null,
      latencyMs,
      inputTokens: promptTokens,
      outputTokens: completionTokens,
      estimatedCost: 0,
      generatedAt: stored.createdAt,
      lastGeneratedAt: stored.createdAt,
      lastSourceChangedAt: null,
      staleReason: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      aiEnabled: context.aiEnabled,
      metadata: {
        version: STATE_METADATA_VERSION,
        deterministicOnly: !context.aiEnabled,
        schemaVersion: SCHEMA_VERSION,
      },
    });

    await recordAuditLog({
      organisationId: context.permissionContext.organisationId,
      actorUserId: requestedByUserId,
      action: 'intelligence.candidate.generate',
      entityType: ENTITY_TYPE,
      entityId: stored.id,
      metadata: {
        candidateId,
        kind: DEFAULT_KIND,
        aiEnabled: context.aiEnabled,
        taskId: task.id,
      },
    }).catch(() => {});

    return 'success';
  } catch (error) {
    await recordIntelligenceFailure(execution.id, error).catch(() => {});
    await upsertCandidateIntelligenceState(context.candidate, {
      organisationId: context.permissionContext.organisationId,
      kind: DEFAULT_KIND,
      status: context.aiEnabled ? 'FAILED' : 'DISABLED',
      latestExecutionId: execution.id,
      latestResumeAssetId: context.resumeAsset?.id || null,
      latestImportItemId: context.importItem?.id || null,
      sourceFingerprint: context.sourceFingerprint,
      parserVersion: context.parserVersion,
      provider: context.aiEnabled ? env.intelligenceProvider : 'DISABLED',
      providerVersion: providerVersionFor(context.aiEnabled ? env.intelligenceProvider : 'DISABLED'),
      model: context.aiEnabled ? (env.awsBedrockModelId || env.intelligenceModel || null) : null,
      modelVersion: context.aiEnabled ? (env.awsBedrockModelId || env.intelligenceModel || null) : null,
      lastErrorCode: error.code || 'CANDIDATE_INTELLIGENCE_FAILED',
      lastErrorMessage: String(error.message || 'Candidate intelligence generation failed.').slice(0, 1000),
      aiEnabled: context.aiEnabled,
      metadata: { version: STATE_METADATA_VERSION, deterministicOnly: !context.aiEnabled },
    });
    throw error;
  }
}

export async function markCandidateIntelligenceStale(candidateId, reason = 'SOURCE_CHANGED') {
  return prisma.candidateIntelligenceState.updateMany({
    where: { candidateId },
    data: {
      status: 'STALE',
      staleReason: String(reason).slice(0, 120),
      lastSourceChangedAt: new Date(),
    },
  }).catch(() => ({ count: 0 }));
}

export {
  DEFAULT_KIND as candidateIntelligenceDefaultKind,
  PROMPT_VERSION as candidateIntelligencePromptVersion,
  RESULT_VERSION as candidateIntelligenceResultVersion,
  SOURCE_VERSION as candidateIntelligenceSourceVersion,
  buildSourceFingerprint as buildCandidateIntelligenceSourceFingerprint,
  buildDeterministicSections as buildDeterministicCandidateIntelligence,
  normalizeSkillName,
};
