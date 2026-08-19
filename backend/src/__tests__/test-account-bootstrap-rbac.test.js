import test, { before, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';

let prisma;
let roleSatisfies;
let auth;
let signToken;
let bootstrapCandidateAdminAccount;
let bootstrapRecruiterAdminAccount;
let changePassword;
let state;

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function resetState() {
  state = {
    users: [],
    organisations: [],
    organisationMemberships: [],
  };
}

function withUserRelations(user) {
  if (!user) return null;
  return {
    ...clone(user),
    candidateProfile: user.candidateProfile ? clone(user.candidateProfile) : null,
    recruiterProfile: user.recruiterProfile
      ? { ...clone(user.recruiterProfile), organisation: user.recruiterProfile.organisation ? clone(user.recruiterProfile.organisation) : null }
      : null,
  };
}

function installPrismaMocks() {
  prisma.user.findUnique = async ({ where, include = {} }) => {
    const user = state.users.find((item) => (where.id ? item.id === where.id : item.email === where.email));
    if (!user) return null;
    const result = withUserRelations(user);
    if (!include.candidateProfile) delete result.candidateProfile;
    if (!include.recruiterProfile) delete result.recruiterProfile;
    return result;
  };

  prisma.user.create = async ({ data, include = {} }) => {
    const { candidateProfile, recruiterProfile, ...rest } = data;
    const user = {
      id: `user-${state.users.length + 1}`,
      sessionVersion: 0,
      mustChangePassword: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...rest,
    };
    if (candidateProfile?.create) {
      user.candidateProfile = { id: `candidate-${state.users.length + 1}`, userId: user.id, ...candidateProfile.create };
    }
    if (recruiterProfile?.create) {
      const organisation = state.organisations.find((org) => org.id === recruiterProfile.create.organisationId) || null;
      user.recruiterProfile = { id: `recruiter-${state.users.length + 1}`, userId: user.id, ...recruiterProfile.create, organisation };
    }
    state.users.push(user);
    const result = withUserRelations(user);
    if (!include.candidateProfile) delete result.candidateProfile;
    if (!include.recruiterProfile) delete result.recruiterProfile;
    return result;
  };

  prisma.user.update = async ({ where, data, include = {} }) => {
    const user = state.users.find((item) => item.id === where.id);
    if (!user) throw new Error('User not found in mock store.');
    const { candidateProfile, sessionVersion, ...rest } = data;
    Object.assign(user, rest);
    if (sessionVersion?.increment) {
      user.sessionVersion += sessionVersion.increment;
    }
    if (candidateProfile?.create && !user.candidateProfile) {
      user.candidateProfile = { id: `candidate-${state.users.length + 100}`, userId: user.id, ...candidateProfile.create };
    }
    const result = withUserRelations(user);
    if (!include.candidateProfile) delete result.candidateProfile;
    if (!include.recruiterProfile) delete result.recruiterProfile;
    return result;
  };

  prisma.organisation.findUnique = async ({ where }) => {
    const org = state.organisations.find((item) => item.slug === where.slug);
    return org ? clone(org) : null;
  };
  prisma.organisation.create = async ({ data }) => {
    const organisation = { id: `org-${state.organisations.length + 1}`, ...data };
    state.organisations.push(organisation);
    return clone(organisation);
  };

  prisma.organisationMembership.create = async ({ data }) => {
    const membership = { id: `membership-${state.organisationMemberships.length + 1}`, ...data };
    state.organisationMemberships.push(membership);
    return clone(membership);
  };
  prisma.organisationMembership.findMany = async ({ where }) => (
    state.organisationMemberships.filter((item) => item.userId === where.userId).map(clone)
  );

  prisma.$transaction = async (callback) => callback(prisma);
}

before(async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || '12345678901234567890123456789012';
  ({ prisma } = await import('../config/db.js'));
  ({ roleSatisfies, auth } = await import('../middleware/auth.js'));
  ({ signToken } = await import('../utils/jwt.js'));
  ({
    bootstrapCandidateAdminAccount,
    bootstrapRecruiterAdminAccount,
  } = await import('../services/testAccountBootstrapService.js'));
  ({ changePassword } = await import('../services/authService.js'));
});

function fakeRes() {
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  return res;
}

beforeEach(() => {
  resetState();
  installPrismaMocks();
});

describe('roleSatisfies (auth middleware role equivalence)', () => {
  test('exact role matches still work', () => {
    assert.equal(roleSatisfies('CANDIDATE', ['CANDIDATE']), true);
    assert.equal(roleSatisfies('RECRUITER', ['RECRUITER', 'ADMIN']), true);
  });

  test('CANDIDATE_ADMIN satisfies CANDIDATE-gated routes but not ADMIN-gated routes', () => {
    assert.equal(roleSatisfies('CANDIDATE_ADMIN', ['CANDIDATE']), true);
    assert.equal(roleSatisfies('CANDIDATE_ADMIN', ['ADMIN']), false);
    assert.equal(roleSatisfies('CANDIDATE_ADMIN', ['RECRUITER']), false);
  });

  test('RECRUITER_ADMIN satisfies both ADMIN-gated and plain RECRUITER-gated routes (a full working recruiter plus the admin panel)', () => {
    assert.equal(roleSatisfies('RECRUITER_ADMIN', ['RECRUITER', 'ADMIN']), true);
    assert.equal(roleSatisfies('RECRUITER_ADMIN', ['RECRUITER']), true);
    assert.equal(roleSatisfies('RECRUITER_ADMIN', ['ADMIN']), true);
  });

  test('PLATFORM_ADMIN satisfies ADMIN-gated routes only, not RECRUITER-only business routes', () => {
    assert.equal(roleSatisfies('PLATFORM_ADMIN', ['ADMIN']), true);
    assert.equal(roleSatisfies('PLATFORM_ADMIN', ['RECRUITER']), false);
  });

  test('an unrelated role satisfies nothing it is not explicitly listed for', () => {
    assert.equal(roleSatisfies('CANDIDATE', ['ADMIN']), false);
  });
});

describe('auth() middleware: mustChangePassword gate', () => {
  function seedUser(overrides = {}) {
    const user = {
      id: 'gate-user-1',
      email: 'vinu842@gmail.com',
      role: 'CANDIDATE_ADMIN',
      isActive: true,
      sessionVersion: 0,
      mustChangePassword: true,
      candidateProfile: null,
      ...overrides,
    };
    state.users.push(user);
    return user;
  }

  test('blocks an ordinary protected route with 403 while mustChangePassword is true', async () => {
    const user = seedUser();
    const token = signToken({ userId: user.id, role: user.role, sessionVersion: user.sessionVersion });
    const req = { headers: { authorization: `Bearer ${token}` }, query: {} };
    const res = fakeRes();
    let nextCalled = false;

    await auth(['CANDIDATE'])(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.details?.code, 'PASSWORD_CHANGE_REQUIRED');
  });

  test('allows /auth/me and /change-password style routes through via allowPasswordChangeRequired', async () => {
    const user = seedUser();
    const token = signToken({ userId: user.id, role: user.role, sessionVersion: user.sessionVersion });
    const req = { headers: { authorization: `Bearer ${token}` }, query: {} };
    const res = fakeRes();
    let nextCalled = false;

    await auth([], { allowPasswordChangeRequired: true })(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true, '/auth/me must stay reachable so the frontend can discover mustChangePassword at all');
    assert.equal(res.statusCode, null);
  });

  test('does not block once mustChangePassword is false', async () => {
    const user = seedUser({ mustChangePassword: false });
    const token = signToken({ userId: user.id, role: user.role, sessionVersion: user.sessionVersion });
    const req = { headers: { authorization: `Bearer ${token}` }, query: {} };
    const res = fakeRes();
    let nextCalled = false;

    await auth(['CANDIDATE'])(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
  });
});

describe('bootstrapCandidateAdminAccount', () => {
  test('creates a new user + CandidateProfile when none exists', async () => {
    const result = await bootstrapCandidateAdminAccount({ email: 'new.candidate@example.com', passwordHash: 'hashed' });
    assert.equal(result.created, true);
    assert.equal(result.roleBefore, null);
    assert.equal(result.roleAfter, 'CANDIDATE_ADMIN');
    assert.equal(result.candidateProfileCreated, true);
    assert.ok(result.candidateProfileId);
    assert.equal(state.users.length, 1);
  });

  test('reuses an existing CANDIDATE user and preserves its CandidateProfile untouched', async () => {
    state.users.push({
      id: 'existing-user-1',
      email: 'vinu842@gmail.com',
      role: 'CANDIDATE',
      passwordHash: 'old-hash',
      sessionVersion: 3,
      mustChangePassword: false,
      emailVerifiedAt: new Date('2026-01-01'),
      candidateProfile: {
        id: 'candidate-existing-1',
        fullName: 'Vinu',
        skills: ['React'],
        resumeAssetId: 'resume-1',
      },
    });

    const result = await bootstrapCandidateAdminAccount({ email: 'vinu842@gmail.com', passwordHash: 'new-hash' });

    assert.equal(result.created, false);
    assert.equal(result.roleBefore, 'CANDIDATE');
    assert.equal(result.roleAfter, 'CANDIDATE_ADMIN');
    assert.equal(result.candidateProfileCreated, false);
    assert.equal(result.candidateProfileId, 'candidate-existing-1');
    assert.equal(state.users.length, 1, 'must not create a duplicate User row');

    const stored = state.users[0];
    assert.equal(stored.passwordHash, 'new-hash');
    assert.equal(stored.mustChangePassword, true);
    assert.equal(stored.sessionVersion, 4, 'sessionVersion must increment to invalidate old sessions');
    assert.deepEqual(stored.candidateProfile, {
      id: 'candidate-existing-1',
      fullName: 'Vinu',
      skills: ['React'],
      resumeAssetId: 'resume-1',
    }, 'CandidateProfile must be preserved exactly, not recreated or mutated');
  });

  test('is idempotent: rerunning does not create a second user', async () => {
    const first = await bootstrapCandidateAdminAccount({ email: 'idempotent@example.com', passwordHash: 'hash-1' });
    const second = await bootstrapCandidateAdminAccount({ email: 'idempotent@example.com', passwordHash: 'hash-2' });

    assert.equal(first.created, true);
    assert.equal(second.created, false);
    assert.equal(first.userId, second.userId);
    assert.equal(state.users.length, 1);
  });

  test('refuses to elevate an unrelated existing role', async () => {
    state.users.push({
      id: 'existing-recruiter-1',
      email: 'someone@company.com',
      role: 'RECRUITER',
      passwordHash: 'old-hash',
      sessionVersion: 0,
      mustChangePassword: false,
      candidateProfile: null,
    });

    await assert.rejects(
      () => bootstrapCandidateAdminAccount({ email: 'someone@company.com', passwordHash: 'new-hash' }),
      (error) => {
        assert.equal(error.statusCode, 409);
        return true;
      }
    );
    assert.equal(state.users[0].role, 'RECRUITER', 'must not silently change an unrelated role');
  });
});

describe('bootstrapRecruiterAdminAccount', () => {
  test('creates a new user + Organisation + RecruiterProfile + Membership when none exists', async () => {
    const result = await bootstrapRecruiterAdminAccount({ email: 'support@sivantatechnologies.com', passwordHash: 'hashed' });

    assert.equal(result.created, true);
    assert.equal(result.roleAfter, 'RECRUITER_ADMIN');
    assert.equal(result.organisationCreated, true);
    assert.ok(result.organisationId);
    assert.equal(state.users.length, 1);
    assert.equal(state.organisations.length, 1);
    assert.equal(state.organisationMemberships.length, 1);
    assert.equal(state.organisationMemberships[0].role, 'OWNER');
  });

  test('reuses an existing RECRUITER user and preserves its organisation untouched', async () => {
    state.organisations.push({ id: 'org-existing-1', name: 'Existing Co', slug: 'existing-co' });
    state.users.push({
      id: 'existing-recruiter-2',
      email: 'support@sivantatechnologies.com',
      role: 'RECRUITER',
      passwordHash: 'old-hash',
      sessionVersion: 1,
      mustChangePassword: false,
      emailVerifiedAt: new Date('2026-01-01'),
      recruiterProfile: {
        id: 'recruiter-existing-2',
        organisationId: 'org-existing-1',
        organisation: { id: 'org-existing-1', name: 'Existing Co', slug: 'existing-co' },
      },
    });

    const result = await bootstrapRecruiterAdminAccount({ email: 'support@sivantatechnologies.com', passwordHash: 'new-hash' });

    assert.equal(result.created, false);
    assert.equal(result.roleBefore, 'RECRUITER');
    assert.equal(result.roleAfter, 'RECRUITER_ADMIN');
    assert.equal(result.organisationId, 'org-existing-1');
    assert.equal(state.organisations.length, 1, 'must not create a duplicate Organisation');
    assert.equal(state.users.length, 1, 'must not create a duplicate User row');
  });

  test('refuses to elevate an unrelated existing role', async () => {
    state.users.push({
      id: 'existing-candidate-2',
      email: 'other@example.com',
      role: 'CANDIDATE',
      passwordHash: 'old-hash',
      sessionVersion: 0,
      mustChangePassword: false,
      recruiterProfile: null,
    });

    await assert.rejects(
      () => bootstrapRecruiterAdminAccount({ email: 'other@example.com', passwordHash: 'new-hash' }),
      (error) => {
        assert.equal(error.statusCode, 409);
        return true;
      }
    );
  });
});

describe('changePassword', () => {
  test('succeeds with the correct current password, clears the flag, and rotates the session', async () => {
    const currentHash = await bcrypt.hash('Taff@842', 12);
    state.users.push({
      id: 'user-cp-1',
      email: 'vinu842@gmail.com',
      role: 'CANDIDATE_ADMIN',
      passwordHash: currentHash,
      sessionVersion: 5,
      mustChangePassword: true,
      candidateProfile: null,
    });

    const result = await changePassword('user-cp-1', 'Taff@842', 'BrandNewPassw0rd!');

    assert.ok(result.token);
    assert.equal(result.session.user.mustChangePassword, false);
    const stored = state.users[0];
    assert.equal(stored.mustChangePassword, false);
    assert.equal(stored.sessionVersion, 6, 'sessionVersion must increment to invalidate the old (temporary-password) session');
    assert.notEqual(stored.passwordHash, currentHash);

    const oldPasswordStillWorks = await bcrypt.compare('Taff@842', stored.passwordHash);
    assert.equal(oldPasswordStillWorks, false, 'the old temporary password must no longer work');
    const newPasswordWorks = await bcrypt.compare('BrandNewPassw0rd!', stored.passwordHash);
    assert.equal(newPasswordWorks, true);
  });

  test('rejects an incorrect current password', async () => {
    const currentHash = await bcrypt.hash('Taff@842', 12);
    state.users.push({
      id: 'user-cp-2',
      email: 'vinu842@gmail.com',
      role: 'CANDIDATE_ADMIN',
      passwordHash: currentHash,
      sessionVersion: 0,
      mustChangePassword: true,
    });

    await assert.rejects(
      () => changePassword('user-cp-2', 'WrongPassword', 'BrandNewPassw0rd!'),
      (error) => {
        assert.equal(error.statusCode, 401);
        return true;
      }
    );
    assert.equal(state.users[0].mustChangePassword, true, 'flag must remain set when the change fails');
  });

  test('rejects a new password identical to the current password', async () => {
    const currentHash = await bcrypt.hash('Taff@842', 12);
    state.users.push({
      id: 'user-cp-3',
      email: 'vinu842@gmail.com',
      role: 'CANDIDATE_ADMIN',
      passwordHash: currentHash,
      sessionVersion: 0,
      mustChangePassword: true,
    });

    await assert.rejects(
      () => changePassword('user-cp-3', 'Taff@842', 'Taff@842'),
      (error) => {
        assert.equal(error.statusCode, 422);
        return true;
      }
    );
  });
});
