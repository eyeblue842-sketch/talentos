import crypto from 'crypto';
import { env } from '../../config/env.js';

const SUPPORTED_SCHEMA_VERSION = '1.0.0';

// Any route the Python service reports that starts with this prefix means
// "the request was valid and safely handled, but no real extraction
// happened" (no engine available/implemented for this request). A response
// shaped this way must never be confused with genuine extraction output.
const SCAFFOLD_ROUTE_PREFIX = 'SCAFFOLD_';

/**
 * Minimal in-memory circuit breaker, process-scoped (mirrors the worker's
 * own process-scoped state elsewhere in this codebase). After
 * DOCUMENT_PROCESSOR_CIRCUIT_BREAKER_THRESHOLD consecutive failures, the
 * breaker opens for DOCUMENT_PROCESSOR_CIRCUIT_BREAKER_COOLDOWN_MS — calls
 * during that window fail fast (no network attempt), so a genuinely down
 * document-processing service can't make every resume-import item pay a
 * full connect-timeout before falling back.
 */
const circuitState = {
  consecutiveFailures: 0,
  openUntil: 0,
};

export function resetDocumentProcessorCircuitBreaker() {
  circuitState.consecutiveFailures = 0;
  circuitState.openUntil = 0;
}

function isCircuitOpen() {
  return circuitState.openUntil > Date.now();
}

function recordSuccess() {
  circuitState.consecutiveFailures = 0;
  circuitState.openUntil = 0;
}

function recordFailure() {
  circuitState.consecutiveFailures += 1;
  if (circuitState.consecutiveFailures >= env.documentProcessorCircuitBreakerThreshold) {
    circuitState.openUntil = Date.now() + env.documentProcessorCircuitBreakerCooldownMs;
  }
}

export function getDocumentProcessorCircuitBreakerState() {
  return {
    consecutiveFailures: circuitState.consecutiveFailures,
    open: isCircuitOpen(),
    openUntil: circuitState.openUntil || null,
  };
}

export function isDocumentProcessorEnabled() {
  return env.documentProcessorEnabled;
}

function buildUrl(path) {
  return new URL(path, env.documentProcessorUrl).toString();
}

function buildFallbackResult(code, message, retryable) {
  return {
    success: false,
    document: null,
    fallbackReason: code,
    fallbackMessage: message,
    retryable,
  };
}

async function fetchWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Retryable classification: connection failures, timeouts, and 5xx
 * responses are transient and worth one retry. 4xx responses (bad MIME
 * type, oversized file, signature mismatch) describe the file itself and
 * will fail identically on retry, so they are not retried.
 */
function isRetryableStatus(statusCode) {
  return statusCode == null || statusCode >= 500;
}

export async function checkDocumentProcessorHealth() {
  if (!isDocumentProcessorEnabled()) {
    return { healthy: false, reason: 'DOCUMENT_PROCESSOR_DISABLED' };
  }
  try {
    const response = await fetchWithTimeout(
      buildUrl('/health/ready'),
      { method: 'GET' },
      env.documentProcessorConnectTimeoutMs,
    );
    if (!response.ok) {
      return { healthy: false, reason: `HTTP_${response.status}` };
    }
    const body = await response.json();
    return { healthy: body?.status === 'ready', reason: body?.status === 'ready' ? null : 'NOT_READY', detail: body };
  } catch (error) {
    return { healthy: false, reason: error?.name === 'AbortError' ? 'CONNECT_TIMEOUT' : 'CONNECT_ERROR' };
  }
}

// Step 4.5: the Docling engine now runs in an isolated worker process
// with its own lifecycle (STARTING/WARMING/READY/BUSY/DEGRADED/...), not
// a static available/unavailable flag. This distinguishes "not ready
// yet, but will be shortly" (WARMING, STARTING, RESTARTING -- worth
// retrying) from "genuinely not usable" (DEGRADED, UNAVAILABLE,
// SHUTTING_DOWN, STOPPED -- retrying immediately won't help) so a caller
// can decide whether to wait/retry or fall back straight away, and so the
// circuit breaker only counts genuine problems, not expected transient
// warm-up windows.
const DOCLING_ACCEPTING_STATES = new Set(['READY', 'BUSY']);
const DOCLING_TRANSIENT_STATES = new Set(['STARTING', 'WARMING', 'RESTARTING']);

export async function checkDoclingEngineReadiness() {
  if (!isDocumentProcessorEnabled()) {
    return { ready: false, state: 'DISABLED', retryable: false, transient: false };
  }
  try {
    const response = await fetchWithTimeout(
      buildUrl('/health/ready'),
      { method: 'GET' },
      env.documentProcessorConnectTimeoutMs,
    );
    const body = await response.json().catch(() => null);
    const state = body?.docling?.state || 'UNKNOWN';
    if (DOCLING_ACCEPTING_STATES.has(state)) {
      return { ready: true, state, retryable: false, transient: false };
    }
    if (DOCLING_TRANSIENT_STATES.has(state)) {
      return { ready: false, state, retryable: true, transient: true };
    }
    // DEGRADED, UNAVAILABLE, SHUTTING_DOWN, STOPPED, UNKNOWN -- a real
    // problem, not an expected transient window.
    return { ready: false, state, retryable: state === 'DEGRADED', transient: false };
  } catch (error) {
    return {
      ready: false,
      state: 'UNREACHABLE',
      retryable: true,
      transient: false,
      reason: error?.name === 'AbortError' ? 'CONNECT_TIMEOUT' : 'CONNECT_ERROR',
    };
  }
}

export async function getDocumentProcessorCapabilities() {
  const response = await fetchWithTimeout(
    buildUrl('/v1/capabilities'),
    { method: 'GET' },
    env.documentProcessorConnectTimeoutMs,
  );
  if (!response.ok) {
    const error = new Error(`Document processor capabilities request failed with status ${response.status}.`);
    error.code = 'DOCUMENT_PROCESSOR_HTTP_ERROR';
    error.statusCode = response.status;
    throw error;
  }
  return response.json();
}

/**
 * Analyses one document via the document-processing service. Never throws
 * for expected failure modes (disabled, circuit open, network error,
 * validation rejection, malformed response) — always returns a result the
 * caller can branch on, so "fall back to the existing Careeriz parser" is a
 * normal, first-class path, not an exception handler bolted on afterward.
 *
 * IMPORTANT: this function does not yet get called from the real resume
 * import pipeline (processResumeImportItem) — that wiring is intentionally
 * deferred to the step where a real engine (Docling, Step 4) exists to
 * receive the result. Calling it today would only ever produce a
 * SCAFFOLD_NOT_IMPLEMENTED route, which is not useful to merge into
 * candidate data.
 */
export async function analyseDocumentViaProcessor({ fileBuffer, originalFilename, mimeType, routeHint = 'auto' }) {
  const correlationId = crypto.randomUUID();

  if (!isDocumentProcessorEnabled()) {
    return buildFallbackResult('DOCUMENT_PROCESSOR_DISABLED', 'Document processor is disabled.', false);
  }

  if (isCircuitOpen()) {
    return buildFallbackResult('DOCUMENT_PROCESSOR_CIRCUIT_OPEN', 'Document processor circuit breaker is open.', false);
  }

  // Step 4.5: check readiness before sending the (potentially large)
  // multipart upload at all -- sending work while the isolated Docling
  // worker is WARMING/STARTING/RESTARTING would only ever produce a
  // scaffold result on the other end, so there is no reason to pay the
  // upload cost first. A WARMING-class state does not count against the
  // circuit breaker (it is an expected, self-resolving window, not
  // evidence the service is unhealthy); a genuinely DEGRADED/UNAVAILABLE
  // engine does.
  const readiness = await checkDoclingEngineReadiness();
  if (!readiness.ready) {
    if (!readiness.transient) {
      recordFailure();
    }
    return buildFallbackResult(
      `DOCUMENT_PROCESSOR_ENGINE_${readiness.state}`,
      `Docling engine is not ready to accept work (state: ${readiness.state}).`,
      readiness.retryable,
    );
  }

  const maxAttempts = env.documentProcessorMaxRetries + 1;
  let lastFailure = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const formData = new FormData();
      formData.append('file', new Blob([fileBuffer], { type: mimeType }), originalFilename);
      formData.append('correlationId', correlationId);
      formData.append('mimeType', mimeType);
      formData.append('originalFilename', originalFilename);
      formData.append('routeHint', routeHint);

      const response = await fetchWithTimeout(
        buildUrl('/v1/documents/analyse'),
        { method: 'POST', body: formData },
        env.documentProcessorResponseTimeoutMs,
      );

      if (!response.ok) {
        const retryable = isRetryableStatus(response.status);
        const body = await response.json().catch(() => null);
        lastFailure = buildFallbackResult(
          body?.code || `DOCUMENT_PROCESSOR_HTTP_${response.status}`,
          body?.message || `Document processor request failed with status ${response.status}.`,
          retryable,
        );
        if (!retryable || attempt >= maxAttempts) {
          recordFailure();
          return lastFailure;
        }
        continue;
      }

      const document = await response.json().catch(() => null);

      // Never trust a 200 status alone. A response that doesn't parse, is
      // missing required fields, or reports an unrecognised schema version
      // must be treated as a failure, not silently accepted as success.
      if (!document || typeof document !== 'object') {
        lastFailure = buildFallbackResult('DOCUMENT_PROCESSOR_INVALID_RESPONSE', 'Document processor returned an unparseable response.', true);
        if (attempt >= maxAttempts) {
          recordFailure();
          return lastFailure;
        }
        continue;
      }

      if (document.schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
        recordFailure();
        return buildFallbackResult(
          'DOCUMENT_PROCESSOR_SCHEMA_MISMATCH',
          `Document processor returned schemaVersion ${document.schemaVersion}, expected ${SUPPORTED_SCHEMA_VERSION}.`,
          false,
        );
      }

      if (!document.documentMetadata || !document.selectedRoute) {
        recordFailure();
        return buildFallbackResult('DOCUMENT_PROCESSOR_INCOMPLETE_RESPONSE', 'Document processor response is missing required fields.', false);
      }

      // A route beginning with SCAFFOLD_ means the service round-tripped a
      // well-formed response exactly per its contract -- that is real
      // evidence the service itself is healthy, so it still resets the
      // circuit breaker the same as any other valid response. What it is
      // NOT is real extraction: no engine ran, so the content fields are
      // empty/placeholder. Silently returning success: true here is exactly
      // how a scaffold response could end up merged into candidate data as
      // if it were real, so this is reported as a (non-retryable, non
      // failure-counted) fallback instead.
      if (typeof document.selectedRoute === 'string' && document.selectedRoute.startsWith(SCAFFOLD_ROUTE_PREFIX)) {
        recordSuccess();
        return buildFallbackResult(
          'DOCUMENT_PROCESSOR_SCAFFOLD_RESULT',
          `Document processor selected an unimplemented route (${document.selectedRoute}); no real extraction was performed.`,
          false,
        );
      }

      recordSuccess();
      return { success: true, document, fallbackReason: null, fallbackMessage: null, retryable: false };
    } catch (error) {
      const retryable = true; // network/timeout errors are always retryable
      lastFailure = buildFallbackResult(
        error?.name === 'AbortError' ? 'DOCUMENT_PROCESSOR_TIMEOUT' : 'DOCUMENT_PROCESSOR_CONNECTION_ERROR',
        error?.message || 'Document processor request failed.',
        retryable,
      );
      if (attempt >= maxAttempts) {
        recordFailure();
        return lastFailure;
      }
    }
  }

  recordFailure();
  return lastFailure || buildFallbackResult('DOCUMENT_PROCESSOR_UNKNOWN_ERROR', 'Document processor request failed for an unknown reason.', true);
}
