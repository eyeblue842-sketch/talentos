import { prisma } from '../../config/db.js';
import { env } from '../../config/env.js';
import { encryptMeetingSecret, decryptMeetingSecret } from '../../meeting/meetingEncryptionService.js';
import { issueAuthToken } from '../authTokenService.js';
import { recordAuditLog } from '../auditLogService.js';
import { isPlatformSuperAdmin } from '../../middleware/platformAdmin.js';
import {
  PERSONAL_SCOPES,
  PUBLISH_SCOPE,
  buildAuthorizationUrl,
  exchangeAuthorizationCode,
  fetchMemberIdentity,
  isLinkedInConfigured,
  redactSecrets,
  revokeToken,
} from './linkedinApiClient.js';
import {
  enqueueJobDistribution,
  getPlatformSettings,
  serializeLinkedInPost,
  retryLinkedInPost,
} from './linkedinDistributionService.js';
import { getJobShareIneligibility } from './linkedinPostComposer.js';

// Platform-owned LinkedIn destinations. EVERY function here is reachable only
// through routes guarded by requirePlatformSuperAdmin(); none accepts an
// organisation id, and none is imported by any recruiter/org-scoped route.

// Setup references only. An e-mail never grants access or identifies a
// profile: the verified member URN returned by LinkedIn after the owner of
// that exact profile authorizes is the only identity we trust.
export const SETUP_EMAIL_SUGGESTIONS = ['vinu842@gmail.com', 'eyeblue842@gmail.com'];

const STATE_PURPOSE = 'PLATFORM_LINKEDIN_DESTINATION';
const CONNECTED = 'CONNECTED';

function httpError(statusCode, message, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) error.code = code;
  return error;
}

export function serializeDestination(destination) {
  const scopes = Array.isArray(destination.scopes) ? destination.scopes : [];
  const expiresAt = destination.accessTokenExpiresAt ? new Date(destination.accessTokenExpiresAt) : null;
  return {
    id: destination.id,
    label: destination.label,
    setupEmail: destination.setupEmail,
    status: destination.status,
    memberUrn: destination.memberUrn,
    memberName: destination.memberName,
    isPrimary: destination.isPrimary,
    enabled: destination.enabled,
    scopes,
    canPublish: destination.status === CONNECTED && scopes.includes(PUBLISH_SCOPE),
    accessTokenExpiresAt: expiresAt ? expiresAt.toISOString() : null,
    hasRefreshToken: Boolean(destination.encryptedRefreshToken),
    lastVerifiedAt: destination.lastVerifiedAt ? new Date(destination.lastVerifiedAt).toISOString() : null,
    lastErrorCategory: destination.lastErrorCategory,
    lastErrorMessage: destination.lastErrorMessage,
    createdAt: destination.createdAt ? new Date(destination.createdAt).toISOString() : null,
  };
}

async function audit(actorUser, action, entityType, entityId, metadata = {}, requestMeta = {}) {
  return recordAuditLog({ organisationId: null, actorUserId: actorUser?.id || null, action, entityType, entityId, metadata, ...requestMeta });
}

// -- Destinations ----------------------------------------------------------

export async function listDestinations() {
  const rows = await prisma.linkedInDestination.findMany({ orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] });
  return rows.map(serializeDestination);
}

export async function createDestination(actorUser, { label, setupEmail = null }, requestMeta = {}) {
  const cleanLabel = String(label || '').trim().slice(0, 80);
  if (!cleanLabel) throw httpError(400, 'A label is required.');
  const destination = await prisma.linkedInDestination.create({
    data: { label: cleanLabel, setupEmail: setupEmail ? String(setupEmail).trim().toLowerCase().slice(0, 200) : null, connectedByUserId: actorUser.id },
  });
  await audit(actorUser, 'linkedin.platform.destination.create', 'LinkedInDestination', destination.id, { label: cleanLabel }, requestMeta);
  return serializeDestination(destination);
}

async function requireDestination(id) {
  const destination = await prisma.linkedInDestination.findUnique({ where: { id } });
  if (!destination) throw httpError(404, 'LinkedIn destination not found.');
  return destination;
}

export async function updateDestination(actorUser, id, patch, requestMeta = {}) {
  const destination = await requireDestination(id);
  const data = {};
  if (typeof patch.label === 'string' && patch.label.trim()) data.label = patch.label.trim().slice(0, 80);
  if (typeof patch.enabled === 'boolean') data.enabled = patch.enabled;

  if (patch.isPrimary === true) {
    if (destination.status !== CONNECTED) throw httpError(409, 'Only a connected destination can be the primary profile.');
    await prisma.$transaction([
      prisma.linkedInDestination.updateMany({ where: { isPrimary: true, id: { not: id } }, data: { isPrimary: false } }),
      prisma.linkedInDestination.update({ where: { id }, data: { ...data, isPrimary: true } }),
    ]);
  } else {
    if (patch.isPrimary === false) data.isPrimary = false;
    await prisma.linkedInDestination.update({ where: { id }, data });
  }

  if (data.enabled === false) {
    await prisma.linkedInPost.updateMany({
      where: { destinationType: 'PLATFORM', destinationId: id, status: { in: ['QUEUED', 'RETRYING'] } },
      data: { status: 'CANCELLED', lastErrorMessage: 'Destination disabled by administrator.' },
    });
  }
  await audit(actorUser, 'linkedin.platform.destination.update', 'LinkedInDestination', id, { changes: Object.keys(patch) }, requestMeta);
  return serializeDestination(await requireDestination(id));
}

// -- OAuth -----------------------------------------------------------------

export async function beginDestinationOAuth(actorUser, id, requestMeta = {}) {
  if (!isLinkedInConfigured()) throw httpError(503, 'LinkedIn is not configured. Set LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET / LINKEDIN_OAUTH_REDIRECT_URI.', 'NOT_CONFIGURED');
  await requireDestination(id);
  const { token } = await issueAuthToken(actorUser.id, 'OAUTH_STATE', {
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    context: { provider: 'LINKEDIN', purpose: STATE_PURPOSE, destinationId: id, userId: actorUser.id },
    invalidateExisting: false,
  });
  await audit(actorUser, 'linkedin.platform.destination.connect_start', 'LinkedInDestination', id, {}, requestMeta);
  return { authorizationUrl: buildAuthorizationUrl({ state: token, scopes: PERSONAL_SCOPES }) };
}

export function isPlatformOAuthState(context) {
  return context?.purpose === STATE_PURPOSE;
}

// Completes authorization for the profile that just consented. The destination
// is bound to the verified LinkedIn member id; reconnecting with a DIFFERENT
// LinkedIn profile, or one already attached elsewhere, is refused.
export async function completeDestinationOAuth(code, stateToken) {
  const context = stateToken.context || {};
  // The consenting browser session belonged to the platform owner when state was issued.
  if (!isPlatformSuperAdmin(stateToken.user)) throw httpError(403, 'Platform administrator required.');
  const destination = await requireDestination(context.destinationId);

  const tokens = await exchangeAuthorizationCode(code);
  if (!tokens.grantedScopes.includes(PUBLISH_SCOPE)) {
    await prisma.linkedInDestination.update({
      where: { id: destination.id },
      data: { status: 'REVOKED', lastErrorCategory: 'PERMISSION_DENIED', lastErrorMessage: 'The w_member_social (Share on LinkedIn) permission was not granted.' },
    });
    throw httpError(400, 'LinkedIn did not grant the w_member_social permission.', 'PERMISSION_DENIED');
  }
  const identity = await fetchMemberIdentity(tokens.accessToken);

  if (destination.memberUrn && destination.memberUrn !== identity.memberUrn) {
    throw httpError(409, 'This destination is bound to a different LinkedIn profile. Create a new destination for another profile.', 'IDENTITY_MISMATCH');
  }
  const clash = await prisma.linkedInDestination.findUnique({ where: { memberUrn: identity.memberUrn } });
  if (clash && clash.id !== destination.id) {
    throw httpError(409, 'That LinkedIn profile is already connected as another destination.', 'DUPLICATE_PROFILE');
  }

  await prisma.linkedInDestination.update({
    where: { id: destination.id },
    data: {
      status: CONNECTED,
      memberUrn: identity.memberUrn,
      memberName: identity.memberName,
      encryptedAccessToken: encryptMeetingSecret(tokens.accessToken),
      encryptedRefreshToken: tokens.refreshToken ? encryptMeetingSecret(tokens.refreshToken) : null,
      accessTokenExpiresAt: tokens.expiresAt,
      refreshTokenExpiresAt: tokens.refreshExpiresAt,
      scopes: tokens.grantedScopes,
      lastVerifiedAt: new Date(),
      lastErrorCategory: null,
      lastErrorMessage: null,
      connectedByUserId: stateToken.userId || context.userId || null,
    },
  });
  await recordAuditLog({
    organisationId: null,
    actorUserId: context.userId || null,
    action: 'linkedin.platform.destination.connected',
    entityType: 'LinkedInDestination',
    entityId: destination.id,
    metadata: { memberUrn: identity.memberUrn, scopes: tokens.grantedScopes },
  });
  return { destinationId: destination.id };
}

export async function disconnectDestination(actorUser, id, requestMeta = {}) {
  const destination = await requireDestination(id);
  let revoked = false;
  if (destination.encryptedAccessToken) {
    try { revoked = await revokeToken(decryptMeetingSecret(destination.encryptedAccessToken)); } catch { revoked = false; }
  }
  await prisma.linkedInDestination.update({
    where: { id },
    data: {
      status: 'DISCONNECTED',
      isPrimary: false,
      encryptedAccessToken: null,
      encryptedRefreshToken: null,
      accessTokenExpiresAt: null,
      refreshTokenExpiresAt: null,
      scopes: null,
      lastErrorCategory: null,
      lastErrorMessage: null,
    },
  });
  await prisma.linkedInPost.updateMany({
    where: { destinationType: 'PLATFORM', destinationId: id, status: { in: ['QUEUED', 'RETRYING'] } },
    data: { status: 'CANCELLED', lastErrorMessage: 'Destination disconnected by administrator.' },
  });
  await audit(actorUser, 'linkedin.platform.destination.disconnect', 'LinkedInDestination', id, { tokenRevokedAtLinkedIn: revoked }, requestMeta);
  return { disconnected: true, tokenRevokedAtLinkedIn: revoked };
}

// -- Settings --------------------------------------------------------------

export async function updatePlatformSettings(actorUser, { autoDistribute }, requestMeta = {}) {
  if (typeof autoDistribute !== 'boolean') throw httpError(400, 'autoDistribute must be true or false.');
  if (autoDistribute) {
    if (!env.linkedinPublishingEnabled) {
      throw httpError(409, 'Automatic publishing is disabled on the server (LINKEDIN_PUBLISHING_ENABLED=false) until the LinkedIn app is verified.', 'PUBLISHING_DISABLED');
    }
    const ready = await prisma.linkedInDestination.count({ where: { enabled: true, status: CONNECTED, memberUrn: { not: null } } });
    if (!ready) throw httpError(409, 'Connect and enable at least one LinkedIn destination first.', 'NO_READY_DESTINATION');
  }
  const before = await getPlatformSettings();
  await prisma.linkedInPlatformSettings.upsert({
    where: { id: 'default' },
    create: { id: 'default', autoDistribute, updatedByUserId: actorUser.id },
    update: { autoDistribute, updatedByUserId: actorUser.id },
  });
  await recordAuditLog({
    organisationId: null, actorUserId: actorUser.id, action: 'linkedin.platform.settings.update',
    entityType: 'LinkedInPlatformSettings', entityId: 'default', beforeData: before, afterData: { autoDistribute }, ...requestMeta,
  });
  return { autoDistribute };
}

// -- Per-job controls ------------------------------------------------------

export async function setJobPlatformExclusion(actorUser, jobId, excluded, requestMeta = {}) {
  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { id: true, organisationId: true } });
  if (!job) throw httpError(404, 'Job not found.');
  await prisma.job.update({ where: { id: jobId }, data: { excludeFromPlatformLinkedIn: Boolean(excluded) } });
  let cancelled = 0;
  if (excluded) {
    const result = await prisma.linkedInPost.updateMany({
      where: { jobId, destinationType: 'PLATFORM', status: { in: ['QUEUED', 'RETRYING', 'NEEDS_ACTION'] } },
      data: { status: 'CANCELLED', lastErrorMessage: 'Job excluded from platform distribution.' },
    });
    cancelled = result.count;
  }
  await recordAuditLog({
    organisationId: job.organisationId, actorUserId: actorUser.id, action: excluded ? 'linkedin.platform.job.exclude' : 'linkedin.platform.job.include',
    entityType: 'Job', entityId: jobId, metadata: { cancelledPosts: cancelled }, ...requestMeta,
  });
  return { jobId, excluded: Boolean(excluded), cancelledPosts: cancelled };
}

// Manually distribute one already-published job through the platform
// destinations (ignores the auto-distribute switch, honours exclusion).
export async function distributeJobNow(actorUser, jobId, requestMeta = {}) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  const ineligible = getJobShareIneligibility(job);
  if (ineligible) throw httpError(409, ineligible);
  if (job.excludeFromPlatformLinkedIn) throw httpError(409, 'This job is excluded from platform distribution.');
  const summary = await enqueueJobDistribution(jobId, { actorUserId: actorUser.id, platformOnly: true, ignoreAutoSetting: true });
  await recordAuditLog({
    organisationId: job.organisationId, actorUserId: actorUser.id, action: 'linkedin.platform.job.distribute',
    entityType: 'Job', entityId: jobId, metadata: { destinations: summary.platform.length }, ...requestMeta,
  });
  return summary;
}

export function retryPlatformPost(actorUser, postId, requestMeta = {}) {
  return retryLinkedInPost(postId, { actorUserId: actorUser.id, scope: 'platform', requestMeta });
}

// -- Dashboard -------------------------------------------------------------

function eligibleJobWhere(now = new Date()) {
  return {
    status: 'OPEN',
    isPublic: true,
    visibility: { in: ['EXTERNAL', 'BOTH'] },
    excludeFromPlatformLinkedIn: false,
    AND: [
      { OR: [{ applicationClosesAt: null }, { applicationClosesAt: { gt: now } }] },
      { OR: [{ applicationOpensAt: null }, { applicationOpensAt: { lte: now } }] },
    ],
  };
}

export async function listShareableJobs({ search = '', take = 40 } = {}) {
  const jobs = await prisma.job.findMany({
    where: {
      status: 'OPEN',
      ...(search ? { title: { contains: String(search).slice(0, 80), mode: 'insensitive' } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(take, 100),
    select: {
      id: true, title: true, slug: true, excludeFromPlatformLinkedIn: true, organisation: { select: { name: true } },
      linkedInPosts: { where: { destinationType: 'PLATFORM' }, select: { id: true, status: true, destinationId: true } },
    },
  });
  return jobs.map((job) => ({
    id: job.id,
    title: job.title,
    slug: job.slug,
    company: job.organisation?.name || null,
    excluded: job.excludeFromPlatformLinkedIn,
    posts: job.linkedInPosts,
  }));
}

export async function getPlatformDashboard() {
  const [destinations, settings, eligibleJobs, statusGroups, recent, audits, excluded] = await Promise.all([
    listDestinations(),
    getPlatformSettings(),
    prisma.job.count({ where: eligibleJobWhere() }),
    prisma.linkedInPost.groupBy({ by: ['status'], where: { destinationType: 'PLATFORM' }, _count: { _all: true } }),
    prisma.linkedInPost.findMany({
      where: { destinationType: 'PLATFORM' },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: { job: { select: { id: true, title: true, slug: true } } },
    }),
    prisma.auditLog.findMany({
      where: { action: { startsWith: 'linkedin.' }, organisationId: null },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { id: true, action: true, entityType: true, entityId: true, actorUserId: true, metadata: true, createdAt: true },
    }),
    prisma.job.findMany({ where: { excludeFromPlatformLinkedIn: true }, select: { id: true, title: true }, take: 50 }),
  ]);

  const counts = Object.fromEntries(statusGroups.map((row) => [row.status, row._count._all]));
  const byDestination = new Map(destinations.map((d) => [d.id, d.label]));
  return {
    readiness: {
      configured: isLinkedInConfigured(),
      publishingEnabled: env.linkedinPublishingEnabled,
      apiVersion: env.linkedinApiVersion,
      requiredProducts: ['Share on LinkedIn (w_member_social)', 'Sign In with LinkedIn using OpenID Connect (openid, profile)'],
      verifiedAgainstLiveApi: false,
      setupEmailSuggestions: SETUP_EMAIL_SUGGESTIONS,
    },
    settings,
    destinations,
    totals: {
      eligibleJobs,
      queued: (counts.QUEUED || 0) + (counts.RETRYING || 0) + (counts.PUBLISHING || 0),
      published: counts.PUBLISHED || 0,
      failed: (counts.FAILED || 0) + (counts.NEEDS_ACTION || 0),
      cancelled: counts.CANCELLED || 0,
    },
    recentPosts: recent.map((post) => ({
      ...serializeLinkedInPost(post),
      job: post.job,
      destinationLabel: byDestination.get(post.destinationId) || 'Removed destination',
    })),
    excludedJobs: excluded,
    auditLog: audits.map((entry) => ({ ...entry, createdAt: entry.createdAt.toISOString() })),
  };
}

export { redactSecrets };
