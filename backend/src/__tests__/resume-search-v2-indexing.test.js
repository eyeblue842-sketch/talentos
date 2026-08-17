import test, { before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

let env;
let prisma;
let resumeSearchAdapter;
let isResumeIndexingAllowed;
let enqueueResumeSearchIndexUpsert;
let enqueueResumeSearchIndexDelete;
let processResumeSearchIndexTask;
let RESUME_SEARCH_INDEX_SCHEMA_VERSION;

const state = {
  candidate: null,
  indexState: null,
  upsertCalls: 0,
  deleteCalls: 0,
  backgroundTasks: [],
  stateUpdates: [],
};

before(async () => {
  ({ env } = await import('../config/env.js'));
  ({ prisma } = await import('../config/db.js'));
  ({ resumeSearchAdapter } = await import('../services/resumeSearchV2/openSearchAdapter.js'));
  ({
    isResumeIndexingAllowed,
    enqueueResumeSearchIndexUpsert,
    enqueueResumeSearchIndexDelete,
    processResumeSearchIndexTask,
  } = await import('../services/resumeSearchV2/indexingService.js'));
  ({ RESUME_SEARCH_INDEX_SCHEMA_VERSION } = await import('../services/resumeSearchV2/mapping.js'));
});

beforeEach(() => {
  env.resumeIndexingEnabled = true;
  env.resumeIndexingAllowedOrgIds = [];
  env.resumeIndexingAllowedBatchIds = [];
  env.resumeImportBlockedBatchIds = ['fictional-blocked-indexing-batch'];

  state.candidate = {
    id: 'candidate-1',
    organisationId: 'allowed-org',
    importBatchId: 'fictional-allowed-indexing-batch',
    profileStatus: 'ACTIVE',
    searchableProfile: true,
    resumeVisibleToRecruiters: true,
    salaryVisibleToRecruiters: false,
    profileVisibility: 'RECRUITERS_ONLY',
    skills: ['Java'],
    updatedAt: new Date('2026-08-17T10:00:00.000Z'),
    latestResumeAsset: {
      id: 'resume-1',
      status: 'ACTIVE',
      parsedText: 'Java engineer',
      updatedAt: new Date('2026-08-17T10:00:00.000Z'),
    },
  };
  state.indexState = {
    candidateId: 'candidate-1',
    indexSchemaVersion: RESUME_SEARCH_INDEX_SCHEMA_VERSION,
    sourceVersion: 'different-source-version',
    attemptCount: 0,
    status: 'PENDING',
  };
  state.upsertCalls = 0;
  state.deleteCalls = 0;
  state.backgroundTasks = [];
  state.stateUpdates = [];

  prisma.candidateProfile.findUnique = async () => structuredClone(state.candidate);
  prisma.resumeSearchIndexState.findUnique = async () => structuredClone(state.indexState);
  prisma.resumeSearchIndexState.update = async ({ data }) => {
    state.stateUpdates.push(structuredClone(data));
    if (data.sourceVersion) state.indexState.sourceVersion = data.sourceVersion;
    if (data.status) state.indexState.status = data.status;
    state.indexState.attemptCount += data.attemptCount?.increment || 0;
    return structuredClone(state.indexState);
  };
  prisma.resumeSearchIndexState.updateMany = async ({ data }) => {
    state.stateUpdates.push(structuredClone(data));
    return { count: 1 };
  };
  prisma.resumeSearchIndexState.upsert = async ({ update, create }) => structuredClone(update || create);
  prisma.backgroundTask.create = async ({ data }) => {
    const task = { id: `task-${state.backgroundTasks.length + 1}`, ...structuredClone(data) };
    state.backgroundTasks.push(task);
    return task;
  };
  prisma.backgroundTask.findUnique = async ({ where }) => structuredClone(
    state.backgroundTasks.find((task) => task.idempotencyKey === where.idempotencyKey || task.id === where.id) || null,
  );

  resumeSearchAdapter.ensureIndexVersion = async () => ({});
  resumeSearchAdapter.upsertResumeDocument = async () => {
    state.upsertCalls += 1;
    return {};
  };
  resumeSearchAdapter.deleteResumeDocument = async () => {
    state.deleteCalls += 1;
    return {};
  };
});

test('indexing stays disabled when feature flag is off or allowlists are empty', () => {
  env.resumeIndexingEnabled = false;
  assert.equal(isResumeIndexingAllowed({ organisationId: 'allowed-org', importBatchId: 'fictional-allowed-indexing-batch' }), false);

  env.resumeIndexingEnabled = true;
  assert.equal(isResumeIndexingAllowed({ organisationId: 'allowed-org', importBatchId: null }), false);
});

test('protected batch guard overrides allowlists and uses fictional batch ids in tests', () => {
  env.resumeIndexingAllowedBatchIds = ['fictional-blocked-indexing-batch'];
  assert.equal(isResumeIndexingAllowed({
    organisationId: 'allowed-org',
    importBatchId: 'fictional-blocked-indexing-batch',
  }), false);
});

test('allowed organisation or allowed batch enables indexing without global enablement', () => {
  env.resumeIndexingAllowedOrgIds = ['allowed-org'];
  assert.equal(isResumeIndexingAllowed({ organisationId: 'allowed-org', importBatchId: null }), true);

  env.resumeIndexingAllowedOrgIds = [];
  env.resumeIndexingAllowedBatchIds = ['fictional-allowed-indexing-batch'];
  assert.equal(isResumeIndexingAllowed({
    organisationId: 'different-org',
    importBatchId: 'fictional-allowed-indexing-batch',
  }), true);
});

test('enqueue upsert uses one idempotent task per source version and no raw resume text in payload', async () => {
  env.resumeIndexingAllowedOrgIds = ['allowed-org'];

  const first = await enqueueResumeSearchIndexUpsert('candidate-1', { correlationId: 'corr-1' });
  assert.equal(first.type, 'RESUME_SEARCH_INDEX_SYNC');
  assert.match(first.idempotencyKey, /^resume-search-index:candidate-1:v1:/);
  assert.equal(JSON.stringify(first.payload).includes('Java engineer'), false);

  prisma.backgroundTask.create = async () => {
    const error = new Error('duplicate');
    error.code = 'P2002';
    throw error;
  };
  prisma.backgroundTask.findUnique = async () => structuredClone(first);

  const second = await enqueueResumeSearchIndexUpsert('candidate-1', { correlationId: 'corr-1' });
  assert.equal(second.idempotencyKey, first.idempotencyKey);
});

test('stale source versions are cancelled before any OpenSearch write', async () => {
  const result = await processResumeSearchIndexTask({
    payload: {
      action: 'UPSERT',
      candidateId: 'candidate-1',
      sourceVersion: 'older-source-version',
    },
  });

  assert.equal(result, 'cancelled');
  assert.equal(state.upsertCalls, 0);
});

test('transient failures schedule retry and permanent failures mark failed', async () => {
  env.resumeIndexingAllowedOrgIds = ['allowed-org'];
  const successTask = await enqueueResumeSearchIndexUpsert('candidate-1');
  state.indexState.sourceVersion = successTask.payload.sourceVersion;

  resumeSearchAdapter.upsertResumeDocument = async () => {
    const error = new Error('cluster timeout');
    error.code = 'ConnectionError';
    throw error;
  };
  await assert.rejects(
    processResumeSearchIndexTask({ payload: successTask.payload }),
    /cluster timeout/i,
  );
  assert.equal(state.stateUpdates.some((update) => update.status === 'RETRY_SCHEDULED'), true);

  state.stateUpdates = [];
  resumeSearchAdapter.upsertResumeDocument = async () => {
    const error = new Error('strict mapping');
    error.meta = { statusCode: 400 };
    throw error;
  };
  await assert.rejects(
    processResumeSearchIndexTask({ payload: successTask.payload }),
    /strict mapping/i,
  );
  assert.equal(state.stateUpdates.some((update) => update.status === 'FAILED'), true);
});

test('successful processing updates state and delete/tombstone transitions to deleted', async () => {
  env.resumeIndexingAllowedOrgIds = ['allowed-org'];
  const task = await enqueueResumeSearchIndexUpsert('candidate-1');
  state.indexState.sourceVersion = task.payload.sourceVersion;

  const result = await processResumeSearchIndexTask({ payload: task.payload });
  assert.equal(result, 'success');
  assert.equal(state.upsertCalls, 1);
  assert.equal(state.stateUpdates.some((update) => update.status === 'INDEXED'), true);

  const deleteTask = await enqueueResumeSearchIndexDelete('candidate-1', { organisationId: 'allowed-org' });
  const deleteResult = await processResumeSearchIndexTask({ payload: deleteTask.payload });
  assert.equal(deleteResult, 'success');
  assert.equal(state.deleteCalls, 1);
  assert.equal(state.stateUpdates.some((update) => update.status === 'DELETED'), true);
});
