import crypto from 'crypto';
import { env } from './config/env.js';
import { closePrisma } from './config/db.js';
import { closeRedisClient } from './config/redis.js';
import {
  claimBackgroundTaskById,
  claimDueBackgroundTasks,
  markBackgroundTaskCancelled,
  markBackgroundTaskFailed,
  markBackgroundTaskSucceeded,
} from './services/backgroundTaskService.js';
import { processBackgroundTask } from './services/backgroundTaskHandlers.js';
import { scheduleProductionBackgroundTasks } from './services/backgroundTaskScheduler.js';
import {
  deleteResumeImportTaskMessage,
  receiveResumeImportTaskMessages,
} from './services/resumeImportQueueService.js';

const workerId = `worker-${crypto.randomBytes(4).toString('hex')}`;

let shuttingDown = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runSchedulerLoop() {
  while (!shuttingDown) {
    await scheduleProductionBackgroundTasks().catch((error) => {
      console.error(JSON.stringify({
        level: 'error',
        event: 'worker.scheduler.error',
        workerId,
        message: error?.message || 'Scheduler failed',
      }));
    });
    await sleep(env.workerSchedulerIntervalMs);
  }
}

async function runWorkerLoop() {
  while (!shuttingDown) {
    let tasks = [];
    let queueMessages = [];

    if (env.queueProvider === 'sqs') {
      queueMessages = await receiveResumeImportTaskMessages(env.workerConcurrency).catch(() => []);
      tasks = (await Promise.all(queueMessages.map((message) => {
        let taskId = null;
        try {
          taskId = JSON.parse(message.Body || '{}').taskId || null;
        } catch {
          taskId = null;
        }
        if (!taskId) return null;
        return claimBackgroundTaskById(taskId, workerId);
      }))).filter(Boolean);
    }

    if (!tasks.length) {
      tasks = await claimDueBackgroundTasks({
        limit: env.queueProvider === 'sqs' ? Math.max(1, env.resumeImportWorkerConcurrency) : env.workerConcurrency,
        workerId,
      });
    }

    if (!tasks.length) {
      await sleep(env.workerPollIntervalMs);
      continue;
    }

    await Promise.all(tasks.map(async (task) => {
      const queueMessage = queueMessages.find((message) => {
        try {
          return JSON.parse(message.Body || '{}').taskId === task.id;
        } catch {
          return false;
        }
      });
      try {
        const result = await processBackgroundTask(task);
        if (result === 'cancelled') {
          await markBackgroundTaskCancelled(task.id, workerId, 'Task no longer applicable.');
          if (queueMessage?.ReceiptHandle) {
            await deleteResumeImportTaskMessage(queueMessage.ReceiptHandle).catch(() => {});
          }
          return;
        }
        await markBackgroundTaskSucceeded(task.id, workerId);
        if (queueMessage?.ReceiptHandle) {
          await deleteResumeImportTaskMessage(queueMessage.ReceiptHandle).catch(() => {});
        }
      } catch (error) {
        await markBackgroundTaskFailed(task, error, workerId);
        if (queueMessage?.ReceiptHandle) {
          await deleteResumeImportTaskMessage(queueMessage.ReceiptHandle).catch(() => {});
        }
        console.error(JSON.stringify({
          level: 'error',
          event: 'worker.task.error',
          workerId,
          taskId: task.id,
          taskType: task.type,
          message: error?.message || 'Background task failed',
        }));
      }
    }));
  }
}

async function shutdown(signal) {
  shuttingDown = true;
  console.log(JSON.stringify({
    level: 'info',
    event: 'worker.shutdown',
    workerId,
    signal,
  }));
  await Promise.allSettled([closePrisma(), closeRedisClient()]);
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

console.log(JSON.stringify({
  level: 'info',
  event: 'worker.start',
  workerId,
  concurrency: env.workerConcurrency,
  queueProvider: env.queueProvider,
}));

await Promise.all([
  runSchedulerLoop(),
  runWorkerLoop(),
]);
