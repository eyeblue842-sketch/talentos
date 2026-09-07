import test, { before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';

// Verifies the account-active gate (accountStatusService.js's
// assertAccountLoginable) is enforced on both OAuth token-issuing entry
// points: finalizeOAuthCallback (shared by the GET redirect flow and the
// direct POST /oauth/callback flow) and exchangeOAuthSessionToken (the
// OAUTH_HANDOFF token redemption step). Mocking follows the same pattern
// as employer-oauth.test.js: mocked prisma + global.fetch standing in for
// Google, no real network or database.

let prisma;
let getOAuthAuthorizationUrl;
let completeOAuthSignIn;
let handleOAuthCallbackRedirect;
let exchangeOAuthSessionToken;
let state;
let originalFetch;

function nextId(prefix) {
  state.counters[prefix] = (state.counters[prefix] || 0) + 1;
  return `${prefix}-${state.counters[prefix]}`;
}

before(async () => {
  ({ prisma } = await import('../config/db.js'));
  const { env } = await import('../config/env.js');
  env.googleClientId = 'test-google-client-id';
  env.googleClientSecret = 'test-google-client-secret';
  env.googleRedirectUri = 'http://localhost:5000/api/auth/oauth/google/callback';

  ({
    getOAuthAuthorizationUrl,
    completeOAuthSignIn,
    handleOAuthCallbackRedirect,
    exchangeOAuthSessionToken,
  } = await import('../services/oauthService.js'));

  originalFetch = globalThis.fetch;
});

after(() => {
  globalThis.fetch = originalFetch;
});

function mockGoogleFetch({ email, emailVerified }) {
  globalThis.fetch = async (url) => {
    const href = typeof url === 'string' ? url : url.toString();
    if (href.includes('oauth2.googleapis.com/token')) {
      return { ok: true, json: async () => ({ access_token: 'fake-access-token' }) };
    }
    if (href.includes('openidconnect.googleapis.com/v1/userinfo')) {
      return { ok: true, json: async () => ({ email, email_verified: emailVerified, name: 'Test Recruiter' }) };
    }
    throw new Error(`Unexpected fetch to ${href}`);
  };
}

function withRelations(user) {
  return {
    ...user,
    recruiterProfile: user.recruiterProfile
      ? { ...user.recruiterProfile, organisation: state.organisations.find((org) => org.id === user.recruiterProfile.organisationId) || null }
      : null,
    candidateProfile: user.candidateProfile || null,
  };
}

beforeEach(() => {
  state = { counters: {}, users: [], organisations: [], memberships: [], authTokens: [], auditLogs: [] };

  prisma.authToken = {
    updateMany: async ({ where, data }) => {
      let count = 0;
      state.authTokens.forEach((row) => {
        const matchesId = where.userId !== undefined ? row.userId === where.userId : true;
        const matchesHash = where.tokenHash !== undefined ? row.tokenHash === where.tokenHash : true;
        const matchesType = row.type === where.type;
        const matchesUnconsumed = where.consumedAt === null ? row.consumedAt === null : true;
        const matchesExpiry = where.expiresAt?.gt ? row.expiresAt > where.expiresAt.gt : true;
        if (matchesId && matchesHash && matchesType && matchesUnconsumed && matchesExpiry) {
          Object.assign(row, data);
          count += 1;
        }
      });
      return { count };
    },
    create: async ({ data }) => {
      const row = { id: nextId('token'), consumedAt: null, createdAt: new Date(), ...data };
      state.authTokens.push(row);
      return row;
    },
    findUnique: async ({ where, include }) => {
      const row = state.authTokens.find((item) => item.tokenHash === where.tokenHash);
      if (!row) return null;
      if (include?.user) {
        const user = state.users.find((item) => item.id === row.userId);
        return { ...row, user: user ? withRelations(user) : null };
      }
      return { ...row };
    },
  };

  prisma.$transaction = async (callback) => callback(prisma);

  prisma.organisation = {
    findUnique: async ({ where }) => state.organisations.find((org) => org.slug === where.slug) || null,
    findFirst: async ({ where }) => state.organisations.find(
      (org) => org.type === where.type && org.verifiedDomain === where.verifiedDomain,
    ) || null,
    create: async ({ data }) => {
      const organisation = { id: nextId('org'), createdAt: new Date(), updatedAt: new Date(), status: 'ACTIVE', ...data };
      state.organisations.push(organisation);
      return organisation;
    },
  };

  prisma.organisationMembership = {
    create: async ({ data }) => {
      const membership = { id: nextId('membership'), createdAt: new Date(), updatedAt: new Date(), ...data };
      state.memberships.push(membership);
      return membership;
    },
    findMany: async () => [],
  };

  prisma.user = {
    findUnique: async ({ where }) => {
      const user = state.users.find((item) => (where.id ? item.id === where.id : item.email === where.email));
      return user ? withRelations(user) : null;
    },
    create: async ({ data }) => {
      const { recruiterProfile, candidateProfile, ...rest } = data;
      const user = { id: nextId('user'), sessionVersion: 0, isActive: true, accountStatus: 'ACTIVE', createdAt: new Date(), updatedAt: new Date(), ...rest };
      if (recruiterProfile?.create) user.recruiterProfile = { id: nextId('recruiter-profile'), userId: user.id, ...recruiterProfile.create };
      if (candidateProfile?.create) user.candidateProfile = { id: nextId('candidate-profile'), userId: user.id, ...candidateProfile.create };
      state.users.push(user);
      return withRelations(user);
    },
    update: async ({ where, data }) => {
      const user = state.users.find((item) => item.id === where.id);
      Object.assign(user, data);
      return withRelations(user);
    },
  };

  prisma.recruiterProfile = { findUnique: async () => null, create: async ({ data }) => data };
  prisma.candidateProfile = { findUnique: async () => null };

  prisma.auditLog = {
    create: async ({ data }) => {
      const row = { id: nextId('audit'), createdAt: new Date(), ...data };
      state.auditLogs.push(row);
      return row;
    },
  };
});

async function signUpViaOAuth({ email, emailVerified = true }) {
  mockGoogleFetch({ email, emailVerified });
  const authUrl = await getOAuthAuthorizationUrl('google', { role: 'RECRUITER', employerType: 'CONSULTANCY', mode: 'signup', next: null });
  const state64 = new URL(authUrl).searchParams.get('state');
  return completeOAuthSignIn('google', 'fake-code', state64);
}

async function reauthenticateViaOAuth({ email, emailVerified = true }) {
  mockGoogleFetch({ email, emailVerified });
  const authUrl = await getOAuthAuthorizationUrl('google', { role: 'RECRUITER', employerType: 'CONSULTANCY', mode: 'login', next: null });
  const state64 = new URL(authUrl).searchParams.get('state');
  return completeOAuthSignIn('google', 'fake-code', state64);
}

test('active recruiter can complete OAuth sign-in and receives a token', async () => {
  const result = await signUpViaOAuth({ email: 'oauth-active@example.com' });
  assert.equal(typeof result.token, 'string');
  assert.ok(result.token.length > 0);
});

test('a deactivated existing account cannot obtain an OAuth-linked session', async () => {
  await signUpViaOAuth({ email: 'oauth-deactivated@example.com' });
  const user = state.users.find((u) => u.email === 'oauth-deactivated@example.com');
  user.isActive = false;
  user.accountStatus = 'DEACTIVATED';

  await assert.rejects(
    () => reauthenticateViaOAuth({ email: 'oauth-deactivated@example.com' }),
    (error) => {
      assert.equal(error.statusCode, 401);
      assert.equal(error.message, 'Invalid credentials.');
      return true;
    },
  );
});

test('the GET redirect OAuth flow blocks a deactivated account before minting even the short-lived handoff token', async () => {
  await signUpViaOAuth({ email: 'oauth-redirect-deactivated@example.com' });
  const user = state.users.find((u) => u.email === 'oauth-redirect-deactivated@example.com');
  user.isActive = false;
  user.accountStatus = 'DEACTIVATED';

  mockGoogleFetch({ email: 'oauth-redirect-deactivated@example.com', emailVerified: true });
  const authUrl = await getOAuthAuthorizationUrl('google', { role: 'RECRUITER', employerType: 'CONSULTANCY', mode: 'login', next: null });
  const state64 = new URL(authUrl).searchParams.get('state');

  const tokensBefore = state.authTokens.length;
  await assert.rejects(
    () => handleOAuthCallbackRedirect('google', 'fake-code', state64),
    (error) => error.statusCode === 401 && error.message === 'Invalid credentials.',
  );
  assert.equal(state.authTokens.filter((t) => t.type === 'OAUTH_HANDOFF').length, 0, 'no OAUTH_HANDOFF token issued for a blocked account');
  assert.equal(state.authTokens.length, tokensBefore, 'no new token of any kind was persisted');
});

test('exchangeOAuthSessionToken re-checks account status and blocks a handoff token redeemed after deactivation', async () => {
  // Simulates the race window: the handoff token was issued while the
  // account was still active, then the account got deactivated before the
  // token was redeemed.
  await signUpViaOAuth({ email: 'oauth-race@example.com' });
  const user = state.users.find((u) => u.email === 'oauth-race@example.com');

  mockGoogleFetch({ email: 'oauth-race@example.com', emailVerified: true });
  const authUrl = await getOAuthAuthorizationUrl('google', { role: 'RECRUITER', employerType: 'CONSULTANCY', mode: 'login', next: null });
  const state64 = new URL(authUrl).searchParams.get('state');
  const { redirectUrl } = await handleOAuthCallbackRedirect('google', 'fake-code', state64);
  const handoffCode = new URL(redirectUrl).searchParams.get('code');
  assert.ok(handoffCode, 'handoff token must have been issued while the account was still active');

  user.isActive = false;
  user.accountStatus = 'DEACTIVATED';

  await assert.rejects(
    () => exchangeOAuthSessionToken(handoffCode),
    (error) => error.statusCode === 401 && error.message === 'Invalid credentials.',
  );
});

test('a blocked OAuth login is audited without leaking credentials or tokens', async () => {
  await signUpViaOAuth({ email: 'oauth-audited@example.com' });
  const user = state.users.find((u) => u.email === 'oauth-audited@example.com');
  user.isActive = false;
  user.accountStatus = 'DEACTIVATED';

  await assert.rejects(() => reauthenticateViaOAuth({ email: 'oauth-audited@example.com' }));

  const entry = state.auditLogs.find((row) => row.entityId === user.id && row.action === 'auth.login.blocked');
  assert.ok(entry, 'expected an auth.login.blocked audit entry');
  assert.equal(entry.metadata.channel, 'oauth');
  const serialized = JSON.stringify(entry);
  assert.ok(!serialized.includes('fake-access-token'));
});
