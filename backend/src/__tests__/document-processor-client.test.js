import test, { before, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

let env;
let client;
const originalFetch = global.fetch;

before(async () => {
  ({ env } = await import('../config/env.js'));
  client = await import('../services/documentProcessor/documentProcessorClient.js');
});

beforeEach(() => {
  env.documentProcessorEnabled = true;
  env.documentProcessorUrl = 'http://127.0.0.1:8081';
  env.documentProcessorConnectTimeoutMs = 50;
  env.documentProcessorResponseTimeoutMs = 50;
  env.documentProcessorMaxRetries = 1;
  env.documentProcessorCircuitBreakerThreshold = 3;
  env.documentProcessorCircuitBreakerCooldownMs = 200;
  client.resetDocumentProcessorCircuitBreaker();
});

afterEach(() => {
  global.fetch = originalFetch;
  client.resetDocumentProcessorCircuitBreaker();
});

function scaffoldDocument(overrides = {}) {
  return {
    schemaVersion: '1.0.0',
    parserVersion: 'document-processor-0.1.0',
    correlationId: 'corr-1',
    engineVersions: { docling: null, paddleocr: null },
    selectedRoute: 'SCAFFOLD_NOT_IMPLEMENTED',
    fallbackReasons: [],
    documentMetadata: { pageCount: 1, fileSizeBytes: 10, mimeType: 'application/pdf', sniffedMimeType: 'application/pdf', originalFilename: 'x.pdf' },
    pages: [],
    textBlocks: [],
    tables: [],
    images: [],
    readingOrderApplied: false,
    extractionConfidence: null,
    qualityWarnings: [],
    processingDurations: { totalMs: 5, validationMs: 2 },
    error: null,
    ...overrides,
  };
}

function readyResponse(doclingState = 'READY') {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      status: 'ready',
      engines: { paddleocr: { available: false, reason: 'scaffold', version: null } },
      docling: {
        state: doclingState,
        engineVersion: doclingState === 'READY' || doclingState === 'BUSY' ? '2.119.0' : null,
        degradedReason: doclingState === 'DEGRADED' ? 'simulated' : null,
        activeConversions: 0,
        queuedRequests: 0,
        queueCapacity: 2,
      },
      activeRequests: 0,
      maxConcurrentRequests: 2,
    }),
  };
}

// Step 4.5: analyseDocumentViaProcessor now makes a GET /health/ready
// readiness pre-check before the POST /v1/documents/analyse upload --
// every test that exercises the POST path needs to dispatch on the URL
// so the pre-check sees a READY engine and the POST reaches the test's
// own intended mock behaviour.
function mockPostAfterReady(postHandler, { doclingState = 'READY' } = {}) {
  return async (url, init) => {
    if (String(url).endsWith('/health/ready')) {
      return readyResponse(doclingState);
    }
    return postHandler(url, init);
  };
}

test('isDocumentProcessorEnabled reflects the env flag', () => {
  env.documentProcessorEnabled = false;
  assert.equal(client.isDocumentProcessorEnabled(), false);
  env.documentProcessorEnabled = true;
  assert.equal(client.isDocumentProcessorEnabled(), true);
});

test('analyseDocumentViaProcessor returns a disabled fallback result without any network call when disabled', async () => {
  env.documentProcessorEnabled = false;
  let called = false;
  global.fetch = async () => { called = true; };

  const result = await client.analyseDocumentViaProcessor({ fileBuffer: Buffer.from('x'), originalFilename: 'a.pdf', mimeType: 'application/pdf' });

  assert.equal(result.success, false);
  assert.equal(result.fallbackReason, 'DOCUMENT_PROCESSOR_DISABLED');
  assert.equal(called, false, 'a disabled adapter must never attempt a network call');
});

test('a successful analyse call returns the parsed canonical document', async () => {
  global.fetch = mockPostAfterReady(async (url, init) => {
    assert.equal(String(url), 'http://127.0.0.1:8081/v1/documents/analyse');
    assert.equal(init.method, 'POST');
    return { ok: true, status: 200, json: async () => scaffoldDocument({ selectedRoute: 'DOCLING_STRUCTURE' }) };
  });

  const result = await client.analyseDocumentViaProcessor({ fileBuffer: Buffer.from('x'), originalFilename: 'a.pdf', mimeType: 'application/pdf' });

  assert.equal(result.success, true);
  assert.equal(result.document.selectedRoute, 'DOCLING_STRUCTURE');
});

test('a SCAFFOLD_NOT_IMPLEMENTED route is never reported as a successful extraction', async () => {
  global.fetch = mockPostAfterReady(async () => ({ ok: true, status: 200, json: async () => scaffoldDocument() }));

  const result = await client.analyseDocumentViaProcessor({ fileBuffer: Buffer.from('x'), originalFilename: 'a.pdf', mimeType: 'application/pdf' });

  assert.equal(result.success, false);
  assert.equal(result.fallbackReason, 'DOCUMENT_PROCESSOR_SCAFFOLD_RESULT');
  assert.equal(result.retryable, false);
});

test('any route prefixed SCAFFOLD_ is rejected the same way, not just SCAFFOLD_NOT_IMPLEMENTED', async () => {
  global.fetch = mockPostAfterReady(async () => ({ ok: true, status: 200, json: async () => scaffoldDocument({ selectedRoute: 'SCAFFOLD_PADDLEOCR_NOT_IMPLEMENTED' }) }));

  const result = await client.analyseDocumentViaProcessor({ fileBuffer: Buffer.from('x'), originalFilename: 'a.pdf', mimeType: 'application/pdf' });

  assert.equal(result.success, false);
  assert.equal(result.fallbackReason, 'DOCUMENT_PROCESSOR_SCAFFOLD_RESULT');
});

test('a scaffold response still resets the circuit breaker (the service itself round-tripped correctly)', async () => {
  global.fetch = mockPostAfterReady(async () => { throw new Error('connection refused'); });
  await client.analyseDocumentViaProcessor({ fileBuffer: Buffer.from('x'), originalFilename: 'a.pdf', mimeType: 'application/pdf' });
  assert.equal(client.getDocumentProcessorCircuitBreakerState().consecutiveFailures, 1);

  global.fetch = mockPostAfterReady(async () => ({ ok: true, status: 200, json: async () => scaffoldDocument() }));
  const result = await client.analyseDocumentViaProcessor({ fileBuffer: Buffer.from('x'), originalFilename: 'a.pdf', mimeType: 'application/pdf' });

  assert.equal(result.success, false, 'scaffold is not a usable extraction result');
  assert.equal(client.getDocumentProcessorCircuitBreakerState().consecutiveFailures, 0, 'but it is a healthy round trip, so the breaker still resets');
});

test('a service-unavailable (connection refused) failure falls back safely with a retryable reason', async () => {
  global.fetch = mockPostAfterReady(async () => { throw new Error('ECONNREFUSED'); });

  const result = await client.analyseDocumentViaProcessor({ fileBuffer: Buffer.from('x'), originalFilename: 'a.pdf', mimeType: 'application/pdf' });

  assert.equal(result.success, false);
  assert.equal(result.fallbackReason, 'DOCUMENT_PROCESSOR_CONNECTION_ERROR');
  assert.equal(result.retryable, true);
});

test('a request that exceeds the response timeout falls back with DOCUMENT_PROCESSOR_TIMEOUT', async () => {
  global.fetch = mockPostAfterReady(async (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => {
      const error = new Error('The operation was aborted.');
      error.name = 'AbortError';
      reject(error);
    });
  }));

  const result = await client.analyseDocumentViaProcessor({ fileBuffer: Buffer.from('x'), originalFilename: 'a.pdf', mimeType: 'application/pdf' });

  assert.equal(result.success, false);
  assert.equal(result.fallbackReason, 'DOCUMENT_PROCESSOR_TIMEOUT');
});

test('an invalid/unparseable JSON response is never treated as success', async () => {
  global.fetch = mockPostAfterReady(async () => ({
    ok: true,
    status: 200,
    json: async () => { throw new Error('Unexpected token in JSON'); },
  }));

  const result = await client.analyseDocumentViaProcessor({ fileBuffer: Buffer.from('x'), originalFilename: 'a.pdf', mimeType: 'application/pdf' });

  assert.equal(result.success, false);
  assert.equal(result.fallbackReason, 'DOCUMENT_PROCESSOR_INVALID_RESPONSE');
});

test('a response with a mismatched schemaVersion is rejected, not silently accepted', async () => {
  global.fetch = mockPostAfterReady(async () => ({ ok: true, status: 200, json: async () => scaffoldDocument({ schemaVersion: '99.0.0' }) }));

  const result = await client.analyseDocumentViaProcessor({ fileBuffer: Buffer.from('x'), originalFilename: 'a.pdf', mimeType: 'application/pdf' });

  assert.equal(result.success, false);
  assert.equal(result.fallbackReason, 'DOCUMENT_PROCESSOR_SCHEMA_MISMATCH');
});

test('a 4xx validation rejection is not retried', async () => {
  let callCount = 0;
  global.fetch = mockPostAfterReady(async () => {
    callCount += 1;
    return { ok: false, status: 422, json: async () => ({ code: 'UNSUPPORTED_MIME_TYPE', message: 'bad mime', retryable: false }) };
  });

  const result = await client.analyseDocumentViaProcessor({ fileBuffer: Buffer.from('x'), originalFilename: 'a.txt', mimeType: 'text/plain' });

  assert.equal(result.success, false);
  assert.equal(result.fallbackReason, 'UNSUPPORTED_MIME_TYPE');
  assert.equal(callCount, 1, 'a non-retryable 4xx must not be retried');
});

test('a 5xx failure is retried up to the configured max attempts', async () => {
  let callCount = 0;
  global.fetch = mockPostAfterReady(async () => {
    callCount += 1;
    return { ok: false, status: 503, json: async () => ({ code: 'SERVICE_BUSY', message: 'busy', retryable: true }) };
  });

  const result = await client.analyseDocumentViaProcessor({ fileBuffer: Buffer.from('x'), originalFilename: 'a.pdf', mimeType: 'application/pdf' });

  assert.equal(result.success, false);
  assert.equal(callCount, env.documentProcessorMaxRetries + 1);
});

test('a PROCESSING_TIMEOUT (504) from Python is surfaced with its own code and is retryable', async () => {
  global.fetch = mockPostAfterReady(async () => ({
    ok: false,
    status: 504,
    json: async () => ({ code: 'PROCESSING_TIMEOUT', message: 'Document conversion exceeded its hard deadline and was terminated.', retryable: true }),
  }));

  const result = await client.analyseDocumentViaProcessor({ fileBuffer: Buffer.from('x'), originalFilename: 'a.pdf', mimeType: 'application/pdf' });

  assert.equal(result.success, false);
  assert.equal(result.fallbackReason, 'PROCESSING_TIMEOUT');
  assert.equal(result.retryable, true);
});

test('the circuit breaker opens after the configured number of consecutive failures and then fails fast', async () => {
  global.fetch = mockPostAfterReady(async () => {
    throw new Error('connection refused');
  });

  // Each analyse call retries once internally (maxRetries=1), so 2 fetch
  // attempts per call. Drive enough calls to cross the failure threshold.
  await client.analyseDocumentViaProcessor({ fileBuffer: Buffer.from('x'), originalFilename: 'a.pdf', mimeType: 'application/pdf' });
  await client.analyseDocumentViaProcessor({ fileBuffer: Buffer.from('x'), originalFilename: 'a.pdf', mimeType: 'application/pdf' });
  await client.analyseDocumentViaProcessor({ fileBuffer: Buffer.from('x'), originalFilename: 'a.pdf', mimeType: 'application/pdf' });

  const state = client.getDocumentProcessorCircuitBreakerState();
  assert.equal(state.open, true, `circuit should be open after ${env.documentProcessorCircuitBreakerThreshold} consecutive failures`);

  const result = await client.analyseDocumentViaProcessor({ fileBuffer: Buffer.from('x'), originalFilename: 'a.pdf', mimeType: 'application/pdf' });

  assert.equal(result.fallbackReason, 'DOCUMENT_PROCESSOR_CIRCUIT_OPEN');
});

test('a success after failures resets the circuit breaker', async () => {
  global.fetch = mockPostAfterReady(async () => { throw new Error('connection refused'); });
  await client.analyseDocumentViaProcessor({ fileBuffer: Buffer.from('x'), originalFilename: 'a.pdf', mimeType: 'application/pdf' });

  global.fetch = mockPostAfterReady(async () => ({ ok: true, status: 200, json: async () => scaffoldDocument({ selectedRoute: 'DOCLING_STRUCTURE' }) }));
  const result = await client.analyseDocumentViaProcessor({ fileBuffer: Buffer.from('x'), originalFilename: 'a.pdf', mimeType: 'application/pdf' });

  assert.equal(result.success, true);
  assert.equal(client.getDocumentProcessorCircuitBreakerState().consecutiveFailures, 0);
});

test('checkDocumentProcessorHealth reports unhealthy without a network call when disabled', async () => {
  env.documentProcessorEnabled = false;
  let called = false;
  global.fetch = async () => { called = true; };

  const health = await client.checkDocumentProcessorHealth();

  assert.equal(health.healthy, false);
  assert.equal(health.reason, 'DOCUMENT_PROCESSOR_DISABLED');
  assert.equal(called, false);
});

test('checkDocumentProcessorHealth reports healthy when the service responds ready', async () => {
  global.fetch = async () => ({ ok: true, json: async () => ({ status: 'ready' }) });

  const health = await client.checkDocumentProcessorHealth();

  assert.equal(health.healthy, true);
});

// --- Step 4.5: Docling engine readiness (WARMING/READY/BUSY/DEGRADED/...) ---

test('checkDoclingEngineReadiness reports ready for READY and BUSY states', async () => {
  global.fetch = async () => readyResponse('READY');
  assert.equal((await client.checkDoclingEngineReadiness()).ready, true);

  global.fetch = async () => readyResponse('BUSY');
  assert.equal((await client.checkDoclingEngineReadiness()).ready, true);
});

test('checkDoclingEngineReadiness reports a transient, retryable state while warming', async () => {
  for (const state of ['STARTING', 'WARMING', 'RESTARTING']) {
    global.fetch = async () => readyResponse(state);
    const readiness = await client.checkDoclingEngineReadiness();
    assert.equal(readiness.ready, false, state);
    assert.equal(readiness.transient, true, state);
    assert.equal(readiness.retryable, true, state);
  }
});

test('checkDoclingEngineReadiness reports a non-transient state when degraded or unavailable', async () => {
  global.fetch = async () => readyResponse('UNAVAILABLE');
  const readiness = await client.checkDoclingEngineReadiness();
  assert.equal(readiness.ready, false);
  assert.equal(readiness.transient, false);
  assert.equal(readiness.retryable, false);
});

test('analyseDocumentViaProcessor does not send the upload while the engine is warming', async () => {
  let postCalled = false;
  global.fetch = async (url) => {
    if (String(url).endsWith('/health/ready')) {
      return readyResponse('WARMING');
    }
    postCalled = true;
    return { ok: true, status: 200, json: async () => scaffoldDocument() };
  };

  const result = await client.analyseDocumentViaProcessor({ fileBuffer: Buffer.from('x'), originalFilename: 'a.pdf', mimeType: 'application/pdf' });

  assert.equal(postCalled, false, 'must not upload the file while the engine is warming');
  assert.equal(result.success, false);
  assert.equal(result.fallbackReason, 'DOCUMENT_PROCESSOR_ENGINE_WARMING');
  assert.equal(result.retryable, true);
});

test('a WARMING readiness result does not count against the circuit breaker', async () => {
  global.fetch = async () => readyResponse('WARMING');
  await client.analyseDocumentViaProcessor({ fileBuffer: Buffer.from('x'), originalFilename: 'a.pdf', mimeType: 'application/pdf' });

  assert.equal(client.getDocumentProcessorCircuitBreakerState().consecutiveFailures, 0, 'warming is expected and self-resolving, not a service failure');
});

test('a DEGRADED readiness result does count against the circuit breaker', async () => {
  global.fetch = async () => readyResponse('DEGRADED');
  await client.analyseDocumentViaProcessor({ fileBuffer: Buffer.from('x'), originalFilename: 'a.pdf', mimeType: 'application/pdf' });

  assert.equal(client.getDocumentProcessorCircuitBreakerState().consecutiveFailures, 1, 'degraded is a real problem, not an expected window');
});
