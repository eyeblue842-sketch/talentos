import { env } from '../../config/env.js';
import { createBedrockProvider } from '../providers/bedrockProvider.js';
import { disabledProvider } from '../providers/disabledProvider.js';
import { mockProvider } from '../providers/mockProvider.js';
import { createOpenAiCompatibleProvider } from '../providers/openaiCompatibleProvider.js';

let providerInstance;

export function resetIntelligenceProvider() {
  providerInstance = undefined;
}

export function getIntelligenceProvider() {
  if (providerInstance) return providerInstance;

  if (!env.intelligenceEnabled || env.intelligenceProvider === 'DISABLED') {
    providerInstance = disabledProvider;
    return providerInstance;
  }

  if (env.intelligenceProvider === 'MOCK') {
    providerInstance = mockProvider;
    return providerInstance;
  }

  if (env.intelligenceProvider === 'BEDROCK') {
    providerInstance = createBedrockProvider();
    return providerInstance;
  }

  providerInstance = createOpenAiCompatibleProvider();
  return providerInstance;
}

export async function getIntelligenceProviderHealth() {
  return getIntelligenceProvider().healthCheck();
}
