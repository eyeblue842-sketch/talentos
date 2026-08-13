import { env } from '../../config/env.js';
import {
  buildProviderUrl,
  classifyProviderFailure,
  getValidatedProviderBaseUrl,
  normalizeProviderError,
  sanitizeProviderMessage,
} from './providerUtils.js';

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

function isNativeOpenAiGpt5Model(providerName, model) {
  return String(providerName || '').toUpperCase() === 'OPENAI'
    && /^gpt-5(?:$|[-.])/i.test(String(model || '').trim());
}

function buildTokenLimitPayload(providerName, model, maxOutputTokens) {
  if (!Number.isFinite(maxOutputTokens) || maxOutputTokens <= 0) {
    return {};
  }

  if (isNativeOpenAiGpt5Model(providerName, model)) {
    return { max_completion_tokens: maxOutputTokens };
  }

  return { max_tokens: maxOutputTokens };
}

function buildSamplingPayload(providerName, model, temperature) {
  if (temperature === undefined || temperature === null) {
    return {};
  }

  if (isNativeOpenAiGpt5Model(providerName, model)) {
    return {};
  }

  return { temperature };
}

// Native gpt-5 reasoning models spend part of max_completion_tokens on
// invisible reasoning before emitting any visible content — for a
// structured-extraction task (not open-ended reasoning), an unconstrained
// default reasoning effort can consume the entire token budget and leave
// zero tokens for the actual JSON output (finish_reason: "length", empty
// content). Extraction/classification tasks don't need deep reasoning, so
// pin the lowest effort tier for native gpt-5 models specifically.
function buildReasoningPayload(providerName, model) {
  if (isNativeOpenAiGpt5Model(providerName, model)) {
    return { reasoning_effort: 'minimal' };
  }

  return {};
}

export function createOpenAiCompatibleProvider() {
  const baseUrl = getValidatedProviderBaseUrl(env.intelligenceProvider, env.intelligenceBaseUrl);
  const providerName = env.intelligenceProvider;
  const endpointPath = '/chat/completions';

  async function callProvider(payload) {
    const startedAt = Date.now();
    const url = buildProviderUrl(baseUrl, endpointPath);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(env.intelligenceApiKey ? { Authorization: `Bearer ${env.intelligenceApiKey}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    const rawText = await response.text();
    let json = null;
    try {
      json = rawText ? JSON.parse(rawText) : null;
    } catch {
      json = null;
    }
    if (!response.ok) {
      const error = new Error(sanitizeProviderMessage(json?.error?.message || json?.message || rawText || 'Intelligence provider request failed.'));
      error.code = json?.error?.code || 'INTELLIGENCE_PROVIDER_HTTP_ERROR';
      error.statusCode = response.status;
      error.errorType = json?.error?.type || null;
      error.endpoint = url.pathname;
      error.model = payload?.model || env.intelligenceModel || null;
      error.durationMs = Date.now() - startedAt;
      throw error;
    }

    return json;
  }

  return {
    provider: providerName,
    async healthCheck() {
      const endpoint = buildProviderUrl(baseUrl, endpointPath).pathname;
      try {
        const model = env.intelligenceModel;
        await withTimeout(callProvider({
          model,
          messages: [{ role: 'user', content: 'Respond with the single word OK.' }],
          ...buildSamplingPayload(providerName, model, 0),
          ...buildReasoningPayload(providerName, model),
          ...buildTokenLimitPayload(providerName, model, 5),
        }), Math.min(env.intelligenceTimeoutMs, 8000));
        return {
          provider: providerName,
          healthy: true,
          model: model || null,
          endpoint,
          apiKeyConfigured: Boolean(env.intelligenceApiKey),
        };
      } catch (error) {
        const normalized = normalizeProviderError(error, providerName);
        return {
          provider: providerName,
          healthy: false,
          model: normalized.model || env.intelligenceModel || null,
          endpoint: normalized.endpoint || endpoint,
          apiKeyConfigured: Boolean(env.intelligenceApiKey),
          status: normalized.statusCode || null,
          code: normalized.code || 'INTELLIGENCE_PROVIDER_HTTP_ERROR',
          errorType: normalized.errorType || null,
          message: normalized.message,
          durationMs: normalized.durationMs || null,
          category: classifyProviderFailure(normalized.statusCode, normalized.code),
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
          const model = settings.model || env.intelligenceModel;
          const result = await withTimeout(callProvider({
            model,
            ...buildSamplingPayload(providerName, model, settings.temperature ?? 0.2),
            ...buildReasoningPayload(providerName, model),
            ...buildTokenLimitPayload(
              providerName,
              model,
              settings.maxOutputTokens || env.intelligenceMaxOutputTokens,
            ),
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

          const choice = result?.choices?.[0];
          const rawText = choice?.message?.content || '';
          // A truncated completion (token budget exhausted, typically all of
          // it spent on invisible reasoning — see buildReasoningPayload
          // above) or an empty body must never be treated as a successful,
          // if-empty response — both are incomplete output, not a valid "{}"
          // answer, and must fall through to the deterministic parser rather
          // than being merged as if the AI had confidently returned nothing.
          if (choice?.finish_reason === 'length' || !rawText.trim()) {
            const error = new Error(
              choice?.finish_reason === 'length'
                ? 'Intelligence provider response was truncated before completion (token budget exhausted).'
                : 'Intelligence provider returned an empty response.'
            );
            error.code = 'INTELLIGENCE_INCOMPLETE_OUTPUT';
            error.statusCode = 502;
            error.finishReason = choice?.finish_reason || null;
            throw error;
          }

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
