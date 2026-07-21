import { env } from '../config/env.js';
import { meetingProviders } from './meetingConstants.js';

const unsafeUrlProtocols = new Set(['javascript:', 'data:', 'file:']);

export function ensureSupportedMeetingProvider(provider) {
  if (!meetingProviders.includes(provider)) {
    const error = new Error('Unsupported meeting provider.');
    error.statusCode = 422;
    throw error;
  }
}

export function assertValidTimezone(timezone) {
  try {
    Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
  } catch {
    const error = new Error('Invalid timezone.');
    error.statusCode = 422;
    throw error;
  }
}

export function ensureHttpsUrl(value, { allowHttp = false } = {}) {
  if (!value) return null;
  let parsed;
  try {
    parsed = new URL(String(value));
  } catch {
    const error = new Error('Invalid URL.');
    error.statusCode = 422;
    throw error;
  }

  if (unsafeUrlProtocols.has(parsed.protocol)) {
    const error = new Error('Unsafe URL scheme is not allowed.');
    error.statusCode = 422;
    throw error;
  }

  if (parsed.protocol !== 'https:' && !(allowHttp && parsed.protocol === 'http:')) {
    const error = new Error('Only HTTPS meeting URLs are allowed.');
    error.statusCode = 422;
    throw error;
  }

  return parsed.toString();
}

export function sanitizeMeetingText(value, maxLength = 2000) {
  if (value == null) return null;
  const normalized = String(value).replace(/[<>]/g, '').trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

export function buildUtcDate(value, fieldLabel) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const error = new Error(`${fieldLabel} is invalid.`);
    error.statusCode = 422;
    throw error;
  }
  return date;
}

export function assertFutureSchedule(startUtc, endUtc) {
  if (endUtc <= startUtc) {
    const error = new Error('Interview end time must be after the start time.');
    error.statusCode = 422;
    throw error;
  }

  if (!env.isTest && startUtc.getTime() < Date.now()) {
    const error = new Error('Interviews cannot be scheduled in the past.');
    error.statusCode = 422;
    throw error;
  }

  const durationMinutes = Math.round((endUtc.getTime() - startUtc.getTime()) / (60 * 1000));
  if (durationMinutes < 15 || durationMinutes > 480) {
    const error = new Error('Interview duration must be between 15 and 480 minutes.');
    error.statusCode = 422;
    throw error;
  }

  return durationMinutes;
}

export function normalizeProviderError(error, provider = 'CUSTOM') {
  const message = String(error?.message || 'Provider request failed.');
  const statusCode = error?.statusCode || 502;
  const normalized = new Error(`${provider} scheduling failed.`);
  normalized.statusCode = statusCode >= 400 && statusCode < 600 ? statusCode : 502;
  normalized.code = error?.code || `${provider}_PROVIDER_ERROR`;
  normalized.safeMessage = message.slice(0, 240);
  return normalized;
}
