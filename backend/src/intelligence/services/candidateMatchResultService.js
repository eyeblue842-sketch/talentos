import { prisma } from '../../config/db.js';
import { requireIntelligenceFeature } from './featureAccessService.js';

const MATCH_FEATURE = 'CANDIDATE_MATCH';
const OVERRIDE_FEATURE = 'MATCH_OVERRIDE';
const ENTITY_TYPE = 'CandidateJobMatch';

function iso(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value || 0))));
}

function confidenceLabel(score) {
  if (score == null || Number.isNaN(score)) return 'UNKNOWN';
  if (score >= 0.8) return 'HIGH';
  if (score >= 0.55) return 'MEDIUM';
  return 'LOW';
}

function buildExecutionSection(state, execution, statusOverride = null) {
  return {
    stateId: state?.id || null,
    executionId: execution?.id || state?.latestExecutionId || null,
    resultId: state?.latestResultId || null,
    status: statusOverride || state?.status || execution?.status || 'PENDING',
    cacheHit: true,
    aiEnabled: Boolean(state?.aiEnabled),
    stale: state?.status === 'STALE',
    generatedAt: iso(state?.generatedAt || state?.lastGeneratedAt || execution?.completedAt),
    provider: state?.provider || execution?.provider || 'DISABLED',
    providerVersion: state?.providerVersion || null,
    model: state?.model || execution?.model || null,
    modelVersion: state?.modelVersion || null,
    schemaVersion: state?.schemaVersion || null,
    promptKey: state?.promptKey || null,
    promptVersion: state?.promptVersion || null,
    resultVersion: state?.resultVersion || null,
    sourceVersion: state?.sourceVersion || null,
    latencyMs: state?.latencyMs || execution?.latencyMs || 0,
    inputTokens: state?.inputTokens ?? execution?.promptTokens ?? null,
    outputTokens: state?.outputTokens ?? execution?.completionTokens ?? null,
    estimatedCost: state?.estimatedCost != null ? Number(state.estimatedCost) : (execution?.estimatedCost != null ? Number(execution.estimatedCost) : null),
  };
}

function serializeOverride(override) {
  if (!override) return null;
  return {
    id: override.id,
    type: override.type,
    scoreDelta: override.scoreDelta ?? null,
    recommendationOverride: override.recommendationOverride || null,
    knockoutOverride: override.knockoutOverride ?? null,
    reason: override.reason || null,
    notes: override.notes || null,
    createdByUserId: override.createdByUserId,
    createdAt: iso(override.createdAt),
  };
}

function applyOverride(baseOutput, override) {
  if (!override) {
    return {
      response: baseOutput,
      effective: null,
      override: null,
    };
  }

  const generatedScore = Number(baseOutput?.overallScore?.score || 0);
  const generatedRecommendation = baseOutput?.recommendation?.label || 'REVIEW_REQUIRED';
  const generatedKnockout = Array.isArray(baseOutput?.knockoutResults)
    ? baseOutput.knockoutResults.some((item) => item?.triggered)
    : false;

  const effectiveScore = override.type === 'SCORE_ADJUSTMENT'
    ? clampScore(generatedScore + Number(override.scoreDelta || 0))
    : generatedScore;
  const effectiveRecommendation = override.type === 'RECOMMENDATION_OVERRIDE' && override.recommendationOverride
    ? override.recommendationOverride
    : generatedRecommendation;
  const effectiveKnockout = override.type === 'KNOCKOUT_OVERRIDE' && override.knockoutOverride != null
    ? Boolean(override.knockoutOverride)
    : generatedKnockout;

  const effective = {
    overallScore: {
      score: effectiveScore,
      label: baseOutput?.overallScore?.label || 'UNKNOWN',
    },
    recommendation: {
      label: effectiveRecommendation,
      reason: override.reason || baseOutput?.recommendation?.reason?.text || null,
    },
    knockedOut: effectiveKnockout,
    confidence: {
      score: baseOutput?.confidence?.score ?? null,
      label: confidenceLabel(baseOutput?.confidence?.score ?? null),
    },
  };

  return {
    response: {
      ...baseOutput,
      effective,
      overrides: [serializeOverride(override)],
    },
    effective,
    override: serializeOverride(override),
  };
}

async function loadMatchAccess(actorUser, candidateId, jobId, mode = 'read') {
  const permissionContext = await requireIntelligenceFeature(actorUser, MATCH_FEATURE, null, mode);
  const state = await prisma.candidateJobMatchState.findUnique({
    where: {
      organisationId_candidateId_jobId: {
        organisationId: permissionContext.organisationId,
        candidateId,
        jobId,
      },
    },
    include: {
      latestExecution: true,
      latestResult: { include: { execution: true } },
    },
  });

  if (!state) {
    const error = new Error('Candidate match state not found.');
    error.statusCode = 404;
    throw error;
  }

  return { permissionContext, state };
}

async function loadLatestOverride(organisationId, candidateId, jobId) {
  if (!prisma.recruiterMatchOverride?.findFirst) return null;
  return prisma.recruiterMatchOverride.findFirst({
    where: {
      organisationId,
      candidateId,
      jobId,
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getCandidateJobMatchResultEnvelope(actorUser, payload) {
  const { permissionContext, state } = await loadMatchAccess(actorUser, payload.candidateId, payload.jobId, 'read');
  const result = state.latestResult;
  if (!result?.normalizedOutput) {
    const error = new Error('Candidate match result not found.');
    error.statusCode = 404;
    throw error;
  }

  const override = await loadLatestOverride(permissionContext.organisationId, payload.candidateId, payload.jobId);
  const applied = applyOverride(result.normalizedOutput, override);

  return {
    ...applied.response,
    execution: buildExecutionSection(state, result.execution, state.status),
  };
}

export async function listCandidateJobMatchOverrides(actorUser, payload) {
  await requireIntelligenceFeature(actorUser, OVERRIDE_FEATURE, null, 'read');
  if (!prisma.recruiterMatchOverride?.findMany) return [];

  const { permissionContext } = await loadMatchAccess(actorUser, payload.candidateId, payload.jobId, 'read');
  const rows = await prisma.recruiterMatchOverride.findMany({
    where: {
      organisationId: permissionContext.organisationId,
      candidateId: payload.candidateId,
      jobId: payload.jobId,
    },
    orderBy: { createdAt: 'desc' },
  });

  return rows.map(serializeOverride);
}

export function buildEffectiveCandidateMatchValues(baseOutput, override) {
  return applyOverride(baseOutput, override);
}

export function buildCandidateMatchEntityId(candidateId, jobId) {
  return `${candidateId}:${jobId}`;
}

export function getCandidateMatchEntityType() {
  return ENTITY_TYPE;
}
