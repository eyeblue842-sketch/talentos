import { prisma } from '../config/db.js';
import { getRedisClient, getRedisKey } from '../config/redis.js';
import { enqueueResumeImportTaskMessage } from './resumeImportQueueService.js';
import { env } from '../config/env.js';

export const wakeQueueKey = getRedisKey('worker:wakeup');

function nowDate() {
  return new Date();
}

function leaseExpiryFrom(now) {
  return new Date(now.getTime() + env.taskLeaseDurationMs);
}

// Exponential backoff with jitter, used both for ordinary task failures and
// for tasks recovered after their lease expired (a crashed/killed worker).
export function jitteredBackoffMs(attemptCount) {
  const baseMs = 30_000;
  const maxMs = 30 * 60_000;
  const exponential = Math.min(maxMs, baseMs * (2 ** Math.max(0, attemptCount - 1)));
  const jitter = Math.floor(Math.random() * exponential * 0.2);
  return exponential + jitter;
}

function buildUpdatedByUserData(actorId) {
  if (!actorId || String(actorId).startsWith('worker-')) {
    return {};
  }

  return { updatedByUserId: actorId };
}

export async function enqueueBackgroundTask(payload) {
  const data = {
    organisationId: payload.organisationId || null,
    type: payload.type,
    status: payload.status || 'PENDING',
    entityType: payload.entityType || null,
    entityId: payload.entityId || null,
    idempotencyKey: payload.idempotencyKey,
    payload: payload.payload || null,
    attemptCount: 0,
    maxAttempts: payload.maxAttempts || 3,
    nextAttemptAt: payload.nextAttemptAt || null,
    createdByUserId: payload.createdByUserId || null,
    updatedByUserId: payload.updatedByUserId || payload.createdByUserId || null,
  };

  let task;
  try {
    task = await prisma.backgroundTask.create({ data });
  } catch (error) {
    if (error?.code !== 'P2002') throw error;
    task = await prisma.backgroundTask.findUnique({
      where: { idempotencyKey: payload.idempotencyKey },
    });
  }

  const redisClient = await getRedisClient().catch(() => null);
  if (redisClient && task && (!task.nextAttemptAt || new Date(task.nextAttemptAt) <= nowDate())) {
    await redisClient.lPush(wakeQueueKey, task.id).catch(() => {});
  }
  if (task?.type === 'RESUME_IMPORT_PROCESSING' && (!task.nextAttemptAt || new Date(task.nextAttemptAt) <= nowDate())) {
    await enqueueResumeImportTaskMessage(task.id).catch(() => {});
  }

  return task;
}

function isDue(task, now = nowDate()) {
  return !task.nextAttemptAt || new Date(task.nextAttemptAt) <= now;
}

/**
 * Claims up to `limit` due tasks, atomically (optimistic-lock updateMany
 * gated on the previously-read status, so two workers racing on the same
 * row can never both succeed). Each claimed task is given a lease
 * (leaseExpiresAt) that the worker must renew (see renewTaskLease) while
 * actively processing it; recoverExpiredLeaseTasks() requeues anything
 * whose lease lapses (crashed/killed worker) instead of leaving it stuck
 * in RUNNING forever.
 *
 * perTypeLimits optionally caps how many tasks of a given `type` may be
 * claimed in a single call (e.g. { RESUME_IMPORT_PROCESSING: 1 }), so a
 * generic worker concurrency budget can't accidentally let several resumes
 * process at once even though other task types are also due.
 */
export async function claimDueBackgroundTasks({ limit = 5, workerId = null, perTypeLimits = null } = {}) {
  const now = nowDate();
  const leaseExpiresAt = leaseExpiryFrom(now);
  const candidates = await prisma.backgroundTask.findMany({
    where: {
      status: { in: ['PENDING', 'RETRY_SCHEDULED'] },
      OR: [
        { nextAttemptAt: null },
        { nextAttemptAt: { lte: now } },
      ],
    },
    orderBy: [{ nextAttemptAt: 'asc' }, { createdAt: 'asc' }],
    take: Math.max(limit * 4, 20),
  });

  const claimed = [];
  const typeCounts = {};
  for (const task of candidates) {
    if (claimed.length >= limit) break;
    if (!isDue(task, now)) continue;

    if (perTypeLimits && Object.prototype.hasOwnProperty.call(perTypeLimits, task.type)) {
      const typeLimit = perTypeLimits[task.type];
      if ((typeCounts[task.type] || 0) >= typeLimit) continue;
    }

    const updated = await prisma.backgroundTask.updateMany({
      where: {
        id: task.id,
        status: task.status,
      },
      data: {
        status: 'RUNNING',
        attemptCount: { increment: 1 },
        lastAttemptAt: now,
        leaseOwnerId: workerId,
        leaseExpiresAt,
        lastHeartbeatAt: now,
        ...buildUpdatedByUserData(workerId),
      },
    });

    if (updated.count !== 1) continue;

    const refreshed = await prisma.backgroundTask.findUnique({ where: { id: task.id } });
    if (refreshed) {
      claimed.push(refreshed);
      typeCounts[task.type] = (typeCounts[task.type] || 0) + 1;
    }
  }

  return claimed;
}

export async function claimBackgroundTaskById(taskId, workerId = null) {
  const task = await prisma.backgroundTask.findUnique({ where: { id: taskId } });
  if (!task) return null;
  if (!['PENDING', 'RETRY_SCHEDULED'].includes(task.status)) return null;
  if (!isDue(task)) return null;

  const now = nowDate();
  const updated = await prisma.backgroundTask.updateMany({
    where: {
      id: task.id,
      status: task.status,
    },
    data: {
      status: 'RUNNING',
      attemptCount: { increment: 1 },
      lastAttemptAt: now,
      leaseOwnerId: workerId,
      leaseExpiresAt: leaseExpiryFrom(now),
      lastHeartbeatAt: now,
      ...buildUpdatedByUserData(workerId),
    },
  });

  if (updated.count !== 1) return null;
  return prisma.backgroundTask.findUnique({ where: { id: task.id } });
}

/**
 * Called by the worker while actively processing a claimed task (e.g. at
 * each stage-transition checkpoint) to extend its lease. Guarded on both
 * status=RUNNING and leaseOwnerId=workerId so a task reclaimed by another
 * worker after this one's lease already expired cannot have its lease
 * silently extended by the original (now-late) owner.
 */
export async function renewTaskLease(taskId, workerId) {
  if (!workerId) return false;
  const now = nowDate();
  const updated = await prisma.backgroundTask.updateMany({
    where: { id: taskId, status: 'RUNNING', leaseOwnerId: workerId },
    data: { leaseExpiresAt: leaseExpiryFrom(now), lastHeartbeatAt: now },
  });
  return updated.count === 1;
}

/**
 * Sweeps tasks stuck in RUNNING whose lease has expired (worker crashed,
 * was killed, or lost its DB connection mid-task) and requeues them for
 * retry, or moves them to DEAD_LETTER if retries are exhausted. Guarded by
 * an optimistic re-check on leaseExpiresAt so a worker that renews its
 * lease in the same instant this sweep reads a stale row cannot be
 * clobbered.
 */
export async function recoverExpiredLeaseTasks({ limit = 100 } = {}) {
  const now = nowDate();
  const expired = await prisma.backgroundTask.findMany({
    where: { status: 'RUNNING', leaseExpiresAt: { lt: now } },
    take: limit,
  });

  const recovered = [];
  for (const task of expired) {
    const isPermanentFailure = task.attemptCount >= task.maxAttempts;
    const nextStatus = isPermanentFailure ? 'DEAD_LETTER' : 'RETRY_SCHEDULED';
    const nextAttemptAt = isPermanentFailure ? null : new Date(now.getTime() + jitteredBackoffMs(task.attemptCount));

    const updated = await prisma.backgroundTask.updateMany({
      where: { id: task.id, status: 'RUNNING', leaseExpiresAt: task.leaseExpiresAt },
      data: {
        status: nextStatus,
        nextAttemptAt,
        leaseOwnerId: null,
        leaseExpiresAt: null,
        lastErrorCode: 'LEASE_EXPIRED',
        lastErrorMessage: isPermanentFailure
          ? `Task lease expired while owned by ${task.leaseOwnerId || 'an unknown worker'}; retry limit exhausted, moved to dead letter.`
          : `Task lease expired while owned by ${task.leaseOwnerId || 'an unknown worker'}; requeued for retry.`,
      },
    });

    if (updated.count === 1) {
      recovered.push({
        id: task.id,
        type: task.type,
        entityType: task.entityType,
        entityId: task.entityId,
        previousOwner: task.leaseOwnerId,
        nextStatus,
        attemptCount: task.attemptCount,
        maxAttempts: task.maxAttempts,
      });
    }
  }

  return recovered;
}

export async function markBackgroundTaskSucceeded(taskId, workerId = null) {
  return prisma.backgroundTask.update({
    where: { id: taskId },
    data: {
      status: 'SUCCEEDED',
      completedAt: nowDate(),
      nextAttemptAt: null,
      leaseOwnerId: null,
      leaseExpiresAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      ...buildUpdatedByUserData(workerId),
    },
  });
}

export async function markBackgroundTaskCancelled(taskId, workerId = null, reason = null) {
  return prisma.backgroundTask.update({
    where: { id: taskId },
    data: {
      status: 'CANCELLED',
      completedAt: nowDate(),
      nextAttemptAt: null,
      leaseOwnerId: null,
      leaseExpiresAt: null,
      lastErrorCode: reason ? 'TASK_CANCELLED' : null,
      lastErrorMessage: reason,
      ...buildUpdatedByUserData(workerId),
    },
  });
}

export async function cancelBackgroundTasks(where = {}, workerId = null, reason = 'TASK_CANCELLED') {
  const tasks = await prisma.backgroundTask.findMany({
    where: {
      ...where,
      status: { in: ['PENDING', 'RETRY_SCHEDULED', 'RUNNING'] },
    },
  });

  if (!tasks.length) return [];

  await prisma.backgroundTask.updateMany({
    where: {
      id: { in: tasks.map((task) => task.id) },
    },
    data: {
      status: 'CANCELLED',
      completedAt: nowDate(),
      nextAttemptAt: null,
      leaseOwnerId: null,
      leaseExpiresAt: null,
      lastErrorCode: reason,
      lastErrorMessage: reason,
      ...buildUpdatedByUserData(workerId),
    },
  });

  return tasks;
}

export async function markBackgroundTaskFailed(task, error, workerId = null) {
  const isPermanentFailure = error?.retryable === false;
  const nextStatus = isPermanentFailure || task.attemptCount >= task.maxAttempts ? 'DEAD_LETTER' : 'RETRY_SCHEDULED';
  const nextAttemptAt = nextStatus === 'RETRY_SCHEDULED'
    ? new Date(Date.now() + jitteredBackoffMs(task.attemptCount))
    : null;

  return prisma.backgroundTask.update({
    where: { id: task.id },
    data: {
      status: nextStatus,
      nextAttemptAt,
      leaseOwnerId: null,
      leaseExpiresAt: null,
      lastErrorCode: error?.code || 'TASK_FAILED',
      lastErrorMessage: error?.message ? String(error.message).slice(0, 1000) : 'Background task failed.',
      ...buildUpdatedByUserData(workerId),
    },
  });
}

export async function listBackgroundTasks(filters = {}) {
  const where = {
    ...(filters.organisationId ? { organisationId: filters.organisationId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.type ? { type: filters.type } : {}),
  };

  return prisma.backgroundTask.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }],
    take: filters.take || 100,
  });
}
