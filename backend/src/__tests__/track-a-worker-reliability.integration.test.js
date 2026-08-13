import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../config/db.js';
import {
  claimDueBackgroundTasks,
  enqueueBackgroundTask,
  markBackgroundTaskFailed,
  markBackgroundTaskSucceeded,
  recoverExpiredLeaseTasks,
  jitteredBackoffMs,
} from '../services/backgroundTaskService.js';
import { enqueueItemProcessing } from '../services/resumeImportService.js';

/**
 * Real-database integration tests for Track A (worker reliability). These
 * exercise actual Postgres row locking / optimistic-concurrency behaviour
 * that a mocked Prisma client cannot faithfully simulate — concurrent
 * claims, concurrent enqueues, and lease-expiry recovery all depend on
 * real UPDATE ... WHERE semantics.
 *
 * Requires TEST_DATABASE_URL / TEST_DIRECT_URL (see backend/.env.test) and
 * must be run via `npm run test:integration`, which points at the isolated
 * `careeriz_test` schema — never the schema used by real recruiter data.
 */

const RUN = `tracka${Date.now()}`;
let org;
let user;
let batch;

async function createItem(overrides = {}) {
  return prisma.resumeImportItem.create({
    data: {
      batchId: batch.id,
      organisationId: org.id,
      originalFilename: `${RUN}-resume.pdf`,
      sanitizedFilename: `${RUN}-resume.pdf`,
      storedObjectKey: `resumes/${org.id}/${batch.id}/${RUN}-${Math.random().toString(36).slice(2)}.pdf`,
      storageProvider: 'local',
      mimeType: 'application/pdf',
      fileExtension: '.pdf',
      fileSizeBytes: 1024,
      status: 'UPLOADED',
      ...overrides,
    },
  });
}

before(async () => {
  org = await prisma.organisation.create({
    data: { name: `Track A Test Org ${RUN}`, slug: `track-a-test-${RUN}` },
  });
  user = await prisma.user.create({
    data: {
      email: `${RUN}@example.test`,
      passwordHash: 'not-a-real-hash',
      role: 'RECRUITER',
    },
  });
  batch = await prisma.resumeImportBatch.create({
    data: {
      organisationId: org.id,
      createdByUserId: user.id,
      originalFileCount: 1,
      totalItemCount: 1,
      status: 'PROCESSING',
    },
  });
});

after(async () => {
  await prisma.backgroundTask.deleteMany({ where: { organisationId: org.id } });
  await prisma.resumeImportItem.deleteMany({ where: { batchId: batch.id } });
  await prisma.resumeImportBatch.deleteMany({ where: { id: batch.id } });
  await prisma.user.deleteMany({ where: { id: user.id } });
  await prisma.organisation.deleteMany({ where: { id: org.id } });
});

test('jitteredBackoffMs grows exponentially and stays within a bounded jitter window', () => {
  const d1 = jitteredBackoffMs(1);
  const d2 = jitteredBackoffMs(2);
  const d3 = jitteredBackoffMs(3);
  assert.ok(d1 >= 30_000 && d1 <= 36_000, `attempt 1 backoff out of range: ${d1}`);
  assert.ok(d2 >= 60_000 && d2 <= 72_000, `attempt 2 backoff out of range: ${d2}`);
  assert.ok(d3 >= 120_000 && d3 <= 144_000, `attempt 3 backoff out of range: ${d3}`);
});

test('repeated non-forced enqueue reuses the existing active task instead of creating a duplicate', async () => {
  const item = await createItem();
  const first = await enqueueItemProcessing(item, user.id, false);
  const second = await enqueueItemProcessing(item, user.id, false);

  assert.equal(first.id, second.id, 'a second non-forced enqueue call must return the same task, not create a new one');

  const count = await prisma.backgroundTask.count({
    where: { entityType: 'ResumeImportItem', entityId: item.id },
  });
  assert.equal(count, 1, 'exactly one BackgroundTask row must exist for this item');
});

test('concurrent enqueue calls for the same item never create more than one active task (the exact bug found in the live incident)', async () => {
  const item = await createItem();

  const results = await Promise.all(
    Array.from({ length: 8 }, () => enqueueItemProcessing(item, user.id, false)),
  );

  const uniqueTaskIds = new Set(results.map((task) => task.id));
  assert.equal(uniqueTaskIds.size, 1, 'all 8 concurrent enqueue calls must resolve to the same single task');

  const activeCount = await prisma.backgroundTask.count({
    where: {
      entityType: 'ResumeImportItem',
      entityId: item.id,
      status: { in: ['PENDING', 'RUNNING', 'RETRY_SCHEDULED'] },
    },
  });
  assert.equal(activeCount, 1, 'only one active task may exist per item, even under concurrent enqueue pressure');
});

test('force retry is rejected while the item is genuinely under an unexpired lease (no double-processing)', async () => {
  const item = await createItem();
  const task = await enqueueItemProcessing(item, user.id, false);

  // Simulate an in-flight claim: RUNNING with a lease in the future.
  await prisma.backgroundTask.update({
    where: { id: task.id },
    data: {
      status: 'RUNNING',
      leaseOwnerId: 'worker-simulated',
      leaseExpiresAt: new Date(Date.now() + 5 * 60_000),
    },
  });

  await assert.rejects(
    () => enqueueItemProcessing(item, user.id, true),
    (error) => {
      assert.equal(error.code, 'ITEM_PROCESSING_IN_PROGRESS');
      assert.equal(error.statusCode, 409);
      return true;
    },
  );
});

test('force retry safely supersedes a task whose lease has already expired (crash recovery path)', async () => {
  const item = await createItem();
  const task = await enqueueItemProcessing(item, user.id, false);

  await prisma.backgroundTask.update({
    where: { id: task.id },
    data: {
      status: 'RUNNING',
      leaseOwnerId: 'worker-crashed',
      leaseExpiresAt: new Date(Date.now() - 60_000), // already expired
    },
  });

  const retried = await enqueueItemProcessing(item, user.id, true);
  assert.notEqual(retried.id, task.id, 'a fresh task must be created once the stale lease is superseded');

  const original = await prisma.backgroundTask.findUnique({ where: { id: task.id } });
  assert.equal(original.status, 'CANCELLED');
  assert.equal(original.lastErrorCode, 'SUPERSEDED_BY_RETRY');

  const activeCount = await prisma.backgroundTask.count({
    where: {
      entityType: 'ResumeImportItem',
      entityId: item.id,
      status: { in: ['PENDING', 'RUNNING', 'RETRY_SCHEDULED'] },
    },
  });
  assert.equal(activeCount, 1, 'exactly one active task must remain after superseding');
});

test('concurrent claimDueBackgroundTasks calls never claim the same task twice', async () => {
  const items = await Promise.all(Array.from({ length: 6 }, () => createItem()));
  const tasks = await Promise.all(items.map((item) => enqueueItemProcessing(item, user.id, false)));
  const taskIds = new Set(tasks.map((task) => task.id));

  const workerA = `worker-a-${RUN}`;
  const workerB = `worker-b-${RUN}`;

  const [claimedByA, claimedByB] = await Promise.all([
    claimDueBackgroundTasks({ limit: 10, workerId: workerA, perTypeLimits: { RESUME_IMPORT_PROCESSING: 10 } }),
    claimDueBackgroundTasks({ limit: 10, workerId: workerB, perTypeLimits: { RESUME_IMPORT_PROCESSING: 10 } }),
  ]);

  const claimedIds = [...claimedByA, ...claimedByB]
    .filter((task) => taskIds.has(task.id))
    .map((task) => task.id);

  const uniqueClaimedIds = new Set(claimedIds);
  assert.equal(claimedIds.length, uniqueClaimedIds.size, 'no task claimed by both concurrent claim calls');

  for (const task of [...claimedByA, ...claimedByB].filter((t) => taskIds.has(t.id))) {
    assert.equal(task.status, 'RUNNING');
    assert.ok(task.leaseExpiresAt, 'a claimed task must have a lease');
    assert.ok(task.leaseOwnerId, 'a claimed task must record its lease owner');
  }
});

test('perTypeLimits caps RESUME_IMPORT_PROCESSING claims independently of the overall limit', async () => {
  const items = await Promise.all(Array.from({ length: 4 }, () => createItem()));
  const tasks = await Promise.all(items.map((item) => enqueueItemProcessing(item, user.id, false)));
  const taskIds = new Set(tasks.map((task) => task.id));

  const claimed = await claimDueBackgroundTasks({
    limit: 10,
    workerId: `worker-cap-${RUN}`,
    perTypeLimits: { RESUME_IMPORT_PROCESSING: 1 },
  });

  const claimedFromThisTest = claimed.filter((task) => taskIds.has(task.id));
  assert.ok(claimedFromThisTest.length <= 1, `perTypeLimits must cap resume-import claims to 1, got ${claimedFromThisTest.length}`);
});

test('a task whose lease has expired is recovered (requeued) by recoverExpiredLeaseTasks', async () => {
  const item = await createItem();
  const task = await enqueueItemProcessing(item, user.id, false);

  await prisma.backgroundTask.update({
    where: { id: task.id },
    data: {
      status: 'RUNNING',
      leaseOwnerId: 'worker-dead',
      leaseExpiresAt: new Date(Date.now() - 60_000),
      attemptCount: 1,
      maxAttempts: 4,
    },
  });

  const recovered = await recoverExpiredLeaseTasks();
  const thisTask = recovered.find((entry) => entry.id === task.id);
  assert.ok(thisTask, 'the expired-lease task must appear in the recovery result');
  assert.equal(thisTask.nextStatus, 'RETRY_SCHEDULED');

  const refreshed = await prisma.backgroundTask.findUnique({ where: { id: task.id } });
  assert.equal(refreshed.status, 'RETRY_SCHEDULED');
  assert.equal(refreshed.leaseOwnerId, null);
  assert.equal(refreshed.leaseExpiresAt, null);
  assert.equal(refreshed.lastErrorCode, 'LEASE_EXPIRED');
});

test('a task whose lease expired after exhausting retries is moved to DEAD_LETTER, not retried forever', async () => {
  const item = await createItem();
  const task = await enqueueItemProcessing(item, user.id, false);

  await prisma.backgroundTask.update({
    where: { id: task.id },
    data: {
      status: 'RUNNING',
      leaseOwnerId: 'worker-dead',
      leaseExpiresAt: new Date(Date.now() - 60_000),
      attemptCount: 4,
      maxAttempts: 4,
    },
  });

  const recovered = await recoverExpiredLeaseTasks();
  const thisTask = recovered.find((entry) => entry.id === task.id);
  assert.equal(thisTask.nextStatus, 'DEAD_LETTER');

  const refreshed = await prisma.backgroundTask.findUnique({ where: { id: task.id } });
  assert.equal(refreshed.status, 'DEAD_LETTER');
  assert.equal(refreshed.nextAttemptAt, null);
});

test('one item failing does not prevent independent items from being claimed and succeeding', async () => {
  const failingItem = await createItem();
  const okItem = await createItem();
  const failingTask = await enqueueItemProcessing(failingItem, user.id, false);
  const okTask = await enqueueItemProcessing(okItem, user.id, false);

  const claimed = await claimDueBackgroundTasks({
    limit: 10,
    workerId: `worker-partial-${RUN}`,
    perTypeLimits: { RESUME_IMPORT_PROCESSING: 10 },
  });
  const claimedIds = new Set(claimed.map((t) => t.id));
  assert.ok(claimedIds.has(failingTask.id) && claimedIds.has(okTask.id), 'both tasks must be claimable independently');

  await markBackgroundTaskFailed(claimed.find((t) => t.id === failingTask.id), new Error('simulated extraction failure'), `worker-partial-${RUN}`);
  await markBackgroundTaskSucceeded(okTask.id, `worker-partial-${RUN}`);

  const [failingRefreshed, okRefreshed] = await Promise.all([
    prisma.backgroundTask.findUnique({ where: { id: failingTask.id } }),
    prisma.backgroundTask.findUnique({ where: { id: okTask.id } }),
  ]);

  assert.equal(okRefreshed.status, 'SUCCEEDED', 'the healthy item must succeed regardless of the other item failing');
  assert.ok(['RETRY_SCHEDULED', 'DEAD_LETTER'].includes(failingRefreshed.status));
});

test('enqueueBackgroundTask is idempotent by key: a colliding key returns the existing row, not a duplicate', async () => {
  const item = await createItem();
  const key = `test-idempotency-${item.id}`;
  const payload = {
    organisationId: org.id,
    type: 'RESUME_IMPORT_PROCESSING',
    entityType: 'ResumeImportItem',
    entityId: item.id,
    idempotencyKey: key,
    payload: { batchId: batch.id, itemId: item.id },
    nextAttemptAt: new Date(),
  };

  const results = await Promise.all(Array.from({ length: 5 }, () => enqueueBackgroundTask(payload)));
  const uniqueIds = new Set(results.map((task) => task.id));
  assert.equal(uniqueIds.size, 1, 'five concurrent calls with the same idempotency key must resolve to one row');

  const count = await prisma.backgroundTask.count({ where: { idempotencyKey: key } });
  assert.equal(count, 1);
});
