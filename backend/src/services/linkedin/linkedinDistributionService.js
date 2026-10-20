import { prisma } from '../../config/db.js';
import { env } from '../../config/env.js';
import { encryptMeetingSecret, decryptMeetingSecret } from '../../meeting/meetingEncryptionService.js';
import { enqueueBackgroundTask } from '../backgroundTaskService.js';
import { recordAuditLog } from '../auditLogService.js';
import {
  LinkedInApiError,
  ERROR_CATEGORIES,
  PUBLISH_SCOPE,
  createArticlePost,
  refreshAccessToken,
  redactSecrets,
} from './linkedinApiClient.js';
import { composeJobPost, generateTrackingRef, getJobShareIneligibility, getPublicUrlProblem } from './linkedinPostComposer.js';

// Durable LinkedIn publishing pipeline.
//
//   job published -> enqueueJobDistribution() -> LinkedInPost row (unique per
//   job+destination) + LINKEDIN_POST BackgroundTask -> worker ->
//   processLinkedInPostTask() -> LinkedIn Posts API.
//
// Delivery guarantee: AT-MOST-ONE row per (job, destination) and a conditional
// claim (QUEUED|RETRYING -> PUBLISHING) so concurrent workers cannot both call
// LinkedIn for the same row. LinkedIn's API offers no idempotency key, so if a
// worker dies AFTER LinkedIn accepted the post but BEFORE we saved the result,
// the outcome is unknowable: such a row is parked as NEEDS_ACTION
// (UNKNOWN_OUTCOME) for a human to check instead of being auto-retried. This is
// deliberately NOT an exactly-once claim.

export const MAX_ATTEMPTS = 5;
const STALE_PUBLISHING_MS = 10 * 60 * 1000;
const OPT_IN_BACKFILL_DAYS = 7;

export function linkedInBackoffMs(attempt) {
  const base = 60_000;
  return Math.min(30 * 60_000, base * (2 ** Math.max(0, attempt - 1)));
}

// ---------------------------------------------------------------------------
// Destinations
// ---------------------------------------------------------------------------

async function loadDestination(post) {
  if (post.destinationType === 'PLATFORM') {
    const record = await prisma.linkedInDestination.findUnique({ where: { id: post.destinationId } });
    if (!record) throw new LinkedInApiError('NOT_CONNECTED', 'The LinkedIn destination no longer exists.');
    if (!record.enabled) throw new LinkedInApiError('NOT_CONNECTED', 'This LinkedIn destination is disabled.');
    return {
      type: 'PLATFORM',
      id: record.id,
      status: record.status,
      authorUrn: record.memberUrn,
      scopes: record.scopes,
      encryptedAccessToken: record.encryptedAccessToken,
      encryptedRefreshToken: record.encryptedRefreshToken,
      accessTokenExpiresAt: record.accessTokenExpiresAt,
      refreshTokenExpiresAt: record.refreshTokenExpiresAt,
      async saveTokens(tokens) {
        await prisma.linkedInDestination.update({ where: { id: record.id }, data: tokens });
      },
      async markStatus(status, category, message) {
        await prisma.linkedInDestination.update({
          where: { id: record.id },
          data: { status, lastErrorCategory: category, lastErrorMessage: message },
        });
      },
    };
  }
  const record = await prisma.socialConnection.findUnique({ where: { id: post.destinationId } });
  if (!record) throw new LinkedInApiError('NOT_CONNECTED', 'The LinkedIn connection no longer exists.');
  return {
    type: 'RECRUITER',
    id: record.id,
    status: record.status,
    authorUrn: record.metadata?.memberUrn || record.connectedAccountId || null,
    scopes: record.scopes,
    encryptedAccessToken: record.encryptedAccessToken,
    encryptedRefreshToken: null,
    accessTokenExpiresAt: record.accessTokenExpiresAt,
    refreshTokenExpiresAt: null,
    async saveTokens(tokens) {
      await prisma.socialConnection.update({ where: { id: record.id }, data: tokens });
    },
    async markStatus(status) {
      await prisma.socialConnection.update({ where: { id: record.id }, data: { status } });
    },
  };
}

// Validates connection status, granted scope and token lifetime; refreshes the
// token when LinkedIn issued a refresh token. Throws a categorised error.
export async function getUsableAccessToken(destination, now = new Date()) {
  if (destination.status !== 'CONNECTED' || !destination.encryptedAccessToken) {
    throw new LinkedInApiError(destination.status === 'EXPIRED' ? 'AUTH_EXPIRED' : 'NOT_CONNECTED', 'The LinkedIn account is not connected. Reconnect it to continue.');
  }
  if (Array.isArray(destination.scopes) && !destination.scopes.includes(PUBLISH_SCOPE)) {
    throw new LinkedInApiError('PERMISSION_DENIED', 'The LinkedIn authorization does not include w_member_social (Share on LinkedIn).');
  }
  if (!destination.authorUrn) {
    throw new LinkedInApiError('NOT_CONNECTED', 'No verified LinkedIn member identity is stored for this account.');
  }
  const expiresAt = destination.accessTokenExpiresAt ? new Date(destination.accessTokenExpiresAt) : null;
  if (!expiresAt || expiresAt.getTime() - 60_000 > now.getTime()) {
    return decryptMeetingSecret(destination.encryptedAccessToken);
  }
  const refreshAlive = destination.encryptedRefreshToken
    && (!destination.refreshTokenExpiresAt || new Date(destination.refreshTokenExpiresAt) > now);
  if (!refreshAlive) {
    await destination.markStatus('EXPIRED', 'AUTH_EXPIRED', 'Access token expired.');
    throw new LinkedInApiError('AUTH_EXPIRED', 'The LinkedIn access token expired. Reconnect the account.');
  }
  try {
    const refreshed = await refreshAccessToken(decryptMeetingSecret(destination.encryptedRefreshToken));
    const update = {
      encryptedAccessToken: encryptMeetingSecret(refreshed.accessToken),
      accessTokenExpiresAt: refreshed.expiresAt,
    };
    if (destination.type === 'PLATFORM' && refreshed.refreshToken) {
      update.encryptedRefreshToken = encryptMeetingSecret(refreshed.refreshToken);
      update.refreshTokenExpiresAt = refreshed.refreshExpiresAt;
    }
    await destination.saveTokens(update);
    return refreshed.accessToken;
  } catch (error) {
    if (error instanceof LinkedInApiError && !error.retryable) {
      await destination.markStatus('EXPIRED', 'AUTH_EXPIRED', 'Token refresh was rejected.');
      throw new LinkedInApiError('AUTH_EXPIRED', 'LinkedIn rejected the token refresh. Reconnect the account.');
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Enqueue
// ---------------------------------------------------------------------------

export async function getPlatformSettings() {
  const row = await prisma.linkedInPlatformSettings.findUnique({ where: { id: 'default' } });
  return { autoDistribute: Boolean(row?.autoDistribute) };
}

async function createTask(post, suffix = '') {
  return enqueueBackgroundTask({
    organisationId: post.organisationId || null,
    type: 'LINKEDIN_POST',
    entityType: 'LinkedInPost',
    entityId: post.id,
    idempotencyKey: `linkedin-post:${post.id}${suffix}`,
    payload: { postId: post.id },
    maxAttempts: 3,
    nextAttemptAt: new Date(),
  });
}

// Creates (or finds) the unique row for this job+destination and queues work.
async function ensurePostRow({ job, companyName, destinationType, destinationId, authorUrn, requestedByUserId }) {
  const existing = await prisma.linkedInPost.findUnique({
    where: { jobId_destinationType_destinationId: { jobId: job.id, destinationType, destinationId } },
  });
  if (existing) return { post: existing, created: false };

  // The same LinkedIn member may be both a recruiter connection and a platform
  // profile (e.g. the owner). One member must not get two posts for one job.
  if (authorUrn) {
    const sameMember = await prisma.linkedInPost.findFirst({
      where: { jobId: job.id, authorUrn, status: { not: 'CANCELLED' } },
    });
    if (sameMember) return { post: sameMember, created: false };
  }

  const trackingRef = generateTrackingRef();
  const composed = composeJobPost(job, { destinationType, trackingRef, companyName });
  const disabled = !env.linkedinPublishingEnabled;
  try {
    const post = await prisma.linkedInPost.create({
      data: {
        jobId: job.id,
        organisationId: job.organisationId || null,
        destinationType,
        destinationId,
        authorUrn,
        commentary: composed.commentary,
        trackingRef,
        status: disabled ? 'NEEDS_ACTION' : 'QUEUED',
        lastErrorCategory: disabled ? 'PUBLISHING_DISABLED' : null,
        lastErrorMessage: disabled ? ERROR_CATEGORIES.PUBLISHING_DISABLED.action : null,
        requestedByUserId: requestedByUserId || null,
      },
    });
    return { post, created: true };
  } catch (error) {
    if (error?.code !== 'P2002') throw error;
    // Lost a race with a concurrent enqueue: the other row wins.
    const raced = await prisma.linkedInPost.findUnique({
      where: { jobId_destinationType_destinationId: { jobId: job.id, destinationType, destinationId } },
    });
    return { post: raced, created: false };
  }
}

/**
 * Called AFTER a job transitions to OPEN (the publish transaction has already
 * committed). Never throws: LinkedIn problems must not affect the Careeriz job.
 * Returns a summary of what was queued/skipped.
 */
export async function enqueueJobDistribution(jobId, { actorUserId = null, platformOnly = false, ignoreAutoSetting = false } = {}) {
  const summary = { recruiter: 'NOT_REQUESTED', platform: [], skipped: null };
  try {
    const job = await prisma.job.findUnique({ where: { id: jobId }, include: { organisation: { select: { name: true } } } });
    const ineligible = getJobShareIneligibility(job);
    if (ineligible) {
      summary.skipped = ineligible;
      return summary;
    }
    const companyName = job.organisation?.name || null;

    if (!platformOnly && job.shareOnLinkedIn && job.organisationId) {
      const connection = await prisma.socialConnection.findUnique({
        where: { organisationId_provider: { organisationId: job.organisationId, provider: 'LINKEDIN' } },
      });
      if (!connection || connection.status !== 'CONNECTED') {
        summary.recruiter = 'NOT_CONNECTED';
      } else {
        const { post, created } = await ensurePostRow({
          job, companyName, destinationType: 'RECRUITER', destinationId: connection.id,
          authorUrn: connection.metadata?.memberUrn || connection.connectedAccountId || null,
          requestedByUserId: actorUserId,
        });
        if (created && post.status === 'QUEUED') await createTask(post);
        summary.recruiter = post.status;
      }
    }

    if (!job.excludeFromPlatformLinkedIn) {
      const settings = await getPlatformSettings();
      if (settings.autoDistribute || ignoreAutoSetting) {
        const destinations = await prisma.linkedInDestination.findMany({
          where: { enabled: true, status: 'CONNECTED', memberUrn: { not: null } },
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        });
        for (const destination of destinations) {
          const { post, created } = await ensurePostRow({
            job, companyName, destinationType: 'PLATFORM', destinationId: destination.id,
            authorUrn: destination.memberUrn, requestedByUserId: actorUserId,
          });
          if (created && post.status === 'QUEUED') await createTask(post);
          summary.platform.push({ destinationId: destination.id, status: post.status });
        }
      }
    }
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', event: 'linkedin.enqueue.error', jobId, message: redactSecrets(error?.message) }));
    summary.error = 'ENQUEUE_FAILED';
  }
  return summary;
}

// When a recruiter connects LinkedIn after opting a (recently published) job in.
export async function enqueueOptedInJobsForOrganisation(organisationId) {
  const since = new Date(Date.now() - OPT_IN_BACKFILL_DAYS * 24 * 60 * 60 * 1000);
  const jobs = await prisma.job.findMany({
    where: { organisationId, shareOnLinkedIn: true, status: 'OPEN', activatedAt: { gte: since } },
    select: { id: true },
    take: 25,
  });
  for (const job of jobs) await enqueueJobDistribution(job.id);
  return jobs.length;
}

// ---------------------------------------------------------------------------
// Worker handler
// ---------------------------------------------------------------------------

function safeMessage(error) {
  return redactSecrets(error?.message || 'Unknown LinkedIn error.');
}

async function finishFailure(post, error, destination) {
  const category = error instanceof LinkedInApiError ? error.category : 'TRANSIENT';
  const retryable = error instanceof LinkedInApiError ? error.retryable : true;
  const attempts = post.attemptCount;
  const message = safeMessage(error);

  if (category === 'AUTH_EXPIRED' && destination) await destination.markStatus('EXPIRED', category, message).catch(() => {});
  if (category === 'PERMISSION_DENIED' && destination) await destination.markStatus('REVOKED', category, message).catch(() => {});

  if (retryable && attempts < MAX_ATTEMPTS) {
    const delay = Math.max(linkedInBackoffMs(attempts), error.retryAfterMs || 0);
    const nextAttemptAt = new Date(Date.now() + delay);
    await prisma.linkedInPost.update({
      where: { id: post.id },
      data: { status: 'RETRYING', lastErrorCategory: category, lastErrorMessage: message, nextAttemptAt, claimedAt: null },
    });
    const task = await enqueueBackgroundTask({
      organisationId: post.organisationId || null,
      type: 'LINKEDIN_POST',
      entityType: 'LinkedInPost',
      entityId: post.id,
      idempotencyKey: `linkedin-post:${post.id}:attempt-${attempts + 1}`,
      payload: { postId: post.id },
      maxAttempts: 3,
      nextAttemptAt,
    });
    await prisma.linkedInPost.update({ where: { id: post.id }, data: { backgroundTaskId: task?.id || null } });
    return 'RETRYING';
  }

  // Needs a human: auth/permission/config problems, exhausted retries or rejected content.
  const needsAction = ['AUTH_EXPIRED', 'PERMISSION_DENIED', 'NOT_CONNECTED', 'NOT_CONFIGURED', 'PUBLISHING_DISABLED', 'UNKNOWN_OUTCOME'].includes(category);
  await prisma.linkedInPost.update({
    where: { id: post.id },
    data: {
      status: needsAction ? 'NEEDS_ACTION' : 'FAILED',
      lastErrorCategory: category,
      lastErrorMessage: retryable ? `${message} (retries exhausted)` : message,
      nextAttemptAt: null,
      claimedAt: null,
    },
  });
  return needsAction ? 'NEEDS_ACTION' : 'FAILED';
}

async function persistPublished(postId, result) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await prisma.linkedInPost.update({
        where: { id: postId },
        data: {
          status: 'PUBLISHED',
          linkedinPostId: result.postUrn,
          postUrl: result.postUrl,
          publishedAt: new Date(),
          lastErrorCategory: null,
          lastErrorMessage: null,
          nextAttemptAt: null,
          claimedAt: null,
        },
      });
      return true;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
    }
  }
  return false;
}

export async function processLinkedInPostTask(task) {
  const postId = task.payload?.postId || task.entityId;
  const post = postId ? await prisma.linkedInPost.findUnique({ where: { id: postId } }) : null;
  if (!post) return 'cancelled';
  if (post.status === 'PUBLISHED' || post.status === 'CANCELLED') return 'success';

  if (post.status === 'PUBLISHING') {
    // Another worker holds the row. If its claim is stale it died mid-flight:
    // we cannot know whether LinkedIn accepted the post, so park for a human.
    const claimedAt = post.claimedAt ? new Date(post.claimedAt).getTime() : 0;
    if (Date.now() - claimedAt > STALE_PUBLISHING_MS) {
      await prisma.linkedInPost.updateMany({
        where: { id: post.id, status: 'PUBLISHING', claimedAt: post.claimedAt },
        data: {
          status: 'NEEDS_ACTION',
          lastErrorCategory: 'UNKNOWN_OUTCOME',
          lastErrorMessage: ERROR_CATEGORIES.UNKNOWN_OUTCOME.action,
        },
      });
    }
    return 'success';
  }
  if (!['QUEUED', 'RETRYING'].includes(post.status)) return 'success';
  if (post.nextAttemptAt && new Date(post.nextAttemptAt) > new Date()) return 'success';

  if (!env.linkedinPublishingEnabled) {
    await prisma.linkedInPost.update({
      where: { id: post.id },
      data: { status: 'NEEDS_ACTION', lastErrorCategory: 'PUBLISHING_DISABLED', lastErrorMessage: ERROR_CATEGORIES.PUBLISHING_DISABLED.action },
    });
    return 'success';
  }

  const job = await prisma.job.findUnique({ where: { id: post.jobId }, include: { organisation: { select: { name: true } } } });
  const ineligible = getJobShareIneligibility(job);
  const excluded = post.destinationType === 'PLATFORM' && job?.excludeFromPlatformLinkedIn;
  if (ineligible || excluded) {
    await prisma.linkedInPost.update({
      where: { id: post.id },
      data: { status: 'CANCELLED', lastErrorCategory: null, lastErrorMessage: excluded ? 'Job excluded from platform distribution.' : ineligible },
    });
    return 'success';
  }

  // Atomic claim: only one worker can move the row into PUBLISHING.
  const claimed = await prisma.linkedInPost.updateMany({
    where: { id: post.id, status: { in: ['QUEUED', 'RETRYING'] } },
    data: { status: 'PUBLISHING', claimedAt: new Date(), attemptCount: { increment: 1 } },
  });
  if (claimed.count !== 1) return 'success';
  const current = await prisma.linkedInPost.findUnique({ where: { id: post.id } });

  let destination = null;
  try {
    destination = await loadDestination(current);
    const accessToken = await getUsableAccessToken(destination);
    const composed = composeJobPost(job, {
      destinationType: current.destinationType,
      trackingRef: current.trackingRef,
      companyName: job.organisation?.name || null,
    });
    const urlProblem = getPublicUrlProblem(composed.url);
    if (urlProblem) throw new LinkedInApiError('INVALID_REQUEST', urlProblem);
    // The stored commentary is the reviewed/approved text; the card metadata is derived.
    let result;
    try {
      result = await createArticlePost({
        accessToken,
        authorUrn: destination.authorUrn,
        commentary: current.commentary,
        url: composed.url,
        title: composed.title,
        description: composed.cardDescription,
      });
    } catch (error) {
      // Anything that is not a classified LinkedIn error happened after the
      // request may have been sent: never treat it as safely retryable.
      throw error instanceof LinkedInApiError
        ? error
        : new LinkedInApiError('UNKNOWN_OUTCOME', 'Unexpected error while creating the post; it may or may not have been created.');
    }
    // LinkedIn has accepted the post. From here on NOTHING may trigger a re-post:
    // persistence is retried, and if it still fails the row stays PUBLISHING
    // (the sweeper parks it as UNKNOWN_OUTCOME) instead of going to RETRYING.
    const persisted = await persistPublished(post.id, result);
    if (!persisted) {
      console.error(JSON.stringify({
        level: 'error',
        event: 'linkedin.post.persist_failed_after_publish',
        postId: post.id,
        linkedinPostId: result.postUrn,
      }));
      return 'success';
    }
    await recordAuditLog({
      organisationId: post.organisationId,
      actorUserId: null,
      action: 'linkedin.post.published',
      entityType: 'LinkedInPost',
      entityId: post.id,
      metadata: { jobId: post.jobId, destinationType: post.destinationType, destinationId: post.destinationId, attempt: current.attemptCount },
    }).catch(() => {});
    return 'success';
  } catch (error) {
    await finishFailure(current, error, destination);
    console.error(JSON.stringify({
      level: 'warn',
      event: 'linkedin.post.failed',
      postId: post.id,
      category: error?.category || 'TRANSIENT',
      message: safeMessage(error),
    }));
    return 'success'; // the row owns retry state; the task itself completed
  }
}

// Scheduler sweep: re-queues rows that lost their task (crash between row
// creation and enqueue) and parks stale PUBLISHING claims.
export async function sweepLinkedInPosts() {
  const now = new Date();
  const orphaned = await prisma.linkedInPost.findMany({
    where: {
      status: { in: ['QUEUED', 'RETRYING'] },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      updatedAt: { lt: new Date(now.getTime() - 2 * 60 * 1000) },
    },
    take: 25,
  });
  for (const post of orphaned) await createTask(post, `:sweep-${post.attemptCount}`);

  const stale = await prisma.linkedInPost.updateMany({
    where: { status: 'PUBLISHING', claimedAt: { lt: new Date(now.getTime() - STALE_PUBLISHING_MS) } },
    data: { status: 'NEEDS_ACTION', lastErrorCategory: 'UNKNOWN_OUTCOME', lastErrorMessage: ERROR_CATEGORIES.UNKNOWN_OUTCOME.action },
  });
  return { requeued: orphaned.length, parked: stale.count };
}

// ---------------------------------------------------------------------------
// Manual retry (shared by recruiter + platform admin; callers authorise first)
// ---------------------------------------------------------------------------

export async function retryLinkedInPost(postId, { actorUserId, organisationId = null, scope = 'recruiter', requestMeta = {} }) {
  const post = await prisma.linkedInPost.findUnique({ where: { id: postId } });
  const expectedType = scope === 'platform' ? 'PLATFORM' : 'RECRUITER';
  // Org users can only ever reach their own RECRUITER posts.
  if (!post || post.destinationType !== expectedType || (scope === 'recruiter' && post.organisationId !== organisationId)) {
    const error = new Error('LinkedIn post not found.');
    error.statusCode = 404;
    throw error;
  }
  if (!['FAILED', 'NEEDS_ACTION', 'RETRYING', 'CANCELLED'].includes(post.status)) {
    const error = new Error(`A post in status ${post.status} cannot be retried.`);
    error.statusCode = 409;
    throw error;
  }
  const job = await prisma.job.findUnique({ where: { id: post.jobId } });
  const ineligible = getJobShareIneligibility(job);
  if (ineligible) {
    const error = new Error(ineligible);
    error.statusCode = 409;
    throw error;
  }
  if (post.destinationType === 'PLATFORM' && job.excludeFromPlatformLinkedIn) {
    const error = new Error('This job is excluded from platform distribution.');
    error.statusCode = 409;
    throw error;
  }
  const updated = await prisma.linkedInPost.updateMany({
    where: { id: post.id, status: { in: ['FAILED', 'NEEDS_ACTION', 'RETRYING', 'CANCELLED'] } },
    data: { status: 'QUEUED', attemptCount: 0, nextAttemptAt: null, lastErrorCategory: null, lastErrorMessage: null, claimedAt: null },
  });
  if (updated.count !== 1) {
    const error = new Error('The post is already being processed.');
    error.statusCode = 409;
    throw error;
  }
  const task = await createTask(post, `:manual-${Date.now()}`);
  await prisma.linkedInPost.update({ where: { id: post.id }, data: { backgroundTaskId: task?.id || null } });
  await recordAuditLog({
    organisationId: post.organisationId,
    actorUserId,
    action: 'linkedin.post.retry',
    entityType: 'LinkedInPost',
    entityId: post.id,
    metadata: { scope, previousStatus: post.status, previousError: post.lastErrorCategory },
    ...requestMeta,
  });
  return serializeLinkedInPost({ ...post, status: 'QUEUED', lastErrorCategory: null, lastErrorMessage: null });
}

// ---------------------------------------------------------------------------
// Serialization (never includes tokens)
// ---------------------------------------------------------------------------

export function serializeLinkedInPost(post) {
  return {
    id: post.id,
    jobId: post.jobId,
    destinationType: post.destinationType,
    destinationId: post.destinationId,
    status: post.status,
    attemptCount: post.attemptCount,
    errorCategory: post.lastErrorCategory || null,
    errorMessage: post.lastErrorMessage || null,
    requiredAction: ERROR_CATEGORIES[post.lastErrorCategory]?.action || null,
    linkedinPostId: post.linkedinPostId || null,
    postUrl: post.postUrl || null,
    commentary: post.commentary,
    nextAttemptAt: post.nextAttemptAt ? new Date(post.nextAttemptAt).toISOString() : null,
    queuedAt: post.queuedAt ? new Date(post.queuedAt).toISOString() : null,
    publishedAt: post.publishedAt ? new Date(post.publishedAt).toISOString() : null,
    updatedAt: post.updatedAt ? new Date(post.updatedAt).toISOString() : null,
  };
}
