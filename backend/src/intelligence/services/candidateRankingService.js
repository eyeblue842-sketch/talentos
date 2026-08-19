import { env } from '../../config/env.js';
import { recordAuditLog } from '../../services/auditLogService.js';
import { enqueueBackgroundTask } from '../../services/backgroundTaskService.js';
import { requireIntelligenceFeature } from './featureAccessService.js';
import { createFingerprint } from './governanceService.js';
import { resolveActiveMatchScoringProfileVersion } from './matchScoringProfileService.js';
import { getCandidateJobMatchCompatibility } from './candidateMatchEngineService.js';
import { buildEffectiveCandidateMatchValues } from './candidateMatchResultService.js';
import {
  countRankingEntries,
  createRankingEntry,
  createRankingSnapshot,
  deleteRankingEntriesForSnapshot,
  findCandidateJobMatchStateForRanking,
  findLatestRankingOverrides,
  findLatestRankingSnapshot,
  findRankingEntries,
  findRankingEntriesWithCandidateFallback,
  findRankingJob,
  findRankingPoolApplications,
  findRankingSnapshotById,
  findRankingTaskActorUser,
  updateRankingSnapshot,
} from '../repositories/candidateRankingRepository.js';

const FEATURE = 'CANDIDATE_RANKING';
const SNAPSHOT_SCHEMA_VERSION = '1.0.0';
const SNAPSHOT_SOURCE_VERSION = 'candidate-ranking-source-v1';
const RANKING_POLICY_VERSION = 'candidate-ranking-policy-v1';
const MAX_RANKING_CANDIDATES = 250;

function iso(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function clampPage(value, fallback) {
  const next = Number(value || fallback);
  return Number.isFinite(next) && next > 0 ? Math.floor(next) : fallback;
}

function fitBand(score) {
  if (score >= 85) return 'STRONG_MATCH';
  if (score >= 70) return 'MATCH';
  if (score >= 55) return 'PARTIAL_MATCH';
  return 'LIMITED_MATCH';
}

function serializeSnapshot(snapshot) {
  if (!snapshot) return null;
  return {
    id: snapshot.id,
    organisationId: snapshot.organisationId,
    jobId: snapshot.jobId,
    status: snapshot.status,
    candidatePoolFingerprint: snapshot.candidatePoolFingerprint,
    sourceFingerprint: snapshot.sourceFingerprint,
    sourceVersion: snapshot.sourceVersion,
    schemaVersion: snapshot.schemaVersion,
    scoringProfileVersionId: snapshot.scoringProfileVersionId || null,
    latestExecutionId: snapshot.latestExecutionId || null,
    generatedAt: iso(snapshot.generatedAt),
    completedAt: iso(snapshot.completedAt),
    staleReason: snapshot.staleReason || null,
    totalCandidates: snapshot.totalCandidates,
    processedCandidates: snapshot.processedCandidates,
    failedCandidates: snapshot.failedCandidates,
    createdAt: iso(snapshot.createdAt),
    updatedAt: iso(snapshot.updatedAt),
  };
}

function serializeEntry(entry) {
  return {
    id: entry.id,
    snapshotId: entry.snapshotId,
    organisationId: entry.organisationId,
    jobId: entry.jobId,
    candidateId: entry.candidateId,
    matchStateId: entry.matchStateId,
    matchResultId: entry.matchResultId,
    rank: entry.rank,
    generatedOverallScore: entry.generatedOverallScore,
    effectiveOverallScore: entry.effectiveOverallScore,
    confidenceScore: entry.confidenceScore == null ? null : Number(entry.confidenceScore),
    generatedRecommendation: entry.generatedRecommendation,
    effectiveRecommendation: entry.effectiveRecommendation,
    fitBand: entry.fitBand,
    strengthSummary: entry.strengthSummary || null,
    gapSummary: entry.gapSummary || null,
    isKnockedOut: Boolean(entry.isKnockedOut),
    hasOverride: Boolean(entry.hasOverride),
    createdAt: iso(entry.createdAt),
    updatedAt: iso(entry.updatedAt),
  };
}

async function getRankingContext(actorUser, jobId, mode = 'read') {
  const permissionContext = await requireIntelligenceFeature(actorUser, FEATURE, null, mode);
  const job = await findRankingJob(permissionContext.organisationId, jobId);
  if (!job) {
    const error = new Error('Job not found.');
    error.statusCode = 404;
    throw error;
  }
  return { permissionContext, job };
}

async function getCandidatePool(context) {
  const rows = await findRankingPoolApplications(
    context.permissionContext.organisationId,
    context.job.id,
    MAX_RANKING_CANDIDATES,
  );

  return rows.map((row) => ({
    applicationId: row.id,
    candidateId: row.candidateId,
    updatedAt: row.updatedAt,
  }));
}

function buildCandidatePoolFingerprint(pool) {
  return createFingerprint({
    candidates: pool.map((item) => ({
      candidateId: item.candidateId,
      applicationId: item.applicationId,
      updatedAt: iso(item.updatedAt),
    })),
  });
}

function buildRankingSourceFingerprint({ job, poolFingerprint, scoringProfileVersion, overrideFingerprint }) {
  return createFingerprint({
    jobId: job.id,
    jobUpdatedAt: iso(job.updatedAt),
    poolFingerprint,
    scoringProfileVersion: scoringProfileVersion ? {
      id: scoringProfileVersion.id,
      version: scoringProfileVersion.version,
      profileId: scoringProfileVersion.profileId,
      resultVersion: scoringProfileVersion.resultVersion,
      normalizationVersion: scoringProfileVersion.normalizationVersion,
    } : null,
    overrideFingerprint,
    rankingPolicyVersion: RANKING_POLICY_VERSION,
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    sourceVersion: SNAPSHOT_SOURCE_VERSION,
  });
}

async function getLatestSnapshot(organisationId, jobId) {
  return findLatestRankingSnapshot(organisationId, jobId);
}

async function getLatestOverridesMap(organisationId, jobId) {
  const rows = await findLatestRankingOverrides(organisationId, jobId);

  const map = new Map();
  for (const row of rows) {
    const key = `${row.candidateId}:${row.jobId}`;
    if (!map.has(key)) map.set(key, row);
  }
  return map;
}

function compareRankingEntries(left, right) {
  if (left.isKnockedOut !== right.isKnockedOut) return left.isKnockedOut ? 1 : -1;
  if (right.effectiveOverallScore !== left.effectiveOverallScore) return right.effectiveOverallScore - left.effectiveOverallScore;
  if ((right.confidenceScore || 0) !== (left.confidenceScore || 0)) return (right.confidenceScore || 0) - (left.confidenceScore || 0);
  if ((right.requiredSkillsScore || 0) !== (left.requiredSkillsScore || 0)) return (right.requiredSkillsScore || 0) - (left.requiredSkillsScore || 0);
  if (left.generatedAt !== right.generatedAt) return new Date(left.generatedAt) - new Date(right.generatedAt);
  return String(left.candidateId).localeCompare(String(right.candidateId));
}

async function createRankingEntries(snapshot, items) {
  const sorted = [...items].sort(compareRankingEntries).map((item, index) => ({
    ...item,
    rank: index + 1,
  }));

  if (sorted.length) {
    for (const item of sorted) {
      await createRankingEntry({
        snapshotId: snapshot.id,
        organisationId: snapshot.organisationId,
        jobId: snapshot.jobId,
        candidateId: item.candidateId,
        matchStateId: item.matchStateId,
        matchResultId: item.matchResultId,
        rank: item.rank,
        generatedOverallScore: item.generatedOverallScore,
        effectiveOverallScore: item.effectiveOverallScore,
        confidenceScore: item.confidenceScore,
        generatedRecommendation: item.generatedRecommendation,
        effectiveRecommendation: item.effectiveRecommendation,
        fitBand: fitBand(item.effectiveOverallScore),
        strengthSummary: item.strengthSummary,
        gapSummary: item.gapSummary,
        isKnockedOut: item.isKnockedOut,
        hasOverride: item.hasOverride,
        metadata: {
          requiredSkillsScore: item.requiredSkillsScore,
        },
      });
    }
  }
  return sorted;
}

async function buildRankingSnapshot(actorUser, payload, requestMeta = {}, forceRegenerate = false) {
  const context = await getRankingContext(actorUser, payload.jobId, 'generate');
  const pool = await getCandidatePool(context);
  const scoringProfileVersion = await resolveActiveMatchScoringProfileVersion(
    context.permissionContext.organisationId,
    payload.scoringProfileVersionId || null,
    payload.scoringProfileId || null,
    actorUser.id,
  );
  const overrides = await getLatestOverridesMap(context.permissionContext.organisationId, context.job.id);
  const overrideFingerprint = createFingerprint({
    overrides: [...overrides.values()].map((item) => ({
      id: item.id,
      candidateId: item.candidateId,
      type: item.type,
      createdAt: iso(item.createdAt),
    })),
  });
  const candidatePoolFingerprint = buildCandidatePoolFingerprint(pool);
  const sourceFingerprint = buildRankingSourceFingerprint({
    job: context.job,
    poolFingerprint: candidatePoolFingerprint,
    scoringProfileVersion,
    overrideFingerprint,
  });

  const existing = await getLatestSnapshot(context.permissionContext.organisationId, context.job.id);
  if (!forceRegenerate && existing && existing.sourceFingerprint === sourceFingerprint && ['PENDING', 'READY', 'PARTIAL'].includes(existing.status)) {
    return { context, pool, scoringProfileVersion, snapshot: existing, queued: false };
  }

  const snapshot = await createRankingSnapshot({
    organisationId: context.permissionContext.organisationId,
    jobId: context.job.id,
    status: pool.length ? 'PENDING' : 'READY',
    candidatePoolFingerprint,
    sourceFingerprint,
    sourceVersion: SNAPSHOT_SOURCE_VERSION,
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    scoringProfileVersionId: scoringProfileVersion?.id || null,
    triggeredByUserId: actorUser.id,
    totalCandidates: pool.length,
    processedCandidates: 0,
    failedCandidates: 0,
    metadata: {
      rankingPolicyVersion: RANKING_POLICY_VERSION,
      queuedCandidateIds: pool.map((item) => item.candidateId),
    },
  });

  const task = pool.length
    ? await enqueueBackgroundTask({
        organisationId: context.permissionContext.organisationId,
        type: 'JOB_CANDIDATE_RANKING_GENERATION',
        entityType: 'CandidateRankingSnapshot',
        entityId: snapshot.id,
        idempotencyKey: `candidate-ranking:${snapshot.id}`,
        payload: {
          snapshotId: snapshot.id,
          jobId: context.job.id,
          requestedByUserId: actorUser.id,
          scoringProfileId: payload.scoringProfileId || null,
          scoringProfileVersionId: scoringProfileVersion?.id || null,
        },
        nextAttemptAt: new Date(),
        createdByUserId: actorUser.id,
        maxAttempts: Math.max(1, env.intelligenceMaxRetries + 1),
      })
    : null;

  await recordAuditLog({
    organisationId: context.permissionContext.organisationId,
    actorUserId: actorUser.id,
    action: 'intelligence.ranking.generate',
    entityType: 'CandidateRankingSnapshot',
    entityId: snapshot.id,
    metadata: {
      jobId: context.job.id,
      totalCandidates: pool.length,
      taskId: task?.id || null,
    },
    ipAddress: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
  }).catch(() => {});

  return { context, pool, scoringProfileVersion, snapshot, queued: Boolean(task) };
}

export async function generateCandidateRanking(actorUser, payload, requestMeta = {}) {
  const built = await buildRankingSnapshot(actorUser, payload, requestMeta, Boolean(payload.forceRegenerate));
  return {
    snapshot: serializeSnapshot(built.snapshot),
    queued: built.queued,
  };
}

export async function refreshCandidateRanking(actorUser, payload, requestMeta = {}) {
  return generateCandidateRanking(actorUser, { ...payload, forceRegenerate: true }, requestMeta);
}

export async function getCandidateRankingStatus(actorUser, payload) {
  const context = await getRankingContext(actorUser, payload.jobId, 'read');
  const snapshot = await getLatestSnapshot(context.permissionContext.organisationId, context.job.id);
  return snapshot ? serializeSnapshot(snapshot) : null;
}

export async function getCandidateRanking(actorUser, payload) {
  const context = await getRankingContext(actorUser, payload.jobId, 'read');
  const snapshot = await getLatestSnapshot(context.permissionContext.organisationId, context.job.id);
  if (!snapshot) {
    return {
      snapshot: null,
      entries: [],
      meta: { total: 0, page: clampPage(payload.page, 1), pageSize: clampPage(payload.pageSize, 20), pageCount: 1 },
    };
  }

  const page = clampPage(payload.page, 1);
  const pageSize = clampPage(payload.pageSize, 20);
  if (payload.status && snapshot.status !== payload.status) {
    return {
      snapshot: serializeSnapshot(snapshot),
      entries: [],
      meta: { total: 0, page, pageSize, pageCount: 1 },
    };
  }

  const where = {
    snapshotId: snapshot.id,
    organisationId: context.permissionContext.organisationId,
    ...(payload.recommendation ? { effectiveRecommendation: payload.recommendation } : {}),
    ...(payload.knockedOut !== undefined ? { isKnockedOut: Boolean(payload.knockedOut) } : {}),
    ...(payload.minScore != null ? { effectiveOverallScore: { gte: payload.minScore } } : {}),
    ...(payload.minConfidence != null ? { confidenceScore: { gte: payload.minConfidence } } : {}),
    ...(String(payload.candidate || '').trim()
      ? { candidate: { fullName: { contains: String(payload.candidate).trim(), mode: 'insensitive' } } }
      : {}),
  };
  const orderBy = payload.sort === 'score'
    ? [{ effectiveOverallScore: 'desc' }, { rank: 'asc' }]
    : payload.sort === 'confidence'
      ? [{ confidenceScore: 'desc' }, { rank: 'asc' }]
      : [{ rank: 'asc' }];

  const runFallbackListing = async () => {
    let entries = await findRankingEntriesWithCandidateFallback(
      snapshot.id,
      context.permissionContext.organisationId,
      orderBy,
    );

    if (payload.recommendation) entries = entries.filter((entry) => entry.effectiveRecommendation === payload.recommendation);
    if (payload.knockedOut !== undefined) entries = entries.filter((entry) => Boolean(entry.isKnockedOut) === Boolean(payload.knockedOut));
    if (payload.minScore != null) entries = entries.filter((entry) => entry.effectiveOverallScore >= payload.minScore);
    if (payload.minConfidence != null) entries = entries.filter((entry) => (entry.confidenceScore == null ? 0 : Number(entry.confidenceScore)) >= payload.minConfidence);
    if (String(payload.candidate || '').trim()) {
      const needle = String(payload.candidate).trim().toLowerCase();
      entries = entries.filter((entry) => String(entry.candidate?.fullName || '').toLowerCase().includes(needle));
    }

    const total = entries.length;
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const start = (page - 1) * pageSize;
    return {
      snapshot: serializeSnapshot(snapshot),
      entries: entries.slice(start, start + pageSize).map(serializeEntry),
      meta: { total, page, pageSize, pageCount },
    };
  };

  try {
    const [total, entries] = await Promise.all([
      countRankingEntries(where),
      findRankingEntries(where, orderBy, (page - 1) * pageSize, pageSize),
    ]);
    const pageCount = Math.max(1, Math.ceil(total / pageSize));

    return {
      snapshot: serializeSnapshot(snapshot),
      entries: entries.map(serializeEntry),
      meta: { total, page, pageSize, pageCount },
    };
  } catch (error) {
    if (error?.code === 'P2021' || error?.code === 'P1001' || error?.code === 'P1008') {
      return runFallbackListing();
    }
    throw error;
  }
}

export async function runJobCandidateRankingGenerationTask(task) {
  const snapshotId = task.payload?.snapshotId || task.entityId;
  const requestedByUserId = task.payload?.requestedByUserId || task.createdByUserId || null;
  if (!snapshotId || !requestedByUserId) return 'cancelled';

  const actorUser = await findRankingTaskActorUser(requestedByUserId);
  if (!actorUser) return 'cancelled';

  const snapshot = await findRankingSnapshotById(snapshotId);
  if (!snapshot) return 'cancelled';

  const context = await getRankingContext(actorUser, snapshot.jobId, 'read');
  const pool = await getCandidatePool(context);
  const overrides = await getLatestOverridesMap(context.permissionContext.organisationId, context.job.id);

  const items = [];
  let failedCandidates = 0;
  for (const candidate of pool) {
    try {
      await getCandidateJobMatchCompatibility(actorUser, {
        candidateId: candidate.candidateId,
        jobId: context.job.id,
        forceRegenerate: true,
        scoringProfileVersionId: task.payload?.scoringProfileVersionId || snapshot.scoringProfileVersionId || null,
        scoringProfileId: task.payload?.scoringProfileId || null,
      });

      const state = await findCandidateJobMatchStateForRanking(
        context.permissionContext.organisationId,
        candidate.candidateId,
        context.job.id,
      );
      if (!state?.latestResult?.normalizedOutput) {
        failedCandidates += 1;
        continue;
      }

      const override = overrides.get(`${candidate.candidateId}:${context.job.id}`) || null;
      const effective = buildEffectiveCandidateMatchValues(state.latestResult.normalizedOutput, override);
      const output = state.latestResult.normalizedOutput;
      items.push({
        candidateId: candidate.candidateId,
        matchStateId: state.id,
        matchResultId: state.latestResultId,
        generatedOverallScore: output.overallScore.score,
        effectiveOverallScore: effective.effective?.overallScore?.score ?? output.overallScore.score,
        confidenceScore: output.confidence?.score ?? null,
        generatedRecommendation: output.recommendation?.label || 'REVIEW_REQUIRED',
        effectiveRecommendation: effective.effective?.recommendation?.label || output.recommendation?.label || 'REVIEW_REQUIRED',
        requiredSkillsScore: output.scoreBreakdown?.requiredSkills?.score ?? 0,
        isKnockedOut: effective.effective?.knockedOut ?? (Array.isArray(output.knockoutResults) && output.knockoutResults.some((item) => item?.triggered)),
        hasOverride: Boolean(override),
        strengthSummary: output.strengths?.[0]?.text || null,
        gapSummary: output.risks?.[0]?.text || null,
        generatedAt: state.generatedAt || state.lastGeneratedAt || state.updatedAt,
      });
    } catch {
      failedCandidates += 1;
    }
  }

  await deleteRankingEntriesForSnapshot(snapshot.id);

  await createRankingEntries(snapshot, items);
  const status = failedCandidates > 0 && items.length > 0
    ? 'PARTIAL'
    : failedCandidates > 0
      ? 'FAILED'
      : 'READY';

  await updateRankingSnapshot(snapshot.id, {
    status,
    processedCandidates: items.length,
    failedCandidates,
    generatedAt: new Date(),
    completedAt: new Date(),
    staleReason: null,
    metadata: {
      rankingPolicyVersion: RANKING_POLICY_VERSION,
    },
  });

  return 'success';
}

export async function runCandidateMatchBulkGenerationTask(task) {
  const requestedByUserId = task.payload?.requestedByUserId || task.createdByUserId || null;
  const jobId = task.payload?.jobId || null;
  const candidateIds = Array.isArray(task.payload?.candidateIds) ? task.payload.candidateIds : [];
  if (!requestedByUserId || !jobId || !candidateIds.length) return 'cancelled';

  const actorUser = await findRankingTaskActorUser(requestedByUserId);
  if (!actorUser) return 'cancelled';

  for (const candidateId of candidateIds) {
    await getCandidateJobMatchCompatibility(actorUser, {
      candidateId,
      jobId,
      forceRegenerate: Boolean(task.payload?.forceRegenerate),
      scoringProfileId: task.payload?.scoringProfileId || null,
      scoringProfileVersionId: task.payload?.scoringProfileVersionId || null,
    }).catch(() => null);
  }

  return 'success';
}
