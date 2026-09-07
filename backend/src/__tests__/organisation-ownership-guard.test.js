import test, { before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Verifies assertOwnershipInvariant (organisationAccessService.js), wired
// into adminService.updateEnterpriseUserMembership, blocks any membership/
// account-status change that would leave an organisation with zero usable
// (role=OWNER, membership ACTIVE, user isActive+accountStatus ACTIVE)
// owners - unless another active owner already exists or is assigned in
// the same transferOrganisationOwnership transaction.

let prisma;
let updateEnterpriseUserMembership;
let transferOrganisationOwnership;
let updateOrganisationMember;
let state;

function nextId(prefix) {
  state.counters[prefix] = (state.counters[prefix] || 0) + 1;
  return `${prefix}-${state.counters[prefix]}`;
}

const PLATFORM_ADMIN = { id: 'platform-admin-1', role: 'ADMIN' };

before(async () => {
  ({ prisma } = await import('../config/db.js'));
  ({ updateEnterpriseUserMembership, transferOrganisationOwnership } = await import('../services/adminService.js'));
  ({ updateOrganisationMember } = await import('../services/organisationService.js'));
});

beforeEach(() => {
  state = { counters: {}, organisations: [], users: [], memberships: [], auditLogs: [] };

  prisma.organisation = {
    findFirst: async ({ where }) => {
      if (where.id) return state.organisations.find((o) => o.id === where.id && o.status === where.status) || null;
      return state.organisations.find((o) => o.status === where.status) || null;
    },
  };

  prisma.user = {
    update: async ({ where, data }) => {
      const user = state.users.find((u) => u.id === where.id);
      if (!user) throw new Error(`user ${where.id} not found`);
      Object.assign(user, data);
      return { ...user };
    },
  };

  prisma.organisationMembership = {
    findFirst: async ({ where }) => {
      const row = state.memberships.find((m) => m.id === where.id && m.organisationId === where.organisationId);
      if (!row) return null;
      return { ...row, user: state.users.find((u) => u.id === row.userId) };
    },
    findMany: async ({ where }) => state.memberships
      .filter((m) => {
        if (where.organisationId !== undefined && m.organisationId !== where.organisationId) return false;
        if (where.role !== undefined && m.role !== where.role) return false;
        if (where.userId !== undefined && m.userId !== where.userId) return false;
        if (where.status !== undefined && m.status !== where.status) return false;
        if (where.organisation?.status !== undefined) {
          const org = state.organisations.find((o) => o.id === m.organisationId);
          if (org?.status !== where.organisation.status) return false;
        }
        return true;
      })
      .map((m) => ({ ...m, organisation: state.organisations.find((o) => o.id === m.organisationId) })),
    update: async ({ where, data }) => {
      const row = state.memberships.find((m) => m.id === where.id);
      if (!row) throw new Error(`membership ${where.id} not found`);
      Object.assign(row, data);
      return { ...row };
    },
    count: async ({ where }) => state.memberships.filter((m) => {
      if (m.organisationId !== where.organisationId) return false;
      if (where.role && m.role !== where.role) return false;
      if (where.status && m.status !== where.status) return false;
      if (where.id?.not && m.id === where.id.not) return false;
      const user = state.users.find((u) => u.id === m.userId);
      if (where.user?.isActive !== undefined && user?.isActive !== where.user.isActive) return false;
      if (where.user?.accountStatus && user?.accountStatus !== where.user.accountStatus) return false;
      return true;
    }).length,
  };

  prisma.auditLog = {
    create: async ({ data }) => {
      const row = { id: nextId('audit'), createdAt: new Date(), ...data };
      state.auditLogs.push(row);
      return row;
    },
  };

  // Transactional mock: snapshots memberships/users before running the
  // callback and restores them if it throws, so rollback-on-failure is
  // genuinely testable (not just "the callback happened to not run the
  // later statements") - matches real Postgres transaction semantics for
  // the purposes of this test. $queryRaw (the FOR UPDATE lock
  // assertOwnershipInvariant takes) has no real row-locking concept in a
  // single-threaded in-memory mock, so it's a no-op here - the row lock's
  // actual concurrency guarantee is a Postgres-level property exercised in
  // integration testing, not this unit suite. What IS fully covered here
  // is the guard's decision logic being correct at every state transition
  // it's asked to evaluate.
  prisma.$queryRaw = async () => [];
  prisma.$transaction = async (callback) => {
    const membershipsSnapshot = state.memberships.map((m) => ({ ...m }));
    const usersSnapshot = state.users.map((u) => ({ ...u }));
    try {
      return await callback(prisma);
    } catch (error) {
      state.memberships = membershipsSnapshot;
      state.users = usersSnapshot;
      throw error;
    }
  };
});

function makeOrg(overrides = {}) {
  const org = { id: overrides.id || nextId('org'), status: 'ACTIVE', name: 'Acme', ...overrides };
  state.organisations.push(org);
  return org;
}

function makeUser(overrides = {}) {
  const user = {
    id: overrides.id || nextId('user'),
    email: overrides.email || `${overrides.id || nextId('user-email')}@example.com`,
    isActive: true,
    accountStatus: 'ACTIVE',
    ...overrides,
  };
  state.users.push(user);
  return user;
}

function makeMembership(overrides = {}) {
  const membership = {
    id: overrides.id || nextId('membership'),
    organisationId: overrides.organisationId,
    userId: overrides.userId,
    role: 'OWNER',
    status: 'ACTIVE',
    ...overrides,
  };
  state.memberships.push(membership);
  return membership;
}

test('sole active owner cannot be deactivated', async () => {
  const org = makeOrg();
  const owner = makeUser();
  const membership = makeMembership({ organisationId: org.id, userId: owner.id });

  await assert.rejects(
    () => updateEnterpriseUserMembership(PLATFORM_ADMIN, { membershipId: membership.id, accountStatus: 'DEACTIVATED' }, org.id),
    (error) => {
      assert.equal(error.statusCode, 409);
      assert.match(error.message, /last active owner/i);
      return true;
    },
  );

  const reloadedMembership = state.memberships.find((m) => m.id === membership.id);
  const reloadedUser = state.users.find((u) => u.id === owner.id);
  assert.equal(reloadedMembership.role, 'OWNER');
  assert.equal(reloadedUser.accountStatus, 'ACTIVE', 'rejected change must not have partially applied');
});

test('sole active owner cannot be demoted to a non-owner role either', async () => {
  const org = makeOrg();
  const owner = makeUser();
  const membership = makeMembership({ organisationId: org.id, userId: owner.id });

  await assert.rejects(
    () => updateEnterpriseUserMembership(PLATFORM_ADMIN, { membershipId: membership.id, role: 'ADMIN' }, org.id),
    (error) => error.statusCode === 409,
  );
});

test('sole active owner cannot have their membership set INACTIVE either', async () => {
  const org = makeOrg();
  const owner = makeUser();
  const membership = makeMembership({ organisationId: org.id, userId: owner.id });

  await assert.rejects(
    () => updateEnterpriseUserMembership(PLATFORM_ADMIN, { membershipId: membership.id, status: 'INACTIVE' }, org.id),
    (error) => error.statusCode === 409,
  );
});

test('owner CAN be deactivated once ownership has been transferred to another active member first', async () => {
  const org = makeOrg();
  const oldOwner = makeUser({ id: 'old-owner' });
  const newOwner = makeUser({ id: 'new-owner' });
  const oldMembership = makeMembership({ organisationId: org.id, userId: oldOwner.id, role: 'OWNER' });
  const newMembership = makeMembership({ organisationId: org.id, userId: newOwner.id, role: 'ADMIN' });

  await transferOrganisationOwnership(PLATFORM_ADMIN, newMembership.id, org.id);
  assert.equal(state.memberships.find((m) => m.id === newMembership.id).role, 'OWNER');
  assert.equal(state.memberships.find((m) => m.id === oldMembership.id).role, 'ADMIN');

  await updateEnterpriseUserMembership(PLATFORM_ADMIN, { membershipId: oldMembership.id, accountStatus: 'DEACTIVATED' }, org.id);
  const reloadedOldOwner = state.users.find((u) => u.id === oldOwner.id);
  assert.equal(reloadedOldOwner.accountStatus, 'DEACTIVATED');
});

test('a pending invitation does not count as an active owner - deactivating the sole real owner is still blocked', async () => {
  const org = makeOrg();
  const owner = makeUser();
  const membership = makeMembership({ organisationId: org.id, userId: owner.id });
  // No OrganisationMembership row exists for the invited email at all yet -
  // modeling this the same way the real schema does (an invitation is a
  // wholly separate OrganisationInvitation row, never counted by
  // countActiveOwners, which only ever queries OrganisationMembership).

  await assert.rejects(
    () => updateEnterpriseUserMembership(PLATFORM_ADMIN, { membershipId: membership.id, accountStatus: 'DEACTIVATED' }, org.id),
    (error) => error.statusCode === 409,
  );
});

test('a deactivated user does not count as an active owner - demoting the last USABLE owner is blocked even if a second OWNER-role membership row exists but is unusable', async () => {
  const org = makeOrg();
  const usableOwner = makeUser({ id: 'usable-owner' });
  const unusableOwner = makeUser({ id: 'unusable-owner', isActive: false, accountStatus: 'DEACTIVATED' });
  const usableMembership = makeMembership({ organisationId: org.id, userId: usableOwner.id });
  makeMembership({ organisationId: org.id, userId: unusableOwner.id, role: 'OWNER' });

  await assert.rejects(
    () => updateEnterpriseUserMembership(PLATFORM_ADMIN, { membershipId: usableMembership.id, accountStatus: 'DEACTIVATED' }, org.id),
    (error) => error.statusCode === 409,
    'a second OWNER-role membership whose user is deactivated must not be counted as "another active owner"',
  );
});

test('sequential demote-both-owners on a two-owner org: the first succeeds, the second is correctly blocked once it would zero out ownership', async () => {
  const org = makeOrg();
  const ownerA = makeUser({ id: 'owner-a' });
  const ownerB = makeUser({ id: 'owner-b' });
  const membershipA = makeMembership({ organisationId: org.id, userId: ownerA.id });
  const membershipB = makeMembership({ organisationId: org.id, userId: ownerB.id });

  // Represents the state-transition correctness a real FOR UPDATE lock
  // guarantees under true concurrent load: whichever transaction commits
  // first is fully visible to the second by the time it evaluates the
  // guard, so the second always sees the first's result rather than a
  // stale "still two owners" snapshot.
  await updateEnterpriseUserMembership(PLATFORM_ADMIN, { membershipId: membershipA.id, accountStatus: 'DEACTIVATED' }, org.id);
  assert.equal(state.users.find((u) => u.id === ownerA.id).accountStatus, 'DEACTIVATED');

  await assert.rejects(
    () => updateEnterpriseUserMembership(PLATFORM_ADMIN, { membershipId: membershipB.id, accountStatus: 'DEACTIVATED' }, org.id),
    (error) => error.statusCode === 409,
  );
  assert.equal(state.users.find((u) => u.id === ownerB.id).accountStatus, 'ACTIVE', 'the last remaining owner must still be usable');
});

test('transaction rollback on an unrelated failure preserves the original owner - no partial ownership change persists', async () => {
  const org = makeOrg();
  const ownerA = makeUser({ id: 'rollback-owner-a' });
  const ownerB = makeUser({ id: 'rollback-owner-b' });
  const membershipA = makeMembership({ organisationId: org.id, userId: ownerA.id });
  makeMembership({ organisationId: org.id, userId: ownerB.id });

  // A real second owner exists, so the ownership guard itself would allow
  // this change - the failure injected below is unrelated (e.g. a
  // simulated DB error on the user write), and must still roll back the
  // membership role change that already ran earlier in the same
  // transaction.
  const originalUserUpdate = prisma.user.update;
  prisma.user.update = async (args) => {
    if (args.where.id === ownerA.id) {
      throw new Error('simulated downstream failure');
    }
    return originalUserUpdate(args);
  };

  await assert.rejects(
    () => updateEnterpriseUserMembership(PLATFORM_ADMIN, { membershipId: membershipA.id, role: 'ADMIN', accountStatus: 'DEACTIVATED' }, org.id),
    /simulated downstream failure/,
  );

  const reloadedMembership = state.memberships.find((m) => m.id === membershipA.id);
  const reloadedUser = state.users.find((u) => u.id === ownerA.id);
  assert.equal(reloadedMembership.role, 'OWNER', 'membership role change must have been rolled back');
  assert.equal(reloadedUser.accountStatus, 'ACTIVE', 'user accountStatus change must have been rolled back');
});

// --- organisationService.updateOrganisationMember: the org-self-service
// twin of adminService.updateEnterpriseUserMembership above (any OWNER/
// ADMIN of the org itself, not just a platform admin, can reach this) -
// same invariant, separate call site, separate route
// (PATCH /organisations/members/:membershipId). ---

test('an ADMIN cannot demote the sole OWNER via updateOrganisationMember', async () => {
  const org = makeOrg();
  const owner = makeUser({ id: 'self-service-owner' });
  const admin = makeUser({ id: 'self-service-admin' });
  const ownerMembership = makeMembership({ organisationId: org.id, userId: owner.id, role: 'OWNER' });
  makeMembership({ organisationId: org.id, userId: admin.id, role: 'ADMIN' });

  const actingAdmin = { id: admin.id, role: 'RECRUITER' };

  await assert.rejects(
    () => updateOrganisationMember(actingAdmin, ownerMembership.id, { role: 'ADMIN' }, org.id),
    (error) => {
      assert.equal(error.statusCode, 409);
      assert.match(error.message, /last active owner/i);
      return true;
    },
  );
  assert.equal(state.memberships.find((m) => m.id === ownerMembership.id).role, 'OWNER');
});

test('an ADMIN cannot deactivate the sole OWNER\'s membership status via updateOrganisationMember either', async () => {
  const org = makeOrg();
  const owner = makeUser({ id: 'self-service-owner-2' });
  const admin = makeUser({ id: 'self-service-admin-2' });
  const ownerMembership = makeMembership({ organisationId: org.id, userId: owner.id, role: 'OWNER' });
  makeMembership({ organisationId: org.id, userId: admin.id, role: 'ADMIN' });

  const actingAdmin = { id: admin.id, role: 'RECRUITER' };

  await assert.rejects(
    () => updateOrganisationMember(actingAdmin, ownerMembership.id, { status: 'INACTIVE' }, org.id),
    (error) => error.statusCode === 409,
  );
  assert.equal(state.memberships.find((m) => m.id === ownerMembership.id).status, 'ACTIVE');
});

test('updateOrganisationMember allows demoting an owner once a second active owner exists', async () => {
  const org = makeOrg();
  const ownerA = makeUser({ id: 'self-service-owner-a' });
  const ownerB = makeUser({ id: 'self-service-owner-b' });
  const membershipA = makeMembership({ organisationId: org.id, userId: ownerA.id, role: 'OWNER' });
  makeMembership({ organisationId: org.id, userId: ownerB.id, role: 'OWNER' });

  const actingOwner = { id: ownerB.id, role: 'RECRUITER' };

  await updateOrganisationMember(actingOwner, membershipA.id, { role: 'ADMIN' }, org.id);
  assert.equal(state.memberships.find((m) => m.id === membershipA.id).role, 'ADMIN');
});
