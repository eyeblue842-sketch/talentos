import test, { before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// CAREERIZ EMPLOYER ACCESS, section 8: the centralized domain-policy
// service is the single source of truth for email/domain decisions at
// employer registration. These tests exercise it directly, independent of
// the registration/OAuth flows that consume it.

let prisma;
let normalizeEmailDomain;
let isConsumerEmailDomain;
let isDisposableEmailDomain;
let classifyEmailForConsultancy;
let classifyEmailForCompany;
let DOMAIN_REJECTION_CODES;
let DOMAIN_MATCH_TYPES;
let state;

before(async () => {
  ({ prisma } = await import('../config/db.js'));
  ({
    normalizeEmailDomain,
    isConsumerEmailDomain,
    isDisposableEmailDomain,
    classifyEmailForConsultancy,
    classifyEmailForCompany,
    DOMAIN_REJECTION_CODES,
    DOMAIN_MATCH_TYPES,
  } = await import('../services/domainPolicyService.js'));
});

beforeEach(() => {
  state = { organisations: [] };
  prisma.organisation = {
    findFirst: async ({ where }) => state.organisations.find(
      (org) => org.type === where.type && org.verifiedDomain === where.verifiedDomain,
    ) || null,
  };
});

test('normalizeEmailDomain lowercases, trims, and IDN-normalizes', () => {
  assert.equal(normalizeEmailDomain(' Recruiter@ACME.com '), 'acme.com');
  assert.equal(normalizeEmailDomain('user@münchen.de'), 'xn--mnchen-3ya.de');
  assert.equal(normalizeEmailDomain('not-an-email'), '');
  assert.equal(normalizeEmailDomain('user@'), '');
});

test('isConsumerEmailDomain and isDisposableEmailDomain classify known providers', () => {
  assert.equal(isConsumerEmailDomain('gmail.com'), true);
  assert.equal(isConsumerEmailDomain('yahoo.com'), true);
  assert.equal(isConsumerEmailDomain('outlook.com'), true);
  assert.equal(isConsumerEmailDomain('acme.com'), false);
  assert.equal(isDisposableEmailDomain('mailinator.com'), true);
  assert.equal(isDisposableEmailDomain('yopmail.com'), true);
  assert.equal(isDisposableEmailDomain('gmail.com'), false);
});

test('classifyEmailForConsultancy allows business and personal email, rejects disposable', async () => {
  assert.equal((await classifyEmailForConsultancy('recruiter@agency.com')).ok, true);
  assert.equal((await classifyEmailForConsultancy('recruiter@gmail.com')).ok, true);
  assert.equal((await classifyEmailForConsultancy('recruiter@yahoo.com')).ok, true);

  const disposable = await classifyEmailForConsultancy('recruiter@mailinator.com');
  assert.equal(disposable.ok, false);
  assert.equal(disposable.code, DOMAIN_REJECTION_CODES.DISPOSABLE);
});

test('classifyEmailForConsultancy rejects a business domain already claimed by a COMPANY organisation', async () => {
  state.organisations.push({ id: 'org-acme', type: 'COMPANY', verifiedDomain: 'acme.com' });

  const result = await classifyEmailForConsultancy('person@acme.com');
  assert.equal(result.ok, false);
  assert.equal(result.code, DOMAIN_REJECTION_CODES.COMPANY_DOMAIN_CLAIMED);
});

test('classifyEmailForCompany rejects consumer and disposable domains', async () => {
  const gmail = await classifyEmailForCompany('hr@gmail.com');
  assert.equal(gmail.ok, false);
  assert.equal(gmail.code, DOMAIN_REJECTION_CODES.CONSUMER);

  const yahoo = await classifyEmailForCompany('hr@yahoo.com');
  assert.equal(yahoo.ok, false);
  assert.equal(yahoo.code, DOMAIN_REJECTION_CODES.CONSUMER);

  const outlook = await classifyEmailForCompany('hr@outlook.com');
  assert.equal(outlook.ok, false);
  assert.equal(outlook.code, DOMAIN_REJECTION_CODES.CONSUMER);

  const disposable = await classifyEmailForCompany('hr@mailinator.com');
  assert.equal(disposable.ok, false);
  assert.equal(disposable.code, DOMAIN_REJECTION_CODES.DISPOSABLE);
});

test('classifyEmailForCompany reports an existing verified domain as EXISTING_VERIFIED_DOMAIN', async () => {
  state.organisations.push({ id: 'org-acme', type: 'COMPANY', verifiedDomain: 'acme.com' });

  const result = await classifyEmailForCompany('newhire@acme.com');
  assert.equal(result.ok, true);
  assert.equal(result.matchType, DOMAIN_MATCH_TYPES.EXISTING_VERIFIED_DOMAIN);
  assert.equal(result.matchedOrganisationId, 'org-acme');
});

test('classifyEmailForCompany reports an unrecognized business domain as pending review', async () => {
  const result = await classifyEmailForCompany('hr@newcorp.com');
  assert.equal(result.ok, true);
  assert.equal(result.matchType, DOMAIN_MATCH_TYPES.UNKNOWN_DOMAIN_PENDING_REVIEW);
  assert.equal(result.matchedOrganisationId, null);
});

test('both policies reject an invalid email shape', async () => {
  assert.equal((await classifyEmailForConsultancy('not-an-email')).ok, false);
  assert.equal((await classifyEmailForCompany('not-an-email')).ok, false);
});
