import { z } from 'zod';
import { getIntelligenceProvider, getIntelligenceProviderHealth } from '../src/intelligence/services/providerService.js';
import { normalizeStructuredOutput } from '../src/intelligence/services/intelligenceRuntimeService.js';
import { getSafeIntelligenceRuntimeConfiguration, getSafeResumeAiConfiguration } from '../src/intelligence/services/runtimeConfigurationService.js';

function printJson(event, payload) {
  console.log(JSON.stringify({
    level: 'info',
    event,
    ...payload,
  }, null, 2));
}

async function main() {
  const runtime = getSafeIntelligenceRuntimeConfiguration();
  const resume = getSafeResumeAiConfiguration();

  printJson('ai.health.runtime', {
    intelligence: runtime,
    resume,
  });

  const providerHealth = await getIntelligenceProviderHealth();
  printJson('ai.health.provider', providerHealth);

  if (!runtime.enabled) {
    process.exitCode = 1;
    return;
  }

  if (!providerHealth?.healthy) {
    process.exitCode = 1;
    return;
  }

  const provider = getIntelligenceProvider();
  const smokeSchema = z.object({
    ok: z.boolean(),
  }).strict();
  const smokeJsonSchema = {
    type: 'object',
    additionalProperties: false,
    required: ['ok'],
    properties: {
      ok: { type: 'boolean' },
    },
  };

  const smokeResult = await provider.generate({
    prompt: 'Return only valid JSON matching this exact object: {"ok":true}.',
    schema: smokeJsonSchema,
  });
  const smoke = smokeSchema.parse(normalizeStructuredOutput(smokeResult.text));

  printJson('ai.health.structured-smoke', {
    provider: provider.provider,
    model: smokeResult.model,
    promptTokens: smokeResult.promptTokens,
    completionTokens: smokeResult.completionTokens,
    latencyMs: smokeResult.latencyMs,
    outputKeys: Object.keys(smoke || {}),
  });
}

main().catch((error) => {
  console.error(JSON.stringify({
    level: 'error',
    event: 'ai.health.failed',
    code: error?.code || 'AI_HEALTH_CHECK_FAILED',
    message: error?.message || 'AI health check failed.',
  }, null, 2));
  process.exitCode = 1;
});
