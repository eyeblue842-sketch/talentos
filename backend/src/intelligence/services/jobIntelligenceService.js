import { prisma } from '../../config/db.js';
import { requireIntelligenceFeature } from './featureAccessService.js';
import { createIntelligenceExecution, completeIntelligenceExecution, createFingerprint, getFreshCachedResult, recordIntelligenceFailure, storeIntelligenceResult, supersedeCachedResults } from './governanceService.js';
import { executeStructuredPrompt } from './intelligenceRuntimeService.js';
import { projectJobForIntelligence } from '../redaction/projectionService.js';
import { enforceIntelligenceUsageLimits } from './usageService.js';

const exclusionaryPatterns = [
  /young\b/i,
  /aggressive\b/i,
  /rockstar\b/i,
  /ninja\b/i,
  /dominant\b/i,
  /digital native\b/i,
];

function buildDeterministicJobBaseline(jobLike, mode, sourceDescription = '') {
  const description = String(sourceDescription || jobLike?.description || '');
  return {
    summary: description.slice(0, 900) || 'No source description provided yet.',
    responsibilities: [],
    requiredSkills: Array.isArray(jobLike?.skillsRequired) ? jobLike.skillsRequired.slice(0, 20) : [],
    preferredSkills: Array.isArray(jobLike?.skillsPreferred) ? jobLike.skillsPreferred.slice(0, 20) : [],
    screeningQuestions: [],
    assumptions: [
      !jobLike?.location ? 'Location is missing and must be confirmed manually.' : null,
      !jobLike?.employmentType ? 'Employment type is missing and must be confirmed manually.' : null,
    ].filter(Boolean),
    exclusionaryWordingWarnings: exclusionaryPatterns.filter((pattern) => pattern.test(description)).map((pattern) => `Potentially exclusionary wording detected: ${pattern.source.replace(/\\b|\(\?:|\)|\//g, '')}`),
    missingFields: [
      !jobLike?.title ? 'Title missing' : null,
      !jobLike?.location ? 'Location missing' : null,
      !jobLike?.experienceMin && jobLike?.experienceMin !== 0 ? 'Minimum experience missing' : null,
      !jobLike?.skillsRequired?.length ? 'Required skills missing' : null,
    ].filter(Boolean),
    interviewFocus: Array.isArray(jobLike?.skillsRequired) ? jobLike.skillsRequired.slice(0, 8).map((skill) => `Validate ${skill} with practical evidence.`) : [],
  };
}

export async function getJobIntelligence(actorUser, payload) {
  const context = await requireIntelligenceFeature(actorUser, 'JOB_DESCRIPTION', null, 'generate');
  const [job, requisition] = await Promise.all([
    payload.jobId ? prisma.job.findFirst({ where: { id: payload.jobId, organisationId: context.organisationId } }) : null,
    payload.requisitionId ? prisma.jobRequisition.findFirst({ where: { id: payload.requisitionId, organisationId: context.organisationId } }) : null,
  ]);

  const baselineInput = job || requisition || {};
  const deterministic = buildDeterministicJobBaseline(baselineInput, payload.mode, payload.sourceDescription);
  const sourceFingerprint = createFingerprint({
    mode: payload.mode,
    jobUpdatedAt: job?.updatedAt || null,
    requisitionUpdatedAt: requisition?.updatedAt || null,
    sourceDescription: payload.sourceDescription || null,
  });
  const entityId = payload.jobId || payload.requisitionId || 'adhoc-job-intelligence';

  if (!payload.forceRegenerate) {
    const cached = await getFreshCachedResult({
      organisationId: context.organisationId,
      entityType: 'JobIntelligence',
      entityId,
      sourceFingerprint,
      resultVersion: `job-intelligence-${payload.mode}-v1`,
      promptVersion: payload.mode === 'IMPROVE_DESCRIPTION' ? '1.0.0' : '1.0.0',
    });
    if (cached) {
      return {
        executionId: cached.executionId,
        fromCache: true,
        generatedAt: cached.createdAt,
        ...cached.normalizedOutput,
      };
    }
  }

  const promptKey = payload.mode === 'IMPROVE_DESCRIPTION' ? 'JOB_DESCRIPTION_IMPROVEMENT' : 'JOB_DESCRIPTION_DRAFT';
  if (context.enabled) {
    await enforceIntelligenceUsageLimits({
      organisationId: context.organisationId,
      userId: actorUser.id,
      feature: 'JOB_DESCRIPTION',
    });
  }

  const execution = await createIntelligenceExecution({
    organisationId: context.organisationId,
    requestedByUserId: actorUser.id,
    feature: 'JOB_DESCRIPTION',
    promptKey,
    promptVersion: '1.0.0',
    provider: context.enabled ? undefined : 'DISABLED',
    inputPayload: { mode: payload.mode, jobId: payload.jobId || null, requisitionId: payload.requisitionId || null },
  });

  try {
    let assisted = null;
    let usage = {};
    if (context.enabled) {
      const runtime = await executeStructuredPrompt({
        promptKey,
        input: projectJobForIntelligence(job, requisition, payload.sourceDescription),
      });
      assisted = runtime.output;
      usage = {
        promptTokens: runtime.promptTokens,
        completionTokens: runtime.completionTokens,
        latencyMs: runtime.latencyMs,
        outputCharacterCount: runtime.rawText.length,
      };
    }

    await supersedeCachedResults({
      organisationId: context.organisationId,
      entityType: 'JobIntelligence',
      entityId,
      resultVersion: `job-intelligence-${payload.mode}-v1`,
    });

    const normalizedOutput = {
      deterministic,
      assisted,
      mode: payload.mode,
      generatedLabel: assisted ? 'AI-generated suggestion. Review before use.' : 'Provider unavailable. Review deterministic warnings and complete the form manually.',
      assumptions: assisted?.assumptions || deterministic.assumptions,
      missingFields: assisted?.missingFields || deterministic.missingFields,
    };

    const stored = await storeIntelligenceResult({
      organisationId: context.organisationId,
      executionId: execution.id,
      entityType: 'JobIntelligence',
      entityId,
      sourceFingerprint,
      resultVersion: `job-intelligence-${payload.mode}-v1`,
      promptVersion: '1.0.0',
      normalizedOutput,
      explanation: assisted?.summary || deterministic.summary,
      feature: 'JOB_DESCRIPTION',
    });

    await completeIntelligenceExecution(execution.id, {
      status: context.enabled ? 'SUCCEEDED' : 'SKIPPED',
      ...usage,
      outputCharacterCount: JSON.stringify(normalizedOutput).length,
    });

    return {
      executionId: execution.id,
      resultId: stored.id,
      fromCache: false,
      generatedAt: stored.createdAt,
      ...normalizedOutput,
    };
  } catch (error) {
    await recordIntelligenceFailure(execution.id, error);
    throw error;
  }
}
