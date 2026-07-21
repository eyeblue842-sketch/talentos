import crypto from 'crypto';
import { env } from './config/env.js';
import { closePrisma } from './config/db.js';
import { closeRedisClient } from './config/redis.js';
import {
  claimDueBackgroundTasks,
  markBackgroundTaskCancelled,
  markBackgroundTaskFailed,
  markBackgroundTaskSucceeded,
} from './services/backgroundTaskService.js';
import { processBackgroundTask } from './services/backgroundTaskHandlers.js';
import { scheduleProductionBackgroundTasks } from './services/backgroundTaskScheduler.js';

const workerId = `worker-${crypto.randomBytes(4).toString('hex')}`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runSchedulerLoop() {
  while (true) {
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
  while (true) {
    const tasks = await claimDueBackgroundTasks({
      limit: env.workerConcurrency,
      workerId,
    });

    if (!tasks.length) {
      await sleep(env.workerPollIntervalMs);
      continue;
    }

    await Promise.all(tasks.map(async (task) => {
      try {
        const result = await processBackgroundTask(task);
        if (result === 'cancelled') {
          await markBackgroundTaskCancelled(task.id, workerId, 'Task no longer applicable.');
          return;
        }
        await markBackgroundTaskSucceeded(task.id, workerId);
      } catch (error) {
        await markBackgroundTaskFailed(task, error, workerId);
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
}));

await Promise.all([
  runSchedulerLoop(),
  runWorkerLoop(),
]);
