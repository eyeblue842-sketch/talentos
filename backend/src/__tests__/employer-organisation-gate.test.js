import test, { before, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// CAREERIZ EMPLOYER ACCESS, domain-ownership closure section 1: the
// centralized requireVerifiedOrganisation() gate that blocks a
// COMPANY/PENDING organisation from normal employer functionality, behind
// a rollout kill-switch identical in shape to the proven billing one.

let env;
let requireVerifiedOrganisation;
let ORGANISATION_DOMAIN_VERIFICATION_REQUIRED;
let originalEnforced;
let originalRolloutIds;

before(async () => {
  ({ env } = await import('../config/env.js'));
  ({ requireVerifiedOrganisation, ORGANISATION_DOMAIN_VERIFICATION_REQUIRED } = await import('../middleware/organisationVerification.js'));
});

beforeEach(() => {
  originalEnforced = env.employerOrganisationVerificationEnforcementEnabled;
  originalRolloutIds = env.employerOrganisationVerificationRolloutOrgIds;
  env.employerOrganisationVerificationEnforcementEnabled = false;
  env.employerOrganisationVerificationRolloutOrgIds = [];
});

afterEach(() => {
  env.employerOrganisationVerificationEnforcementEnabled = originalEnforced;
  env.employerOrganisationVerificationRolloutOrgIds = originalRolloutIds;
});

function buildReq(organisation, organisationId = organisation ? 'org-1' : null) {
  return {
    user: organisationId
      ? { activeMembership: { organisationId, organisation } }
      : {},
  };
}

function buildRes() {
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  return res;
}

function run(req) {
  const res = buildRes();
  let nextCalled = false;
  const gate = requireVerifiedOrganisation();
  gate(req, res, () => { nextCalled = true; });
  return { res, nextCalled };
}

test('disabled by default (the kill-switch): a COMPANY/PENDING organisation is NOT blocked - true no-op', () => {
  const req = buildReq({ type: 'COMPANY', domainVerificationStatus: 'PENDING' });
  const { res, nextCalled } = run(req);
  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, null);
});

test('enabled: a COMPANY/PENDING organisation is blocked with the stable error code', () => {
  env.employerOrganisationVerificationEnforcementEnabled = true;
  const req = buildReq({ type: 'COMPANY', domainVerificationStatus: 'PENDING' });
  const { res, nextCalled } = run(req);
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, ORGANISATION_DOMAIN_VERIFICATION_REQUIRED);
});

test('enabled: a COMPANY/VERIFIED organisation proceeds', () => {
  env.employerOrganisationVerificationEnforcementEnabled = true;
  const req = buildReq({ type: 'COMPANY', domainVerificationStatus: 'VERIFIED' });
  const { nextCalled } = run(req);
  assert.equal(nextCalled, true);
});

test('enabled: a CONSULTANCY organisation always proceeds regardless of domainVerificationStatus', () => {
  env.employerOrganisationVerificationEnforcementEnabled = true;
  const req = buildReq({ type: 'CONSULTANCY', domainVerificationStatus: 'NOT_APPLICABLE' });
  const { nextCalled } = run(req);
  assert.equal(nextCalled, true);
});

test('enabled: a legacy (type=null) organisation is never locked out', () => {
  env.employerOrganisationVerificationEnforcementEnabled = true;
  const req = buildReq({ type: null, domainVerificationStatus: 'NOT_APPLICABLE' });
  const { nextCalled } = run(req);
  assert.equal(nextCalled, true);
});

test('enabled: a request with no resolved organisation membership is not this gate\'s concern - proceeds', () => {
  env.employerOrganisationVerificationEnforcementEnabled = true;
  const req = buildReq(null, null);
  const { nextCalled } = run(req);
  assert.equal(nextCalled, true);
});

test('global flag off but organisation is in the rollout allowlist: enforcement applies to that organisation only', () => {
  env.employerOrganisationVerificationRolloutOrgIds = ['org-1'];
  const gatedReq = buildReq({ type: 'COMPANY', domainVerificationStatus: 'PENDING' }, 'org-1');
  const { res: gatedRes, nextCalled: gatedNext } = run(gatedReq);
  assert.equal(gatedNext, false);
  assert.equal(gatedRes.statusCode, 403);

  const ungatedReq = buildReq({ type: 'COMPANY', domainVerificationStatus: 'PENDING' }, 'org-2');
  const { nextCalled: ungatedNext } = run(ungatedReq);
  assert.equal(ungatedNext, true);
});
