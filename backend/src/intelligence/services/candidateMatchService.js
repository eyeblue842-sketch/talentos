import { prisma } from '../../config/db.js';
import { recordAuditLog } from '../../services/auditLogService.js';
import { calculateDeterministicCandidateMatch } from './deterministicMatchService.js';
import { requireIntelligenceFeature } from './featureAccessService.js';
import { createIntelligenceExecution, completeIntelligenceExecution, createFingerprint, getFreshCachedResult, recordIntelligenceFailure, storeIntelligenceResult, supersedeCachedResults } from './governanceService.js';
import { executeStructuredPrompt } from './intelligenceRuntimeService.js';
import { projectJobForIntelligence, projectResumeForIntelligence } from '../redaction/projectionService.js';
import { enforceIntelligenceUsageLimits } from './usageService.js';

function buildEntityId(candidateId, jobId) {
  return `${candidateId}:${jobId}`;
}

async function getCandidateAndJob(jobId, candidateId, organisationId) {
  const [candidate, job] = await Promise.all([
    prisma.candidateProfile.findUnique({ where: { id: candidateId } }),
    prisma.job.findFirst({ where: { id: jobId, organisationId } }),
  ]);

  if (!candidate) {
    const error = new Error('Candidate not found.');
    error.statusCode = 404;
    throw error;
  }
  if (!job) {
    const error = new Error('Job not found.');
    error.statusCode = 404;
    throw error;
  }

  return { candidate, job };
}

export async function getCandidateMatchIntelligence(actorUser, payload, requestMeta = {}) {
  const context = await requireIntelligenceFeature(actorUser, 'CANDIDATE_MATCH', null, 'read');
  const { candidate, job } = await getCandidateAndJob(payload.jobId, payload.candidateId, context.organisationId);
  const deterministic = calculateDeterministicCandidateMatch(candidate, job);
  const sourceFingerprint = createFingerprint({
    candidate: {
      updatedAt: candidate.updatedAt,
      skills: candidate.skills,
      totalExperience: candidate.totalExperience,
      location: candidate.location,
      headline: candidate.headline,
      currentTitle: candidate.currentTitle,
    },
    job: {
      updatedAt: job.updatedAt,
      title: job.title,
      location: job.location,
      skillsRequired: job.skillsRequired,
      skillsPreferred: job.skillsPreferred,
      experienceMin: job.experienceMin,
      experienceMax: job.experienceMax,
      employmentType: job.employmentType,
      workplaceType: job.workplaceType,
    },
    version: deterministic.scoreVersion,
  });

  const entityId = buildEntityId(candidate.id, job.id);
  if (!payload.forceRegenerate) {
    const cached = await getFreshCachedResult({
      organisationId: context.organisationId,
      entityType: 'CandidateMatch',
      entityId,
      sourceFingerprint,
      resultVersion: deterministic.scoreVersion,
      promptVersion: '1.0.0',
    });

    if (cached) {
      return {
        executionId: cached.executionId,
        fromCache: true,
        aiAvailable: cached.execution.provider !== 'DISABLED',
        machineGenerated: true,
        generatedAt: cached.createdAt,
        ...cached.normalizedOutput,
      };
    }
  }

  if (context.enabled) {
    await enforceIntelligenceUsageLimits({
      organisationId: context.organisationId,
      userId: actorUser.id,
      feature: 'CANDIDATE_MATCH',
    });
  }

  const execution = await createIntelligenceExecution({
    organisationId: context.organisationId,
    requestedByUserId: actorUser.id,
    feature: 'CANDIDATE_MATCH',
    promptKey: 'CANDIDATE_JOB_MATCH_EXPLANATION',
    promptVersion: '1.0.0',
    provider: context.enabled ? undefined : 'DISABLED',
    model: null,
    inputPayload: {
      candidateId: candidate.id,
      jobId: job.id,
      deterministic,
    },
    metadata: {
      deterministicOnly: !context.enabled,
    },
  });

  try {
    let aiExplanation = null;
    let usage = {};
    let provider = 'DISABLED';
    let model = null;

    if (context.enabled) {
      const runtime = await executeStructuredPrompt({
        promptKey: 'CANDIDATE_JOB_MATCH_EXPLANATION',
        input: {
          deterministic,
          candidate: projectResumeForIntelligence(candidate),
          job: projectJobForIntelligence(job),
        },
      });
      aiExplanation = runtime.output;
      usage = {
        promptTokens: runtime.promptTokens,
        completionTokens: runtime.completionTokens,
        latencyMs: runtime.latencyMs,
        outputCharacterCount: runtime.rawText.length,
      };
      provider = runtime.provider;
      model = runtime.model;
    }

    await supersedeCachedResults({
      organisationId: context.organisationId,
      entityType: 'CandidateMatch',
      entityId,
      resultVersion: deterministic.scoreVersion,
    });

    const normalizedOutput = {
      deterministic,
      aiExplanation,
      explanation: aiExplanation?.explanation || deterministic.explanation,
      generatedLabel: aiExplanation ? 'AI-generated suggestion. Review before use.' : 'Deterministic match baseline. AI explanation unavailable.',
      providerUnavailable: !context.enabled,
      calculationVersion: deterministic.scoreVersion,
    };

    const stored = await storeIntelligenceResult({
      organisationId: context.organisationId,
      executionId: execution.id,
      entityType: 'CandidateMatch',
      entityId,
      sourceFingerprint,
      resultVersion: deterministic.scoreVersion,
      promptVersion: '1.0.0',
      normalizedOutput,
      explanation: normalizedOutput.explanation,
      feature: 'CANDIDATE_MATCH',
    });

    await completeIntelligenceExecution(execution.id, {
      status: context.enabled ? 'SUCCEEDED' : 'SKIPPED',
      ...usage,
      outputCharacterCount: JSON.stringify(normalizedOutput).length,
      metadata: { provider, model, entityId },
    });

    await recordAuditLog({
      organisationId: context.organisationId,
      actorUserId: actorUser.id,
      action: 'intelligence.match.view',
      entityType: 'CandidateMatch',
      entityId,
      afterData: {
        score: deterministic.overallScore,
        calculationVersion: deterministic.scoreVersion,
        providerEnabled: context.enabled,
      },
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });

    return {
      executionId: execution.id,
      resultId: stored.id,
      fromCache: false,
      aiAvailable: context.enabled,
      machineGenerated: Boolean(aiExplanation),
      generatedAt: stored.createdAt,
      ...normalizedOutput,
    };
  } catch (error) {
    await recordIntelligenceFailure(execution.id, error);
    throw error;
  }
}

export async function getBatchCandidateMatchIntelligence(actorUser, payload, requestMeta = {}) {
  const items = [];
  for (const candidateId of payload.candidateIds) {
    try {
      const item = await getCandidateMatchIntelligence(actorUser, {
        candidateId,
        jobId: payload.jobId,
        forceRegenerate: payload.forceRegenerate,
      }, requestMeta);
      items.push({ candidateId, success: true, data: item });
    } catch (error) {
      items.push({ candidateId, success: false, error: error.message });
    }
  }

  return { items };
}
