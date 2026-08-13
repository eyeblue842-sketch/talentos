import { env } from '../../config/env.js';
import { resolveIntelligenceBaseUrl } from '../services/runtimeConfigurationService.js';

const privateHostPatterns = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^\[?::1\]?$/,
];

export function validateProviderBaseUrl(value) {
  if (!value) return null;
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol)) {
    const error = new Error('Unsupported intelligence provider protocol.');
    error.statusCode = 422;
    throw error;
  }

  if (url.username || url.password) {
    const error = new Error('Intelligence provider URL must not embed credentials.');
    error.statusCode = 422;
    throw error;
  }

  const isPrivate = privateHostPatterns.some((pattern) => pattern.test(url.hostname));
  if (isPrivate && env.isProduction) {
    const error = new Error('Intelligence provider URL is not allowed for this environment.');
    error.statusCode = 422;
    throw error;
  }

  url.hash = '';
  return url;
}

export function getValidatedProviderBaseUrl(provider = env.intelligenceProvider, configuredBaseUrl = env.intelligenceBaseUrl) {
  const resolved = resolveIntelligenceBaseUrl(provider, configuredBaseUrl);
  if (!resolved) {
    const error = new Error('INTELLIGENCE_BASE_URL is not configured for this provider.');
    error.code = 'INTELLIGENCE_BASE_URL_REQUIRED';
    error.statusCode = 422;
    throw error;
  }
  return validateProviderBaseUrl(resolved);
}

export function buildProviderUrl(baseUrl, endpointPath) {
  const normalized = String(endpointPath || '').replace(/^\/+/, '');
  const url = new URL(baseUrl.toString());
  const pathname = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`;
  url.pathname = `${pathname}${normalized}`;
  return url;
}

export function normalizeProviderError(error, provider = 'DISABLED') {
  const normalized = new Error(error?.message || 'Intelligence provider request failed.');
  normalized.code = error?.code || 'INTELLIGENCE_PROVIDER_ERROR';
  normalized.statusCode = error?.statusCode || 503;
  normalized.provider = provider;
  normalized.errorType = error?.errorType || error?.type || null;
  normalized.endpoint = error?.endpoint || null;
  normalized.model = error?.model || null;
  normalized.durationMs = error?.durationMs || null;
  return normalized;
}

export function sanitizeProviderMessage(value, fallback = 'Intelligence provider request failed.') {
  return String(value || fallback)
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/\bsk-[A-Za-z0-9_-]+\b/g, '[REDACTED_API_KEY]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

export function classifyProviderFailure(statusCode, errorCode) {
  if (errorCode === 'INTELLIGENCE_TIMEOUT') return 'timeout';
  if (statusCode === 401) return 'authentication';
  if (statusCode === 403) return 'permission';
  if (statusCode === 404) return 'endpoint-or-model';
  if (statusCode === 429) return 'quota-or-rate-limit';
  if (statusCode >= 500) return 'provider-service';
  if (statusCode === 400) return 'invalid-request';
  return 'request-failed';
}

export function stripUnsafeMarkup(value = '') {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[`$]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
