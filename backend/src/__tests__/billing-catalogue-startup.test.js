import test, { before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// B1 hardening, section 10: the catalogue sync is idempotent, safe to run
// from multiple instances concurrently, and refuses to silently overwrite
// the commercial terms of an existing (code, version) row.

let prisma;
let ensureProductCatalogueSeeded;
let state;

before(async () => {
  ({ prisma } = await import('../config/db.js'));
  ({ ensureProductCatalogueSeeded } = await import('../services/productCatalogueService.js'));
});

beforeEach(() => {
  state = { plans: [] };
  prisma.productPlan = {
    findUnique: async ({ where }) => state.plans.find((p) => p.code === where.code_version.code && p.version === where.code_version.version) || null,
    create: async ({ data }) => {
      if (state.plans.some((p) => p.code === data.code && p.version === data.version)) {
        const error = new Error('Unique constraint violation');
        error.code = 'P2002';
        throw error;
      }
      const plan = { id: `plan-${state.plans.length + 1}`, ...data };
      state.plans.push(plan);
      return plan;
    },
    update: async ({ where, data }) => {
      const plan = state.plans.find((p) => p.code === where.code_version.code && p.version === where.code_version.version);
      Object.assign(plan, data);
      return plan;
    },
  };
});

test('running the sync twice in a row (simulating a second server instance boot) creates each product exactly once', async () => {
  await ensureProductCatalogueSeeded();
  const firstRunCount = state.plans.length;
  assert.equal(firstRunCount, 4);

  await ensureProductCatalogueSeeded();
  assert.equal(state.plans.length, 4, 'a second sync must not create duplicate rows');
});

test('re-running the sync does not change an existing version\'s commercial terms', async () => {
  await ensureProductCatalogueSeeded();
  const before = state.plans.find((p) => p.code === 'JOB_POST_45D');
  const originalAmount = before.totalAmountPaise;

  await ensureProductCatalogueSeeded();
  const after = state.plans.find((p) => p.code === 'JOB_POST_45D');
  assert.equal(after.totalAmountPaise, originalAmount);
});

test('concurrent create races on the same (code, version) resolve safely via the P2002 catch, not a crash or duplicate', async () => {
  // Simulate two instances racing to insert the same row: the mock's
  // `create` throws P2002 on the second attempt, exactly like a real
  // Postgres unique-constraint conflict would.
  let creates = 0;
  const originalCreate = prisma.productPlan.create;
  prisma.productPlan.create = async (args) => {
    creates += 1;
    if (creates === 2) {
      const error = new Error('Unique constraint violation');
      error.code = 'P2002';
      throw error;
    }
    return originalCreate(args);
  };

  await assert.doesNotReject(() => ensureProductCatalogueSeeded());
});

test('changing a commercial field without bumping the version throws instead of silently overwriting an existing row', async () => {
  await ensureProductCatalogueSeeded();
  // Simulate an existing DB row that a Purchase may already reference,
  // whose price no longer matches the current (unversioned) code constant -
  // exactly the scenario a developer editing CATALOGUE_DEFINITIONS without
  // bumping `version` would produce.
  const existing = state.plans.find((p) => p.code === 'JOB_POST_45D');
  existing.totalAmountPaise = 999999;

  await assert.rejects(() => ensureProductCatalogueSeeded(), /Refusing to sync ProductPlan/);
});

test('cosmetic-only fields (name/description/razorpayButtonId) can still be refreshed on an existing version', async () => {
  await ensureProductCatalogueSeeded();
  const existing = state.plans.find((p) => p.code === 'JOB_POST_45D');
  existing.name = 'Old Name';
  existing.isActive = false;

  await ensureProductCatalogueSeeded();

  const refreshed = state.plans.find((p) => p.code === 'JOB_POST_45D');
  assert.equal(refreshed.name, 'Single Job Posting');
  assert.equal(refreshed.isActive, true);
});
