import { env } from '../../config/env.js';
import { recordAuditLog } from '../../services/auditLogService.js';
import { enqueueBackgroundTask } from '../../services/backgroundTaskService.js';
import { requireIntelligenceFeature } from './featureAccessService.js';
import {
  completeIntelligenceExecution,
  createIntelligenceExecution,
  getFreshCachedResult,
  recordIntelligenceFailure,
  storeIntelligenceResult,
  supersedeCachedResults,
} from './governanceService.js';
import { executeStructuredPrompt } from './intelligenceRuntimeService.js';
import { projectJobForIntelligence, projectResumeForIntelligence } from '../redaction/projectionService.js';
import { enforceIntelligenceUsageLimits } from './usageService.js';
import { buildCandidateJobMatchSourceFingerprint, getCandidateJobMatchContractVersions } from './candidateMatchFingerprintService.js';
import { calculateCandidateJobMatchScore } from './candidateMatchScoringService.js';
import { buildCandidateMatchEvidenceCatalog } from './candidateMatchEvidenceService.js';
import { resolveActiveMatchScoringProfileVersion } from './matchScoringProfileService.js';
import {
  findAccessibleCandidateForMatch,
  findAccessibleJobForMatch,
  findCandidateIntelligenceStateForMatch,
  findCandidateJobMatchState,
  findCandidateJobMatchStateWithRelations,
  findCandidateMatchTaskActor,
  findJobDescriptionStateForMatch,
  findLatestCandidateMatchResult,
  findPendingCandidateMatchTask,
  upsertCandidateJobMatchStateRecord,
} from '../repositories/candidateMatchEngineRepository.js';

const FEATURE = 'CANDIDATE_MATCH';
const ENTITY_TYPE = 'CandidateJobMatch';
const STATE_METADATA_VERSION = '1.0.0';

const {
  sourceVersion: SOURCE_VERSION,
  schemaVersion: SCHEMA_VERSION,
  resultVersion: RESULT_VERSION,
  promptKey: PROMPT_KEY,
  promptVersion: PROMPT_VERSION,
} = getCandidateJobMatchContractVersions();

function iso(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function buildEntityId(candidateId, jobId) {
  return `${candidateId}:${jobId}`;
}

function confidenceLabel(score) {
  if (score == null || Number.isNaN(score)) return 'UNKNOWN';
  if (score >= 0.8) return 'HIGH';
  if (score >= 0.55) return 'MEDIUM';
  return 'LOW';
}

function areaLabel(score) {
  if (score == null || Number.isNaN(score)) return 'UNKNOWN';
  if (score >= 80) return 'HIGH';
  if (score >= 55) return 'MEDIUM';
  return 'LOW';
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

function flattenEvidenceCatalog(catalog) {
  const values = [
    ...(catalog.overall || []),
    ...Object.values(catalog.areas || {}).flat(),
    ...Object.values(catalog.external || {}).filter(Boolean),
  ];
  const unique = new Map();
  for (const item of values) {
    if (!unique.has(item.id)) unique.set(item.id, item);
  }
  return [...unique.values()];
}

function mapEvidence(evidenceMap, ids = []) {
  const mapped = ids.map((id) => evidenceMap.get(id)).filter(Boolean);
  if (!mapped.length) {
    const error = new Error('Candidate match insight output must include supported evidence.');
    error.code = 'CANDIDATE_MATCH_EVIDENCE_REQUIRED';
    error.retryable = false;
    throw error;
  }
  return mapped;
}

function statement(text, evidence, score = 0.5, generationType = 'DETERMINISTIC') {
  return {
    text,
    confidence: {
      score: Number(score.toFixed(2)),
      label: confidenceLabel(score),
    },
    evidence,
    generationType,
  };
}

function skillItems(skills, evidence, generationType = 'DETERMINISTIC', rationale = null, score = 0.65) {
  return (skills || []).map((skill) => ({
    skill,
    rationale,
    confidence: {
      score: Number(score.toFixed(2)),
      label: confidenceLabel(score),
    },
    evidence,
    generationType,
  }));
}

function buildDeterministicRecommendation(scoring, evidenceCatalog) {
  const overallEvidence = evidenceCatalog.overall;
  const reason = scoring.recommendation.reviewRequired
    ? 'Minimum identity or contact information is incomplete, so the match should be reviewed manually before use.'
    : scoring.explanation;

  return {
    label: scoring.recommendation.label,
    reason: statement(reason, overallEvidence, scoring.confidence.score, 'DETERMINISTIC'),
  };
}

function buildDeterministicStrengths(scoring, evidenceCatalog) {
  const strengths = [];
  if (scoring.matchedSkills.required.length) {
    strengths.push(statement(
      `${scoring.matchedSkills.required.length} required skills are explicitly matched.`,
      evidenceCatalog.areas.requiredSkills,
      0.76,
    ));
  }
  if (scoring.subscores.experience >= 80) {
    strengths.push(statement(
      'Experience range aligns well with the role expectations.',
      evidenceCatalog.areas.experience,
      0.72,
    ));
  }
  if (scoring.subscores.roleTitle >= 70) {
    strengths.push(statement(
      'Current title or headline aligns with the target role theme.',
      evidenceCatalog.areas.roleTitle,
      0.68,
    ));
  }
  return strengths.slice(0, 8);
}

function buildDeterministicRisks(scoring, evidenceCatalog) {
  const risks = [];
  if (scoring.missingSkills.required.length) {
    risks.push(statement(
      `Missing required skills need verification: ${scoring.missingSkills.required.slice(0, 4).join(', ')}.`,
      evidenceCatalog.areas.requiredSkills,
      0.72,
    ));
  }
  for (const item of scoring.unknownCriteria.slice(0, 2)) {
    const evidence = item.toLowerCase().includes('compensation')
      ? evidenceCatalog.areas.compensation
      : item.toLowerCase().includes('notice')
        ? evidenceCatalog.areas.noticePeriod
        : item.toLowerCase().includes('education')
          ? evidenceCatalog.areas.education
          : evidenceCatalog.areas.roleTitle;
    risks.push(statement(item, evidence, 0.58));
  }
  if (scoring.subscores.location < 80) {
    risks.push(statement(
      'Location alignment is partial and should be confirmed with the recruiter or candidate.',
      evidenceCatalog.areas.location,
      0.55,
    ));
  }
  return risks.slice(0, 8);
}

function buildDeterministicInterviewFocus(scoring, evidenceCatalog) {
  const items = [];
  if (scoring.missingSkills.required.length) {
    items.push(statement(
      `Validate depth in missing required skills such as ${scoring.missingSkills.required.slice(0, 3).join(', ')}.`,
      evidenceCatalog.areas.requiredSkills,
      0.69,
    ));
  }
  if (scoring.subscores.experience < 80) {
    items.push(statement(
      'Confirm whether prior experience covers the job scope and expected ownership level.',
      evidenceCatalog.areas.experience,
      0.63,
    ));
  }
  if (!items.length) {
    items.push(statement(
      'Validate recent practical ownership of the core required stack in production settings.',
      evidenceCatalog.areas.requiredSkills,
      0.67,
    ));
  }
  return items.slice(0, 8);
}

function buildDeterministicOutput(context) {
  const { candidate, job, scoring, evidenceCatalog } = context;
  return {
    candidateId: candidate.id,
    jobId: job.id,
    overallScore: {
      score: scoring.overallScore,
      label: areaLabel(scoring.overallScore),
      evidence: evidenceCatalog.overall,
      generationType: 'DETERMINISTIC',
    },
    confidence: {
      score: scoring.confidence.score,
      label: confidenceLabel(scoring.confidence.score),
    },
    recommendation: buildDeterministicRecommendation(scoring, evidenceCatalog),
    scoreBreakdown: {
      requiredSkills: {
        score: scoring.subscores.requiredSkills,
        weight: scoring.weights.requiredSkills,
        label: areaLabel(scoring.subscores.requiredSkills),
        evidence: evidenceCatalog.areas.requiredSkills,
        generationType: 'DETERMINISTIC',
      },
      preferredSkills: {
        score: scoring.subscores.preferredSkills,
        weight: scoring.weights.preferredSkills,
        label: areaLabel(scoring.subscores.preferredSkills),
        evidence: evidenceCatalog.areas.preferredSkills,
        generationType: 'DETERMINISTIC',
      },
      experience: {
        score: scoring.subscores.experience,
        weight: scoring.weights.experience,
        label: areaLabel(scoring.subscores.experience),
        evidence: evidenceCatalog.areas.experience,
        generationType: 'DETERMINISTIC',
      },
      roleTitle: {
        score: scoring.subscores.roleTitle,
        weight: scoring.weights.roleTitle,
        label: areaLabel(scoring.subscores.roleTitle),
        evidence: evidenceCatalog.areas.roleTitle,
        generationType: 'DETERMINISTIC',
      },
      location: {
        score: scoring.subscores.location,
        weight: scoring.weights.location,
        label: areaLabel(scoring.subscores.location),
        evidence: evidenceCatalog.areas.location,
        generationType: 'DETERMINISTIC',
      },
      workMode: {
        score: scoring.subscores.workMode,
        weight: scoring.weights.workMode,
        label: areaLabel(scoring.subscores.workMode),
        evidence: evidenceCatalog.areas.workMode,
        generationType: 'DETERMINISTIC',
      },
      employmentType: {
        score: scoring.subscores.employmentType,
        weight: scoring.weights.employmentType,
        label: areaLabel(scoring.subscores.employmentType),
        evidence: evidenceCatalog.areas.employmentType,
        generationType: 'DETERMINISTIC',
      },
      noticePeriod: {
        score: scoring.subscores.noticePeriod,
        weight: scoring.weights.noticePeriod,
        label: areaLabel(scoring.subscores.noticePeriod),
        evidence: evidenceCatalog.areas.noticePeriod,
        generationType: 'DETERMINISTIC',
      },
      compensation: {
        score: scoring.subscores.compensation,
        weight: scoring.weights.compensation,
        label: areaLabel(scoring.subscores.compensation),
        evidence: evidenceCatalog.areas.compensation,
        generationType: 'DETERMINISTIC',
      },
      education: {
        score: scoring.subscores.education,
        weight: scoring.weights.education,
        label: areaLabel(scoring.subscores.education),
        evidence: evidenceCatalog.areas.education,
        generationType: 'DETERMINISTIC',
      },
    },
    skills: {
      matchedRequired: skillItems(scoring.matchedSkills.required, evidenceCatalog.areas.requiredSkills, 'DETERMINISTIC'),
      matchedPreferred: skillItems(scoring.matchedSkills.preferred, evidenceCatalog.areas.preferredSkills, 'DETERMINISTIC'),
      missingRequired: skillItems(scoring.missingSkills.required, evidenceCatalog.areas.requiredSkills, 'DETERMINISTIC', 'Required skill not explicitly present in the candidate profile.', 0.57),
      missingPreferred: skillItems(scoring.missingSkills.preferred, evidenceCatalog.areas.preferredSkills, 'DETERMINISTIC', 'Preferred skill not explicitly present in the candidate profile.', 0.55),
      transferable: skillItems(
        scoring.matchedSkills.transferable,
        evidenceCatalog.areas.requiredSkills,
        'DETERMINISTIC',
        'Present in secondary skill sources and may merit recruiter review.',
        0.52,
      ),
    },
    strengths: buildDeterministicStrengths(scoring, evidenceCatalog),
    risks: buildDeterministicRisks(scoring, evidenceCatalog),
    interviewFocus: buildDeterministicInterviewFocus(scoring, evidenceCatalog),
    recruiterSummary: statement(scoring.explanation, evidenceCatalog.overall, scoring.confidence.score, 'DETERMINISTIC'),
    warnings: scoring.unknownCriteria.slice(0, 8),
  };
}

function buildAiEnhancedOutput(aiOutput, deterministicOutput, evidenceCatalog) {
  const evidenceMap = new Map(flattenEvidenceCatalog(evidenceCatalog).map((item) => [item.id, item]));
  const mapStatement = (item) => ({
    text: item.text,
    confidence: {
      score: item.confidence,
      label: confidenceLabel(item.confidence),
    },
    evidence: mapEvidence(evidenceMap, item.evidenceIds),
    generationType: 'AI_GENERATED',
  });

  return {
    ...deterministicOutput,
    recommendation: {
      label: aiOutput.recommendation.label,
      reason: {
        text: aiOutput.recommendation.reason,
        confidence: {
          score: aiOutput.recommendation.confidence,
          label: confidenceLabel(aiOutput.recommendation.confidence),
        },
        evidence: mapEvidence(evidenceMap, aiOutput.recommendation.evidenceIds),
        generationType: 'AI_GENERATED',
      },
    },
    strengths: aiOutput.strengths.map(mapStatement),
    risks: aiOutput.risks.map(mapStatement),
    interviewFocus: aiOutput.interviewFocus.map(mapStatement),
    recruiterSummary: mapStatement(aiOutput.recruiterSummary),
    skills: {
      ...deterministicOutput.skills,
      transferable: aiOutput.transferableSkills.map((item) => ({
        skill: item.skill,
        rationale: item.rationale,
        confidence: {
          score: item.confidence,
          label: confidenceLabel(item.confidence),
        },
        evidence: mapEvidence(evidenceMap, item.evidenceIds),
        generationType: 'AI_GENERATED',
      })),
    },
    warnings: [...new Set([...(deterministicOutput.warnings || []), ...(aiOutput.warnings || [])])],
  };
}

function buildExecutionSection(state, execution, extra = {}) {
  const status = extra.statusOverride
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
    status,
    cacheHit: Boolean(extra.cacheHit),
    aiEnabled: Boolean(state?.aiEnabled),
    stale: Boolean(extra.stale),
    generatedAt: iso(state?.generatedAt || state?.lastGeneratedAt || execution?.completedAt),
    provider: state?.provider || execution?.provider || 'DISABLED',
    providerVersion: state?.providerVersion || null,
    model: state?.model || execution?.model || null,
    modelVersion: state?.modelVersion || null,
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

function buildApiResponse(state, result, extra = {}) {
  const output = result?.normalizedOutput || extra.fallbackOutput;
  return {
    ...(output || {}),
    execution: buildExecutionSection(state, result?.execution, extra),
  };
}

function buildLegacyCompatibilityResponse(response) {
  return {
    executionId: response.execution.executionId,
    resultId: response.execution.resultId,
    fromCache: response.execution.cacheHit,
    aiAvailable: response.execution.aiEnabled,
    machineGenerated: response.recruiterSummary.generationType === 'AI_GENERATED',
    generatedAt: response.execution.generatedAt,
    deterministic: {
      scoreVersion: response.execution.resultVersion,
      overallScore: response.overallScore.score,
      subscores: {
        requiredSkillScore: response.scoreBreakdown.requiredSkills.score,
        preferredSkillScore: response.scoreBreakdown.preferredSkills.score,
        experienceScore: response.scoreBreakdown.experience.score,
        titleScore: response.scoreBreakdown.roleTitle.score,
        locationScore: response.scoreBreakdown.location.score,
        workModeScore: response.scoreBreakdown.workMode.score,
        employmentTypeScore: response.scoreBreakdown.employmentType.score,
        noticePeriodScore: response.scoreBreakdown.noticePeriod.score,
        compensationScore: response.scoreBreakdown.compensation.score,
      },
      matchedCriteria: response.skills.matchedRequired.map((item) => item.skill.toUpperCase()),
      missingRequiredCriteria: response.skills.missingRequired.map((item) => item.skill.toUpperCase()),
      missingPreferredCriteria: response.skills.missingPreferred.map((item) => item.skill.toUpperCase()),
      unknownCriteria: response.warnings,
      explanation: response.recommendation.reason.text,
    },
    aiExplanation: response.recruiterSummary.generationType === 'AI_GENERATED'
      ? {
          explanation: response.recruiterSummary.text,
          strengths: response.strengths.map((item) => item.text),
          missingCriteria: response.skills.missingRequired.map((item) => item.skill),
          unknownCriteria: response.warnings,
        }
      : null,
    explanation: response.recruiterSummary.text,
    generatedLabel: response.recruiterSummary.generationType === 'AI_GENERATED'
      ? 'AI-generated suggestion. Review before use.'
      : 'Deterministic match baseline. AI explanation unavailable.',
    providerUnavailable: !response.execution.aiEnabled,
    calculationVersion: response.execution.resultVersion,
  };
}

async function getAccessibleCandidate(context, candidateId) {
  const candidate = await findAccessibleCandidateForMatch(context.organisationId, candidateId);

  if (!candidate) {
    const error = new Error('Candidate not found.');
    error.statusCode = 404;
    throw error;
  }

  return candidate;
}

async function getAccessibleJob(context, jobId) {
  const job = await findAccessibleJobForMatch(context.organisationId, jobId);

  if (!job) {
    const error = new Error('Job not found.');
    error.statusCode = 404;
    throw error;
  }

  return job;
}

async function getContext(actorUser, candidateId, jobId, mode = 'read', options = {}) {
  const permissionContext = await requireIntelligenceFeature(actorUser, FEATURE, null, mode);
  const [candidate, job] = await Promise.all([
    getAccessibleCandidate(permissionContext, candidateId),
    getAccessibleJob(permissionContext, jobId),
  ]);

  const [candidateIntelligenceState, jobDescriptionState] = await Promise.all([
    findCandidateIntelligenceStateForMatch(permissionContext.organisationId, candidateId, 'PROFILE_OVERVIEW'),
    findJobDescriptionStateForMatch(permissionContext.organisationId, jobId, 'FULL_DESCRIPTION'),
  ]);

  const scoringProfileVersion = await resolveActiveMatchScoringProfileVersion(
    permissionContext.organisationId,
    options.scoringProfileVersionId || null,
    options.scoringProfileId || null,
    actorUser?.id || null,
  );

  const aiEnabled = Boolean(permissionContext.enabled);
  const provider = aiEnabled ? env.intelligenceProvider : 'DISABLED';
  const model = aiEnabled ? (env.awsBedrockModelId || env.intelligenceModel || null) : null;
  const sourceFingerprint = buildCandidateJobMatchSourceFingerprint({
    candidate,
    job,
    resumeAsset: candidate.latestResumeAsset || null,
    candidateIntelligenceState,
    jobDescriptionState,
    scoringProfileVersion,
    provider,
    model,
  });
  const scoring = calculateCandidateJobMatchScore(candidate, job, scoringProfileVersion);
  const evidenceCatalog = buildCandidateMatchEvidenceCatalog({
    candidate,
    job,
    candidateIntelligenceState,
    jobDescriptionState,
    scoring,
  });

  return {
    permissionContext,
    candidate,
    job,
    candidateIntelligenceState,
    jobDescriptionState,
    resumeAsset: candidate.latestResumeAsset || null,
    aiEnabled,
    provider,
    model,
    scoringProfileVersion,
    sourceFingerprint,
    scoring,
    evidenceCatalog,
  };
}

async function getLatestResult(organisationId, candidateId, jobId) {
  return findLatestCandidateMatchResult(
    organisationId,
    ENTITY_TYPE,
    buildEntityId(candidateId, jobId),
    RESULT_VERSION,
    PROMPT_VERSION,
  );
}

async function upsertState(context, payload = {}) {
  return upsertCandidateJobMatchStateRecord(
    context.permissionContext.organisationId,
    context.candidate.id,
    context.job.id,
    {
      organisationId: context.permissionContext.organisationId,
      candidateId: context.candidate.id,
      jobId: context.job.id,
      status: payload.status || 'PENDING',
      latestExecutionId: payload.latestExecutionId || null,
      latestResultId: payload.latestResultId || null,
      candidateIntelligenceStateId: context.candidateIntelligenceState?.id || null,
      jobDescriptionStateId: context.jobDescriptionState?.id || null,
      latestResumeAssetId: context.resumeAsset?.id || null,
      sourceFingerprint: payload.sourceFingerprint || context.sourceFingerprint,
      sourceVersion: SOURCE_VERSION,
      schemaVersion: SCHEMA_VERSION,
      promptKey: PROMPT_KEY,
      promptVersion: PROMPT_VERSION,
      resultVersion: RESULT_VERSION,
      provider: payload.provider === undefined ? context.provider : payload.provider,
      providerVersion: payload.providerVersion === undefined ? providerVersionFor(context.provider) : payload.providerVersion,
      model: payload.model === undefined ? context.model : payload.model,
      modelVersion: payload.modelVersion === undefined ? context.model : payload.modelVersion,
      latencyMs: payload.latencyMs ?? null,
      inputTokens: payload.inputTokens ?? null,
      outputTokens: payload.outputTokens ?? null,
      estimatedCost: payload.estimatedCost ?? null,
      generatedAt: payload.generatedAt || null,
      lastGeneratedAt: payload.lastGeneratedAt || payload.generatedAt || null,
      lastSourceChangedAt: payload.lastSourceChangedAt || null,
      staleReason: payload.staleReason || null,
      lastErrorCode: payload.lastErrorCode || null,
      lastErrorMessage: payload.lastErrorMessage || null,
      aiEnabled: payload.aiEnabled === undefined ? context.aiEnabled : Boolean(payload.aiEnabled),
      metadata: payload.metadata || { version: STATE_METADATA_VERSION },
    },
    {
      status: payload.status === undefined ? undefined : payload.status,
      latestExecutionId: payload.latestExecutionId === undefined ? undefined : payload.latestExecutionId,
      latestResultId: payload.latestResultId === undefined ? undefined : payload.latestResultId,
      candidateIntelligenceStateId: context.candidateIntelligenceState?.id || null,
      jobDescriptionStateId: context.jobDescriptionState?.id || null,
      latestResumeAssetId: context.resumeAsset?.id || null,
      sourceFingerprint: payload.sourceFingerprint === undefined ? context.sourceFingerprint : payload.sourceFingerprint,
      sourceVersion: SOURCE_VERSION,
      schemaVersion: SCHEMA_VERSION,
      promptKey: PROMPT_KEY,
      promptVersion: PROMPT_VERSION,
      resultVersion: RESULT_VERSION,
      provider: payload.provider === undefined ? context.provider : payload.provider,
      providerVersion: payload.providerVersion === undefined ? providerVersionFor(context.provider) : payload.providerVersion,
      model: payload.model === undefined ? context.model : payload.model,
      modelVersion: payload.modelVersion === undefined ? context.model : payload.modelVersion,
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
  );
}

async function markStateForCurrentSource(context, existingState = null) {
  const state = await upsertState(context, {
    status: existingState?.status || (context.aiEnabled ? 'PENDING' : 'DISABLED'),
    latestExecutionId: existingState?.latestExecutionId || null,
    latestResultId: existingState?.latestResultId || null,
    lastSourceChangedAt: existingState?.sourceFingerprint && existingState.sourceFingerprint !== context.sourceFingerprint
      ? new Date()
      : (existingState?.lastSourceChangedAt || null),
    staleReason: existingState?.sourceFingerprint && existingState.sourceFingerprint !== context.sourceFingerprint
      ? 'SOURCE_CHANGED'
      : (existingState?.staleReason || null),
    metadata: {
      version: STATE_METADATA_VERSION,
      deterministicOnly: !context.aiEnabled,
      scoringProfileVersionId: context.scoringProfileVersion?.id || null,
      scoringProfileVersion: context.scoringProfileVersion?.version || null,
    },
  });

  if (existingState?.sourceFingerprint && existingState.sourceFingerprint !== context.sourceFingerprint && ['READY', 'FAILED', 'DISABLED'].includes(state.status)) {
    return upsertState(context, {
      status: 'STALE',
      latestExecutionId: state.latestExecutionId,
      latestResultId: state.latestResultId,
      lastSourceChangedAt: new Date(),
      staleReason: 'SOURCE_CHANGED',
      metadata: state.metadata || {},
    });
  }

  return state;
}

async function ensureGenerationTask(context, state, actorUserId, forceRegenerate = false) {
  const entityId = buildEntityId(context.candidate.id, context.job.id);
  const existingTask = await findPendingCandidateMatchTask(ENTITY_TYPE, entityId);
  if (existingTask) return existingTask;

  const idempotencyKey = forceRegenerate
    ? `candidate-match:${entityId}:force:${state.lastGeneratedAt?.getTime?.() || 'none'}`
    : `candidate-match:${entityId}:${state.sourceFingerprint}`;

  return enqueueBackgroundTask({
    organisationId: context.permissionContext.organisationId,
    type: 'CANDIDATE_MATCH_GENERATION',
    entityType: ENTITY_TYPE,
    entityId,
    idempotencyKey,
    payload: {
      candidateId: context.candidate.id,
      jobId: context.job.id,
      requestedByUserId: actorUserId,
      scoringProfileId: context.scoringProfileVersion?.profileId || null,
      scoringProfileVersionId: context.scoringProfileVersion?.id || null,
    },
    nextAttemptAt: new Date(),
    createdByUserId: actorUserId || null,
    maxAttempts: Math.max(1, env.intelligenceMaxRetries + 1),
  });
}

async function persistDeterministicOnlyResult(context) {
  const execution = await createIntelligenceExecution({
    organisationId: context.permissionContext.organisationId,
    requestedByUserId: null,
    feature: FEATURE,
    promptKey: PROMPT_KEY,
    promptVersion: PROMPT_VERSION,
    provider: 'DISABLED',
    model: null,
    inputPayload: {
      candidateId: context.candidate.id,
      jobId: context.job.id,
      deterministicOnly: true,
    },
    metadata: {
      sourceVersion: SOURCE_VERSION,
      schemaVersion: SCHEMA_VERSION,
    },
  });

  const normalizedOutput = buildDeterministicOutput(context);
  const entityId = buildEntityId(context.candidate.id, context.job.id);

  await supersedeCachedResults({
    organisationId: context.permissionContext.organisationId,
    entityType: ENTITY_TYPE,
    entityId,
    resultVersion: RESULT_VERSION,
  });

  const stored = await storeIntelligenceResult({
    organisationId: context.permissionContext.organisationId,
    executionId: execution.id,
    entityType: ENTITY_TYPE,
    entityId,
    sourceFingerprint: context.sourceFingerprint,
    resultVersion: RESULT_VERSION,
    promptVersion: PROMPT_VERSION,
    normalizedOutput,
    explanation: normalizedOutput.recruiterSummary.text,
    confidence: normalizedOutput.confidence.score,
    feature: FEATURE,
  });

  await completeIntelligenceExecution(execution.id, {
    status: 'SKIPPED',
    outputCharacterCount: JSON.stringify(normalizedOutput).length,
  });

  const state = await upsertState(context, {
    status: 'DISABLED',
    latestExecutionId: execution.id,
    latestResultId: stored.id,
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

  return buildApiResponse(state, { ...stored, execution }, { cacheHit: false, stale: false });
}

function buildPromptInput(context) {
  return {
    deterministicScore: {
      overallScore: context.scoring.overallScore,
      recommendationLabel: context.scoring.recommendation.label,
      subscores: context.scoring.subscores,
      matchedSkills: context.scoring.matchedSkills,
      missingSkills: context.scoring.missingSkills,
      unknownCriteria: context.scoring.unknownCriteria,
      explanation: context.scoring.explanation,
    },
    candidate: projectResumeForIntelligence(context.candidate, context.resumeAsset),
    job: projectJobForIntelligence(context.job, context.job.requisition || null, context.job.description || ''),
    evidenceCatalog: flattenEvidenceCatalog(context.evidenceCatalog).map((item) => ({
      id: item.id,
      sourceType: item.sourceType,
      fieldPath: item.fieldPath,
      snippet: item.snippet,
    })),
  };
}

async function generateAndPersistMatch(context, requestedByUserId = null) {
  const entityId = buildEntityId(context.candidate.id, context.job.id);
  const execution = await createIntelligenceExecution({
    organisationId: context.permissionContext.organisationId,
    requestedByUserId,
    feature: FEATURE,
    promptKey: PROMPT_KEY,
    promptVersion: PROMPT_VERSION,
    provider: context.aiEnabled ? context.provider : 'DISABLED',
    model: context.aiEnabled ? context.model : null,
    inputPayload: {
      candidateId: context.candidate.id,
      jobId: context.job.id,
      sourceFingerprint: context.sourceFingerprint,
      scoringProfileVersionId: context.scoringProfileVersion?.id || null,
    },
    metadata: {
      sourceVersion: SOURCE_VERSION,
      schemaVersion: SCHEMA_VERSION,
      candidateIntelligenceStateId: context.candidateIntelligenceState?.id || null,
      jobDescriptionStateId: context.jobDescriptionState?.id || null,
      scoringProfileVersionId: context.scoringProfileVersion?.id || null,
      scoringProfileVersion: context.scoringProfileVersion?.version || null,
    },
  });

  try {
    let normalizedOutput = buildDeterministicOutput(context);
    let promptTokens = 0;
    let completionTokens = 0;
    let latencyMs = 0;
    let estimatedCost = 0;

    if (context.aiEnabled) {
      const runtime = await executeStructuredPrompt({
        promptKey: PROMPT_KEY,
        input: buildPromptInput(context),
      });
      normalizedOutput = buildAiEnhancedOutput(runtime.output, normalizedOutput, context.evidenceCatalog);
      promptTokens = runtime.promptTokens || 0;
      completionTokens = runtime.completionTokens || 0;
      latencyMs = runtime.latencyMs || 0;
    }

    await supersedeCachedResults({
      organisationId: context.permissionContext.organisationId,
      entityType: ENTITY_TYPE,
      entityId,
      resultVersion: RESULT_VERSION,
    });

    const stored = await storeIntelligenceResult({
      organisationId: context.permissionContext.organisationId,
      executionId: execution.id,
      entityType: ENTITY_TYPE,
      entityId,
      sourceFingerprint: context.sourceFingerprint,
      resultVersion: RESULT_VERSION,
      promptVersion: PROMPT_VERSION,
      normalizedOutput,
      explanation: normalizedOutput.recruiterSummary.text,
      confidence: normalizedOutput.confidence.score,
      feature: FEATURE,
    });

    await completeIntelligenceExecution(execution.id, {
      status: context.aiEnabled ? 'SUCCEEDED' : 'SKIPPED',
      promptTokens,
      completionTokens,
      latencyMs,
      estimatedCost,
      outputCharacterCount: JSON.stringify(normalizedOutput).length,
      metadata: {
        entityId,
        candidateId: context.candidate.id,
        jobId: context.job.id,
        scoringProfileVersionId: context.scoringProfileVersion?.id || null,
      },
    });

    const state = await upsertState(context, {
      status: context.aiEnabled ? (context.scoring.recommendation.reviewRequired ? 'REVIEW_REQUIRED' : 'READY') : 'DISABLED',
      latestExecutionId: execution.id,
      latestResultId: stored.id,
      provider: context.aiEnabled ? context.provider : 'DISABLED',
      providerVersion: providerVersionFor(context.aiEnabled ? context.provider : 'DISABLED'),
      model: context.aiEnabled ? context.model : null,
      modelVersion: context.aiEnabled ? context.model : null,
      latencyMs,
      inputTokens: promptTokens,
      outputTokens: completionTokens,
      estimatedCost,
      generatedAt: stored.createdAt,
      lastGeneratedAt: stored.createdAt,
      lastErrorCode: null,
      lastErrorMessage: null,
      staleReason: null,
      aiEnabled: context.aiEnabled,
      metadata: {
        version: STATE_METADATA_VERSION,
        deterministicOnly: !context.aiEnabled,
        scoringProfileVersionId: context.scoringProfileVersion?.id || null,
        scoringProfileVersion: context.scoringProfileVersion?.version || null,
      },
    });

    return buildApiResponse(state, { ...stored, execution }, { cacheHit: false, stale: false });
  } catch (error) {
    await recordIntelligenceFailure(execution.id, error);
    await upsertState(context, {
      status: 'FAILED',
      latestExecutionId: execution.id,
      lastErrorCode: error?.code || 'CANDIDATE_MATCH_GENERATION_FAILED',
      lastErrorMessage: String(error?.message || 'Candidate match generation failed.').slice(0, 1000),
      aiEnabled: context.aiEnabled,
    });
    throw error;
  }
}

export async function getCandidateJobMatch(actorUser, payload, requestMeta = {}) {
  const context = await getContext(actorUser, payload.candidateId, payload.jobId, 'read', payload);
  const existingState = await findCandidateJobMatchStateWithRelations(
    context.permissionContext.organisationId,
    context.candidate.id,
    context.job.id,
  );
  const state = await markStateForCurrentSource(context, existingState);
  const entityId = buildEntityId(context.candidate.id, context.job.id);

  const cached = await getFreshCachedResult({
    organisationId: context.permissionContext.organisationId,
    entityType: ENTITY_TYPE,
    entityId,
    sourceFingerprint: context.sourceFingerprint,
    resultVersion: RESULT_VERSION,
    promptVersion: PROMPT_VERSION,
  });

  if (cached) {
    return buildApiResponse(state, cached, {
      cacheHit: true,
      stale: false,
      statusOverride: cached.execution?.status === 'SKIPPED'
        ? 'DISABLED'
        : (context.scoring.recommendation.reviewRequired ? 'REVIEW_REQUIRED' : 'READY'),
    });
  }

  const latest = await getLatestResult(context.permissionContext.organisationId, context.candidate.id, context.job.id);

  if (!context.aiEnabled && (!latest || latest.sourceFingerprint !== context.sourceFingerprint)) {
    return persistDeterministicOnlyResult(context);
  }

  await ensureGenerationTask(context, state, actorUser.id, false).catch(() => null);

  const fallbackOutput = latest?.normalizedOutput || buildDeterministicOutput(context);
  const fallbackStatus = latest
    ? 'STALE'
    : (context.scoring.recommendation.reviewRequired ? 'REVIEW_REQUIRED' : (context.aiEnabled ? 'PENDING' : 'DISABLED'));
  const nextState = await upsertState(context, {
    status: fallbackStatus,
    latestExecutionId: state.latestExecutionId,
    latestResultId: latest?.id || state.latestResultId || null,
    lastSourceChangedAt: latest ? new Date() : state.lastSourceChangedAt,
    staleReason: latest ? 'SOURCE_CHANGED' : state.staleReason,
    aiEnabled: context.aiEnabled,
    metadata: state.metadata || {},
  });

  await recordAuditLog({
    organisationId: context.permissionContext.organisationId,
    actorUserId: actorUser.id,
    action: 'intelligence.match.read',
    entityType: ENTITY_TYPE,
    entityId,
    metadata: {
      cached: false,
      staleServed: Boolean(latest),
      candidateId: context.candidate.id,
      jobId: context.job.id,
    },
    ipAddress: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
  }).catch(() => {});

  return buildApiResponse(nextState, latest, {
    cacheHit: false,
    stale: Boolean(latest),
    statusOverride: latest ? 'STALE' : fallbackStatus,
    fallbackOutput,
  });
}

export async function getCandidateJobMatchStatus(actorUser, payload) {
  const context = await getContext(actorUser, payload.candidateId, payload.jobId, 'read', payload);
  const existingState = await findCandidateJobMatchState(
    context.permissionContext.organisationId,
    context.candidate.id,
    context.job.id,
  );
  const state = await markStateForCurrentSource(context, existingState);
  const latest = await getLatestResult(context.permissionContext.organisationId, context.candidate.id, context.job.id);
  const stale = Boolean(latest && latest.sourceFingerprint !== context.sourceFingerprint);

  return {
    candidateId: context.candidate.id,
    jobId: context.job.id,
    status: stale ? 'STALE' : state.status,
    stale,
    aiEnabled: context.aiEnabled,
    generatedAt: iso(state.generatedAt || state.lastGeneratedAt),
    latestExecutionId: state.latestExecutionId,
    latestResultId: state.latestResultId,
    sourceVersion: SOURCE_VERSION,
    promptVersion: PROMPT_VERSION,
    resultVersion: RESULT_VERSION,
  };
}

export async function regenerateCandidateJobMatch(actorUser, payload, requestMeta = {}) {
  const context = await getContext(actorUser, payload.candidateId, payload.jobId, 'generate', payload);
  const state = await upsertState(context, {
    status: context.aiEnabled
      ? (context.scoring.recommendation.reviewRequired ? 'REVIEW_REQUIRED' : 'PENDING')
      : 'DISABLED',
    lastSourceChangedAt: new Date(),
    staleReason: payload.forceRegenerate ? 'FORCED_REGENERATION' : 'REQUESTED_REGENERATION',
    aiEnabled: context.aiEnabled,
    metadata: {
      version: STATE_METADATA_VERSION,
      deterministicOnly: !context.aiEnabled,
      scoringProfileVersionId: context.scoringProfileVersion?.id || null,
      scoringProfileVersion: context.scoringProfileVersion?.version || null,
    },
  });

  const task = await ensureGenerationTask(context, state, actorUser.id, payload.forceRegenerate !== false);
  const entityId = buildEntityId(context.candidate.id, context.job.id);

  await recordAuditLog({
    organisationId: context.permissionContext.organisationId,
    actorUserId: actorUser.id,
    action: 'intelligence.match.regenerate',
    entityType: ENTITY_TYPE,
    entityId,
    metadata: {
      taskId: task?.id || null,
      candidateId: context.candidate.id,
      jobId: context.job.id,
      aiEnabled: context.aiEnabled,
    },
    ipAddress: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
  }).catch(() => {});

  return {
    candidateId: context.candidate.id,
    jobId: context.job.id,
    status: state.status,
    queued: Boolean(task),
    aiEnabled: context.aiEnabled,
    execution: buildExecutionSection(state, null, {
      cacheHit: false,
      stale: state.status === 'STALE',
    }),
  };
}

export async function runCandidateJobMatchGenerationTask(task) {
  const candidateId = task.payload?.candidateId;
  const jobId = task.payload?.jobId;
  const requestedByUserId = task.payload?.requestedByUserId || task.createdByUserId || null;
  if (!candidateId || !jobId || !requestedByUserId) return 'cancelled';

  const actorUser = await findCandidateMatchTaskActor(requestedByUserId);
  if (!actorUser) return 'cancelled';

  const context = await getContext(actorUser, candidateId, jobId, 'read', {
    scoringProfileId: task.payload?.scoringProfileId || null,
    scoringProfileVersionId: task.payload?.scoringProfileVersionId || null,
  });
  await upsertState(context, {
    status: context.aiEnabled
      ? (context.scoring.recommendation.reviewRequired ? 'REVIEW_REQUIRED' : 'PENDING')
      : 'DISABLED',
    aiEnabled: context.aiEnabled,
    metadata: {
      version: STATE_METADATA_VERSION,
      deterministicOnly: !context.aiEnabled,
      scoringProfileVersionId: context.scoringProfileVersion?.id || null,
      scoringProfileVersion: context.scoringProfileVersion?.version || null,
    },
  });
  await generateAndPersistMatch(context, requestedByUserId);
  return 'success';
}

export async function getCandidateJobMatchCompatibility(actorUser, payload, requestMeta = {}) {
  const context = await getContext(actorUser, payload.candidateId, payload.jobId, 'read', payload);
  const entityId = buildEntityId(context.candidate.id, context.job.id);

  if (!payload.forceRegenerate) {
    const cached = await getFreshCachedResult({
      organisationId: context.permissionContext.organisationId,
      entityType: ENTITY_TYPE,
      entityId,
      sourceFingerprint: context.sourceFingerprint,
      resultVersion: RESULT_VERSION,
      promptVersion: PROMPT_VERSION,
    });
    if (cached) {
      const existingState = await findCandidateJobMatchState(
        context.permissionContext.organisationId,
        context.candidate.id,
        context.job.id,
      );
      return buildLegacyCompatibilityResponse(buildApiResponse(existingState, cached, {
        cacheHit: true,
        stale: false,
      }));
    }
  }

  if (context.aiEnabled) {
    await enforceIntelligenceUsageLimits({
      organisationId: context.permissionContext.organisationId,
      userId: actorUser.id,
      feature: FEATURE,
    });
  }

  const response = context.aiEnabled
    ? await generateAndPersistMatch(context, actorUser.id)
    : await persistDeterministicOnlyResult(context);

  await recordAuditLog({
    organisationId: context.permissionContext.organisationId,
    actorUserId: actorUser.id,
    action: 'intelligence.match.view',
    entityType: ENTITY_TYPE,
    entityId,
    metadata: {
      score: response.overallScore.score,
      calculationVersion: response.execution.resultVersion,
      providerEnabled: context.aiEnabled,
      compatibilityRoute: true,
    },
    ipAddress: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
  }).catch(() => {});

  return buildLegacyCompatibilityResponse(response);
}
