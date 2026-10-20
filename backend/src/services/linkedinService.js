import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { requireOrganisationRole, requireOrganisationContext } from './organisationAccessService.js';
import { issueAuthToken, consumeAuthToken } from './authTokenService.js';
import { encryptMeetingSecret, decryptMeetingSecret } from '../meeting/meetingEncryptionService.js';
import { recordAuditLog } from './auditLogService.js';
import {
  PERSONAL_SCOPES,
  PAGE_SCOPES,
  PUBLISH_SCOPE,
  buildAuthorizationUrl,
  exchangeAuthorizationCode,
  fetchMemberIdentity,
  isLinkedInConfigured as clientIsConfigured,
  createArticlePost,
  revokeToken,
  LinkedInApiError,
} from './linkedin/linkedinApiClient.js';
import {
  enqueueJobDistribution,
  enqueueOptedInJobsForOrganisation,
  retryLinkedInPost,
  serializeLinkedInPost,
} from './linkedin/linkedinDistributionService.js';
import { completeDestinationOAuth, isPlatformOAuthState } from './linkedin/linkedinPlatformService.js';
import { composeJobPost, getJobShareIneligibility } from './linkedin/linkedinPostComposer.js';

// Recruiter-side (organisation-scoped) LinkedIn connection and sharing.
// Platform-owned profiles live in linkedin/linkedinPlatformService.js and are
// never reachable from here.

const PROVIDER = 'LINKEDIN';
const writableRoles = ['OWNER', 'ADMIN', 'RECRUITER'];

// Personal publishing needs only openid/profile/w_member_social ("Share on
// LinkedIn" + "Sign In with LinkedIn using OpenID Connect"). Company-Page scopes
// belong to the gated Community Management API; requesting them from an app
// that lacks that product makes LinkedIn reject the WHOLE authorization, so they
// are requested only when LINKEDIN_ENABLE_PAGE_SCOPES=true.
function requestedScopes() {
  return env.linkedinEnablePageScopes ? [...PERSONAL_SCOPES, ...PAGE_SCOPES] : PERSONAL_SCOPES;
}

export function isLinkedInConfigured() {
  return clientIsConfigured();
}

function assertConfigured() {
  if (!isLinkedInConfigured()) {
    const error = new Error('LinkedIn is not configured. Set LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET / LINKEDIN_OAUTH_REDIRECT_URI.');
    error.statusCode = 503;
    throw error;
  }
}

// Step 1 - build the consent URL (state token = CSRF + carries org/user).
export async function beginLinkedInOAuth(actorUser, organisationId = null) {
  assertConfigured();
  const context = await requireOrganisationRole(actorUser, writableRoles, organisationId);
  const { token: stateToken } = await issueAuthToken(actorUser.id, 'OAUTH_STATE', {
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    context: { provider: PROVIDER, organisationId: context.organisationId, userId: actorUser.id },
    invalidateExisting: false,
  });
  return { authorizationUrl: buildAuthorizationUrl({ state: stateToken, scopes: requestedScopes() }) };
}

async function fetchAdminPages(accessToken) {
  const organizations = [];
  try {
    const response = await fetch('https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&projection=(elements*(organization~(localizedName)))', {
      headers: { Authorization: `Bearer ${accessToken}`, 'X-Restli-Protocol-Version': '2.0.0' },
    });
    if (!response.ok) return organizations;
    const acls = await response.json();
    for (const el of acls.elements || []) {
      if (el.organization) organizations.push({ urn: el.organization, name: el['organization~']?.localizedName || 'Company Page' });
    }
  } catch { /* no Page admin access granted */ }
  return organizations;
}

// Step 2 - exchange the code, verify the member identity, store encrypted.
// Returns { platform: true } for platform-owner destination flows so the
// controller can redirect to the right console.
export async function handleLinkedInOAuthCallback(code, stateValue) {
  assertConfigured();
  const stateToken = await consumeAuthToken(stateValue, 'OAUTH_STATE', { includeUser: true });
  const state = stateToken.context || {};
  if (state.provider !== PROVIDER) {
    const error = new Error('Invalid LinkedIn OAuth state.');
    error.statusCode = 400;
    throw error;
  }
  if (isPlatformOAuthState(state)) {
    await completeDestinationOAuth(code, stateToken);
    return { platform: true };
  }
  if (!state.organisationId) {
    const error = new Error('Invalid LinkedIn OAuth state.');
    error.statusCode = 400;
    throw error;
  }

  const tokens = await exchangeAuthorizationCode(code);
  const grantedScopes = tokens.grantedScopes.length ? tokens.grantedScopes : requestedScopes();
  // A verified member id is mandatory: without it nothing can be posted.
  const identity = await fetchMemberIdentity(tokens.accessToken);
  const organizations = grantedScopes.includes('r_organization_admin') ? await fetchAdminPages(tokens.accessToken) : [];

  const data = {
    status: 'CONNECTED',
    connectedAccountId: identity.memberUrn,
    connectedName: identity.memberName || 'LinkedIn account',
    encryptedAccessToken: encryptMeetingSecret(tokens.accessToken),
    accessTokenExpiresAt: tokens.expiresAt,
    scopes: grantedScopes,
    metadata: { memberUrn: identity.memberUrn, memberName: identity.memberName, organizations },
    connectedByUserId: state.userId,
  };
  const connection = await prisma.socialConnection.upsert({
    where: { organisationId_provider: { organisationId: state.organisationId, provider: PROVIDER } },
    create: { organisationId: state.organisationId, provider: PROVIDER, ...data },
    update: data,
  });
  await recordAuditLog({ organisationId: state.organisationId, actorUserId: state.userId, action: 'linkedin.connect', entityType: 'SocialConnection', entityId: connection.id, metadata: { memberUrn: identity.memberUrn, scopes: grantedScopes } });
  // Recently published jobs whose recruiter opted in before connecting.
  await enqueueOptedInJobsForOrganisation(state.organisationId).catch(() => {});
  return { organisationId: state.organisationId };
}

function serializeStatus(connection) {
  const configured = isLinkedInConfigured();
  if (!connection) return { connected: false, configured, status: 'NOT_CONNECTED', destinations: [] };
  if (connection.status !== 'CONNECTED') {
    return { connected: false, configured, status: connection.status, needsReconnect: true, destinations: [] };
  }
  const meta = connection.metadata || {};
  const destinations = [];
  if (meta.memberUrn) destinations.push({ urn: meta.memberUrn, name: `${meta.memberName || 'My profile'} (personal)`, type: 'PERSON' });
  for (const o of meta.organizations || []) destinations.push({ urn: o.urn, name: `${o.name} (Page)`, type: 'ORGANIZATION' });
  const expiresAt = connection.accessTokenExpiresAt ? new Date(connection.accessTokenExpiresAt) : null;
  const expired = Boolean(expiresAt && expiresAt <= new Date());
  return {
    connected: !expired,
    configured,
    status: expired ? 'EXPIRED' : 'CONNECTED',
    needsReconnect: expired,
    connectedName: connection.connectedName,
    memberUrn: meta.memberUrn || null,
    canPublish: !expired && Array.isArray(connection.scopes) && connection.scopes.includes(PUBLISH_SCOPE),
    accessTokenExpiresAt: expiresAt ? expiresAt.toISOString() : null,
    destinations,
  };
}

export async function getLinkedInStatus(actorUser, organisationId = null) {
  const context = await requireOrganisationContext(actorUser, organisationId);
  const connection = await prisma.socialConnection.findUnique({ where: { organisationId_provider: { organisationId: context.organisationId, provider: PROVIDER } } });
  return serializeStatus(connection);
}

export async function disconnectLinkedIn(actorUser, organisationId = null) {
  const context = await requireOrganisationRole(actorUser, writableRoles, organisationId);
  const connection = await prisma.socialConnection.findUnique({ where: { organisationId_provider: { organisationId: context.organisationId, provider: PROVIDER } } });
  let revoked = false;
  if (connection?.encryptedAccessToken) {
    try { revoked = await revokeToken(decryptMeetingSecret(connection.encryptedAccessToken)); } catch { revoked = false; }
  }
  if (connection) {
    await prisma.linkedInPost.updateMany({
      where: { destinationType: 'RECRUITER', destinationId: connection.id, status: { in: ['QUEUED', 'RETRYING'] } },
      data: { status: 'CANCELLED', lastErrorMessage: 'LinkedIn account disconnected.' },
    });
  }
  await prisma.socialConnection.deleteMany({ where: { organisationId: context.organisationId, provider: PROVIDER } });
  await recordAuditLog({ organisationId: context.organisationId, actorUserId: actorUser.id, action: 'linkedin.disconnect', entityType: 'SocialConnection', entityId: context.organisationId, metadata: { tokenRevokedAtLinkedIn: revoked } });
  return { disconnected: true, tokenRevokedAtLinkedIn: revoked };
}

async function loadOrgJob(context, jobId) {
  const job = await prisma.job.findFirst({ where: { id: jobId, organisationId: context.organisationId }, include: { organisation: { select: { name: true } } } });
  if (!job) {
    const error = new Error('Job not found.');
    error.statusCode = 404;
    throw error;
  }
  return job;
}

// Recruiter "share now" from the job page. Personal-profile shares go through
// the durable, idempotent queue; a Company Page author (only possible when
// Page scopes are enabled) is posted synchronously, as before.
export async function postJobToLinkedIn(actorUser, jobId, payload = {}, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationRole(actorUser, writableRoles, organisationId);
  const connection = await prisma.socialConnection.findUnique({ where: { organisationId_provider: { organisationId: context.organisationId, provider: PROVIDER } } });
  if (!connection?.encryptedAccessToken || connection.status !== 'CONNECTED') {
    const error = new Error('Connect LinkedIn before posting.');
    error.statusCode = 400;
    throw error;
  }
  const job = await loadOrgJob(context, jobId);
  const ineligible = getJobShareIneligibility(job);
  if (ineligible) {
    const error = new Error(ineligible);
    error.statusCode = 409;
    throw error;
  }
  const meta = connection.metadata || {};
  const pageUrns = new Set((meta.organizations || []).map((o) => o.urn));
  const authorUrn = payload.authorUrn && (payload.authorUrn === meta.memberUrn || pageUrns.has(payload.authorUrn)) ? payload.authorUrn : meta.memberUrn;
  if (!authorUrn) {
    const error = new Error('No valid LinkedIn destination is available.');
    error.statusCode = 400;
    throw error;
  }

  if (pageUrns.has(authorUrn)) {
    const composed = composeJobPost(job, { destinationType: 'RECRUITER', companyName: job.organisation?.name });
    try {
      const result = await createArticlePost({ accessToken: decryptMeetingSecret(connection.encryptedAccessToken), authorUrn, commentary: composed.commentary, url: composed.url, title: composed.title, description: composed.cardDescription });
      await recordAuditLog({ organisationId: context.organisationId, actorUserId: actorUser.id, action: 'linkedin.post', entityType: 'Job', entityId: jobId, metadata: { authorUrn }, ...requestMeta });
      return { posted: true, postId: result.postUrn, applyUrl: composed.url };
    } catch (error) {
      if (error instanceof LinkedInApiError) error.statusCode = error.statusCode && error.statusCode < 500 ? 400 : 502;
      throw error;
    }
  }

  if (!job.shareOnLinkedIn) await prisma.job.update({ where: { id: jobId }, data: { shareOnLinkedIn: true } });
  const summary = await enqueueJobDistribution(jobId, { actorUserId: actorUser.id });
  await recordAuditLog({ organisationId: context.organisationId, actorUserId: actorUser.id, action: 'linkedin.post.request', entityType: 'Job', entityId: jobId, metadata: { authorUrn }, ...requestMeta });
  return { posted: false, queued: true, status: summary.recruiter };
}

// LinkedIn publication state for one job (recruiter view: RECRUITER posts only).
export async function getJobLinkedInStatus(actorUser, jobId, organisationId = null) {
  const context = await requireOrganisationContext(actorUser, organisationId);
  const job = await loadOrgJob(context, jobId);
  const [connection, posts] = await Promise.all([
    prisma.socialConnection.findUnique({ where: { organisationId_provider: { organisationId: context.organisationId, provider: PROVIDER } } }),
    prisma.linkedInPost.findMany({ where: { jobId, organisationId: context.organisationId, destinationType: 'RECRUITER' }, orderBy: { createdAt: 'desc' } }),
  ]);
  return {
    shareOnLinkedIn: job.shareOnLinkedIn,
    connection: serializeStatus(connection),
    posts: posts.map(serializeLinkedInPost),
    ineligibleReason: getJobShareIneligibility(job),
  };
}

export async function retryRecruiterLinkedInPost(actorUser, postId, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationRole(actorUser, writableRoles, organisationId);
  return retryLinkedInPost(postId, { actorUserId: actorUser.id, organisationId: context.organisationId, scope: 'recruiter', requestMeta });
}
