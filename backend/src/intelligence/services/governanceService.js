import crypto from 'crypto';
import { prisma } from '../../config/db.js';
import { recordAuditLog } from '../../services/auditLogService.js';
import { intelligenceFeatureConfig } from '../policies/intelligencePolicy.js';

export function createFingerprint(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export async function createIntelligenceExecution({
  organisationId,
  requestedByUserId,
  feature,
  promptKey,
  promptVersion,
  provider,
  model,
  inputPayload,
  metadata = {},
}) {
  const inputText = JSON.stringify(inputPayload || {});
  return prisma.intelligenceExecution.create({
    data: {
      organisationId,
      requestedByUserId,
      feature,
      promptKey,
      promptVersion,
      provider,
      model,
      status: 'RUNNING',
      inputFingerprint: createFingerprint(inputPayload),
      inputCharacterCount: inputText.length,
      metadata,
    },
  });
}

export async function completeIntelligenceExecution(executionId, payload = {}) {
  return prisma.intelligenceExecution.update({
    where: { id: executionId },
    data: {
      status: payload.status || 'SUCCEEDED',
      outputCharacterCount: payload.outputCharacterCount ?? undefined,
      promptTokens: payload.promptTokens ?? undefined,
      completionTokens: payload.completionTokens ?? undefined,
      estimatedCost: payload.estimatedCost ?? undefined,
      latencyMs: payload.latencyMs ?? undefined,
      errorCode: payload.errorCode ?? undefined,
      humanReviewed: payload.humanReviewed ?? undefined,
      cacheHit: payload.cacheHit ?? undefined,
      retries: payload.retries ?? undefined,
      completedAt: new Date(),
      metadata: payload.metadata ?? undefined,
    },
  });
}

export async function recordIntelligenceFailure(executionId, error) {
  return prisma.intelligenceExecution.update({
    where: { id: executionId },
    data: {
      status: 'FAILED',
      errorCode: error?.code || 'INTELLIGENCE_FAILED',
      completedAt: new Date(),
    },
  });
}

export async function getFreshCachedResult({ organisationId, entityType, entityId, sourceFingerprint, resultVersion, promptVersion }) {
  return prisma.intelligenceResult.findFirst({
    where: {
      organisationId,
      entityType,
      entityId,
      sourceFingerprint,
      resultVersion,
      promptVersion,
      supersededAt: null,
      dismissedAt: null,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    include: { execution: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function supersedeCachedResults({ organisationId, entityType, entityId, resultVersion }) {
  return prisma.intelligenceResult.updateMany({
    where: {
      organisationId,
      entityType,
      entityId,
      resultVersion,
      supersededAt: null,
    },
    data: {
      supersededAt: new Date(),
    },
  });
}

export async function storeIntelligenceResult({
  organisationId,
  executionId,
  entityType,
  entityId,
  sourceFingerprint,
  resultVersion,
  promptVersion,
  normalizedOutput,
  explanation = null,
  confidence = null,
  feature,
}) {
  const ttlHours = intelligenceFeatureConfig[feature]?.ttlHours || 24;
  return prisma.intelligenceResult.create({
    data: {
      organisationId,
      executionId,
      entityType,
      entityId,
      sourceFingerprint,
      resultVersion,
      promptVersion,
      normalizedOutput,
      explanation,
      confidence,
      expiresAt: new Date(Date.now() + (ttlHours * 60 * 60 * 1000)),
    },
  });
}

export async function recordIntelligenceFeedback(actorUser, payload, requestMeta = {}) {
  const execution = await prisma.intelligenceExecution.findFirst({
    where: {
      id: payload.executionId,
      organisationId: actorUser.activeMembership?.organisationId,
    },
  });

  if (!execution) {
    const error = new Error('Intelligence execution not found.');
    error.statusCode = 404;
    throw error;
  }

  const feedback = await prisma.intelligenceFeedback.create({
    data: {
      executionId: payload.executionId,
      userId: actorUser.id,
      rating: payload.rating ?? null,
      useful: payload.useful,
      feedback: payload.feedback || null,
      overrideReason: payload.overrideReason || null,
      dismissed: payload.dismissed ?? false,
    },
  });

  await prisma.intelligenceExecution.update({
    where: { id: payload.executionId },
    data: { humanReviewed: true },
  });

  await recordAuditLog({
    organisationId: execution.organisationId,
    actorUserId: actorUser.id,
    action: 'intelligence.feedback.create',
    entityType: 'IntelligenceExecution',
    entityId: execution.id,
    afterData: {
      useful: feedback.useful,
      rating: feedback.rating,
      dismissed: feedback.dismissed,
    },
    ipAddress: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
  });

  return feedback;
}

export async function listIntelligenceExecutions(actorUser, filters = {}) {
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 20;
  const where = {
    organisationId: actorUser.activeMembership?.organisationId,
    feature: filters.feature || undefined,
    status: filters.status || undefined,
    provider: filters.provider || undefined,
  };

  const [total, items] = await Promise.all([
    prisma.intelligenceExecution.count({ where }),
    prisma.intelligenceExecution.findMany({
      where,
      include: {
        results: true,
        feedback: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items,
    meta: {
      total,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}
