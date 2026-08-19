import test, { before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';

// CAREERIZ EMPLOYER ACCESS, section 10: existing-account compatibility -
// legacy (pre-feature) organisations and users must keep working exactly
// as before, and the invitation-based join flow must never touch an
// organisation's employer-access type.

let prisma;
let loginUser;
let registerUser;
let acceptOrganisationInvitation;
let state;

function nextId(prefix) {
  state.counters[prefix] = (state.counters[prefix] || 0) + 1;
  return `${prefix}-${state.counters[prefix]}`;
}

before(async () => {
  ({ prisma } = await import('../config/db.js'));
  ({ loginUser, registerUser } = await import('../services/authService.js'));
  ({ acceptOrganisationInvitation } = await import('../services/organisationInvitationService.js'));
});

beforeEach(async () => {
  state = { counters: {}, users: [], organisations: [], memberships: [], invitations: [] };

  prisma.organisation.count = async () => 1;
  prisma.user.count = async () => 1;

  const legacyPasswordHash = await bcrypt.hash('LegacyPass123!', 12);
  state.organisations.push({
    id: 'org-legacy',
    name: 'Legacy Org',
    slug: 'legacy-org',
    type: null,
    verifiedDomain: null,
    domainVerificationStatus: 'NOT_APPLICABLE',
    status: 'ACTIVE',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  });
  state.organisations.push({
    id: 'org-company',
    name: 'Big Co',
    slug: 'big-co',
    type: 'COMPANY',
    verifiedDomain: 'bigco.com',
    domainVerificationStatus: 'VERIFIED',
    status: 'ACTIVE',
    createdAt: new Date('2025-06-01'),
    updatedAt: new Date('2025-06-01'),
  });
  state.users.push({
    id: 'user-legacy-owner',
    email: 'owner@legacy-org.example',
    passwordHash: legacyPasswordHash,
    role: 'RECRUITER',
    isActive: true,
    accountStatus: 'ACTIVE',
    emailVerifiedAt: new Date('2025-01-01'),
    sessionVersion: 0,
    mustChangePassword: false,
    recruiterProfile: { id: 'rp-legacy', userId: 'user-legacy-owner', organisationId: 'org-legacy', companyEmailDomain: 'legacy-org.example', officeLocations: [], profileCompleted: true },
    candidateProfile: null,
  });
  state.memberships.push({ id: 'mem-legacy', organisationId: 'org-legacy', userId: 'user-legacy-owner', role: 'OWNER', status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date() });

  function withRelations(user) {
    return {
      ...user,
      recruiterProfile: user.recruiterProfile
        ? { ...user.recruiterProfile, organisation: state.organisations.find((org) => org.id === user.recruiterProfile.organisationId) || null }
        : null,
      candidateProfile: user.candidateProfile || null,
    };
  }

  prisma.user.findUnique = async ({ where }) => {
    const user = state.users.find((item) => (where.id ? item.id === where.id : item.email === where.email));
    return user ? withRelations(user) : null;
  };
  prisma.user.update = async ({ where, data }) => {
    const user = state.users.find((item) => item.id === where.id);
    Object.assign(user, data);
    return withRelations(user);
  };
  prisma.user.create = async ({ data }) => {
    const { recruiterProfile, candidateProfile, ...rest } = data;
    const user = { id: nextId('user'), sessionVersion: 0, isActive: true, accountStatus: 'ACTIVE', createdAt: new Date(), updatedAt: new Date(), ...rest };
    if (recruiterProfile?.create) user.recruiterProfile = { id: nextId('recruiter-profile'), userId: user.id, ...recruiterProfile.create };
    if (candidateProfile?.create) user.candidateProfile = { id: nextId('candidate-profile'), userId: user.id, ...candidateProfile.create };
    state.users.push(user);
    return withRelations(user);
  };

  prisma.organisation.findUnique = async ({ where }) => {
    const org = state.organisations.find((item) => item.slug === where.slug || item.id === where.id);
    return org ? { ...org } : null;
  };
  prisma.organisation.findFirst = async ({ where }) => {
    const org = state.organisations.find((item) => item.type === where.type && item.verifiedDomain === where.verifiedDomain);
    return org ? { ...org } : null;
  };
  prisma.organisation.create = async ({ data }) => {
    const organisation = { id: nextId('org'), createdAt: new Date(), updatedAt: new Date(), status: 'ACTIVE', ...data };
    state.organisations.push(organisation);
    return organisation;
  };

  prisma.organisationMembership.create = async ({ data }) => {
    const membership = { id: nextId('membership'), createdAt: new Date(), updatedAt: new Date(), ...data };
    state.memberships.push(membership);
    return membership;
  };
  prisma.organisationMembership.findMany = async ({ where }) => state.memberships
    .filter((m) => m.userId === where.userId && m.status === 'ACTIVE')
    .map((m) => ({ ...m, organisation: state.organisations.find((org) => org.id === m.organisationId) }))
    .filter((m) => m.organisation?.status === 'ACTIVE');
  prisma.organisationMembership.findFirst = async ({ where }) => state.memberships.find(
    (m) => m.organisationId === where.organisationId && m.userId === where.userId && m.status === 'ACTIVE',
  ) || null;

  prisma.authToken = { updateMany: async () => ({ count: 0 }), create: async ({ data }) => ({ id: nextId('token'), createdAt: new Date(), ...data }) };
  prisma.notification = { create: async ({ data }) => ({ id: nextId('notification'), createdAt: new Date(), ...data }) };
  prisma.auditLog = { create: async ({ data }) => ({ id: nextId('audit'), createdAt: new Date(), ...data }) };
  prisma.$transaction = async (callback) => callback(prisma);
});

test('a legacy (pre-employer-access) recruiter with an unclassified organisation can still log in normally', async () => {
  const result = await loginUser('owner@legacy-org.example', 'LegacyPass123!');
  assert.equal(result.session.user.role, 'RECRUITER');
  assert.equal(result.session.user.activeMembership.organisation.type, null);
});

test('registering with an email that already exists is rejected regardless of the employerType chosen this time', async () => {
  await assert.rejects(
    () => registerUser({ email: 'owner@legacy-org.example', password: 'Password123!', role: 'RECRUITER', employerType: 'COMPANY' }),
    (error) => error.statusCode === 409,
  );
});

test('accepting an organisation invitation never changes the organisation type', async () => {
  const invitedUser = await prisma.user.create({
    data: {
      email: 'newmember@bigco.com',
      passwordHash: await bcrypt.hash('Password123!', 12),
      role: 'RECRUITER',
      emailVerifiedAt: new Date(),
      recruiterProfile: { create: { organisationId: null, companyEmailDomain: 'bigco.com', officeLocations: [], profileCompleted: false } },
    },
  });

  prisma.organisationInvitation = {
    findUnique: async () => ({
      id: 'invite-1',
      organisationId: 'org-company',
      email: 'newmember@bigco.com',
      role: 'RECRUITER',
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      revokedAt: null,
      acceptedAt: null,
      invitedByUserId: 'user-legacy-owner',
      organisation: state.organisations.find((org) => org.id === 'org-company'),
      invitedByUser: state.users[0],
      acceptedByUser: null,
    }),
    update: async ({ data }) => ({
      id: 'invite-1',
      organisationId: 'org-company',
      email: 'newmember@bigco.com',
      role: 'RECRUITER',
      status: data.status,
      acceptedByUserId: data.acceptedByUserId,
      acceptedAt: data.acceptedAt,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      organisation: state.organisations.find((org) => org.id === 'org-company'),
      invitedByUser: state.users[0],
      acceptedByUser: invitedUser,
    }),
  };

  const beforeType = state.organisations.find((org) => org.id === 'org-company').type;
  await acceptOrganisationInvitation(invitedUser, 'raw-invite-token');
  const afterType = state.organisations.find((org) => org.id === 'org-company').type;

  assert.equal(beforeType, 'COMPANY');
  assert.equal(afterType, 'COMPANY');
});
