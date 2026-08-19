import test, { before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';

// CAREERIZ EMPLOYER ACCESS, final publication-bypass closure section 4:
// the remaining cells of the controlled-enforcement matrix not already
// covered by employer-organisation-gate.test.js (the middleware's
// disabled/enabled/allowlist/type matrix) and
// employer-job-publication-gate.test.js (the job-activation boundary):
// - a COMPANY/PENDING user can still log in even with enforcement enabled
// - platform-admin domain-verification endpoints are never affected by
//   this gate at all (they act on OTHER organisations, not the actor's own)
// - logout has no organisation-verification gate
process.env.EMPLOYER_ORGANISATION_VERIFICATION_ENFORCEMENT_ENABLED = 'true';

let prisma;
let loginUser;
let logoutUser;
let listPendingDomainVerifications;
let approveDomainVerification;
let state;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

before(async () => {
  ({ prisma } = await import('../config/db.js'));
  ({ loginUser, logoutUser } = await import('../services/authService.js'));
  ({ listPendingDomainVerifications, approveDomainVerification } = await import('../services/organisationVerificationService.js'));
});

beforeEach(async () => {
  state = {
    organisations: [
      { id: 'org-pending', name: 'Pending Co', slug: 'pending-co', type: 'COMPANY', verifiedDomain: 'pendingco.com', domainVerificationStatus: 'PENDING', status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date() },
    ],
    memberships: [
      { id: 'mem-1', organisationId: 'org-pending', userId: 'user-pending', role: 'OWNER', status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date() },
    ],
  };

  const passwordHash = await bcrypt.hash('Password123!', 12);
  state.user = {
    id: 'user-pending', email: 'owner@pendingco.com', passwordHash, role: 'RECRUITER',
    isActive: true, accountStatus: 'ACTIVE', emailVerifiedAt: new Date(), sessionVersion: 0, mustChangePassword: false,
    recruiterProfile: { id: 'rp-1', userId: 'user-pending', organisationId: 'org-pending', companyEmailDomain: 'pendingco.com', officeLocations: [], profileCompleted: true },
    candidateProfile: null,
  };

  prisma.user.findUnique = async ({ where }) => {
    if (where.id && where.id !== state.user.id) return null;
    if (where.email && where.email !== state.user.email) return null;
    return clone(state.user);
  };
  prisma.user.update = async ({ where, data }) => {
    if (data.sessionVersion?.increment !== undefined) {
      state.user.sessionVersion += data.sessionVersion.increment;
      data = { ...data, sessionVersion: state.user.sessionVersion };
    }
    Object.assign(state.user, data);
    return clone(state.user);
  };
  prisma.organisationMembership = {
    findMany: async ({ where }) => state.memberships
      .filter((m) => m.userId === where.userId && m.status === 'ACTIVE')
      .map((m) => ({ ...clone(m), organisation: clone(state.organisations.find((org) => org.id === m.organisationId)) })),
  };
  prisma.organisation.findMany = async ({ where }) => state.organisations
    .filter((org) => org.type === where.type && org.domainVerificationStatus === where.domainVerificationStatus)
    .map((org) => ({ ...org }));
  prisma.organisation.findUnique = async ({ where }) => {
    const org = state.organisations.find((item) => item.id === where.id);
    return org ? { ...org } : null;
  };
  prisma.organisation.update = async ({ where, data }) => {
    const org = state.organisations.find((item) => item.id === where.id);
    Object.assign(org, data);
    return { ...org };
  };
  prisma.organisation.updateMany = async ({ where, data }) => {
    const matches = state.organisations.filter((item) => item.id === where.id && (where.type === undefined || item.type === where.type));
    matches.forEach((org) => Object.assign(org, data));
    return { count: matches.length };
  };
  prisma.auditLog = { create: async ({ data }) => ({ id: 'audit-1', createdAt: new Date(), ...data }) };
  prisma.$transaction = async (callback) => callback(prisma);
});

const platformAdmin = { id: 'platform-admin-1', role: 'ADMIN' };

test('a COMPANY/PENDING organisation\'s user can still log in with enforcement enabled', async () => {
  const result = await loginUser('owner@pendingco.com', 'Password123!');
  assert.equal(result.session.user.role, 'RECRUITER');
  assert.equal(result.session.user.activeMembership.organisation.domainVerificationStatus, 'PENDING');
});

test('sign-out (session rotation) is never blocked by the domain-verification gate', async () => {
  const before1 = state.user.sessionVersion;
  await logoutUser('user-pending');
  assert.equal(state.user.sessionVersion, before1 + 1);
});

test('platform-admin domain-verification endpoints are unaffected by enforcement being enabled - they operate on OTHER organisations, not an actor\'s own membership', async () => {
  const pending = await listPendingDomainVerifications();
  assert.equal(pending.length, 1);
  assert.equal(pending[0].id, 'org-pending');

  const approved = await approveDomainVerification(platformAdmin, 'org-pending');
  assert.equal(approved.domainVerificationStatus, 'VERIFIED');
});
