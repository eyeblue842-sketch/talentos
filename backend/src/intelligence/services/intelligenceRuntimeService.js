import { stripUnsafeMarkup } from '../providers/providerUtils.js';
import { getIntelligenceProvider } from './providerService.js';
import { getPromptDefinition } from '../prompts/promptRegistry.js';

export function normalizeStructuredOutput(text) {
  const trimmed = String(text || '').trim();
  const fenced = trimmed.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(fenced);
  } catch (error) {
    const normalized = new Error('Intelligence provider returned malformed JSON.');
    normalized.code = 'INTELLIGENCE_MALFORMED_JSON';
    normalized.statusCode = 502;
    normalized.cause = error;
    throw normalized;
  }
}

export async function executeStructuredPrompt({ promptKey, input, providerSettings }) {
  const provider = getIntelligenceProvider();
  const prompt = getPromptDefinition(promptKey);
  const result = await provider.generate({
    prompt: prompt.buildPrompt(input),
    schema: prompt.jsonSchema || (prompt.outputSchema.toJSON ? prompt.outputSchema.toJSON() : { type: 'object' }),
    settings: {
      ...prompt.defaultProviderSettings,
      ...(providerSettings || {}),
    },
  });

  const rawOutput = normalizeStructuredOutput(stripUnsafeMarkup(result.text));
  const normalized = prompt.normalizeOutput
    ? prompt.normalizeOutput(rawOutput)
    : { output: prompt.outputSchema.parse(rawOutput), diagnostics: [] };

  return {
    provider: provider.provider,
    prompt,
    model: result.model,
    output: normalized.output,
    diagnostics: normalized.diagnostics || [],
    promptTokens: result.promptTokens,
    completionTokens: result.completionTokens,
    latencyMs: result.latencyMs,
    rawText: result.text,
  };
}
