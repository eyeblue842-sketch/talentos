import { env } from '../../config/env.js';

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

export function normalizeProviderError(error, provider = 'DISABLED') {
  const normalized = new Error(error?.message || 'Intelligence provider request failed.');
  normalized.code = error?.code || 'INTELLIGENCE_PROVIDER_ERROR';
  normalized.statusCode = error?.statusCode || 503;
  normalized.provider = provider;
  return normalized;
}

export function stripUnsafeMarkup(value = '') {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[`$]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
