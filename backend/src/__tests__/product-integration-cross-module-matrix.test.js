import test, { before, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// CAREERIZ PRODUCT INTEGRATION, section 7: proves the composed middleware
// STACK - requireResumeDatabaseAccess/requireAtsAccess (billing
// entitlement) followed by requireVerifiedOrganisation (employer domain
// verification) - produces the correct end-to-end outcome for every
// fictional organisation state in the matrix. Neither gate is retested in
// isolation here (each already has its own exhaustive suite:
// billing-entitlement-enforcement-*.test.js and
// employer-organisation-gate.test.js) - this specifically proves the
// COMBINATION, which is the one thing that only became testable once the
// Billing and Employer Access branches were merged together.

let env;
let requireAtsAccess;
let requireResumeDatabaseAccess;
let requireVerifiedOrganisation;
let originalEmployerEnforced;
let originalBillingEnforced;

before(async () => {
  ({ env } = await import('../config/env.js'));
  ({ requireAtsAccess, requireResumeDatabaseAccess } = await import('../middleware/entitlement.js'));
  ({ requireVerifiedOrganisation } = await import('../middleware/organisationVerification.js'));
});

beforeEach(() => {
  originalEmployerEnforced = env.employerOrganisationVerificationEnforcementEnabled;
  originalBillingEnforced = env.billingEntitlementEnforcementEnabled;
  env.employerOrganisationVerificationEnforcementEnabled = true;
  env.billingEntitlementEnforcementEnabled = true;
});

afterEach(() => {
  env.employerOrganisationVerificationEnforcementEnabled = originalEmployerEnforced;
  env.billingEntitlementEnforcementEnabled = originalBillingEnforced;
});

function buildRes() {
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  return res;
}

// Every gate in this codebase's chain is an `async (req, res, next) => {}`
// function (see middleware/entitlement.js's buildGate and
// middleware/organisationVerification.js) - an async function always
// returns a Promise, so awaiting the call directly (rather than racing it
// against a `next` callback) is both simpler and race-free.
async function runStack(req, middlewares) {
  const res = buildRes();
  for (const mw of middlewares) {
    let calledNext = false;
    await mw(req, res, () => { calledNext = true; });
    if (res.statusCode) return { res, reachedHandler: false };
    if (!calledNext) return { res, reachedHandler: false };
  }
  return { res, reachedHandler: true };
}

function buildReq(subscription, organisation, organisationId = 'org-1') {
  return {
    user: {
      activeMembership: { organisationId, organisation },
    },
    __subscription: subscription,
  };
}

// requireAtsAccess/requireResumeDatabaseAccess resolve the subscription via
// entitlementService.getCurrentSubscription(organisationId), which is a
// thin wrapper over prisma.companySubscription.findFirst - mock that
// directly (this codebase's established convention: monkeypatch methods on
// the shared prisma singleton, not module exports, which ESM namespace
// objects do not allow reassigning).
let prisma;
before(async () => {
  ({ prisma } = await import('../config/db.js'));
});

function withSubscription(subscription) {
  prisma.companySubscription = {
    findFirst: async () => subscription,
  };
}

const verifiedCompanySubscription = { status: 'ACTIVE', expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), atsAccess: true, resumeDatabaseAccess: true };
const expiredSubscription = { status: 'ACTIVE', expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), atsAccess: true, resumeDatabaseAccess: true };

test('Verified COMPANY: both billing entitlement and domain-verification gates pass together for ATS and Resume Database (V1 and V2 share the same gate)', async () => {
  withSubscription(verifiedCompanySubscription);
  const org = { type: 'COMPANY', domainVerificationStatus: 'VERIFIED' };

  const ats = await runStack(buildReq(null, org), [requireAtsAccess(), requireVerifiedOrganisation()]);
  assert.equal(ats.reachedHandler, true);

  // Resume Search V2 is gated with the identical requireResumeDatabaseAccess
  // function as V1 (see resumeRoutes.js) - proving the stack once proves it
  // for both routes.
  const resumeDb = await runStack(buildReq(null, org), [requireResumeDatabaseAccess(), requireVerifiedOrganisation()]);
  assert.equal(resumeDb.reachedHandler, true);
});

test('Pending COMPANY under enforcement: cannot reach ATS or Resume Database/Search V2, even with an otherwise-valid subscription', async () => {
  withSubscription(verifiedCompanySubscription);
  const org = { type: 'COMPANY', domainVerificationStatus: 'PENDING' };

  const ats = await runStack(buildReq(null, org), [requireAtsAccess(), requireVerifiedOrganisation()]);
  assert.equal(ats.reachedHandler, false);
  assert.equal(ats.res.statusCode, 403);
  assert.equal(ats.res.body.code, 'ORGANISATION_DOMAIN_VERIFICATION_REQUIRED');

  const resumeDb = await runStack(buildReq(null, org), [requireResumeDatabaseAccess(), requireVerifiedOrganisation()]);
  assert.equal(resumeDb.reachedHandler, false);
  assert.equal(resumeDb.res.statusCode, 403);
  assert.equal(resumeDb.res.body.code, 'ORGANISATION_DOMAIN_VERIFICATION_REQUIRED');
});

test('CONSULTANCY: shares the identical entitlement/verification behaviour as a verified COMPANY - never a weaker or stronger path', async () => {
  withSubscription(verifiedCompanySubscription);
  const org = { type: 'CONSULTANCY', domainVerificationStatus: 'NOT_APPLICABLE' };

  const ats = await runStack(buildReq(null, org), [requireAtsAccess(), requireVerifiedOrganisation()]);
  assert.equal(ats.reachedHandler, true);

  const resumeDb = await runStack(buildReq(null, org), [requireResumeDatabaseAccess(), requireVerifiedOrganisation()]);
  assert.equal(resumeDb.reachedHandler, true);
});

test('Expired subscription: ATS and Resume Database/Search V2 are blocked by the billing gate regardless of a fully VERIFIED domain', async () => {
  withSubscription(expiredSubscription);
  const org = { type: 'COMPANY', domainVerificationStatus: 'VERIFIED' };

  const ats = await runStack(buildReq(null, org), [requireAtsAccess(), requireVerifiedOrganisation()]);
  assert.equal(ats.reachedHandler, false);
  assert.equal(ats.res.body.code, 'SUBSCRIPTION_EXPIRED');

  const resumeDb = await runStack(buildReq(null, org), [requireResumeDatabaseAccess(), requireVerifiedOrganisation()]);
  assert.equal(resumeDb.reachedHandler, false);
  assert.equal(resumeDb.res.body.code, 'SUBSCRIPTION_EXPIRED');
});

test('a legacy (type=null) organisation with a verified subscription is never blocked by the domain-verification gate', async () => {
  withSubscription(verifiedCompanySubscription);
  const org = { type: null, domainVerificationStatus: 'NOT_APPLICABLE' };

  const ats = await runStack(buildReq(null, org), [requireAtsAccess(), requireVerifiedOrganisation()]);
  assert.equal(ats.reachedHandler, true);
});
