import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { env } from '../../config/env.js';

const bedrockClient = env.aiProvider === 'bedrock'
  ? new BedrockRuntimeClient({
      region: env.awsBedrockRegion,
    })
  : null;

const PROMPT = `You extract resume data into strict JSON.
Rules:
- Return valid JSON only.
- Never invent missing values.
- Use null when a field is unavailable.
- Do not infer sensitive or protected attributes.
- Do not invent an email, employer, salary, or dates.
- Output shape:
{
  "candidate": {
    "fullName": { "value": string|null, "confidence": number },
    "email": { "value": string|null, "confidence": number },
    "phoneNumber": { "value": string|null, "confidence": number },
    "linkedInUrl": { "value": string|null, "confidence": number },
    "currentTitle": { "value": string|null, "confidence": number },
    "currentEmployer": { "value": string|null, "confidence": number },
    "location": { "value": string|null, "confidence": number },
    "summary": { "value": string|null, "confidence": number },
    "skills": { "value": string[]|null, "confidence": number }
  }
}`;

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function classifyBedrockError(error) {
  const message = String(error?.message || 'Amazon Bedrock resume parsing failed.');
  if (error?.code === 'AI_INVALID_JSON') {
    error.retryable = false;
    return error;
  }

  const classified = new Error(message);
  classified.code = error?.name === 'AbortError' ? 'AI_TIMEOUT' : (error?.code || 'AI_PROVIDER_ERROR');
  classified.retryable = !['ValidationException', 'AccessDeniedException', 'ResourceNotFoundException'].includes(error?.name || '');
  return classified;
}

async function withTimeout(promise, timeoutMs) {
  let timer = null;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          const error = new Error('Amazon Bedrock request timed out.');
          error.code = 'AI_TIMEOUT';
          error.name = 'AbortError';
          reject(error);
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
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
  return null;
}

export async function parseResumeWithBedrock({ text }) {
  if (!bedrockClient || !env.awsBedrockModelId) {
    return null;
  }

  const input = JSON.stringify({
    prompt: `${PROMPT}\n\nResume:\n${text.slice(0, env.resumeImportMaxTextChars)}`,
    max_tokens: 1200,
    temperature: 0,
  });

  let lastError = null;
  for (let attempt = 0; attempt <= env.aiMaxRetries; attempt += 1) {
    try {
      const response = await withTimeout(
        bedrockClient.send(new InvokeModelCommand({
          modelId: env.awsBedrockModelId,
          contentType: 'application/json',
          accept: 'application/json',
          body: input,
        })),
        env.aiRequestTimeoutMs
      );

      const decoded = new TextDecoder().decode(response.body);
      const parsed = safeJsonParse(decoded);
      if (!parsed) {
        const error = new Error('Amazon Bedrock returned invalid JSON.');
        error.code = 'AI_INVALID_JSON';
        error.retryable = false;
        throw error;
      }

      const extractedText = extractBodyText(parsed);
      if (extractedText) {
        const nested = safeJsonParse(extractedText);
        if (!nested) {
          const error = new Error('Amazon Bedrock response did not contain valid resume JSON.');
          error.code = 'AI_INVALID_JSON';
          error.retryable = false;
          throw error;
        }
        return nested;
      }

      return parsed;
    } catch (error) {
      const classified = classifyBedrockError(error);
      lastError = classified;
      if (classified.retryable === false || attempt >= env.aiMaxRetries) {
        throw classified;
      }
      const backoffMs = Math.min(4000, 250 * (2 ** attempt));
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }

  throw lastError || new Error('Amazon Bedrock resume parsing failed.');
}
