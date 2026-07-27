import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { env } from '../../config/env.js';
import { normalizeProviderError } from './providerUtils.js';

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function extractBodyText(parsed) {
  if (!parsed) return null;
  if (typeof parsed.outputText === 'string') return parsed.outputText;
  if (typeof parsed.completion === 'string') return parsed.completion;
  if (Array.isArray(parsed.content)) {
    const textBlock = parsed.content.find((item) => typeof item?.text === 'string');
    if (textBlock?.text) return textBlock.text;
  }
  if (Array.isArray(parsed.results) && typeof parsed.results[0]?.outputText === 'string') {
    return parsed.results[0].outputText;
  }
  return null;
}

function withTimeout(promise, timeoutMs) {
  let timer = null;
  return Promise.race([
    promise.finally(() => {
      if (timer) clearTimeout(timer);
    }),
    new Promise((_, reject) => {
      timer = setTimeout(() => {
        const error = new Error(`Amazon Bedrock intelligence request timed out after ${timeoutMs}ms.`);
        error.code = 'INTELLIGENCE_TIMEOUT';
        error.statusCode = 504;
        reject(error);
      }, timeoutMs);
    }),
  ]);
}

export function createBedrockProvider() {
  const client = new BedrockRuntimeClient({
    region: env.awsBedrockRegion,
  });

  async function callModel(payload) {
    const response = await client.send(new InvokeModelCommand({
      modelId: payload.modelId || env.awsBedrockModelId || env.intelligenceModel,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload.body),
    }));

    const decoded = new TextDecoder().decode(response.body);
    const parsed = safeJsonParse(decoded);
    if (!parsed) {
      const error = new Error('Amazon Bedrock returned invalid JSON.');
      error.code = 'INTELLIGENCE_PROVIDER_INVALID_JSON';
      error.statusCode = 502;
      throw error;
    }

    const content = extractBodyText(parsed);
    return {
      parsed,
      text: content || JSON.stringify(parsed),
      usage: parsed.usage || parsed.invocationMetrics || null,
    };
  }

  return {
    provider: 'BEDROCK',
    async healthCheck() {
      try {
        await withTimeout(callModel({
          body: {
            prompt: 'Return the single word OK.',
            max_tokens: 8,
            temperature: 0,
          },
        }), Math.min(env.intelligenceTimeoutMs, 8000));
        return { provider: 'BEDROCK', healthy: true };
      } catch (error) {
        return {
          provider: 'BEDROCK',
          healthy: false,
          reason: normalizeProviderError(error, 'BEDROCK').message,
        };
      }
    },
    async generate({ prompt, schema, settings = {} }) {
      const maxRetries = env.intelligenceMaxRetries;
      let lastError = null;

      for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        try {
          const startedAt = Date.now();
          const result = await withTimeout(callModel({
            modelId: settings.model || env.awsBedrockModelId || env.intelligenceModel,
            body: {
              prompt: `${prompt}\n\nReturn strictly valid JSON matching this schema description:\n${JSON.stringify(schema, null, 2)}`,
              max_tokens: settings.maxOutputTokens || env.intelligenceMaxOutputTokens,
              temperature: settings.temperature ?? 0.2,
            },
          }), env.intelligenceTimeoutMs);

          return {
            text: result.text,
            model: settings.model || env.awsBedrockModelId || env.intelligenceModel,
            promptTokens: result.usage?.inputTokens || result.usage?.promptTokens || null,
            completionTokens: result.usage?.outputTokens || result.usage?.completionTokens || null,
            latencyMs: Date.now() - startedAt,
          };
        } catch (error) {
          lastError = normalizeProviderError(error, 'BEDROCK');
          if (attempt >= maxRetries || ['AccessDeniedException', 'ValidationException', 'ResourceNotFoundException'].includes(error?.name || '')) {
            throw lastError;
          }
        }
      }

      throw lastError || normalizeProviderError(new Error('Amazon Bedrock request failed.'), 'BEDROCK');
    },
  };
}
