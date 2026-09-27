import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { requireOrganisationRole, requireOrganisationContext } from './organisationAccessService.js';
import { issueAuthToken, consumeAuthToken } from './authTokenService.js';
import { encryptMeetingSecret, decryptMeetingSecret } from '../meeting/meetingEncryptionService.js';
import { recordAuditLog } from './auditLogService.js';

const PROVIDER = 'LINKEDIN';
const writableRoles = ['OWNER', 'ADMIN', 'RECRUITER'];
const AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
// Personal posting needs openid/profile/w_member_social. Company-Page posting
// additionally needs r_organization_admin + w_organization_social (LinkedIn
// Community Management API — gated behind app review).
const SCOPES = ['openid', 'profile', 'w_member_social', 'r_organization_admin', 'w_organization_social'];

export function isLinkedInConfigured() {
  return Boolean(env.linkedinClientId && env.linkedinClientSecret && env.linkedinRedirectUri);
}

function assertConfigured() {
  if (!isLinkedInConfigured()) {
    const error = new Error('LinkedIn is not configured. Set LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET / LINKEDIN_OAUTH_REDIRECT_URI.');
    error.statusCode = 503;
    throw error;
  }
}

// Step 1 — build the consent URL (state token = CSRF + carries org/user).
export async function beginLinkedInOAuth(actorUser, organisationId = null) {
  assertConfigured();
  const context = await requireOrganisationRole(actorUser, writableRoles, organisationId);
  const { token: stateToken } = await issueAuthToken(actorUser.id, 'OAUTH_STATE', {
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    context: { provider: PROVIDER, organisationId: context.organisationId, userId: actorUser.id },
    invalidateExisting: false,
  });
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: env.linkedinClientId,
    redirect_uri: env.linkedinRedirectUri,
    state: stateToken,
    scope: SCOPES.join(' '),
  });
  return { authorizationUrl: `${AUTH_URL}?${params.toString()}` };
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  if (!response.ok) {
    const error = new Error(body?.message || body?.error_description || `LinkedIn API error (${response.status}).`);
    error.statusCode = response.status;
    error.details = body;
    throw error;
  }
  return body;
}

// Step 2 — exchange the code, read the member + admin Pages, store encrypted.
export async function handleLinkedInOAuthCallback(code, stateValue) {
  assertConfigured();
  const stateToken = await consumeAuthToken(stateValue, 'OAUTH_STATE', { includeUser: true });
  const state = stateToken.context || {};
  if (state.provider !== PROVIDER || !state.organisationId) {
    const error = new Error('Invalid LinkedIn OAuth state.');
    error.statusCode = 400;
    throw error;
  }

  const tokenPayload = await fetchJson(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: env.linkedinRedirectUri,
      client_id: env.linkedinClientId,
      client_secret: env.linkedinClientSecret,
    }).toString(),
  });
  const accessToken = tokenPayload.access_token;
  const expiresAt = tokenPayload.expires_in ? new Date(Date.now() + tokenPayload.expires_in * 1000) : null;

  // Member identity (OpenID userinfo).
  let memberUrn = null; let memberName = 'LinkedIn account';
  try {
    const me = await fetchJson('https://api.linkedin.com/v2/userinfo', { headers: { Authorization: `Bearer ${accessToken}` } });
    if (me.sub) memberUrn = `urn:li:person:${me.sub}`;
    memberName = me.name || memberName;
  } catch { /* leave personal posting disabled if userinfo denied */ }

  // Company Pages the user administers (best-effort; needs r_organization_admin).
  const organizations = [];
  try {
    const acls = await fetchJson('https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&projection=(elements*(organization~(localizedName)))', {
      headers: { Authorization: `Bearer ${accessToken}`, 'X-Restli-Protocol-Version': '2.0.0' },
    });
    for (const el of acls.elements || []) {
      const orgUrn = el.organization;
      const name = el['organization~']?.localizedName || 'Company Page';
      if (orgUrn) organizations.push({ urn: orgUrn, name });
    }
  } catch { /* no Page admin access granted */ }

  const connection = await prisma.socialConnection.upsert({
    where: { organisationId_provider: { organisationId: state.organisationId, provider: PROVIDER } },
    create: {
      organisationId: state.organisationId,
      provider: PROVIDER,
      status: 'CONNECTED',
      connectedAccountId: memberUrn,
      connectedName: memberName,
      encryptedAccessToken: encryptMeetingSecret(accessToken),
      accessTokenExpiresAt: expiresAt,
      scopes: SCOPES,
      metadata: { memberUrn, memberName, organizations },
      connectedByUserId: state.userId,
    },
    update: {
      status: 'CONNECTED',
      connectedAccountId: memberUrn,
      connectedName: memberName,
      encryptedAccessToken: encryptMeetingSecret(accessToken),
      accessTokenExpiresAt: expiresAt,
      scopes: SCOPES,
      metadata: { memberUrn, memberName, organizations },
      connectedByUserId: state.userId,
    },
  });
  await recordAuditLog({ organisationId: state.organisationId, actorUserId: state.userId, action: 'linkedin.connect', entityType: 'SocialConnection', entityId: connection.id });
  return { organisationId: state.organisationId };
}

function serializeStatus(connection) {
  if (!connection || connection.status !== 'CONNECTED') return { connected: false, configured: isLinkedInConfigured(), destinations: [] };
  const meta = connection.metadata || {};
  const destinations = [];
  if (meta.memberUrn) destinations.push({ urn: meta.memberUrn, name: `${meta.memberName || 'My profile'} (personal)`, type: 'PERSON' });
  for (const o of meta.organizations || []) destinations.push({ urn: o.urn, name: `${o.name} (Page)`, type: 'ORGANIZATION' });
  return { connected: true, configured: true, connectedName: connection.connectedName, destinations };
}

export async function getLinkedInStatus(actorUser, organisationId = null) {
  const context = await requireOrganisationContext(actorUser, organisationId);
  const connection = await prisma.socialConnection.findUnique({ where: { organisationId_provider: { organisationId: context.organisationId, provider: PROVIDER } } });
  return serializeStatus(connection);
}

export async function disconnectLinkedIn(actorUser, organisationId = null) {
  const context = await requireOrganisationRole(actorUser, writableRoles, organisationId);
  await prisma.socialConnection.deleteMany({ where: { organisationId: context.organisationId, provider: PROVIDER } });
  await recordAuditLog({ organisationId: context.organisationId, actorUserId: actorUser.id, action: 'linkedin.disconnect', entityType: 'SocialConnection', entityId: context.organisationId });
  return { disconnected: true };
}

// Posts a job to LinkedIn: ONLY position + location + the Careeriz apply link.
export async function postJobToLinkedIn(actorUser, jobId, payload, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationRole(actorUser, writableRoles, organisationId);
  const connection = await prisma.socialConnection.findUnique({ where: { organisationId_provider: { organisationId: context.organisationId, provider: PROVIDER } } });
  if (!connection?.encryptedAccessToken) {
    const error = new Error('Connect LinkedIn before posting.');
    error.statusCode = 400;
    throw error;
  }
  const job = await prisma.job.findFirst({ where: { id: jobId, organisationId: context.organisationId } });
  if (!job) {
    const error = new Error('Job not found.');
    error.statusCode = 404;
    throw error;
  }
  const meta = connection.metadata || {};
  const validUrns = new Set([meta.memberUrn, ...(meta.organizations || []).map((o) => o.urn)].filter(Boolean));
  const authorUrn = payload.authorUrn && validUrns.has(payload.authorUrn) ? payload.authorUrn : meta.memberUrn;
  if (!authorUrn) {
    const error = new Error('No valid LinkedIn destination is available.');
    error.statusCode = 400;
    throw error;
  }

  const applyUrl = `${String(env.frontendUrl).replace(/\/$/, '')}/jobs/${job.slug}`;
  const location = job.location && job.location !== 'Not specified' ? job.location : '';
  const commentary = `We're hiring: ${job.title}${location ? ` — ${location}` : ''}\nApply on Careeriz: ${applyUrl}`;

  const accessToken = decryptMeetingSecret(connection.encryptedAccessToken);
  const uploaded = await fetchJson('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', 'X-Restli-Protocol-Version': '2.0.0' },
    body: JSON.stringify({
      author: authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: commentary },
          shareMediaCategory: 'ARTICLE',
          media: [{ status: 'READY', originalUrl: applyUrl, title: { text: job.title }, description: { text: location || 'Apply on Careeriz' } }],
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    }),
  });
  await recordAuditLog({ organisationId: context.organisationId, actorUserId: actorUser.id, action: 'linkedin.post', entityType: 'Job', entityId: jobId, metadata: { authorUrn }, ...requestMeta });
  return { posted: true, postId: uploaded.id || null, applyUrl };
}
