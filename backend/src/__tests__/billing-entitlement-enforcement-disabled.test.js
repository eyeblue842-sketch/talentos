import test, { before } from 'node:test';
import assert from 'node:assert/strict';

// BILLING_ENTITLEMENT_ENFORCEMENT_ENABLED is intentionally left unset here
// (defaults to 'false') - this file proves the default rollout posture is a
// true no-op: zero additional queries, zero new rejections, for every
// route the entitlement middleware is mounted on. See
// billing-entitlement-enforcement-enabled.test.js for the enforced half.

let prisma;
let requireAtsAccess;
let requireResumeDatabaseAccess;

before(async () => {
  ({ prisma } = await import('../config/db.js'));
  ({ requireAtsAccess, requireResumeDatabaseAccess } = await import('../middleware/entitlement.js'));
});

function refusingRes() {
  return {
    status() {
      throw new Error('Response should never be sent while enforcement is disabled.');
    },
  };
}

test('disabled (default): never calls companySubscription.findFirst and always continues', async () => {
  let queried = false;
  prisma.companySubscription = { findFirst: async () => { queried = true; return null; } };

  const req = { user: { activeMembership: { organisationId: 'org-1' } }, originalUrl: '/api/resumes/search' };
  let nextCalled = false;
  await requireResumeDatabaseAccess()(req, refusingRes(), () => { nextCalled = true; });

  assert.equal(nextCalled, true);
  assert.equal(queried, false, 'companySubscription.findFirst must not be called when enforcement is disabled');
});

test('disabled (default): passes through even without prisma.companySubscription mocked at all (proves no query is attempted)', async () => {
  delete prisma.companySubscription;
  const req = { user: { activeMembership: { organisationId: 'org-1' } }, originalUrl: '/api/ats/pipeline' };
  let nextCalled = false;
  await requireAtsAccess()(req, refusingRes(), () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});

test('disabled (default): a recruiter with no resolved organisation membership is still let through (matches pre-billing behaviour)', async () => {
  const req = { user: { activeMembership: null }, originalUrl: '/api/resumes/search' };
  let nextCalled = false;
  await requireResumeDatabaseAccess()(req, refusingRes(), () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});
