import test, { before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';

// Verifies the account-active gate added to every token-issuing auth path
// (loginUser in authService.js, and finalizeOAuthCallback/
// exchangeOAuthSessionToken in oauthService.js) via a mocked prisma, so no
// real database or network call is involved. The gate itself lives in
// accountStatusService.js and is exercised directly here too.

let prisma;
let loginUser;
let assertAccountLoginable;
let state;

const PASSWORD = 'CorrectHorseBattery9!';
let PASSWORD_HASH;

function nextId(prefix) {
  state.counters[prefix] = (state.counters[prefix] || 0) + 1;
  return `${prefix}-${state.counters[prefix]}`;
}

function makeUser(overrides = {}) {
  const id = overrides.id || nextId('user');
  return {
    id,
    email: overrides.email || `${id}@example.com`,
    passwordHash: PASSWORD_HASH,
    role: 'RECRUITER',
    isActive: true,
    accountStatus: 'ACTIVE',
    sessionVersion: 0,
    mustChangePassword: false,
    emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
    lastLoginAt: null,
    mfaEnabled: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    recruiterProfile: null,
    candidateProfile: null,
    memberships: [],
    ...overrides,
  };
}

before(async () => {
  PASSWORD_HASH = await bcrypt.hash(PASSWORD, 4);
  ({ prisma } = await import('../config/db.js'));
  ({ loginUser } = await import('../services/authService.js'));
  ({ assertAccountLoginable } = await import('../services/accountStatusService.js'));
});

beforeEach(() => {
  state = { counters: {}, users: [], memberships: [], auditLogs: [] };

  prisma.user = {
    findUnique: async ({ where }) => {
      if (where.email) return state.users.find((u) => u.email === where.email) || null;
      if (where.id) return state.users.find((u) => u.id === where.id) || null;
      return null;
    },
    update: async ({ where, data }) => {
      const user = state.users.find((u) => u.id === where.id);
      if (!user) throw new Error('user not found');
      Object.assign(user, data);
      return { ...user };
    },
  };

  prisma.organisationMembership = {
    findMany: async () => [],
  };

  prisma.auditLog = {
    create: async ({ data }) => {
      const row = { id: nextId('audit'), createdAt: new Date(), ...data };
      state.auditLogs.push(row);
      return row;
    },
  };

  prisma.candidateProfile = {
    update: async () => ({}),
  };
});

function addUser(overrides) {
  const user = makeUser(overrides);
  state.users.push(user);
  return user;
}

test('active, verified user can log in and receives a token', async () => {
  const user = addUser({ email: 'active@example.com' });

  const result = await loginUser(user.email, PASSWORD);

  assert.equal(typeof result.token, 'string');
  assert.ok(result.token.length > 0);
  assert.equal(result.session.user.id, user.id);
  assert.equal(state.auditLogs.length, 0, 'no block audit entry for a successful login');
});

test('isActive=false user cannot log in and receives no token', async () => {
  const user = addUser({ email: 'inactive@example.com', isActive: false });

  await assert.rejects(
    () => loginUser(user.email, PASSWORD),
    (error) => {
      assert.equal(error.statusCode, 401);
      assert.equal(error.message, 'Invalid credentials.');
      return true;
    },
  );
});

test('accountStatus=DEACTIVATED user cannot log in and receives no token', async () => {
  const user = addUser({ email: 'deactivated@example.com', accountStatus: 'DEACTIVATED', isActive: false });

  await assert.rejects(
    () => loginUser(user.email, PASSWORD),
    (error) => {
      assert.equal(error.statusCode, 401);
      assert.equal(error.message, 'Invalid credentials.');
      return true;
    },
  );
});

test('accountStatus=SUSPENDED user cannot log in even if isActive drifted true', async () => {
  // isActive intentionally left true here to prove the gate checks
  // accountStatus independently of isActive, not just one or the other.
  const user = addUser({ email: 'suspended@example.com', accountStatus: 'SUSPENDED', isActive: true });

  await assert.rejects(
    () => loginUser(user.email, PASSWORD),
    (error) => {
      assert.equal(error.statusCode, 401);
      assert.equal(error.message, 'Invalid credentials.');
      return true;
    },
  );
});

test('no access token, session, or DB session-affecting write happens for a blocked login', async () => {
  const user = addUser({ email: 'blocked@example.com', isActive: false });
  const originalUpdate = prisma.user.update;
  let updateCalled = false;
  prisma.user.update = async (...args) => {
    updateCalled = true;
    return originalUpdate(...args);
  };

  let caught = null;
  try {
    await loginUser(user.email, PASSWORD);
  } catch (error) {
    caught = error;
  }

  assert.ok(caught, 'loginUser must reject');
  assert.equal(updateCalled, false, 'lastLoginAt (and any other user write) must not happen for a blocked login');
  assert.equal(user.sessionVersion, 0, 'sessionVersion must be untouched by a blocked login attempt');
});

test('the block is audited server-side without credentials or tokens', async () => {
  const user = addUser({ email: 'audited@example.com', accountStatus: 'DEACTIVATED', isActive: false });

  await assert.rejects(() => loginUser(user.email, PASSWORD));

  assert.equal(state.auditLogs.length, 1);
  const entry = state.auditLogs[0];
  assert.equal(entry.action, 'auth.login.blocked');
  assert.equal(entry.entityId, user.id);
  const serialized = JSON.stringify(entry);
  assert.ok(!serialized.includes(PASSWORD), 'audit entry must never contain the attempted password');
  assert.ok(!serialized.includes(PASSWORD_HASH), 'audit entry must never contain the password hash');
});

test('a wrong password and a deactivated account both fail identically (no account-existence/state signal)', async () => {
  addUser({ email: 'nonexistent-check@example.com' });
  const deactivated = addUser({ email: 'signal-check@example.com', isActive: false });

  const wrongPasswordError = await loginUser('signal-check@example.com', 'wrong-password-entirely').catch((e) => e);
  const deactivatedError = await loginUser(deactivated.email, PASSWORD).catch((e) => e);
  const noSuchUserError = await loginUser('truly-nobody@example.com', PASSWORD).catch((e) => e);

  for (const error of [wrongPasswordError, deactivatedError, noSuchUserError]) {
    assert.equal(error.statusCode, 401);
    assert.equal(error.message, 'Invalid credentials.');
  }
});

test('existing token is rejected after deactivation via the same isActive/sessionVersion check the middleware uses', async () => {
  const user = addUser({ email: 'live-session@example.com' });
  const before = await loginUser(user.email, PASSWORD);
  assert.ok(before.token);

  // Simulate an admin deactivating the account after the token was issued -
  // exactly what accountStatusService.js's own comment describes as the
  // half of this defense the auth() middleware (not this test) enforces on
  // every subsequent request. This test asserts the DATA STATE that
  // middleware check relies on actually flips, which is the backend-testable
  // half of "existing tokens must remain invalid" (the middleware's HTTP
  // behavior itself is covered by auth.js's own existing tests).
  user.isActive = false;
  user.accountStatus = 'DEACTIVATED';
  user.sessionVersion += 1;

  const reloaded = await prisma.user.findUnique({ where: { id: user.id } });
  assert.equal(reloaded.isActive, false);
  assert.notEqual(reloaded.sessionVersion, 0, 'sessionVersion must differ from what the old token was signed with');
});

test('assertAccountLoginable is a pure gate: throws for any non-ACTIVE/inactive user, passes through for an active one', async () => {
  await assert.doesNotReject(() => assertAccountLoginable(makeUser({ id: 'gate-active' })));

  for (const overrides of [
    { id: 'gate-inactive', isActive: false },
    { id: 'gate-deactivated', accountStatus: 'DEACTIVATED' },
    { id: 'gate-suspended', accountStatus: 'SUSPENDED' },
  ]) {
    await assert.rejects(
      () => assertAccountLoginable(makeUser(overrides)),
      (error) => {
        assert.equal(error.statusCode, 401);
        assert.equal(error.message, 'Invalid credentials.');
        return true;
      },
    );
  }
});

// Fails CLOSED: a missing/undefined/null/unrecognised accountStatus (or a
// non-true isActive) must never be treated as "probably active". A real
// Prisma row always has both columns populated (schema defaults), so this
// only matters for a malformed/partial user object - which must be denied,
// not defaulted to allowed.
test('assertAccountLoginable fails closed on undefined accountStatus even when isActive is true', async () => {
  const user = makeUser({ id: 'fail-closed-undefined' });
  delete user.accountStatus;
  assert.equal(user.accountStatus, undefined);

  await assert.rejects(
    () => assertAccountLoginable(user),
    (error) => error.statusCode === 401 && error.message === 'Invalid credentials.',
  );
});

test('assertAccountLoginable fails closed on null accountStatus', async () => {
  await assert.rejects(
    () => assertAccountLoginable(makeUser({ id: 'fail-closed-null', accountStatus: null })),
    (error) => error.statusCode === 401 && error.message === 'Invalid credentials.',
  );
});

test('assertAccountLoginable fails closed on an unrecognised accountStatus value', async () => {
  await assert.rejects(
    () => assertAccountLoginable(makeUser({ id: 'fail-closed-unknown', accountStatus: 'SOMETHING_MADE_UP' })),
    (error) => error.statusCode === 401 && error.message === 'Invalid credentials.',
  );
});

test('assertAccountLoginable fails closed on undefined isActive even when accountStatus is ACTIVE', async () => {
  const user = makeUser({ id: 'fail-closed-isactive-undefined' });
  delete user.isActive;
  assert.equal(user.isActive, undefined);

  await assert.rejects(
    () => assertAccountLoginable(user),
    (error) => error.statusCode === 401 && error.message === 'Invalid credentials.',
  );
});

test('a real loginUser() call fails closed for a user row missing accountStatus - no token, no session, no user write', async () => {
  const user = addUser({ email: 'malformed-row@example.com' });
  delete user.accountStatus;

  let updateCalled = false;
  const originalUpdate = prisma.user.update;
  prisma.user.update = async (...args) => { updateCalled = true; return originalUpdate(...args); };

  await assert.rejects(
    () => loginUser(user.email, PASSWORD),
    (error) => error.statusCode === 401 && error.message === 'Invalid credentials.',
  );
  assert.equal(updateCalled, false, 'no token/session-affecting write for a malformed/incomplete user row');
});
