import { requireIntelligenceFeature } from './featureAccessService.js';
import { createIntelligenceExecution, completeIntelligenceExecution, createFingerprint, getFreshCachedResult, recordIntelligenceFailure, storeIntelligenceResult, supersedeCachedResults } from './governanceService.js';
import { executeStructuredPrompt } from './intelligenceRuntimeService.js';
import { projectAnalyticsForIntelligence } from '../redaction/projectionService.js';
import { enforceIntelligenceUsageLimits } from './usageService.js';
import { getOrganisationAnalyticsMetrics } from './analyticsMetricsService.js';

export async function getAnalyticsInsight(actorUser, payload) {
  const context = await requireIntelligenceFeature(actorUser, 'ANALYTICS_INSIGHT', null, 'generate');
  const metricsPayload = await getOrganisationAnalyticsMetrics(context.organisationId, payload);
  const sourceFingerprint = createFingerprint(metricsPayload);
  const entityId = `${context.organisationId}:${payload.periodDays || 30}:${payload.recruiterId || 'all'}:${payload.department || 'all'}:${payload.location || 'all'}`;

  if (!payload.forceRegenerate) {
    const cached = await getFreshCachedResult({
      organisationId: context.organisationId,
      entityType: 'AnalyticsInsight',
      entityId,
      sourceFingerprint,
      resultVersion: metricsPayload.version,
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
      feature: 'ANALYTICS_INSIGHT',
    });
  }

  const execution = await createIntelligenceExecution({
    organisationId: context.organisationId,
    requestedByUserId: actorUser.id,
    feature: 'ANALYTICS_INSIGHT',
    promptKey: 'ANALYTICS_INSIGHT',
    promptVersion: '1.0.0',
    provider: context.enabled ? undefined : 'DISABLED',
    inputPayload: metricsPayload,
  });

  try {
    let insight = null;
    let usage = {};
    if (context.enabled) {
      const runtime = await executeStructuredPrompt({
        promptKey: 'ANALYTICS_INSIGHT',
        input: projectAnalyticsForIntelligence(metricsPayload),
      });
      insight = runtime.output;
      usage = {
        promptTokens: runtime.promptTokens,
        completionTokens: runtime.completionTokens,
        latencyMs: runtime.latencyMs,
        outputCharacterCount: runtime.rawText.length,
      };
    }

    const normalizedOutput = {
      metrics: metricsPayload,
      insight,
      generatedLabel: insight ? 'AI-generated suggestion. Review before use.' : 'Deterministic analytics only. AI narrative unavailable.',
      insufficientData: insight?.insufficientData || metricsPayload.sampleSize.applications < 5,
    };

    await supersedeCachedResults({
      organisationId: context.organisationId,
      entityType: 'AnalyticsInsight',
      entityId,
      resultVersion: metricsPayload.version,
    });

    const stored = await storeIntelligenceResult({
      organisationId: context.organisationId,
      executionId: execution.id,
      entityType: 'AnalyticsInsight',
      entityId,
      sourceFingerprint,
      resultVersion: metricsPayload.version,
      promptVersion: '1.0.0',
      normalizedOutput,
      explanation: insight?.summary || null,
      feature: 'ANALYTICS_INSIGHT',
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
