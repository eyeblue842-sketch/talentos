import test, { before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

let prisma;
let recordHeartbeat;
let markWorkerStopped;
let getWorkerHealthSummary;
let state;

before(async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || '12345678901234567890123456789012';
  ({ prisma } = await import('../config/db.js'));
  ({ recordHeartbeat, markWorkerStopped, getWorkerHealthSummary } = await import('../services/workerHeartbeatService.js'));
});

beforeEach(() => {
  state = { heartbeats: new Map() };
  prisma.workerHeartbeat.upsert = async ({ where, create, update }) => {
    const existing = state.heartbeats.get(where.workerId);
    const row = existing ? { ...existing, ...update } : { ...create };
    state.heartbeats.set(where.workerId, row);
    return { ...row };
  };
  prisma.workerHeartbeat.updateMany = async ({ where, data }) => {
    const row = state.heartbeats.get(where.workerId);
    if (!row) return { count: 0 };
    Object.assign(row, data);
    return { count: 1 };
  };
  prisma.workerHeartbeat.findMany = async ({ where = {} }) => {
    const rows = [...state.heartbeats.values()];
    return rows.filter((row) => {
      if (where.workerType && row.workerType !== where.workerType) return false;
      if (where.lastHeartbeatAt?.gte && new Date(row.lastHeartbeatAt) < new Date(where.lastHeartbeatAt.gte)) return false;
      return true;
    });
  };
});

test('recordHeartbeat creates a row on first call and updates it on subsequent calls', async () => {
  await recordHeartbeat({ workerId: 'worker-abc', status: 'IDLE', concurrency: 1 });
  assert.equal(state.heartbeats.size, 1);

  await recordHeartbeat({ workerId: 'worker-abc', status: 'PROCESSING', currentTaskId: 'task-1', concurrency: 1 });
  assert.equal(state.heartbeats.size, 1, 'a second heartbeat for the same workerId must update, not duplicate');
  assert.equal(state.heartbeats.get('worker-abc').status, 'PROCESSING');
  assert.equal(state.heartbeats.get('worker-abc').currentTaskId, 'task-1');
});

test('a worker with a recent heartbeat is reported online', async () => {
  await recordHeartbeat({ workerId: 'worker-fresh', status: 'IDLE' });
  const summary = await getWorkerHealthSummary();
  assert.equal(summary.online, true);
  assert.equal(summary.workers.find((w) => w.workerId === 'worker-fresh').online, true);
});

test('a worker whose heartbeat is older than the stale threshold is reported offline', async () => {
  // Past the default 45s offline threshold, but within the wider listing
  // window (6x the threshold) so it still appears in the summary as offline
  // rather than being excluded entirely as long-dead.
  const staleRow = {
    workerId: 'worker-stale',
    workerType: 'BACKGROUND_WORKER',
    status: 'IDLE',
    startedAt: new Date(Date.now() - 90_000),
    lastHeartbeatAt: new Date(Date.now() - 90_000),
    concurrency: 1,
  };
  state.heartbeats.set('worker-stale', staleRow);

  const summary = await getWorkerHealthSummary();
  const entry = summary.workers.find((w) => w.workerId === 'worker-stale');
  assert.ok(entry, 'a stale-but-recent-enough-to-list worker should still appear');
  assert.equal(entry.online, false);
});

test('markWorkerStopped sets status to STOPPED and clears currentTaskId', async () => {
  await recordHeartbeat({ workerId: 'worker-stop', status: 'PROCESSING', currentTaskId: 'task-9' });
  await markWorkerStopped('worker-stop');
  const row = state.heartbeats.get('worker-stop');
  assert.equal(row.status, 'STOPPED');
  assert.equal(row.currentTaskId, null);
});

test('getWorkerHealthSummary omits hostname/processId unless includeHostDetail is set', async () => {
  await recordHeartbeat({ workerId: 'worker-host', status: 'IDLE', hostname: 'dev-machine', processId: 1234 });

  const recruiterSafe = await getWorkerHealthSummary({ includeHostDetail: false });
  const recruiterEntry = recruiterSafe.workers.find((w) => w.workerId === 'worker-host');
  assert.equal(recruiterEntry.hostname, undefined);
  assert.equal(recruiterEntry.processId, undefined);

  const adminDetail = await getWorkerHealthSummary({ includeHostDetail: true });
  const adminEntry = adminDetail.workers.find((w) => w.workerId === 'worker-host');
  assert.equal(adminEntry.hostname, 'dev-machine');
  assert.equal(adminEntry.processId, 1234);
});

test('online is false when no worker has a heartbeat at all', async () => {
  const summary = await getWorkerHealthSummary();
  assert.equal(summary.online, false);
  assert.deepEqual(summary.workers, []);
});
