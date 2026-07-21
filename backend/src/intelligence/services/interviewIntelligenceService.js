import { prisma } from '../../config/db.js';
import { requireIntelligenceFeature } from './featureAccessService.js';
import { createIntelligenceExecution, completeIntelligenceExecution, createFingerprint, getFreshCachedResult, recordIntelligenceFailure, storeIntelligenceResult, supersedeCachedResults } from './governanceService.js';
import { executeStructuredPrompt } from './intelligenceRuntimeService.js';
import { projectInterviewContext } from '../redaction/projectionService.js';
import { enforceIntelligenceUsageLimits } from './usageService.js';

function buildInterviewWarning() {
  return 'AI-generated suggestion. Review before use. Interviewers must comply with local employment law and company policy.';
}

export async function getInterviewIntelligence(actorUser, payload) {
  const context = await requireIntelligenceFeature(actorUser, 'INTERVIEW_ASSISTANT', null, 'generate');
  const application = await prisma.application.findFirst({
    where: {
      id: payload.applicationId,
      organisationId: context.organisationId,
    },
    include: {
      candidate: true,
      job: true,
      interviewProcesses: {
        include: {
          rounds: {
            include: {
              feedbacks: true,
            },
          },
        },
      },
    },
  });

  if (!application) {
    const error = new Error('Application not found.');
    error.statusCode = 404;
    throw error;
  }

  const round = payload.roundId
    ? application.interviewProcesses.flatMap((process) => process.rounds || []).find((item) => item.id === payload.roundId) || null
    : application.interviewProcesses.flatMap((process) => process.rounds || [])[0] || null;

  const promptKeyMap = {
    QUESTION_SET: 'INTERVIEW_QUESTION_SET',
    RUBRIC: 'INTERVIEW_EVALUATION_RUBRIC',
    BRIEFING: 'INTERVIEW_QUESTION_SET',
    NOTES_SUMMARY: 'INTERVIEW_NOTES_SUMMARY',
  };

  const sourceFingerprint = createFingerprint({
    applicationUpdatedAt: application.updatedAt,
    roundUpdatedAt: round?.updatedAt || null,
    mode: payload.mode,
    notes: payload.notes || null,
  });
  const entityId = `${application.id}:${payload.mode}:${round?.id || 'no-round'}`;

  if (!payload.forceRegenerate) {
    const cached = await getFreshCachedResult({
      organisationId: context.organisationId,
      entityType: 'InterviewIntelligence',
      entityId,
      sourceFingerprint,
      resultVersion: `interview-intelligence-${payload.mode}-v1`,
      promptVersion: '1.0.0',
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

  if (context.enabled) {
    await enforceIntelligenceUsageLimits({
      organisationId: context.organisationId,
      userId: actorUser.id,
      feature: 'INTERVIEW_ASSISTANT',
    });
  }

  const execution = await createIntelligenceExecution({
    organisationId: context.organisationId,
    requestedByUserId: actorUser.id,
    feature: 'INTERVIEW_ASSISTANT',
    promptKey: promptKeyMap[payload.mode],
    promptVersion: '1.0.0',
    provider: context.enabled ? undefined : 'DISABLED',
    inputPayload: { applicationId: application.id, roundId: round?.id || null, mode: payload.mode },
  });

  try {
    let assisted = null;
    let usage = {};
    if (context.enabled) {
      const runtime = await executeStructuredPrompt({
        promptKey: promptKeyMap[payload.mode],
        input: projectInterviewContext(application, round, payload.notes),
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
      entityType: 'InterviewIntelligence',
      entityId,
      resultVersion: `interview-intelligence-${payload.mode}-v1`,
    });

    const normalizedOutput = {
      assisted,
      generatedLabel: context.enabled ? buildInterviewWarning() : 'Intelligence provider unavailable. Review interview evidence manually.',
      mode: payload.mode,
      roundId: round?.id || null,
      warnings: assisted?.warnings || [buildInterviewWarning()],
    };

    const stored = await storeIntelligenceResult({
      organisationId: context.organisationId,
      executionId: execution.id,
      entityType: 'InterviewIntelligence',
      entityId,
      sourceFingerprint,
      resultVersion: `interview-intelligence-${payload.mode}-v1`,
      promptVersion: '1.0.0',
      normalizedOutput,
      explanation: assisted?.summary || assisted?.questions?.[0]?.question || null,
      feature: 'INTERVIEW_ASSISTANT',
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
