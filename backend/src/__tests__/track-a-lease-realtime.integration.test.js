import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { claimDueBackgroundTasks, recoverExpiredLeaseTasks } from '../services/backgroundTaskService.js';

/**
 * Real-time lease-expiry test — unlike the other integration tests, this
 * does NOT backdate leaseExpiresAt manually. It relies on a genuinely short
 * TASK_LEASE_DURATION_MS (set via env before this process starts — see the
 * run command below) and real wall-clock time passing with no renewal, to
 * prove the actual timer-based expiry path, not just the recovery query
 * logic in isolation.
 *
 * Run with a short lease so the test doesn't take 5 real minutes. 30000ms is
 * the env schema's enforced floor (TASK_LEASE_DURATION_MS.min(30000) — a
 * deliberate production safety floor against lease-thrashing, not relaxed
 * for this test), so this test takes ~35 real seconds, not milliseconds:
 *   TASK_LEASE_DURATION_MS=30000 npm run test:integration -- src/__tests__/track-a-lease-realtime.integration.test.js
 */

const RUN = `leasertime${Date.now()}`;
let org;
let user;
let batch;
let item;

// Computed once at module load (env is already parsed by then), not thrown
// from a hook: a before()/beforeEach() throw is reported by node:test as a
// hard *failure* for every test in the file (plus a synthetic file-level
// failure entry) — that's wrong for "this test's precondition isn't met in
// the current environment," which is exactly what SKIPPED means. Under the
// default `npm test` / `npm run test:integration` (TASK_LEASE_DURATION_MS
// unset, defaulting to 300000ms), this test must skip cleanly, not fail.
const SKIP_REASON = env.taskLeaseDurationMs > 35_000
  ? `Skipped: TASK_LEASE_DURATION_MS is ${env.taskLeaseDurationMs}ms — this test needs the short (env-schema-minimum) lease to run in real time without waiting 5 real minutes. Run with TASK_LEASE_DURATION_MS=30000 set in the environment to execute it.`
  : null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

before(async () => {
  if (SKIP_REASON) return; // nothing to set up — the test itself will skip immediately

  org = await prisma.organisation.create({ data: { name: `Lease Realtime Test ${RUN}`, slug: `lease-realtime-${RUN}` } });
  user = await prisma.user.create({ data: { email: `${RUN}@example.test`, passwordHash: 'not-a-real-hash', role: 'RECRUITER' } });
  batch = await prisma.resumeImportBatch.create({
    data: { organisationId: org.id, createdByUserId: user.id, originalFileCount: 1, totalItemCount: 1, status: 'PROCESSING' },
  });
  item = await prisma.resumeImportItem.create({
    data: {
      batchId: batch.id, organisationId: org.id,
      originalFilename: `${RUN}.pdf`, sanitizedFilename: `${RUN}.pdf`,
      storedObjectKey: `resumes/${org.id}/${batch.id}/${RUN}.pdf`, storageProvider: 'local',
      mimeType: 'application/pdf', fileExtension: '.pdf', fileSizeBytes: 10, status: 'UPLOADED',
    },
  });
  await prisma.backgroundTask.create({
    data: {
      organisationId: org.id, type: 'RESUME_IMPORT_PROCESSING', status: 'PENDING',
      entityType: 'ResumeImportItem', entityId: item.id,
      idempotencyKey: `resume-import-item:${item.id}:gen:0:auto`,
      payload: { batchId: batch.id, itemId: item.id, force: false },
      nextAttemptAt: new Date(),
    },
  });
});

after(async () => {
  if (SKIP_REASON || !org) return; // nothing was ever created

  await prisma.backgroundTask.deleteMany({ where: { organisationId: org.id } });
  await prisma.resumeImportItem.deleteMany({ where: { batchId: batch.id } });
  await prisma.resumeImportBatch.deleteMany({ where: { id: batch.id } });
  await prisma.user.deleteMany({ where: { id: user.id } });
  await prisma.organisation.deleteMany({ where: { id: org.id } });
});

test('a task whose worker stops renewing its lease is recovered after real time elapses, and a replacement claim processes the same row exactly once', async (t) => {
  if (SKIP_REASON) {
    t.skip(SKIP_REASON);
    return;
  }

  // Step 1: worker A claims the task — a real lease is set using the
  // process's actual (short, test-configured) TASK_LEASE_DURATION_MS.
  const claimedByA = await claimDueBackgroundTasks({
    limit: 10,
    workerId: `worker-A-${RUN}`,
    perTypeLimits: { RESUME_IMPORT_PROCESSING: 10 },
  });
  const task = claimedByA.find((t) => t.entityId === item.id);
  assert.ok(task, 'worker A must claim the task');
  assert.equal(task.status, 'RUNNING');
  assert.ok(task.leaseExpiresAt, 'a real lease must be set on claim');

  const leaseWindowMs = new Date(task.leaseExpiresAt).getTime() - Date.now();
  assert.ok(leaseWindowMs > 0 && leaseWindowMs <= 35_000, `lease window should be short and positive, got ${leaseWindowMs}ms`);

  // Step 2: worker A never renews (simulating a crashed/killed worker —
  // no call to renewTaskLease happens here at all).

  // Step 3: wait for real wall-clock time to pass the actual lease expiry,
  // plus a small margin — no manual backdating.
  await sleep(leaseWindowMs + 500);

  const stillRunning = await prisma.backgroundTask.findUnique({ where: { id: task.id } });
  assert.equal(stillRunning.status, 'RUNNING', 'the task must still show RUNNING immediately after real expiry — nothing recovers it until the sweep runs');
  assert.ok(new Date(stillRunning.leaseExpiresAt).getTime() < Date.now(), 'the lease must actually be in the past now, by real wall-clock time');

  // Step 4: the recovery sweep requeues it.
  const recovered = await recoverExpiredLeaseTasks();
  const recoveredEntry = recovered.find((r) => r.id === task.id);
  assert.ok(recoveredEntry, 'the sweep must recover this specific task');
  assert.equal(recoveredEntry.nextStatus, 'RETRY_SCHEDULED');

  // Force it due immediately for the replacement claim (the real backoff
  // delay is proven separately by the jitteredBackoffMs unit assertions —
  // here we're proving the claim/ownership handoff, not the backoff timing).
  await prisma.backgroundTask.update({ where: { id: task.id }, data: { nextAttemptAt: new Date() } });

  // Step 5: a replacement worker claims and processes the same row.
  const claimedByB = await claimDueBackgroundTasks({
    limit: 10,
    workerId: `worker-B-${RUN}`,
    perTypeLimits: { RESUME_IMPORT_PROCESSING: 10 },
  });
  const reclaimed = claimedByB.find((t) => t.id === task.id);
  assert.ok(reclaimed, 'worker B must be able to claim the recovered task');
  assert.equal(reclaimed.leaseOwnerId, `worker-B-${RUN}`, 'ownership must transfer to the replacement worker');
  assert.equal(reclaimed.attemptCount, task.attemptCount + 1, 'attemptCount must increment on reclaim, proving this is a real second claim, not a no-op');

  // Step 6: no second task row was ever created for this item.
  const totalTasksForItem = await prisma.backgroundTask.count({
    where: { entityType: 'ResumeImportItem', entityId: item.id },
  });
  assert.equal(totalTasksForItem, 1, 'exactly one BackgroundTask row must exist for this item throughout the crash/recovery/reclaim cycle');
});
