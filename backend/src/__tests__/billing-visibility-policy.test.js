import test, { before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// B2 hardening, section 1: sensitive billing data (GSTIN, billing address,
// invoices, payment references, purchase history, subscription
// administration, credit-adjustment history) is OWNER/ADMIN/platform-admin
// only. RECRUITER/HIRING_MANAGER get a minimal, non-financial entitlement
// summary instead.

let prisma;
let getBillingDashboard;
let getBillingEntitlementSummary;
let state;

before(async () => {
  ({ prisma } = await import('../config/db.js'));
  ({ getBillingDashboard, getBillingEntitlementSummary } = await import('../services/billingService.js'));
});

function actor(id, role = 'RECRUITER') {
  return { id, role };
}

beforeEach(() => {
  state = {
    memberships: [
      { id: 'm-owner', organisationId: 'org-1', userId: 'owner-1', role: 'OWNER', status: 'ACTIVE', customRoleDefinitionId: null },
      { id: 'm-admin', organisationId: 'org-1', userId: 'admin-1', role: 'ADMIN', status: 'ACTIVE', customRoleDefinitionId: null },
      { id: 'm-recruiter', organisationId: 'org-1', userId: 'recruiter-1', role: 'RECRUITER', status: 'ACTIVE', customRoleDefinitionId: null },
      { id: 'm-hm', organisationId: 'org-1', userId: 'hm-1', role: 'HIRING_MANAGER', status: 'ACTIVE', customRoleDefinitionId: null },
      { id: 'm-viewer', organisationId: 'org-1', userId: 'viewer-1', role: 'VIEWER', status: 'ACTIVE', customRoleDefinitionId: null },
    ],
    organisations: [{ id: 'org-1', status: 'ACTIVE' }],
  };

  prisma.organisationMembership = {
    findMany: async ({ where }) => state.memberships
      .filter((m) => m.userId === where.userId && m.status === 'ACTIVE')
      .map((m) => ({ ...m, organisation: state.organisations.find((org) => org.id === m.organisationId) })),
    findUnique: async ({ where }) => {
      const membership = state.memberships.find((m) => m.id === where.id);
      return membership ? { ...membership, organisation: state.organisations.find((org) => org.id === membership.organisationId), customRoleDefinition: null } : null;
    },
  };
  prisma.purchase = { findMany: async () => [] };
  prisma.invoice = { findMany: async () => [] };
  prisma.jobPostingCreditLedger = { findMany: async () => [], groupBy: async () => [] };
  prisma.companyBillingProfile = { findUnique: async () => null };
  prisma.job = { findMany: async () => [] };
  prisma.companySubscription = { findFirst: async () => null };
  prisma.$queryRaw = async () => [{ balance: 3 }];
});

test('RECRUITER is denied the full billing dashboard (403)', async () => {
  await assert.rejects(
    () => getBillingDashboard(actor('recruiter-1', 'RECRUITER'), 'org-1'),
    (error) => error.statusCode === 403,
  );
});

test('HIRING_MANAGER is denied the full billing dashboard (403)', async () => {
  await assert.rejects(
    () => getBillingDashboard(actor('hm-1', 'RECRUITER'), 'org-1'),
    (error) => error.statusCode === 403,
  );
});

test('VIEWER is denied both the full dashboard and the entitlement summary', async () => {
  await assert.rejects(() => getBillingDashboard(actor('viewer-1', 'RECRUITER'), 'org-1'), (error) => error.statusCode === 403);
  await assert.rejects(() => getBillingEntitlementSummary(actor('viewer-1', 'RECRUITER'), 'org-1'), (error) => error.statusCode === 403);
});

test('OWNER and ADMIN can read the full billing dashboard', async () => {
  const asOwner = await getBillingDashboard(actor('owner-1', 'RECRUITER'), 'org-1');
  assert.ok(asOwner);
  assert.equal('billingProfile' in asOwner, true);
  assert.equal('purchases' in asOwner, true);

  const asAdmin = await getBillingDashboard(actor('admin-1', 'RECRUITER'), 'org-1');
  assert.ok(asAdmin);
});

test('RECRUITER and HIRING_MANAGER can read the minimal entitlement summary', async () => {
  const asRecruiter = await getBillingEntitlementSummary(actor('recruiter-1', 'RECRUITER'), 'org-1');
  const asHiringManager = await getBillingEntitlementSummary(actor('hm-1', 'RECRUITER'), 'org-1');
  assert.ok(asRecruiter);
  assert.ok(asHiringManager);
});

test('the minimal entitlement summary contains only the five allowed fields - no GSTIN, address, invoices, payment references, or purchase/adjustment history', async () => {
  const summary = await getBillingEntitlementSummary(actor('recruiter-1', 'RECRUITER'), 'org-1');
  assert.deepEqual(
    Object.keys(summary).sort(),
    ['availableJobCredits', 'hasActiveAtsAccess', 'hasActiveResumeDatabaseAccess', 'renewalRequired', 'subscriptionExpiresAt'].sort(),
  );
});

test('renewalRequired is true when there is no active subscription at all', async () => {
  const summary = await getBillingEntitlementSummary(actor('recruiter-1', 'RECRUITER'), 'org-1');
  assert.equal(summary.hasActiveAtsAccess, false);
  assert.equal(summary.renewalRequired, true);
});

test('renewalRequired is true when the subscription is expiring within the reminder window, false when comfortably active', async () => {
  const { env } = await import('../config/env.js');
  const soon = new Date(Date.now() + (env.billingRenewalReminderDaysBefore - 1) * 24 * 60 * 60 * 1000);
  prisma.companySubscription.findFirst = async () => ({ status: 'ACTIVE', expiresAt: soon, atsAccess: true, resumeDatabaseAccess: true });
  const summaryExpiringSoon = await getBillingEntitlementSummary(actor('recruiter-1', 'RECRUITER'), 'org-1');
  assert.equal(summaryExpiringSoon.renewalRequired, true);

  const farFuture = new Date(Date.now() + 200 * 24 * 60 * 60 * 1000);
  prisma.companySubscription.findFirst = async () => ({ status: 'ACTIVE', expiresAt: farFuture, atsAccess: true, resumeDatabaseAccess: true });
  const summaryHealthy = await getBillingEntitlementSummary(actor('recruiter-1', 'RECRUITER'), 'org-1');
  assert.equal(summaryHealthy.renewalRequired, false);
});
