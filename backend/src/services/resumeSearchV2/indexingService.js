import { prisma } from '../../config/db.js';
import { env } from '../../config/env.js';
import { enqueueBackgroundTask } from '../backgroundTaskService.js';
import { buildResumeSearchDocument } from './documentBuilder.js';
import { RESUME_SEARCH_INDEX_SCHEMA_VERSION } from './mapping.js';
import { resumeSearchAdapter } from './openSearchAdapter.js';

function buildIndexingIdempotencyKey(candidateId, sourceVersion) {
  return `resume-search-index:${candidateId}:${RESUME_SEARCH_INDEX_SCHEMA_VERSION}:${sourceVersion}`;
}

export function isResumeIndexingAllowed({ organisationId, importBatchId = null } = {}) {
  if (!env.resumeIndexingEnabled) return false;
  if (importBatchId && env.resumeImportBlockedBatchIds.includes(importBatchId)) return false;
  const orgAllowed = env.resumeIndexingAllowedOrgIds.length && organisationId && env.resumeIndexingAllowedOrgIds.includes(organisationId);
  const batchAllowed = env.resumeIndexingAllowedBatchIds.length && importBatchId && env.resumeIndexingAllowedBatchIds.includes(importBatchId);
  return Boolean(orgAllowed || batchAllowed);
}

async function loadCandidateForIndexing(candidateId) {
  return prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    include: {
      latestResumeAsset: true,
    },
  });
}

export async function enqueueResumeSearchIndexUpsert(candidateId, options = {}) {
  const candidate = await loadCandidateForIndexing(candidateId);
  if (!candidate) return null;
  const resume = candidate.latestResumeAsset || null;
  const importBatchId = candidate.importBatchId || candidate.provenanceMetadata?.importBatchId || null;
  if (!isResumeIndexingAllowed({ organisationId: candidate.organisationId, importBatchId })) {
    await prisma.resumeSearchIndexState.upsert({
      where: { candidateId_indexSchemaVersion: { candidateId, indexSchemaVersion: RESUME_SEARCH_INDEX_SCHEMA_VERSION } },
      update: {
        resumeId: resume?.id || null,
        sourceVersion: `skipped:${candidate.updatedAt?.toISOString?.() || 'unknown'}`,
        status: 'SKIPPED',
        lastErrorCode: null,
        lastErrorAt: null,
      },
      create: {
        candidateId,
        resumeId: resume?.id || null,
        sourceVersion: `skipped:${candidate.updatedAt?.toISOString?.() || 'unknown'}`,
        indexSchemaVersion: RESUME_SEARCH_INDEX_SCHEMA_VERSION,
        status: 'SKIPPED',
      },
    }).catch(() => {});
    return null;
  }

  const document = buildResumeSearchDocument(candidate, resume);
  await prisma.resumeSearchIndexState.upsert({
    where: { candidateId_indexSchemaVersion: { candidateId, indexSchemaVersion: RESUME_SEARCH_INDEX_SCHEMA_VERSION } },
    update: {
      resumeId: resume?.id || null,
      sourceVersion: document.sourceVersion,
      status: 'PENDING',
      lastErrorCode: null,
      lastErrorAt: null,
    },
    create: {
      candidateId,
      resumeId: resume?.id || null,
      sourceVersion: document.sourceVersion,
      indexSchemaVersion: RESUME_SEARCH_INDEX_SCHEMA_VERSION,
      status: 'PENDING',
    },
  });

  return enqueueBackgroundTask({
    organisationId: candidate.organisationId || null,
    type: 'RESUME_SEARCH_INDEX_SYNC',
    entityType: 'CandidateProfile',
    entityId: candidate.id,
    idempotencyKey: buildIndexingIdempotencyKey(candidate.id, document.sourceVersion),
    payload: {
      action: 'UPSERT',
      candidateId: candidate.id,
      resumeId: resume?.id || null,
      sourceVersion: document.sourceVersion,
      correlationId: options.correlationId || null,
      importBatchId,
    },
    maxAttempts: 3,
    createdByUserId: options.createdByUserId || null,
  });
}

export async function enqueueResumeSearchIndexDelete(candidateId, options = {}) {
  return enqueueBackgroundTask({
    organisationId: options.organisationId || null,
    type: 'RESUME_SEARCH_INDEX_SYNC',
    entityType: 'CandidateProfile',
    entityId: candidateId,
    idempotencyKey: `resume-search-delete:${candidateId}:${RESUME_SEARCH_INDEX_SCHEMA_VERSION}`,
    payload: {
      action: 'DELETE',
      candidateId,
      correlationId: options.correlationId || null,
    },
    maxAttempts: 3,
    createdByUserId: options.createdByUserId || null,
  });
}

function classifyIndexingError(error) {
  const statusCode = error?.meta?.statusCode || error?.statusCode || 500;
  const retryable = statusCode >= 500 || error?.code === 'ConnectionError' || error?.name === 'TimeoutError';
  return {
    code: error?.code || `OPENSEARCH_${statusCode}`,
    retryable,
  };
}

export async function processResumeSearchIndexTask(task) {
  const action = task.payload?.action;
  if (!action || !task.payload?.candidateId) return 'cancelled';

  if (action === 'DELETE') {
    await resumeSearchAdapter.deleteResumeDocument(`candidate:${task.payload.candidateId}`);
    await prisma.resumeSearchIndexState.updateMany({
      where: { candidateId: task.payload.candidateId, indexSchemaVersion: RESUME_SEARCH_INDEX_SCHEMA_VERSION },
      data: {
        status: 'DELETED',
        indexedAt: new Date(),
        lastErrorCode: null,
        lastErrorAt: null,
      },
    });
    return 'success';
  }

  const candidate = await loadCandidateForIndexing(task.payload.candidateId);
  if (!candidate) return 'cancelled';
  const resume = candidate.latestResumeAsset || null;
  const document = buildResumeSearchDocument(candidate, resume);

  if (document.sourceVersion !== task.payload.sourceVersion) {
    return 'cancelled';
  }

  const state = await prisma.resumeSearchIndexState.findUnique({
    where: { candidateId_indexSchemaVersion: { candidateId: candidate.id, indexSchemaVersion: RESUME_SEARCH_INDEX_SCHEMA_VERSION } },
  });
  if (!state) return 'cancelled';
  if (state.sourceVersion !== document.sourceVersion) return 'cancelled';

  await prisma.resumeSearchIndexState.update({
    where: { candidateId_indexSchemaVersion: { candidateId: candidate.id, indexSchemaVersion: RESUME_SEARCH_INDEX_SCHEMA_VERSION } },
    data: {
      status: 'PENDING',
      attemptCount: { increment: 1 },
      lastAttemptAt: new Date(),
    },
  });

  try {
    await resumeSearchAdapter.ensureIndexVersion();
    await resumeSearchAdapter.upsertResumeDocument(document);
    await prisma.resumeSearchIndexState.update({
      where: { candidateId_indexSchemaVersion: { candidateId: candidate.id, indexSchemaVersion: RESUME_SEARCH_INDEX_SCHEMA_VERSION } },
      data: {
        resumeId: resume?.id || null,
        sourceVersion: document.sourceVersion,
        status: 'INDEXED',
        indexedAt: new Date(),
        engineDocumentVersion: document.sourceVersion,
        lastErrorCode: null,
        lastErrorAt: null,
      },
    });
    return 'success';
  } catch (error) {
    const classified = classifyIndexingError(error);
    await prisma.resumeSearchIndexState.update({
      where: { candidateId_indexSchemaVersion: { candidateId: candidate.id, indexSchemaVersion: RESUME_SEARCH_INDEX_SCHEMA_VERSION } },
      data: {
        status: classified.retryable ? 'RETRY_SCHEDULED' : 'FAILED',
        lastErrorCode: classified.code,
        lastErrorAt: new Date(),
      },
    });
    error.code = classified.code;
    error.retryable = classified.retryable;
    throw error;
  }
}
