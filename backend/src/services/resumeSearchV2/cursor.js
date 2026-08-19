import crypto from 'crypto';
import { env } from '../../config/env.js';

const CURSOR_VERSION = '1';
const DEFAULT_TTL_MS = 10 * 60 * 1000;

function base64UrlEncode(value) {
  return Buffer.from(value).toString('base64url');
}

function base64UrlDecode(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function getSecret() {
  if (!env.openSearchCursorSecret) {
    const error = new Error('Resume search cursor secret is not configured.');
    error.statusCode = 503;
    error.code = 'RESUME_SEARCH_CURSOR_SECRET_MISSING';
    throw error;
  }
  return env.openSearchCursorSecret;
}

function sign(payload) {
  return crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
}

export function createSignedSearchCursor({ pitId, searchAfter, queryFingerprint, ttlMs = DEFAULT_TTL_MS }) {
  const body = {
    v: CURSOR_VERSION,
    pitId,
    sa: Array.isArray(searchAfter) ? searchAfter : [],
    qf: queryFingerprint,
    exp: Date.now() + ttlMs,
  };
  const encoded = base64UrlEncode(JSON.stringify(body));
  return `${encoded}.${sign(encoded)}`;
}

export function parseSignedSearchCursor(cursor, queryFingerprint) {
  if (!cursor) return null;
  const [encoded, providedSignature] = String(cursor).split('.');
  if (!encoded || !providedSignature) {
    const error = new Error('Malformed cursor.');
    error.statusCode = 400;
    error.code = 'RESUME_SEARCH_CURSOR_MALFORMED';
    throw error;
  }

  const expectedSignature = sign(encoded);
  if (providedSignature.length !== expectedSignature.length) {
    const error = new Error('Cursor signature is invalid.');
    error.statusCode = 400;
    error.code = 'RESUME_SEARCH_CURSOR_TAMPERED';
    throw error;
  }
  if (!crypto.timingSafeEqual(Buffer.from(providedSignature), Buffer.from(expectedSignature))) {
    const error = new Error('Cursor signature is invalid.');
    error.statusCode = 400;
    error.code = 'RESUME_SEARCH_CURSOR_TAMPERED';
    throw error;
  }

  const parsed = JSON.parse(base64UrlDecode(encoded));
  if (parsed.v !== CURSOR_VERSION) {
    const error = new Error('Unsupported cursor version.');
    error.statusCode = 400;
    error.code = 'RESUME_SEARCH_CURSOR_VERSION_UNSUPPORTED';
    throw error;
  }
  if (parsed.exp <= Date.now()) {
    const error = new Error('Cursor has expired.');
    error.statusCode = 400;
    error.code = 'RESUME_SEARCH_CURSOR_EXPIRED';
    throw error;
  }
  if (parsed.qf !== queryFingerprint) {
    const error = new Error('Cursor does not match this query.');
    error.statusCode = 400;
    error.code = 'RESUME_SEARCH_CURSOR_QUERY_MISMATCH';
    throw error;
  }
  if (!Array.isArray(parsed.sa)) {
    const error = new Error('Cursor sort state is malformed.');
    error.statusCode = 400;
    error.code = 'RESUME_SEARCH_CURSOR_SORT_MALFORMED';
    throw error;
  }
  return parsed;
}
