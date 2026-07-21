import { stripUnsafeMarkup } from '../providers/providerUtils.js';
import { getIntelligenceProvider } from './providerService.js';
import { getPromptDefinition } from '../prompts/promptRegistry.js';

export function normalizeStructuredOutput(text) {
  const trimmed = String(text || '').trim();
  const fenced = trimmed.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
  return JSON.parse(fenced);
}

export async function executeStructuredPrompt({ promptKey, input, providerSettings }) {
  const provider = getIntelligenceProvider();
  const prompt = getPromptDefinition(promptKey);
  const result = await provider.generate({
    prompt: prompt.buildPrompt(input),
    schema: prompt.outputSchema.toJSON ? prompt.outputSchema.toJSON() : { type: 'object' },
    settings: {
      ...prompt.defaultProviderSettings,
      ...(providerSettings || {}),
    },
  });

  const parsed = prompt.outputSchema.parse(normalizeStructuredOutput(stripUnsafeMarkup(result.text)));

  return {
    provider: provider.provider,
    prompt,
    model: result.model,
    output: parsed,
    promptTokens: result.promptTokens,
    completionTokens: result.completionTokens,
    latencyMs: result.latencyMs,
    rawText: result.text,
  };
}
