import { env } from '../../config/env.js';
import { createBedrockProvider } from '../providers/bedrockProvider.js';
import { disabledProvider } from '../providers/disabledProvider.js';
import { mockProvider } from '../providers/mockProvider.js';
import { createOpenAiCompatibleProvider } from '../providers/openaiCompatibleProvider.js';
import { supportsOpenAiCompatibleTransport } from './runtimeConfigurationService.js';

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

  if (!supportsOpenAiCompatibleTransport(env.intelligenceProvider)) {
    const error = new Error(`INTELLIGENCE_PROVIDER=${env.intelligenceProvider} is configured but no compatible local transport is implemented.`);
    error.code = 'INTELLIGENCE_PROVIDER_UNSUPPORTED';
    error.statusCode = 422;
    throw error;
  }

  providerInstance = createOpenAiCompatibleProvider();
  return providerInstance;
}

export async function getIntelligenceProviderHealth() {
  try {
    return await getIntelligenceProvider().healthCheck();
  } catch (error) {
    return {
      provider: env.intelligenceProvider,
      healthy: false,
      reason: error?.message || 'Unable to initialize intelligence provider.',
      code: error?.code || 'INTELLIGENCE_PROVIDER_HEALTH_FAILED',
    };
  }
}
