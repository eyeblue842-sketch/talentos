import { env } from '../../config/env.js';
import { getDefaultIntelligenceBaseUrl } from '../providers/providerDefaults.js';

export function supportsOpenAiCompatibleTransport(provider = env.intelligenceProvider) {
  return Boolean(getDefaultIntelligenceBaseUrl(provider))
    || ['AZURE_OPENAI', 'CUSTOM_OPENAI_COMPATIBLE'].includes(String(provider || '').toUpperCase());
}

export function resolveIntelligenceBaseUrl(provider = env.intelligenceProvider, configuredBaseUrl = env.intelligenceBaseUrl) {
  return configuredBaseUrl || getDefaultIntelligenceBaseUrl(provider);
}

export function getSafeIntelligenceRuntimeConfiguration() {
  const provider = String(env.intelligenceProvider || 'DISABLED').toUpperCase();
  const baseUrl = resolveIntelligenceBaseUrl(provider, env.intelligenceBaseUrl);

  return {
    enabled: env.intelligenceEnabled && provider !== 'DISABLED',
    provider,
    model: env.intelligenceModel || env.awsBedrockModelId || null,
    baseUrl,
    transport: provider === 'BEDROCK'
      ? 'bedrock-runtime'
      : provider === 'MOCK'
        ? 'mock'
        : provider === 'DISABLED'
          ? 'disabled'
          : supportsOpenAiCompatibleTransport(provider)
            ? 'openai-compatible'
            : 'unsupported',
    timeoutMs: env.intelligenceTimeoutMs,
    maxRetries: env.intelligenceMaxRetries,
    maxInputChars: env.intelligenceMaxInputChars,
    maxOutputTokens: env.intelligenceMaxOutputTokens,
    apiKeyConfigured: Boolean(env.intelligenceApiKey),
  };
}

export function getSafeResumeAiConfiguration() {
  const provider = String(env.intelligenceProvider || 'DISABLED').toUpperCase();
  const intelligenceDriven = env.intelligenceEnabled && provider !== 'DISABLED';

  return {
    enabled: intelligenceDriven || (env.aiResumeParsingEnabled && env.aiProvider !== 'disabled'),
    mode: intelligenceDriven ? 'intelligence' : (env.aiResumeParsingEnabled ? 'legacy' : 'disabled'),
    provider: intelligenceDriven ? provider : String(env.aiProvider || 'disabled').toUpperCase(),
    model: intelligenceDriven ? (env.intelligenceModel || env.awsBedrockModelId || null) : (env.awsBedrockModelId || null),
    parserVersion: '3.0.0',
    deterministicFallback: true,
  };
}
