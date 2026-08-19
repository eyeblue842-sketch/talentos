import test, { before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Set BEFORE any dynamic import of env.js/entitlement middleware in this
// process (node:test isolates each test file into its own process, so this
// is safe and does not leak into other test files). Proves the "enabled"
// half of section 2/3's "test enabled and disabled behaviour" requirement -
// see billing-entitlement-enforcement-disabled.test.js for the other half.
process.env.BILLING_ENTITLEMENT_ENFORCEMENT_ENABLED = 'true';

let prisma;
let requireAtsAccess;
let requireResumeDatabaseAccess;

before(async () => {
  ({ prisma } = await import('../config/db.js'));
  ({ requireAtsAccess, requireResumeDatabaseAccess } = await import('../middleware/entitlement.js'));
});

beforeEach(() => {
  prisma.companySubscription = { findFirst: async () => null };
});

function fakeReq(organisationId) {
  return { user: { activeMembership: organisationId ? { organisationId } : null }, originalUrl: '/api/test' };
}

function fakeRes() {
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
}

async function run(gate, req) {
  const res = fakeRes();
  let nextCalled = false;
  await gate()(req, res, () => { nextCalled = true; });
  return { res, nextCalled };
}

test('enforced: rejects with SUBSCRIPTION_REQUIRED when the organisation has no subscription at all', async () => {
  const { res, nextCalled } = await run(requireAtsAccess, fakeReq('org-1'));
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 402);
  assert.equal(res.body.code, 'SUBSCRIPTION_REQUIRED');
});

test('enforced: rejects with SUBSCRIPTION_EXPIRED once expiresAt has passed, even if status is still ACTIVE', async () => {
  prisma.companySubscription.findFirst = async () => ({
    status: 'ACTIVE', expiresAt: new Date(Date.now() - 1000), atsAccess: true, resumeDatabaseAccess: true,
  });
  const { res, nextCalled } = await run(requireAtsAccess, fakeReq('org-1'));
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 402);
  assert.equal(res.body.code, 'SUBSCRIPTION_EXPIRED');
});

test('enforced: rejects with ATS_ACCESS_REQUIRED when active but the plan does not include ATS', async () => {
  prisma.companySubscription.findFirst = async () => ({
    status: 'ACTIVE', expiresAt: new Date(Date.now() + 100000), atsAccess: false, resumeDatabaseAccess: true,
  });
  const { res, nextCalled } = await run(requireAtsAccess, fakeReq('org-1'));
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 402);
  assert.equal(res.body.code, 'ATS_ACCESS_REQUIRED');
});

test('enforced: rejects with RESUME_DATABASE_ACCESS_REQUIRED when active but the plan does not include the resume database', async () => {
  prisma.companySubscription.findFirst = async () => ({
    status: 'ACTIVE', expiresAt: new Date(Date.now() + 100000), atsAccess: true, resumeDatabaseAccess: false,
  });
  const { res, nextCalled } = await run(requireResumeDatabaseAccess, fakeReq('org-1'));
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 402);
  assert.equal(res.body.code, 'RESUME_DATABASE_ACCESS_REQUIRED');
});

test('enforced: allows the request through when the subscription is active and includes the feature', async () => {
  prisma.companySubscription.findFirst = async () => ({
    status: 'ACTIVE', expiresAt: new Date(Date.now() + 100000), atsAccess: true, resumeDatabaseAccess: true,
  });
  const { res, nextCalled } = await run(requireResumeDatabaseAccess, fakeReq('org-1'));
  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, null);
});

test('enforced: still requires organisation membership (a hard 403, distinct from the billing codes)', async () => {
  const { res, nextCalled } = await run(requireAtsAccess, fakeReq(null));
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, 'SUBSCRIPTION_REQUIRED');
});
