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
import { projectJobForIntelligence } from '../redaction/projectionService.js';

const FEATURE = 'JOB_DESCRIPTION';
const ENTITY_TYPE = 'JobDescription';
const DEFAULT_KIND = 'FULL_DESCRIPTION';
const SOURCE_VERSION = 'job-description-source-v1';
const RESULT_VERSION = 'job-description-v2';
const SCHEMA_VERSION = '1.0.0';
const STATE_METADATA_VERSION = '1.0.0';
const PROMPT_KEY = 'JOB_DESCRIPTION_FULL';
const PROMPT_VERSION = '1.0.0';

function iso(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function scrubText(value = '', maxLength = 4000) {
  return String(value || '')
    .replace(/[<>{}`$]/g, ' ')
    .replace(/\b[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, '[REDACTED_EMAIL]')
    .replace(/\+?\d[\d\s\-()]{7,}\d/g, '[REDACTED_PHONE]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function cleanArray(value, maxItems = 20, maxLength = 160) {
  return Array.isArray(value)
    ? [...new Set(value.map((item) => scrubText(item, maxLength)).filter(Boolean))].slice(0, maxItems)
    : [];
}

function buildDeterministicJobDescription(job, requisition = null) {
  const description = scrubText(job?.description || requisition?.reasonForHiring, 1400);
  return {
    jobId: job.id,
    kind: DEFAULT_KIND,
    summary: description || 'No source description provided yet.',
    responsibilities: cleanArray(job?.responsibilities, 30, 300),
    requiredSkills: cleanArray(job?.skillsRequired, 40, 120),
    preferredSkills: cleanArray(job?.skillsPreferred, 30, 120),
    screeningQuestions: [],
    assumptions: [
      !job?.location ? 'Location is missing and must be confirmed manually.' : null,
      !job?.employmentType ? 'Employment type is missing and must be confirmed manually.' : null,
      !job?.description ? 'Job description content is limited and should be expanded before publishing.' : null,
    ].filter(Boolean),
    exclusionaryWordingWarnings: [
      /\byoung\b/i.test(description) ? 'Potentially exclusionary wording detected: young' : null,
      /\baggressive\b/i.test(description) ? 'Potentially exclusionary wording detected: aggressive' : null,
      /\brockstar\b/i.test(description) ? 'Potentially exclusionary wording detected: rockstar' : null,
      /\bninja\b/i.test(description) ? 'Potentially exclusionary wording detected: ninja' : null,
      /\bdigital native\b/i.test(description) ? 'Potentially exclusionary wording detected: digital native' : null,
    ].filter(Boolean),
    missingFields: [
      !job?.title ? 'Title missing' : null,
      !job?.location ? 'Location missing' : null,
      job?.experienceMin == null ? 'Minimum experience missing' : null,
      !cleanArray(job?.skillsRequired, 40, 120).length ? 'Required skills missing' : null,
      !description ? 'Description missing' : null,
    ].filter(Boolean),
    interviewFocus: cleanArray(job?.skillsRequired, 8, 120).map((skill) => `Validate ${skill} with practical evidence.`),
  };
}

function buildMeaningfulSource(job, requisition = null) {
  return {
    job: {
      title: job?.title || null,
      description: job?.description || null,
      location: job?.location || null,
      employmentType: job?.employmentType || null,
      workplaceType: job?.workplaceType || null,
      department: job?.department || null,
      businessUnit: job?.businessUnit || null,
      experienceMin: job?.experienceMin ?? null,
      experienceMax: job?.experienceMax ?? null,
      skillsRequired: cleanArray(job?.skillsRequired, 50, 120),
      responsibilities: cleanArray(job?.responsibilities, 50, 300),
      requirements: cleanArray(job?.requirements, 50, 300),
      benefits: cleanArray(job?.benefits, 50, 300),
      targetHires: job?.targetHires ?? null,
    },
    requisition: requisition ? {
      id: requisition.id,
      title: requisition.title || null,
      department: requisition.department || null,
      businessUnit: requisition.businessUnit || null,
      location: requisition.location || null,
      employmentType: requisition.employmentType || null,
      numberOfOpenings: requisition.numberOfOpenings ?? null,
      reasonForHiring: requisition.reasonForHiring || null,
      priority: requisition.priority || null,
      budgetMin: requisition.budgetMin ?? null,
      budgetMax: requisition.budgetMax ?? null,
    } : null,
    promptVersion: PROMPT_VERSION,
    sourceVersion: SOURCE_VERSION,
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

function buildExecutionSection(state, execution, extra = {}) {
  const statusOverride = extra.statusOverride
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
    status: statusOverride,
    cacheHit: Boolean(extra.cacheHit),
    stale: Boolean(extra.stale),
    generatedAt: iso(state?.generatedAt || execution?.completedAt),
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
    estimatedCost: state?.estimatedCost != null
      ? Number(state.estimatedCost)
      : (execution?.estimatedCost != null ? Number(execution.estimatedCost) : null),
  };
}

function buildApiResponseFromStoredResult(jobId, state, result, extra = {}) {
  const output = result?.normalizedOutput || extra.fallbackOutput;
  return {
    jobId,
    kind: DEFAULT_KIND,
    ...(output || {}),
    execution: buildExecutionSection(state, result?.execution, extra),
  };
}

async function getAccessibleJob(actorUser, jobId, mode = 'read') {
  const found = await prisma.job.findUnique({
    where: { id: jobId },
    include: { requisition: true },
  });

  if (!found || !found.organisationId) {
    const error = new Error('Job not found.');
    error.statusCode = 404;
    throw error;
  }

  const permissionContext = await requireIntelligenceFeature(actorUser, FEATURE, found.organisationId, mode);

  return {
    permissionContext,
    job: found,
    requisition: found.requisition || null,
    sourceFingerprint: createFingerprint(buildMeaningfulSource(found, found.requisition || null)),
    aiEnabled: Boolean(permissionContext.enabled),
  };
}

async function getLatestResultForJob(organisationId, jobId) {
  return prisma.intelligenceResult.findFirst({
    where: {
      organisationId,
      entityType: ENTITY_TYPE,
      entityId: jobId,
      resultVersion: RESULT_VERSION,
      promptVersion: PROMPT_VERSION,
      dismissedAt: null,
      supersededAt: null,
    },
    include: { execution: true },
    orderBy: { createdAt: 'desc' },
  });
}

async function upsertJobDescriptionState(job, payload) {
  return prisma.jobDescriptionState.upsert({
    where: {
      organisationId_jobId_kind: {
        organisationId: payload.organisationId || job.organisationId,
        jobId: job.id,
        kind: payload.kind || DEFAULT_KIND,
      },
    },
    create: {
      organisationId: payload.organisationId || job.organisationId,
      jobId: job.id,
      kind: payload.kind || DEFAULT_KIND,
      status: payload.status || 'PENDING',
      latestExecutionId: payload.latestExecutionId || null,
      latestResultId: payload.latestResultId || null,
      sourceFingerprint: payload.sourceFingerprint,
      sourceVersion: payload.sourceVersion || SOURCE_VERSION,
      schemaVersion: payload.schemaVersion || SCHEMA_VERSION,
      promptKey: payload.promptKey || PROMPT_KEY,
      promptVersion: payload.promptVersion || PROMPT_VERSION,
      resultVersion: payload.resultVersion || RESULT_VERSION,
      provider: payload.provider === undefined ? undefined : payload.provider,
      providerVersion: payload.providerVersion === undefined ? undefined : payload.providerVersion,
      model: payload.model === undefined ? undefined : payload.model,
      modelVersion: payload.modelVersion === undefined ? undefined : payload.modelVersion,
      latencyMs: payload.latencyMs === undefined ? undefined : payload.latencyMs,
      inputTokens: payload.inputTokens === undefined ? undefined : payload.inputTokens,
      outputTokens: payload.outputTokens === undefined ? undefined : payload.outputTokens,
      estimatedCost: payload.estimatedCost === undefined ? undefined : payload.estimatedCost,
      generatedAt: payload.generatedAt === undefined ? undefined : payload.generatedAt,
      staleReason: payload.staleReason === undefined ? undefined : payload.staleReason,
      metadata: payload.metadata === undefined ? undefined : payload.metadata,
    },
    update: {
      status: payload.status === undefined ? undefined : payload.status,
      latestExecutionId: payload.latestExecutionId === undefined ? undefined : payload.latestExecutionId,
      latestResultId: payload.latestResultId === undefined ? undefined : payload.latestResultId,
      sourceFingerprint: payload.sourceFingerprint === undefined ? undefined : payload.sourceFingerprint,
      sourceVersion: payload.sourceVersion === undefined ? undefined : payload.sourceVersion,
      schemaVersion: payload.schemaVersion === undefined ? undefined : payload.schemaVersion,
      promptKey: payload.promptKey === undefined ? undefined : payload.promptKey,
      promptVersion: payload.promptVersion === undefined ? undefined : payload.promptVersion,
      resultVersion: payload.resultVersion === undefined ? undefined : payload.resultVersion,
      provider: payload.provider === undefined ? undefined : payload.provider,
      providerVersion: payload.providerVersion === undefined ? undefined : payload.providerVersion,
      model: payload.model === undefined ? undefined : payload.model,
      modelVersion: payload.modelVersion === undefined ? undefined : payload.modelVersion,
      latencyMs: payload.latencyMs === undefined ? undefined : payload.latencyMs,
      inputTokens: payload.inputTokens === undefined ? undefined : payload.inputTokens,
      outputTokens: payload.outputTokens === undefined ? undefined : payload.outputTokens,
      estimatedCost: payload.estimatedCost === undefined ? undefined : payload.estimatedCost,
      generatedAt: payload.generatedAt === undefined ? undefined : payload.generatedAt,
      staleReason: payload.staleReason === undefined ? undefined : payload.staleReason,
      metadata: payload.metadata === undefined ? undefined : payload.metadata,
    },
    include: {
      latestExecution: true,
      latestResult: { include: { execution: true } },
    },
  });
}

async function ensureGenerationTask(job, actorUserId, state, forceRegenerate = false) {
  const existingTask = await prisma.backgroundTask.findFirst({
    where: {
      type: 'JOB_DESCRIPTION_GENERATION',
      entityType: 'Job',
      entityId: job.id,
      status: { in: ['PENDING', 'RUNNING', 'RETRY_SCHEDULED'] },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (existingTask) return existingTask;

  const idempotencyKey = forceRegenerate
    ? `job-description:${job.id}:${state.kind}:force:${state.generatedAt?.getTime?.() || 'none'}`
    : `job-description:${job.id}:${state.kind}:${state.sourceFingerprint}`;

  return enqueueBackgroundTask({
    organisationId: state.organisationId || job.organisationId || null,
    type: 'JOB_DESCRIPTION_GENERATION',
    entityType: 'Job',
    entityId: job.id,
    idempotencyKey,
    payload: {
      jobId: job.id,
      kind: state.kind,
      requestedByUserId: actorUserId,
      sourceFingerprint: state.sourceFingerprint,
    },
    maxAttempts: 3,
    createdByUserId: actorUserId,
  });
}

async function markStateForCurrentSource(context, existingState = null) {
  const baseState = await upsertJobDescriptionState(context.job, {
    organisationId: context.permissionContext.organisationId,
    kind: DEFAULT_KIND,
    status: existingState?.status || (context.aiEnabled ? 'PENDING' : 'DISABLED'),
    latestExecutionId: existingState?.latestExecutionId || null,
    latestResultId: existingState?.latestResultId || null,
    sourceFingerprint: context.sourceFingerprint,
    provider: context.aiEnabled ? env.intelligenceProvider : 'DISABLED',
    providerVersion: providerVersionFor(context.aiEnabled ? env.intelligenceProvider : 'DISABLED'),
    model: context.aiEnabled ? (env.awsBedrockModelId || env.intelligenceModel || null) : null,
    modelVersion: context.aiEnabled ? (env.awsBedrockModelId || env.intelligenceModel || null) : null,
    staleReason: existingState?.sourceFingerprint && existingState.sourceFingerprint !== context.sourceFingerprint
      ? 'SOURCE_CHANGED'
      : (existingState?.staleReason || null),
    metadata: {
      version: STATE_METADATA_VERSION,
      deterministicOnly: !context.aiEnabled,
    },
  });

  if (existingState?.sourceFingerprint && existingState.sourceFingerprint !== context.sourceFingerprint && ['READY', 'FAILED', 'DISABLED'].includes(baseState.status)) {
    return upsertJobDescriptionState(context.job, {
      organisationId: context.permissionContext.organisationId,
      kind: DEFAULT_KIND,
      status: 'STALE',
      latestExecutionId: baseState.latestExecutionId,
      latestResultId: baseState.latestResultId,
      sourceFingerprint: context.sourceFingerprint,
      provider: baseState.provider,
      providerVersion: baseState.providerVersion,
      model: baseState.model,
      modelVersion: baseState.modelVersion,
      staleReason: 'SOURCE_CHANGED',
      metadata: baseState.metadata || {},
    });
  }

  return baseState;
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
    inputPayload: { jobId: context.job.id, kind: DEFAULT_KIND, deterministicOnly: true },
    metadata: { sourceVersion: SOURCE_VERSION, schemaVersion: SCHEMA_VERSION },
  });

  const normalizedOutput = buildDeterministicJobDescription(context.job, context.requisition);

  await supersedeCachedResults({
    organisationId: context.permissionContext.organisationId,
    entityType: ENTITY_TYPE,
    entityId: context.job.id,
    resultVersion: RESULT_VERSION,
  });

  const stored = await storeIntelligenceResult({
    organisationId: context.permissionContext.organisationId,
    executionId: execution.id,
    entityType: ENTITY_TYPE,
    entityId: context.job.id,
    sourceFingerprint: context.sourceFingerprint,
    resultVersion: RESULT_VERSION,
    promptVersion: PROMPT_VERSION,
    normalizedOutput,
    explanation: normalizedOutput.summary,
    confidence: null,
    feature: FEATURE,
  });

  await completeIntelligenceExecution(execution.id, {
    status: 'SKIPPED',
    outputCharacterCount: JSON.stringify(normalizedOutput).length,
  });

  const state = await upsertJobDescriptionState(context.job, {
    organisationId: context.permissionContext.organisationId,
    kind: DEFAULT_KIND,
    status: 'DISABLED',
    latestExecutionId: execution.id,
    latestResultId: stored.id,
    sourceFingerprint: context.sourceFingerprint,
    provider: 'DISABLED',
    providerVersion: 'provider:disabled',
    model: null,
    modelVersion: null,
    latencyMs: 0,
    inputTokens: 0,
    outputTokens: 0,
    estimatedCost: 0,
    generatedAt: stored.createdAt,
    staleReason: null,
    metadata: { version: STATE_METADATA_VERSION, deterministicOnly: true },
  });

  return buildApiResponseFromStoredResult(context.job.id, state, { ...stored, execution }, { cacheHit: false, stale: false });
}

export function buildJobDescriptionSourceFingerprint(job, requisition = null) {
  return createFingerprint(buildMeaningfulSource(job, requisition));
}

export async function getJobDescription(actorUser, payload, requestMeta = {}) {
  const context = await getAccessibleJob(actorUser, payload.jobId, 'read');
  const existingState = await prisma.jobDescriptionState.findUnique({
    where: {
      organisationId_jobId_kind: {
        organisationId: context.permissionContext.organisationId,
        jobId: context.job.id,
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
    entityId: context.job.id,
    sourceFingerprint: context.sourceFingerprint,
    resultVersion: RESULT_VERSION,
    promptVersion: PROMPT_VERSION,
  });

  if (cached) {
    return buildApiResponseFromStoredResult(context.job.id, state, cached, {
      cacheHit: true,
      stale: false,
      statusOverride: cached.execution?.status === 'SKIPPED' ? 'DISABLED' : 'READY',
    });
  }

  const latest = await getLatestResultForJob(context.permissionContext.organisationId, context.job.id);
  if (!context.aiEnabled && (!latest || latest.sourceFingerprint !== context.sourceFingerprint)) {
    return storeDeterministicOnlyResult(context);
  }

  await ensureGenerationTask(context.job, actorUser.id, state, false).catch(() => null);

  const fallbackOutput = latest?.normalizedOutput || buildDeterministicJobDescription(context.job, context.requisition);
  const fallbackStatus = latest ? 'STALE' : (context.aiEnabled ? 'PENDING' : 'DISABLED');
  const nextState = await upsertJobDescriptionState(context.job, {
    organisationId: context.permissionContext.organisationId,
    kind: DEFAULT_KIND,
    status: fallbackStatus,
    latestExecutionId: state.latestExecutionId,
    latestResultId: latest?.id || state.latestResultId || null,
    sourceFingerprint: context.sourceFingerprint,
    provider: state.provider || (context.aiEnabled ? env.intelligenceProvider : 'DISABLED'),
    providerVersion: state.providerVersion,
    model: state.model,
    modelVersion: state.modelVersion,
    staleReason: latest ? 'SOURCE_CHANGED' : state.staleReason,
    metadata: state.metadata || {},
  });

  await recordAuditLog({
    organisationId: context.permissionContext.organisationId,
    actorUserId: actorUser.id,
    action: 'intelligence.job.read',
    entityType: 'Job',
    entityId: context.job.id,
    metadata: {
      kind: DEFAULT_KIND,
      cached: false,
      staleServed: Boolean(latest),
    },
    ipAddress: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
  }).catch(() => {});

  return buildApiResponseFromStoredResult(context.job.id, nextState, latest, {
    cacheHit: false,
    stale: Boolean(latest),
    statusOverride: latest ? 'STALE' : fallbackStatus,
    fallbackOutput,
  });
}

export async function getJobDescriptionStatus(actorUser, payload) {
  const context = await getAccessibleJob(actorUser, payload.jobId, 'read');
  const existingState = await prisma.jobDescriptionState.findUnique({
    where: {
      organisationId_jobId_kind: {
        organisationId: context.permissionContext.organisationId,
        jobId: context.job.id,
        kind: DEFAULT_KIND,
      },
    },
  });
  const state = await markStateForCurrentSource(context, existingState);
  const latest = await getLatestResultForJob(context.permissionContext.organisationId, context.job.id);

  return {
    jobId: context.job.id,
    kind: DEFAULT_KIND,
    status: latest && latest.sourceFingerprint !== context.sourceFingerprint ? 'STALE' : state.status,
    stale: Boolean(latest && latest.sourceFingerprint !== context.sourceFingerprint),
    generatedAt: iso(state.generatedAt),
    latestExecutionId: state.latestExecutionId,
    latestResultId: state.latestResultId,
    sourceVersion: SOURCE_VERSION,
    promptVersion: PROMPT_VERSION,
    resultVersion: RESULT_VERSION,
  };
}

export async function regenerateJobDescription(actorUser, payload, requestMeta = {}) {
  const context = await getAccessibleJob(actorUser, payload.jobId, 'generate');
  const state = await upsertJobDescriptionState(context.job, {
    organisationId: context.permissionContext.organisationId,
    kind: DEFAULT_KIND,
    status: context.aiEnabled ? 'PENDING' : 'DISABLED',
    sourceFingerprint: context.sourceFingerprint,
    provider: context.aiEnabled ? env.intelligenceProvider : 'DISABLED',
    providerVersion: providerVersionFor(context.aiEnabled ? env.intelligenceProvider : 'DISABLED'),
    model: context.aiEnabled ? (env.awsBedrockModelId || env.intelligenceModel || null) : null,
    modelVersion: context.aiEnabled ? (env.awsBedrockModelId || env.intelligenceModel || null) : null,
    staleReason: payload.forceRegenerate ? 'FORCED_REGENERATION' : 'REQUESTED_REGENERATION',
    metadata: { version: STATE_METADATA_VERSION, deterministicOnly: !context.aiEnabled },
  });

  const task = await ensureGenerationTask(context.job, actorUser.id, state, payload.forceRegenerate !== false);

  await recordAuditLog({
    organisationId: context.permissionContext.organisationId,
    actorUserId: actorUser.id,
    action: 'intelligence.job.regenerate',
    entityType: 'Job',
    entityId: context.job.id,
    metadata: {
      kind: DEFAULT_KIND,
      taskId: task?.id || null,
      aiEnabled: context.aiEnabled,
    },
    ipAddress: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
  }).catch(() => {});

  return {
    jobId: context.job.id,
    kind: DEFAULT_KIND,
    status: state.status,
    queued: Boolean(task),
    execution: buildExecutionSection(state, null, { cacheHit: false, stale: state.status === 'STALE' }),
  };
}

export async function runJobDescriptionGenerationTask(task) {
  const jobId = task.payload?.jobId || task.entityId;
  const requestedByUserId = task.payload?.requestedByUserId || task.createdByUserId || null;
  if (!jobId || !requestedByUserId) return 'cancelled';

  const actorUser = await prisma.user.findUnique({
    where: { id: requestedByUserId },
    include: { recruiterProfile: true, candidateProfile: true },
  });
  if (!actorUser) return 'cancelled';

  const context = await getAccessibleJob(actorUser, jobId, 'generate');
  await upsertJobDescriptionState(context.job, {
    organisationId: context.permissionContext.organisationId,
    kind: DEFAULT_KIND,
    status: context.aiEnabled ? 'PENDING' : 'DISABLED',
    sourceFingerprint: context.sourceFingerprint,
    provider: context.aiEnabled ? env.intelligenceProvider : 'DISABLED',
    providerVersion: providerVersionFor(context.aiEnabled ? env.intelligenceProvider : 'DISABLED'),
    model: context.aiEnabled ? (env.awsBedrockModelId || env.intelligenceModel || null) : null,
    modelVersion: context.aiEnabled ? (env.awsBedrockModelId || env.intelligenceModel || null) : null,
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
      jobId,
      kind: DEFAULT_KIND,
      sourceFingerprint: context.sourceFingerprint,
    },
    metadata: {
      sourceVersion: SOURCE_VERSION,
      schemaVersion: SCHEMA_VERSION,
    },
  });

  try {
    let normalizedOutput = buildDeterministicJobDescription(context.job, context.requisition);
    let promptTokens = 0;
    let completionTokens = 0;
    let latencyMs = 0;

    if (context.aiEnabled) {
      const runtime = await executeStructuredPrompt({
        promptKey: PROMPT_KEY,
        input: projectJobForIntelligence(context.job, context.requisition, context.job.description),
      });
      normalizedOutput = {
        jobId: context.job.id,
        kind: DEFAULT_KIND,
        ...runtime.output,
      };
      promptTokens = runtime.promptTokens || 0;
      completionTokens = runtime.completionTokens || 0;
      latencyMs = runtime.latencyMs || 0;
    }

    await supersedeCachedResults({
      organisationId: context.permissionContext.organisationId,
      entityType: ENTITY_TYPE,
      entityId: context.job.id,
      resultVersion: RESULT_VERSION,
    });

    const stored = await storeIntelligenceResult({
      organisationId: context.permissionContext.organisationId,
      executionId: execution.id,
      entityType: ENTITY_TYPE,
      entityId: context.job.id,
      sourceFingerprint: context.sourceFingerprint,
      resultVersion: RESULT_VERSION,
      promptVersion: PROMPT_VERSION,
      normalizedOutput,
      explanation: normalizedOutput.summary,
      confidence: null,
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

    await upsertJobDescriptionState(context.job, {
      organisationId: context.permissionContext.organisationId,
      kind: DEFAULT_KIND,
      status: context.aiEnabled ? 'READY' : 'DISABLED',
      latestExecutionId: execution.id,
      latestResultId: stored.id,
      sourceFingerprint: context.sourceFingerprint,
      provider: context.aiEnabled ? env.intelligenceProvider : 'DISABLED',
      providerVersion: providerVersionFor(context.aiEnabled ? env.intelligenceProvider : 'DISABLED'),
      model: context.aiEnabled ? (env.awsBedrockModelId || env.intelligenceModel || null) : null,
      modelVersion: context.aiEnabled ? (env.awsBedrockModelId || env.intelligenceModel || null) : null,
      latencyMs,
      inputTokens: promptTokens,
      outputTokens: completionTokens,
      estimatedCost: 0,
      generatedAt: stored.createdAt,
      staleReason: null,
      metadata: {
        version: STATE_METADATA_VERSION,
        deterministicOnly: !context.aiEnabled,
        schemaVersion: SCHEMA_VERSION,
      },
    });

    await recordAuditLog({
      organisationId: context.permissionContext.organisationId,
      actorUserId: requestedByUserId,
      action: 'intelligence.job.generate',
      entityType: ENTITY_TYPE,
      entityId: stored.id,
      metadata: {
        jobId,
        kind: DEFAULT_KIND,
        aiEnabled: context.aiEnabled,
        taskId: task.id,
      },
    }).catch(() => {});

    return 'success';
  } catch (error) {
    await recordIntelligenceFailure(execution.id, error).catch(() => {});
    await upsertJobDescriptionState(context.job, {
      organisationId: context.permissionContext.organisationId,
      kind: DEFAULT_KIND,
      status: context.aiEnabled ? 'FAILED' : 'DISABLED',
      latestExecutionId: execution.id,
      sourceFingerprint: context.sourceFingerprint,
      provider: context.aiEnabled ? env.intelligenceProvider : 'DISABLED',
      providerVersion: providerVersionFor(context.aiEnabled ? env.intelligenceProvider : 'DISABLED'),
      model: context.aiEnabled ? (env.awsBedrockModelId || env.intelligenceModel || null) : null,
      modelVersion: context.aiEnabled ? (env.awsBedrockModelId || env.intelligenceModel || null) : null,
      staleReason: error.code || 'JOB_DESCRIPTION_FAILED',
      metadata: { version: STATE_METADATA_VERSION, deterministicOnly: !context.aiEnabled },
    });
    throw error;
  }
}
