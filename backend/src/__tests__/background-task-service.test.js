import test, { before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

let prisma;
let claimDueBackgroundTasks;
let markBackgroundTaskSucceeded;
let markBackgroundTaskFailed;

const state = {
  tasks: [],
};

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function now() {
  return new Date('2026-07-27T12:00:00.000Z');
}

function applyData(target, data = {}) {
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      if ('increment' in value) {
        target[key] = (target[key] || 0) + value.increment;
        continue;
      }
    }

    target[key] = value;
  }

  target.updatedAt = now();
  return target;
}

before(async () => {
  ({ prisma } = await import('../config/db.js'));
  ({
    claimDueBackgroundTasks,
    markBackgroundTaskSucceeded,
    markBackgroundTaskFailed,
  } = await import('../services/backgroundTaskService.js'));
});

beforeEach(() => {
  state.tasks = [
    {
      id: 'task-1',
      status: 'PENDING',
      attemptCount: 0,
      maxAttempts: 3,
      nextAttemptAt: null,
      updatedByUserId: 'user-1',
      createdAt: now(),
      updatedAt: now(),
    },
  ];

  prisma.backgroundTask.findMany = async () => state.tasks.map(clone);
  prisma.backgroundTask.findUnique = async ({ where }) => clone(state.tasks.find((task) => task.id === where.id) || null);
  prisma.backgroundTask.updateMany = async ({ where, data }) => {
    const task = state.tasks.find((entry) => entry.id === where.id && entry.status === where.status);
    if (!task) return { count: 0 };
    applyData(task, clone(data));
    return { count: 1 };
  };
  prisma.backgroundTask.update = async ({ where, data }) => {
    const task = state.tasks.find((entry) => entry.id === where.id);
    applyData(task, clone(data));
    return clone(task);
  };
});

test('claiming due background tasks with a worker id does not overwrite updatedByUserId', async () => {
  const [task] = await claimDueBackgroundTasks({ limit: 1, workerId: 'worker-1234' });

  assert.equal(task.status, 'RUNNING');
  assert.equal(task.updatedByUserId, 'user-1');
  assert.equal(task.attemptCount, 1);
});

test('worker completion keeps the last user updater intact', async () => {
  state.tasks[0].status = 'RUNNING';

  const task = await markBackgroundTaskSucceeded('task-1', 'worker-1234');

  assert.equal(task.status, 'SUCCEEDED');
  assert.equal(task.updatedByUserId, 'user-1');
  assert.ok(task.completedAt instanceof Date);
});

test('user-triggered failure updates still record the acting user id', async () => {
  state.tasks[0].status = 'RUNNING';

  const task = await markBackgroundTaskFailed(
    state.tasks[0],
    Object.assign(new Error('Retry later'), { code: 'RETRYABLE', retryable: true }),
    'user-2'
  );

  assert.equal(task.status, 'RETRY_SCHEDULED');
  assert.equal(task.updatedByUserId, 'user-2');
  assert.equal(task.lastErrorCode, 'RETRYABLE');
});
