import { prisma } from '../config/db.js';
import { env } from '../config/env.js';

/**
 * Worker health must be derived from an explicit heartbeat, not from recent
 * task-claim activity — an idle-but-healthy worker (nothing queued) would
 * otherwise look indistinguishable from a dead one. Workers upsert their row
 * here on start, on every poll cycle, and whenever they begin/finish a task.
 */
export async function recordHeartbeat({
  workerId,
  workerType = 'BACKGROUND_WORKER',
  hostname = null,
  processId = null,
  status = 'IDLE',
  currentTaskId = null,
  parserVersion = null,
  concurrency = 1,
  startedAt = null,
}) {
  if (!workerId) return null;
  const now = new Date();

  return prisma.workerHeartbeat.upsert({
    where: { workerId },
    create: {
      workerId,
      workerType,
      hostname,
      processId,
      startedAt: startedAt || now,
      lastHeartbeatAt: now,
      status,
      currentTaskId,
      parserVersion,
      concurrency,
    },
    update: {
      status,
      currentTaskId,
      parserVersion,
      concurrency,
      lastHeartbeatAt: now,
    },
  });
}

export async function markWorkerStopped(workerId) {
  if (!workerId) return null;
  return prisma.workerHeartbeat.updateMany({
    where: { workerId },
    data: { status: 'STOPPED', currentTaskId: null, lastHeartbeatAt: new Date() },
  });
}

function isOnline(heartbeat, now = new Date()) {
  return (now.getTime() - new Date(heartbeat.lastHeartbeatAt).getTime()) <= env.workerHeartbeatStaleMs
    && heartbeat.status !== 'STOPPED';
}

/**
 * `includeHostDetail` must only be true for platform/organisation-admin
 * callers — hostname and processId are operational/environment details that
 * ordinary recruiters should never see.
 */
export async function getWorkerHealthSummary({ includeHostDetail = false, workerType = null } = {}) {
  const now = new Date();
  const recent = new Date(now.getTime() - Math.max(env.workerHeartbeatStaleMs, env.workerHeartbeatIntervalMs) * 6);

  const heartbeats = await prisma.workerHeartbeat.findMany({
    where: {
      lastHeartbeatAt: { gte: recent },
      ...(workerType ? { workerType } : {}),
    },
    orderBy: { lastHeartbeatAt: 'desc' },
  });

  const workers = heartbeats.map((heartbeat) => ({
    workerId: heartbeat.workerId,
    workerType: heartbeat.workerType,
    status: heartbeat.status,
    online: isOnline(heartbeat, now),
    lastHeartbeatAt: heartbeat.lastHeartbeatAt,
    startedAt: heartbeat.startedAt,
    currentTaskId: heartbeat.currentTaskId,
    parserVersion: heartbeat.parserVersion,
    concurrency: heartbeat.concurrency,
    ...(includeHostDetail ? { hostname: heartbeat.hostname, processId: heartbeat.processId } : {}),
  }));

  return {
    online: workers.some((worker) => worker.online),
    staleThresholdMs: env.workerHeartbeatStaleMs,
    workers,
  };
}
