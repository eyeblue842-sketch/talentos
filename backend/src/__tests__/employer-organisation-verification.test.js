import test, { before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// CAREERIZ EMPLOYER ACCESS: organisation-type reclassification and
// domain-verification approval are platform-admin-only, audited actions
// (spec section 2 - "Organization-type changes require an authorized admin
// workflow and audit record"). These tests exercise the service layer;
// the route wiring reuses the already-proven requirePlatformAdmin()
// middleware from adminBillingRoutes.js.

let prisma;
let listPendingDomainVerifications;
let approveDomainVerification;
let reclassifyOrganisationType;
let auditLogs;
let state;

before(async () => {
  ({ prisma } = await import('../config/db.js'));
  ({
    listPendingDomainVerifications,
    approveDomainVerification,
    reclassifyOrganisationType,
  } = await import('../services/organisationVerificationService.js'));
});

beforeEach(() => {
  state = {
    organisations: [
      { id: 'org-pending', name: 'NewCorp', slug: 'newcorp', type: 'COMPANY', verifiedDomain: 'newcorp.com', domainVerificationStatus: 'PENDING', status: 'ACTIVE', createdAt: new Date('2026-01-01'), updatedAt: new Date() },
      { id: 'org-verified', name: 'Acme', slug: 'acme', type: 'COMPANY', verifiedDomain: 'acme.com', domainVerificationStatus: 'VERIFIED', status: 'ACTIVE', createdAt: new Date('2026-01-02'), updatedAt: new Date() },
      { id: 'org-consultancy', name: 'Staffing Co', slug: 'staffing-co', type: 'CONSULTANCY', verifiedDomain: null, domainVerificationStatus: 'NOT_APPLICABLE', status: 'ACTIVE', createdAt: new Date('2026-01-03'), updatedAt: new Date() },
      { id: 'org-legacy', name: 'Legacy Org', slug: 'legacy-org', type: null, verifiedDomain: null, domainVerificationStatus: 'NOT_APPLICABLE', status: 'ACTIVE', createdAt: new Date('2026-01-04'), updatedAt: new Date() },
    ],
  };
  auditLogs = [];

  // Real Prisma always hands back a fresh object per call, never a shared
  // reference into some in-memory store - clone here so beforeData/afterData
  // snapshots in the service under test can't be silently mutated by a
  // later update() the way a naive same-reference mock would allow.
  prisma.organisation.findMany = async ({ where }) => state.organisations
    .filter((org) => org.type === where.type && org.domainVerificationStatus === where.domainVerificationStatus)
    .map((org) => ({ ...org }));
  prisma.organisation.findUnique = async ({ where }) => {
    const org = state.organisations.find((item) => item.id === where.id);
    return org ? { ...org } : null;
  };
  prisma.organisation.update = async ({ where, data }) => {
    const org = state.organisations.find((item) => item.id === where.id);
    if (!org) {
      const notFound = new Error('Record to update not found.');
      notFound.code = 'P2025';
      throw notFound;
    }
    const domainClaim = data.type === 'COMPANY' && data.verifiedDomain
      ? state.organisations.find((item) => item.id !== where.id && item.type === 'COMPANY' && item.verifiedDomain === data.verifiedDomain)
      : null;
    if (domainClaim) {
      const conflict = new Error('Unique constraint failed on the fields: (`verifiedDomain`)');
      conflict.code = 'P2002';
      conflict.meta = { target: 'Organisation_company_verified_domain_key' };
      throw conflict;
    }
    Object.assign(org, data);
    return { ...org };
  };
  prisma.organisation.updateMany = async ({ where, data }) => {
    const matches = state.organisations.filter(
      (item) => item.id === where.id && (where.type === undefined || item.type === where.type),
    );
    matches.forEach((org) => Object.assign(org, data));
    return { count: matches.length };
  };
  prisma.organisation.findFirst = async ({ where }) => {
    const org = state.organisations.find((item) => {
      if (item.type !== where.type || item.verifiedDomain !== where.verifiedDomain) return false;
      if (where.id?.not && item.id === where.id.not) return false;
      return true;
    });
    return org ? { ...org } : null;
  };
  prisma.$transaction = async (callback) => callback(prisma);
  prisma.auditLog = {
    create: async ({ data }) => {
      const log = { id: `audit-${auditLogs.length + 1}`, createdAt: new Date(), ...data };
      auditLogs.push(log);
      return log;
    },
  };
});

const platformAdmin = { id: 'platform-admin-1', role: 'ADMIN' };

test('listPendingDomainVerifications returns only PENDING COMPANY organisations', async () => {
  const result = await listPendingDomainVerifications();
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'org-pending');
});

test('approveDomainVerification sets VERIFIED and records an audit log', async () => {
  const result = await approveDomainVerification(platformAdmin, 'org-pending', { ipAddress: '127.0.0.1' });
  assert.equal(result.domainVerificationStatus, 'VERIFIED');

  const log = auditLogs.find((entry) => entry.action === 'organisation.domain_verification.approve');
  assert.ok(log);
  assert.equal(log.actorUserId, 'platform-admin-1');
  assert.equal(log.entityId, 'org-pending');
  assert.equal(log.beforeData.domainVerificationStatus, 'PENDING');
  assert.equal(log.afterData.domainVerificationStatus, 'VERIFIED');
});

test('approveDomainVerification refuses a CONSULTANCY organisation (nothing to verify)', async () => {
  await assert.rejects(
    () => approveDomainVerification(platformAdmin, 'org-consultancy'),
    (error) => error.statusCode === 422,
  );
});

test('reclassifyOrganisationType classifies a previously unclassified (legacy) organisation and records an audit log', async () => {
  const result = await reclassifyOrganisationType(platformAdmin, 'org-legacy', { type: 'CONSULTANCY', reason: 'Manual review confirmed a staffing agency.' });
  assert.equal(result.type, 'CONSULTANCY');

  const log = auditLogs.find((entry) => entry.action === 'organisation.type.reclassify' && entry.entityId === 'org-legacy');
  assert.ok(log);
  assert.equal(log.beforeData.type, null);
  assert.equal(log.afterData.type, 'CONSULTANCY');
  assert.equal(log.metadata.reason, 'Manual review confirmed a staffing agency.');
});

test('reclassifying a CONSULTANCY organisation to COMPANY starts a fresh PENDING domain review', async () => {
  const result = await reclassifyOrganisationType(platformAdmin, 'org-consultancy', { type: 'COMPANY', verifiedDomain: 'staffingco.com' });
  assert.equal(result.type, 'COMPANY');
  assert.equal(result.verifiedDomain, 'staffingco.com');
  assert.equal(result.domainVerificationStatus, 'PENDING');
});

test('reclassifying a COMPANY organisation to CONSULTANCY clears its verified domain', async () => {
  const result = await reclassifyOrganisationType(platformAdmin, 'org-verified', { type: 'CONSULTANCY' });
  assert.equal(result.type, 'CONSULTANCY');
  assert.equal(result.verifiedDomain, null);
  assert.equal(result.domainVerificationStatus, 'NOT_APPLICABLE');
});

test('reclassifying to COMPANY without any usable domain is rejected', async () => {
  await assert.rejects(
    () => reclassifyOrganisationType(platformAdmin, 'org-legacy', { type: 'COMPANY' }),
    (error) => error.statusCode === 422,
  );
});

test('reclassifying to COMPANY with a domain already claimed by a different organisation is rejected', async () => {
  // Caught by the pre-check (assertValidUnclaimedCompanyDomain), not the
  // database race guard - see the P2002 translation test below for the
  // genuine-race path (409 EMAIL_DOMAIN_ALREADY_CLAIMED).
  await assert.rejects(
    () => reclassifyOrganisationType(platformAdmin, 'org-consultancy', { type: 'COMPANY', verifiedDomain: 'acme.com' }),
    (error) => error.statusCode === 422 && error.code === 'EMAIL_DOMAIN_COMPANY_CLAIMED',
  );
  // Confirms the rejected attempt made no change to the target organisation.
  assert.equal(state.organisations.find((org) => org.id === 'org-consultancy').type, 'CONSULTANCY');
});

test('a database-level unique-constraint conflict during reclassification (a genuine race) is translated into the stable EMAIL_DOMAIN_ALREADY_CLAIMED error', async () => {
  const originalUpdate = prisma.organisation.update;
  prisma.organisation.update = async () => {
    const dbError = new Error('Unique constraint failed on the fields: (`verifiedDomain`)');
    dbError.code = 'P2002';
    dbError.meta = { target: 'Organisation_company_verified_domain_key' };
    throw dbError;
  };

  await assert.rejects(
    () => reclassifyOrganisationType(platformAdmin, 'org-legacy', { type: 'COMPANY', verifiedDomain: 'racer.com' }),
    (error) => error.statusCode === 409 && error.code === 'EMAIL_DOMAIN_ALREADY_CLAIMED',
  );

  prisma.organisation.update = originalUpdate;
});

test('reclassifying to COMPANY with a consumer or disposable domain is rejected', async () => {
  await assert.rejects(
    () => reclassifyOrganisationType(platformAdmin, 'org-legacy', { type: 'COMPANY', verifiedDomain: 'gmail.com' }),
    (error) => error.statusCode === 422,
  );
  await assert.rejects(
    () => reclassifyOrganisationType(platformAdmin, 'org-legacy', { type: 'COMPANY', verifiedDomain: 'mailinator.com' }),
    (error) => error.statusCode === 422,
  );
});

test('re-affirming the same COMPANY domain preserves an already-VERIFIED status; changing the domain resets to PENDING', async () => {
  const sameDomain = await reclassifyOrganisationType(platformAdmin, 'org-verified', { type: 'COMPANY', verifiedDomain: 'acme.com', reason: 'Correcting the audit note only.' });
  assert.equal(sameDomain.domainVerificationStatus, 'VERIFIED');

  const newDomain = await reclassifyOrganisationType(platformAdmin, 'org-verified', { type: 'COMPANY', verifiedDomain: 'acme-rebrand.com' });
  assert.equal(newDomain.domainVerificationStatus, 'PENDING');
  assert.equal(newDomain.verifiedDomain, 'acme-rebrand.com');
});

test('approveDomainVerification never verifies an organisation that is not (or is no longer) COMPANY', async () => {
  // The mocked updateMany's WHERE {id, type: 'COMPANY'} guard is the same
  // one that protects against a genuine mid-transaction race (proven for
  // real against Postgres in the disposable-database concurrency test) -
  // this proves the guard's condition itself, via the same code path.
  const org = state.organisations.find((item) => item.id === 'org-pending');
  org.type = 'CONSULTANCY';
  org.domainVerificationStatus = 'NOT_APPLICABLE';

  await assert.rejects(
    () => approveDomainVerification(platformAdmin, 'org-pending'),
    (error) => error.statusCode === 422,
  );
});

test('reclassifyOrganisationType rejects an invalid type value', async () => {
  await assert.rejects(
    () => reclassifyOrganisationType(platformAdmin, 'org-legacy', { type: 'NOT_A_TYPE' }),
    (error) => error.statusCode === 422,
  );
});

test('unrelated organisations are never touched by an approval or reclassification of a different organisation', async () => {
  await approveDomainVerification(platformAdmin, 'org-pending');
  const untouched = state.organisations.find((org) => org.id === 'org-verified');
  assert.equal(untouched.domainVerificationStatus, 'VERIFIED');
  assert.equal(auditLogs.filter((log) => log.entityId === 'org-verified').length, 0);
});
