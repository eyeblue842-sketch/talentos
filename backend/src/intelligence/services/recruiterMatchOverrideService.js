import { prisma } from '../../config/db.js';
import { recordAuditLog } from '../../services/auditLogService.js';
import { requireIntelligenceFeature } from './featureAccessService.js';
import { buildEffectiveCandidateMatchValues, getCandidateJobMatchResultEnvelope } from './candidateMatchResultService.js';

const FEATURE = 'MATCH_OVERRIDE';

function iso(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function serializeOverride(override) {
  return {
    id: override.id,
    organisationId: override.organisationId,
    candidateId: override.candidateId,
    jobId: override.jobId,
    matchStateId: override.matchStateId,
    matchResultId: override.matchResultId || null,
    rankingSnapshotId: override.rankingSnapshotId || null,
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

async function loadMatchState(actorUser, payload, mode = 'generate') {
  const permissionContext = await requireIntelligenceFeature(actorUser, FEATURE, null, mode);
  const state = await prisma.candidateJobMatchState.findUnique({
    where: {
      organisationId_candidateId_jobId: {
        organisationId: permissionContext.organisationId,
        candidateId: payload.candidateId,
        jobId: payload.jobId,
      },
    },
    include: {
      latestResult: { include: { execution: true } },
    },
  });
  if (!state?.latestResult?.normalizedOutput) {
    const error = new Error('Candidate match result not found for override.');
    error.statusCode = 404;
    throw error;
  }
  return { permissionContext, state };
}

export async function createRecruiterMatchOverride(actorUser, payload, requestMeta = {}) {
  const { permissionContext, state } = await loadMatchState(actorUser, payload, 'generate');
  const created = await prisma.recruiterMatchOverride.create({
    data: {
      organisationId: permissionContext.organisationId,
      candidateId: payload.candidateId,
      jobId: payload.jobId,
      matchStateId: state.id,
      matchResultId: state.latestResultId || null,
      rankingSnapshotId: payload.rankingSnapshotId || null,
      type: payload.type,
      scoreDelta: payload.scoreDelta ?? null,
      recommendationOverride: payload.recommendationOverride || null,
      knockoutOverride: payload.knockoutOverride ?? null,
      reason: String(payload.reason || '').trim() || null,
      notes: String(payload.notes || '').trim() || null,
      createdByUserId: actorUser.id,
      metadata: {
        resultVersion: state.resultVersion,
      },
    },
  });

  await recordAuditLog({
    organisationId: permissionContext.organisationId,
    actorUserId: actorUser.id,
    action: 'intelligence.match.override.create',
    entityType: 'RecruiterMatchOverride',
    entityId: created.id,
    metadata: {
      candidateId: payload.candidateId,
      jobId: payload.jobId,
      type: payload.type,
      rankingSnapshotId: payload.rankingSnapshotId || null,
    },
    ipAddress: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
  }).catch(() => {});

  const generated = await getCandidateJobMatchResultEnvelope(actorUser, payload);
  const effective = buildEffectiveCandidateMatchValues(state.latestResult.normalizedOutput, created);

  return {
    override: serializeOverride(created),
    generated,
    effective: effective.effective,
  };
}

export async function listRecruiterMatchOverrides(actorUser, payload) {
  const { permissionContext } = await loadMatchState(actorUser, payload, 'read');
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
