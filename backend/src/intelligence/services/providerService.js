import { env } from '../../config/env.js';
import { disabledProvider } from '../providers/disabledProvider.js';
import { createOpenAiCompatibleProvider } from '../providers/openaiCompatibleProvider.js';

let providerInstance;

export function getIntelligenceProvider() {
  if (providerInstance) return providerInstance;

  if (!env.intelligenceEnabled || env.intelligenceProvider === 'DISABLED') {
    providerInstance = disabledProvider;
    return providerInstance;
  }

  providerInstance = createOpenAiCompatibleProvider();
  return providerInstance;
}

export async function getIntelligenceProviderHealth() {
  return getIntelligenceProvider().healthCheck();
}
