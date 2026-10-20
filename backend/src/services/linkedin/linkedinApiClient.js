import { env } from '../../config/env.js';

// Thin, side-effect-free client for the LinkedIn endpoints Careeriz uses:
//   - OAuth 2.0 authorization-code + refresh-token exchange
//   - OpenID Connect userinfo (verified member identity)
//   - Posts API  (POST /rest/posts, replaces the legacy ugcPosts API)
// Required product/scope for personal-profile publishing: "Share on LinkedIn"
// -> w_member_social (+ "Sign In with LinkedIn using OpenID Connect" -> openid, profile).

export const AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
export const TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
export const USERINFO_URL = 'https://api.linkedin.com/v2/userinfo';
export const POSTS_URL = 'https://api.linkedin.com/rest/posts';

export const PERSONAL_SCOPES = ['openid', 'profile', 'w_member_social'];
export const PAGE_SCOPES = ['r_organization_admin', 'w_organization_social'];
export const PUBLISH_SCOPE = 'w_member_social';

// Error categories. `retryable` ones are re-queued with bounded backoff; the
// rest need a user/admin action (reconnect, re-grant, fix content).
export const ERROR_CATEGORIES = {
  AUTH_EXPIRED: { retryable: false, action: 'Reconnect the LinkedIn account.' },
  PERMISSION_DENIED: { retryable: false, action: 'Re-authorize LinkedIn and grant the "Share on LinkedIn" permission.' },
  INVALID_REQUEST: { retryable: false, action: 'LinkedIn rejected the post content. Review the post text and retry.' },
  DUPLICATE_CONTENT: { retryable: false, action: 'LinkedIn rejected the post as duplicate content.' },
  RATE_LIMITED: { retryable: true, action: null },
  TRANSIENT: { retryable: true, action: null },
  NOT_CONFIGURED: { retryable: false, action: 'LinkedIn credentials are not configured on the server.' },
  PUBLISHING_DISABLED: { retryable: false, action: 'Automatic LinkedIn publishing is disabled until the LinkedIn app is verified.' },
  NOT_CONNECTED: { retryable: false, action: 'Connect a LinkedIn account.' },
  UNKNOWN_OUTCOME: { retryable: false, action: 'The previous attempt may or may not have posted. Check the LinkedIn profile, then retry only if no post exists.' },
};

export class LinkedInApiError extends Error {
  constructor(category, message, { statusCode = null, retryAfterMs = null } = {}) {
    super(message);
    this.name = 'LinkedInApiError';
    this.category = category;
    this.statusCode = statusCode;
    this.retryAfterMs = retryAfterMs;
    this.retryable = ERROR_CATEGORIES[category]?.retryable ?? false;
  }
}

// Strips anything that looks like a credential before text is stored or logged.
export function redactSecrets(value) {
  return String(value ?? '')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/("?(?:access_token|refresh_token|client_secret|id_token|code)"?\s*[:=]\s*"?)[^"&\s,}]+/gi, '$1[redacted]')
    .slice(0, 500);
}

function parseRetryAfter(response) {
  const raw = response.headers?.get?.('retry-after');
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 3600) * 1000 : null;
}

// `mutating` = a request that creates something (the post). For those, an
// error that does not prove LinkedIn ignored the request is AMBIGUOUS: retrying
// could create a duplicate, so it is classified UNKNOWN_OUTCOME (human check).
export function classifyHttpError(status, body, retryAfterMs = null, mutating = false) {
  const detail = redactSecrets(body?.message || body?.error_description || body?.error || '');
  const code = String(body?.code || body?.serviceErrorCode || '');
  if (status === 401) return new LinkedInApiError('AUTH_EXPIRED', 'LinkedIn rejected the access token (expired or revoked).', { statusCode: status });
  if (status === 403) return new LinkedInApiError('PERMISSION_DENIED', 'LinkedIn denied the request: the required permission (w_member_social) was not granted or was revoked.', { statusCode: status });
  if (status === 429) return new LinkedInApiError('RATE_LIMITED', 'LinkedIn rate limit reached.', { statusCode: status, retryAfterMs });
  if (mutating && (status === 409 || (status >= 500 && status !== 503))) {
    return new LinkedInApiError('UNKNOWN_OUTCOME', `LinkedIn answered ${status} to the post request; it may or may not have been created.`, { statusCode: status });
  }
  if (status === 409 || status >= 500) return new LinkedInApiError('TRANSIENT', `LinkedIn temporarily unavailable (${status}).`, { statusCode: status, retryAfterMs });
  if (status === 422 && /duplicate/i.test(`${detail} ${code}`)) return new LinkedInApiError('DUPLICATE_CONTENT', 'LinkedIn rejected the post as duplicate content.', { statusCode: status });
  return new LinkedInApiError('INVALID_REQUEST', `LinkedIn rejected the request (${status})${detail ? `: ${detail}` : '.'}`, { statusCode: status });
}

// Errors proving the request never left this machine (safe to retry even for a POST).
const NOT_SENT_CODES = new Set(['ENOTFOUND', 'ECONNREFUSED', 'EAI_AGAIN', 'ERR_INVALID_URL']);
const REQUEST_TIMEOUT_MS = 20_000;

async function request(url, options = {}) {
  const mutating = String(options.method || 'GET').toUpperCase() === 'POST' && options.ambiguousOnFailure === true;
  const { ambiguousOnFailure: _ignored, ...fetchOptions } = options;
  let response;
  try {
    response = await fetch(url, { ...fetchOptions, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (error) {
    const code = error?.cause?.code || error?.code;
    if (mutating && !NOT_SENT_CODES.has(code)) {
      throw new LinkedInApiError('UNKNOWN_OUTCOME', 'The connection failed or timed out while creating the post; it may or may not have been created.');
    }
    throw new LinkedInApiError('TRANSIENT', `Could not reach LinkedIn: ${redactSecrets(error?.message)}`);
  }
  const text = await response.text().catch(() => '');
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = {}; }
  if (!response.ok) throw classifyHttpError(response.status, body, parseRetryAfter(response), mutating);
  return { response, body };
}

export function isLinkedInConfigured() {
  return Boolean(env.linkedinClientId && env.linkedinClientSecret && env.linkedinRedirectUri);
}

export function buildAuthorizationUrl({ state, scopes }) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: env.linkedinClientId,
    redirect_uri: env.linkedinRedirectUri,
    state,
    scope: scopes.join(' '),
  });
  return `${AUTH_URL}?${params.toString()}`;
}

function normalizeTokenPayload(payload) {
  const now = Date.now();
  const grantedScopes = String(payload.scope || '').split(/[\s,]+/).filter(Boolean);
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token || null,
    expiresAt: payload.expires_in ? new Date(now + Number(payload.expires_in) * 1000) : null,
    refreshExpiresAt: payload.refresh_token_expires_in ? new Date(now + Number(payload.refresh_token_expires_in) * 1000) : null,
    grantedScopes,
  };
}

async function tokenRequest(params) {
  const { body } = await request(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...params, client_id: env.linkedinClientId, client_secret: env.linkedinClientSecret }).toString(),
  });
  if (!body.access_token) throw new LinkedInApiError('AUTH_EXPIRED', 'LinkedIn did not return an access token.');
  return normalizeTokenPayload(body);
}

export function exchangeAuthorizationCode(code) {
  return tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: env.linkedinRedirectUri });
}

export function refreshAccessToken(refreshToken) {
  return tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken });
}

// Best-effort token revocation on disconnect (never throws).
export async function revokeToken(token) {
  if (!token) return false;
  try {
    await request('https://www.linkedin.com/oauth/v2/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token, client_id: env.linkedinClientId, client_secret: env.linkedinClientSecret }).toString(),
    });
    return true;
  } catch {
    return false;
  }
}

// Verified identity from OpenID Connect userinfo. `sub` is the stable member id.
export async function fetchMemberIdentity(accessToken) {
  const { body } = await request(USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!body.sub) throw new LinkedInApiError('PERMISSION_DENIED', 'LinkedIn did not return a member identifier (openid/profile scope missing).');
  return { memberUrn: `urn:li:person:${body.sub}`, memberName: body.name || null, email: body.email || null };
}

// LinkedIn "little text" format reserves these characters in post commentary;
// unescaped they truncate or mis-render the post. '#' is left alone so hashtags work.
export function escapeCommentary(text) {
  return String(text).replace(/[\\|{}@[\]()<>*_~]/g, (char) => `\\${char}`);
}

export function postUrlFromUrn(urn) {
  return urn ? `https://www.linkedin.com/feed/update/${encodeURIComponent(urn)}/` : null;
}

export async function createArticlePost({ accessToken, authorUrn, commentary, url, title, description }) {
  const { response, body } = await request(POSTS_URL, {
    method: 'POST',
    ambiguousOnFailure: true,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
      'Linkedin-Version': env.linkedinApiVersion,
    },
    body: JSON.stringify({
      author: authorUrn,
      commentary: escapeCommentary(commentary),
      visibility: 'PUBLIC',
      distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
      content: { article: { source: url, title: String(title).slice(0, 200), description: String(description || '').slice(0, 250) } },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    }),
  });
  const postUrn = response.headers?.get?.('x-restli-id') || body?.id || null;
  return { postUrn, postUrl: postUrlFromUrn(postUrn) };
}
