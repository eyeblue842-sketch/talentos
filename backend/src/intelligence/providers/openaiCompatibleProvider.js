import { env } from '../../config/env.js';
import { normalizeProviderError, validateProviderBaseUrl } from './providerUtils.js';

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      const error = new Error(`Intelligence provider timed out after ${timeoutMs}ms.`);
      error.code = 'INTELLIGENCE_TIMEOUT';
      error.statusCode = 504;
      setTimeout(() => reject(error), timeoutMs);
    }),
  ]);
}

export function createOpenAiCompatibleProvider() {
  const baseUrl = validateProviderBaseUrl(env.intelligenceBaseUrl);
  const providerName = env.intelligenceProvider;

  async function callProvider(payload) {
    const url = new URL('/chat/completions', baseUrl);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(env.intelligenceApiKey ? { Authorization: `Bearer ${env.intelligenceApiKey}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    const json = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(json?.error?.message || json?.message || 'Intelligence provider request failed.');
      error.code = json?.error?.code || 'INTELLIGENCE_PROVIDER_HTTP_ERROR';
      error.statusCode = response.status;
      throw error;
    }

    return json;
  }

  return {
    provider: providerName,
    async healthCheck() {
      try {
        await withTimeout(callProvider({
          model: env.intelligenceModel,
          messages: [{ role: 'user', content: 'Respond with the single word OK.' }],
          temperature: 0,
          max_tokens: 5,
        }), Math.min(env.intelligenceTimeoutMs, 8000));
        return { provider: providerName, healthy: true };
      } catch (error) {
        return {
          provider: providerName,
          healthy: false,
          reason: normalizeProviderError(error, providerName).message,
        };
      }
    },
    async generate({ prompt, schema, settings = {} }) {
      const maxRetries = env.intelligenceMaxRetries;
      let attempts = 0;
      let lastError = null;

      while (attempts <= maxRetries) {
        attempts += 1;
        try {
          const startedAt = Date.now();
          const result = await withTimeout(callProvider({
            model: settings.model || env.intelligenceModel,
            temperature: settings.temperature ?? 0.2,
            max_tokens: settings.maxOutputTokens || env.intelligenceMaxOutputTokens,
            response_format: { type: 'json_object' },
            messages: [
              {
                role: 'system',
                content: 'You are a recruitment intelligence assistant. Return only valid JSON that matches the requested schema. Never infer protected attributes or make autonomous decisions.',
              },
              {
                role: 'user',
                content: `${prompt}\n\nReturn strictly valid JSON matching this schema description:\n${JSON.stringify(schema, null, 2)}`,
              },
            ],
          }), env.intelligenceTimeoutMs);

          const rawText = result?.choices?.[0]?.message?.content || '{}';
          return {
            text: rawText,
            model: result?.model || env.intelligenceModel,
            promptTokens: result?.usage?.prompt_tokens || null,
            completionTokens: result?.usage?.completion_tokens || null,
            latencyMs: Date.now() - startedAt,
          };
        } catch (error) {
          lastError = normalizeProviderError(error, providerName);
          if (attempts > maxRetries) {
            throw lastError;
          }
        }
      }

      throw lastError || normalizeProviderError(new Error('Unknown intelligence provider failure.'), providerName);
    },
  };
}
