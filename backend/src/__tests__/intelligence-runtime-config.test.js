import test from 'node:test';
import assert from 'node:assert/strict';

import { parseEnv, env } from '../config/env.js';
import { getDefaultIntelligenceBaseUrl } from '../intelligence/providers/providerDefaults.js';
import { getSafeIntelligenceRuntimeConfiguration, supportsOpenAiCompatibleTransport } from '../intelligence/services/runtimeConfigurationService.js';
import { getIntelligenceProviderHealth, resetIntelligenceProvider } from '../intelligence/services/providerService.js';

function buildBaseRawEnv() {
  return {
    NODE_ENV: 'test',
    PORT: '5000',
    FRONTEND_URL: 'http://localhost:3000',
    DATABASE_URL: 'postgresql://careeriz:careeriz@localhost:5432/careeriz?schema=public',
    JWT_SECRET: '12345678901234567890123456789012',
    STORAGE_PROVIDER: 'local',
    QUEUE_PROVIDER: 'database',
    INTELLIGENCE_ENABLED: 'true',
    INTELLIGENCE_PROVIDER: 'OPENAI',
    INTELLIGENCE_MODEL: 'gpt-test',
    INTELLIGENCE_API_KEY: 'test-key',
  };
}

test('parseEnv accepts OPENAI without an explicit INTELLIGENCE_BASE_URL', () => {
  const result = parseEnv(buildBaseRawEnv());
  assert.equal(result.success, true);
});

test('provider defaults expose safe local compatibility endpoints', () => {
  assert.equal(getDefaultIntelligenceBaseUrl('OPENAI'), 'https://api.openai.com/v1');
  assert.equal(getDefaultIntelligenceBaseUrl('GEMINI'), 'https://generativelanguage.googleapis.com/v1beta/openai');
  assert.equal(getDefaultIntelligenceBaseUrl('OLLAMA'), 'http://127.0.0.1:11434/v1');
  assert.equal(getDefaultIntelligenceBaseUrl('ANTHROPIC'), null);
});

test('runtime configuration marks unsupported transports clearly', () => {
  const originalProvider = env.intelligenceProvider;
  const originalBaseUrl = env.intelligenceBaseUrl;
  const originalEnabled = env.intelligenceEnabled;

  env.intelligenceEnabled = true;
  env.intelligenceProvider = 'ANTHROPIC';
  env.intelligenceBaseUrl = null;

  const runtime = getSafeIntelligenceRuntimeConfiguration();
  assert.equal(runtime.transport, 'unsupported');
  assert.equal(supportsOpenAiCompatibleTransport('ANTHROPIC'), false);

  env.intelligenceProvider = originalProvider;
  env.intelligenceBaseUrl = originalBaseUrl;
  env.intelligenceEnabled = originalEnabled;
});

test('provider health reports unsupported configured providers safely', async () => {
  const originalProvider = env.intelligenceProvider;
  const originalBaseUrl = env.intelligenceBaseUrl;
  const originalEnabled = env.intelligenceEnabled;

  env.intelligenceEnabled = true;
  env.intelligenceProvider = 'ANTHROPIC';
  env.intelligenceBaseUrl = null;
  resetIntelligenceProvider();

  const health = await getIntelligenceProviderHealth();
  assert.equal(health.healthy, false);
  assert.equal(health.code, 'INTELLIGENCE_PROVIDER_UNSUPPORTED');

  env.intelligenceProvider = originalProvider;
  env.intelligenceBaseUrl = originalBaseUrl;
  env.intelligenceEnabled = originalEnabled;
  resetIntelligenceProvider();
});
