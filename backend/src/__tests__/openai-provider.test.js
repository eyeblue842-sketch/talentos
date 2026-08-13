import test, { afterEach, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

let env;
let createOpenAiCompatibleProvider;

const originalFetch = global.fetch;

before(async () => {
  ({ env } = await import('../config/env.js'));
  ({ createOpenAiCompatibleProvider } = await import('../intelligence/providers/openaiCompatibleProvider.js'));
});

beforeEach(() => {
  env.intelligenceProvider = 'OPENAI';
  env.intelligenceBaseUrl = 'https://api.openai.com/v1';
  env.intelligenceModel = 'gpt-5';
  env.intelligenceApiKey = 'sk-test-secret';
  env.intelligenceTimeoutMs = 50;
  env.intelligenceMaxRetries = 0;
});

afterEach(() => {
  global.fetch = originalFetch;
});

function mockJsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  };
}

test('health check preserves /v1 endpoint path and reports success', async () => {
  let calledUrl = null;
  let requestBody = null;
  global.fetch = async (url, options) => {
    calledUrl = String(url);
    requestBody = JSON.parse(options.body);
    return mockJsonResponse(200, {
      model: 'gpt-5',
      choices: [{ message: { content: 'OK' } }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    });
  };

  const provider = createOpenAiCompatibleProvider();
  const health = await provider.healthCheck();

  assert.equal(calledUrl, 'https://api.openai.com/v1/chat/completions');
  assert.equal(health.healthy, true);
  assert.equal(health.endpoint, '/v1/chat/completions');
  assert.equal(health.apiKeyConfigured, true);
  assert.equal(requestBody.max_completion_tokens, 5);
  assert.equal('max_tokens' in requestBody, false);
  assert.equal('temperature' in requestBody, false);
});

test('health check surfaces 401 authentication failures safely', async () => {
  global.fetch = async () => mockJsonResponse(401, {
    error: {
      type: 'invalid_request_error',
      code: 'invalid_api_key',
      message: 'Incorrect API key provided: sk-test-secret',
    },
  });

  const provider = createOpenAiCompatibleProvider();
  const health = await provider.healthCheck();

  assert.equal(health.healthy, false);
  assert.equal(health.status, 401);
  assert.equal(health.code, 'invalid_api_key');
  assert.equal(health.category, 'authentication');
  assert.equal(health.message.includes('sk-test-secret'), false);
});

test('health check surfaces 400 invalid request failures safely', async () => {
  global.fetch = async () => mockJsonResponse(400, {
    error: {
      type: 'invalid_request_error',
      code: 'unsupported_parameter',
      message: 'Unsupported parameter: max_tokens',
    },
  });

  const provider = createOpenAiCompatibleProvider();
  const health = await provider.healthCheck();

  assert.equal(health.status, 400);
  assert.equal(health.code, 'unsupported_parameter');
  assert.equal(health.category, 'invalid-request');
});

test('health check surfaces 404 endpoint or model failures safely', async () => {
  global.fetch = async () => mockJsonResponse(404, {
    error: {
      type: 'invalid_request_error',
      code: 'model_not_found',
      message: 'The model gpt-5 does not exist',
    },
  });

  const provider = createOpenAiCompatibleProvider();
  const health = await provider.healthCheck();

  assert.equal(health.status, 404);
  assert.equal(health.code, 'model_not_found');
  assert.equal(health.category, 'endpoint-or-model');
});

test('health check surfaces 429 quota failures safely', async () => {
  global.fetch = async () => mockJsonResponse(429, {
    error: {
      type: 'insufficient_quota',
      code: 'credit_balance_exhausted',
      message: 'You have no credits remaining.',
    },
  });

  const provider = createOpenAiCompatibleProvider();
  const health = await provider.healthCheck();

  assert.equal(health.status, 429);
  assert.equal(health.code, 'credit_balance_exhausted');
  assert.equal(health.category, 'quota-or-rate-limit');
});

test('health check surfaces timeout failures safely', async () => {
  global.fetch = async () => new Promise(() => {});

  const provider = createOpenAiCompatibleProvider();
  const health = await provider.healthCheck();

  assert.equal(health.healthy, false);
  assert.equal(health.code, 'INTELLIGENCE_TIMEOUT');
  assert.equal(health.category, 'timeout');
});

test('generate surfaces safe upstream diagnostics for non-2xx responses', async () => {
  global.fetch = async () => mockJsonResponse(400, {
    error: {
      type: 'invalid_request_error',
      code: 'unsupported_parameter',
      message: 'Unsupported parameter: response_format',
    },
  });

  const provider = createOpenAiCompatibleProvider();

  await assert.rejects(
    () => provider.generate({
      prompt: 'Return JSON',
      schema: { type: 'object' },
    }),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, 'unsupported_parameter');
      assert.equal(error.provider, 'OPENAI');
      return true;
    },
  );
});

test('generate uses max_completion_tokens for native OpenAI GPT-5 models', async () => {
  let requestBody = null;
  global.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return mockJsonResponse(200, {
      model: 'gpt-5',
      choices: [{ message: { content: '{"ok":true}' } }],
      usage: { prompt_tokens: 12, completion_tokens: 4 },
    });
  };

  const provider = createOpenAiCompatibleProvider();
  await provider.generate({
    prompt: 'Return {"ok":true}',
    schema: { type: 'object' },
    settings: { maxOutputTokens: 42 },
  });

  assert.equal(requestBody.max_completion_tokens, 42);
  assert.equal('max_tokens' in requestBody, false);
  assert.equal('temperature' in requestBody, false);
});

test('generate keeps max_tokens for custom openai-compatible providers', async () => {
  env.intelligenceProvider = 'CUSTOM_OPENAI_COMPATIBLE';
  env.intelligenceBaseUrl = 'https://custom-llm.example.com/v1';
  env.intelligenceModel = 'llama-3.1';

  let requestBody = null;
  global.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return mockJsonResponse(200, {
      model: 'llama-3.1',
      choices: [{ message: { content: '{"ok":true}' } }],
      usage: { prompt_tokens: 10, completion_tokens: 3 },
    });
  };

  const provider = createOpenAiCompatibleProvider();
  await provider.generate({
    prompt: 'Return {"ok":true}',
    schema: { type: 'object' },
    settings: { maxOutputTokens: 21 },
  });

  assert.equal(requestBody.max_tokens, 21);
  assert.equal('max_completion_tokens' in requestBody, false);
  assert.equal(requestBody.temperature, 0.2);
});

test('generate sends reasoning_effort: "minimal" for native OpenAI GPT-5 models', async () => {
  let requestBody = null;
  global.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return mockJsonResponse(200, {
      model: 'gpt-5',
      choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 12, completion_tokens: 4 },
    });
  };

  const provider = createOpenAiCompatibleProvider();
  await provider.generate({
    prompt: 'Return {"ok":true}',
    schema: { type: 'object' },
    settings: { maxOutputTokens: 4000 },
  });

  assert.equal(requestBody.reasoning_effort, 'minimal');
});

test('generate does not send reasoning_effort to non-GPT-5 OpenAI models or custom openai-compatible providers', async () => {
  let requestBody = null;
  global.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return mockJsonResponse(200, {
      model: 'gpt-4o',
      choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 12, completion_tokens: 4 },
    });
  };

  const provider = createOpenAiCompatibleProvider();
  await provider.generate({
    prompt: 'Return {"ok":true}',
    schema: { type: 'object' },
    settings: { model: 'gpt-4o' },
  });

  assert.equal('reasoning_effort' in requestBody, false, 'non-GPT-5 OpenAI models must not receive an unsupported reasoning_effort parameter');

  env.intelligenceProvider = 'CUSTOM_OPENAI_COMPATIBLE';
  env.intelligenceBaseUrl = 'https://custom-llm.example.com/v1';
  env.intelligenceModel = 'llama-3.1';
  requestBody = null;
  global.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return mockJsonResponse(200, {
      model: 'llama-3.1',
      choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 3 },
    });
  };

  const customProvider = createOpenAiCompatibleProvider();
  await customProvider.generate({ prompt: 'Return {"ok":true}', schema: { type: 'object' } });

  assert.equal('reasoning_effort' in requestBody, false, 'non-OpenAI-native providers must not receive reasoning_effort, which is not part of the standard chat-completions contract');
});

test('generate treats a truncated (finish_reason=length) completion as a failure, not a valid empty response', async () => {
  global.fetch = async () => mockJsonResponse(200, {
    model: 'gpt-5',
    choices: [{ message: { content: '' }, finish_reason: 'length' }],
    usage: { prompt_tokens: 100, completion_tokens: 4000 },
  });

  const provider = createOpenAiCompatibleProvider();

  await assert.rejects(
    () => provider.generate({ prompt: 'Return JSON', schema: { type: 'object' } }),
    (error) => {
      assert.equal(error.code, 'INTELLIGENCE_INCOMPLETE_OUTPUT');
      return true;
    },
  );
});

test('generate treats an empty completion body (finish_reason=stop, no content) as a failure', async () => {
  global.fetch = async () => mockJsonResponse(200, {
    model: 'gpt-5',
    choices: [{ message: { content: '' }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 100, completion_tokens: 0 },
  });

  const provider = createOpenAiCompatibleProvider();

  await assert.rejects(
    () => provider.generate({ prompt: 'Return JSON', schema: { type: 'object' } }),
    (error) => {
      assert.equal(error.code, 'INTELLIGENCE_INCOMPLETE_OUTPUT');
      return true;
    },
  );
});
