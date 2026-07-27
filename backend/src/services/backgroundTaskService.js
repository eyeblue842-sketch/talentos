import { prisma } from '../config/db.js';
import { getRedisClient, getRedisKey } from '../config/redis.js';
import { enqueueResumeImportTaskMessage } from './resumeImportQueueService.js';

export const wakeQueueKey = getRedisKey('worker:wakeup');

function nowDate() {
  return new Date();
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

export async function claimDueBackgroundTasks({ limit = 5, workerId = null } = {}) {
  const now = nowDate();
  const candidates = await prisma.backgroundTask.findMany({
    where: {
      status: { in: ['PENDING', 'RETRY_SCHEDULED'] },
      OR: [
        { nextAttemptAt: null },
        { nextAttemptAt: { lte: now } },
      ],
    },
    orderBy: [{ nextAttemptAt: 'asc' }, { createdAt: 'asc' }],
    take: limit * 4,
  });

  const claimed = [];
  for (const task of candidates) {
    if (!isDue(task, now)) continue;
    const updated = await prisma.backgroundTask.updateMany({
      where: {
        id: task.id,
        status: task.status,
      },
      data: {
        status: 'RUNNING',
        attemptCount: { increment: 1 },
        lastAttemptAt: now,
        ...buildUpdatedByUserData(workerId),
      },
    });

    if (updated.count !== 1) continue;

    const refreshed = await prisma.backgroundTask.findUnique({ where: { id: task.id } });
    if (refreshed) {
      claimed.push(refreshed);
    }
    if (claimed.length >= limit) break;
  }

  return claimed;
}

export async function claimBackgroundTaskById(taskId, workerId = null) {
  const task = await prisma.backgroundTask.findUnique({ where: { id: taskId } });
  if (!task) return null;
  if (!['PENDING', 'RETRY_SCHEDULED'].includes(task.status)) return null;
  if (!isDue(task)) return null;

  const updated = await prisma.backgroundTask.updateMany({
    where: {
      id: task.id,
      status: task.status,
    },
    data: {
      status: 'RUNNING',
      attemptCount: { increment: 1 },
      lastAttemptAt: nowDate(),
      ...buildUpdatedByUserData(workerId),
    },
  });

  if (updated.count !== 1) return null;
  return prisma.backgroundTask.findUnique({ where: { id: task.id } });
}

export async function markBackgroundTaskSucceeded(taskId, workerId = null) {
  return prisma.backgroundTask.update({
    where: { id: taskId },
    data: {
      status: 'SUCCEEDED',
      completedAt: nowDate(),
      nextAttemptAt: null,
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
  const delayMinutes = Math.min(60, Math.max(1, task.attemptCount * 5));
  const nextAttemptAt = nextStatus === 'RETRY_SCHEDULED'
    ? new Date(Date.now() + (delayMinutes * 60 * 1000))
    : null;

  return prisma.backgroundTask.update({
    where: { id: task.id },
    data: {
      status: nextStatus,
      nextAttemptAt,
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
