import test, { before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';

// CAREERIZ EMPLOYER ACCESS, section 10: Google OAuth restrictions for the
// Consultancy Recruiter / Company Recruiter split. Runs the real
// getOAuthAuthorizationUrl -> completeOAuthSignIn round trip (through a
// mocked prisma.authToken store, so state tokens are genuinely
// issued/consumed) with global.fetch mocked to stand in for Google's token
// and userinfo endpoints - no real network calls are made.

let prisma;
let env;
let getOAuthAuthorizationUrl;
let completeOAuthSignIn;
let state;
let originalFetch;

function nextId(prefix) {
  state.counters[prefix] = (state.counters[prefix] || 0) + 1;
  return `${prefix}-${state.counters[prefix]}`;
}

before(async () => {
  ({ prisma } = await import('../config/db.js'));
  ({ env } = await import('../config/env.js'));

  // oauthService.js builds its provider config object (reading
  // env.googleClientId etc.) once at module-evaluation time, so these must
  // be set BEFORE the dynamic import below, not after.
  env.googleClientId = 'test-google-client-id';
  env.googleClientSecret = 'test-google-client-secret';
  env.googleRedirectUri = 'http://localhost:5000/api/auth/oauth/google/callback';

  ({ getOAuthAuthorizationUrl, completeOAuthSignIn } = await import('../services/oauthService.js'));

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
      return {
        ok: true,
        json: async () => ({ email, email_verified: emailVerified, name: 'Test Recruiter' }),
      };
    }
    throw new Error(`Unexpected fetch to ${href}`);
  };
}

beforeEach(() => {
  state = { counters: {}, users: [], organisations: [], memberships: [], authTokens: [] };

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

  prisma.organisation.findUnique = async ({ where }) => state.organisations.find((org) => org.slug === where.slug) || null;
  prisma.organisation.findFirst = async ({ where }) => state.organisations.find(
    (org) => org.type === where.type && org.verifiedDomain === where.verifiedDomain,
  ) || null;
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

  prisma.user.create = async ({ data, include }) => {
    const { recruiterProfile, candidateProfile, ...rest } = data;
    const user = { id: nextId('user'), sessionVersion: 0, isActive: true, accountStatus: 'ACTIVE', createdAt: new Date(), updatedAt: new Date(), ...rest };
    if (recruiterProfile?.create) user.recruiterProfile = { id: nextId('recruiter-profile'), userId: user.id, ...recruiterProfile.create };
    if (candidateProfile?.create) user.candidateProfile = { id: nextId('candidate-profile'), userId: user.id, ...candidateProfile.create };
    state.users.push(user);
    return withRelations(user);
  };

  prisma.user.update = async ({ where, data }) => {
    const user = state.users.find((item) => item.id === where.id);
    Object.assign(user, data);
    return withRelations(user);
  };

  prisma.recruiterProfile = { findUnique: async () => null, create: async ({ data }) => data };
  prisma.candidateProfile = { findUnique: async () => null };
});

async function runOAuthSignup({ role, employerType, email, emailVerified }) {
  mockGoogleFetch({ email, emailVerified });
  const authUrl = await getOAuthAuthorizationUrl('google', { role, employerType, mode: 'signup', next: null });
  const state64 = new URL(authUrl).searchParams.get('state');
  return completeOAuthSignIn('google', 'fake-code', state64);
}

test('Google OAuth with an unverified email cannot create a Recruiter account of either type', async () => {
  await assert.rejects(
    () => runOAuthSignup({ role: 'RECRUITER', employerType: 'CONSULTANCY', email: 'recruiter@gmail.com', emailVerified: false }),
    (error) => error.statusCode === 422 && error.code === 'OAUTH_EMAIL_NOT_VERIFIED',
  );
});

test('Google OAuth Gmail cannot create a Company Recruiter account', async () => {
  await assert.rejects(
    () => runOAuthSignup({ role: 'RECRUITER', employerType: 'COMPANY', email: 'hr@gmail.com', emailVerified: true }),
    (error) => error.statusCode === 422 && error.code === 'EMAIL_DOMAIN_CONSUMER',
  );
});

test('Google OAuth Gmail can create a Consultancy Recruiter account', async () => {
  const result = await runOAuthSignup({ role: 'RECRUITER', employerType: 'CONSULTANCY', email: 'recruiter@gmail.com', emailVerified: true });
  assert.equal(result.session.user.role, 'RECRUITER');
  assert.equal(result.session.user.recruiterProfile.organisation.type, 'CONSULTANCY');
});

test('Google OAuth verified business email can create a Company Recruiter account', async () => {
  const result = await runOAuthSignup({ role: 'RECRUITER', employerType: 'COMPANY', email: 'hr@newcorp.com', emailVerified: true });
  assert.equal(result.session.user.recruiterProfile.organisation.type, 'COMPANY');
  assert.equal(result.session.user.recruiterProfile.organisation.domainVerificationStatus, 'PENDING');
});

test('an existing recruiter re-authenticating via OAuth keeps their stored organisation type regardless of the employerType requested this time', async () => {
  const first = await runOAuthSignup({ role: 'RECRUITER', employerType: 'CONSULTANCY', email: 'recruiter@gmail.com', emailVerified: true });
  const originalOrgId = first.session.user.recruiterProfile.organisation.id;
  assert.equal(first.session.user.recruiterProfile.organisation.type, 'CONSULTANCY');

  // Same email, but this time the OAuth flow is started from the Company
  // Recruiter card. Must NOT reclassify the existing organisation or
  // require the email to pass the COMPANY domain policy.
  const second = await runOAuthSignup({ role: 'RECRUITER', employerType: 'COMPANY', email: 'recruiter@gmail.com', emailVerified: true });
  assert.equal(second.session.user.recruiterProfile.organisation.id, originalOrgId);
  assert.equal(second.session.user.recruiterProfile.organisation.type, 'CONSULTANCY');
});

// --- Domain-ownership closure section 6: OAuth state security ---

test('a claimed company domain cannot be bypassed via OAuth Company Recruiter signup', async () => {
  state.organisations.push({ id: 'org-acme', type: 'COMPANY', verifiedDomain: 'acme.com', domainVerificationStatus: 'VERIFIED' });

  await assert.rejects(
    () => runOAuthSignup({ role: 'RECRUITER', employerType: 'COMPANY', email: 'newhire@acme.com', emailVerified: true }),
    (error) => error.statusCode === 409 && error.code === 'EMAIL_DOMAIN_ALREADY_CLAIMED',
  );
});

test('a claimed company domain cannot be bypassed by switching to Consultancy Recruiter via OAuth', async () => {
  state.organisations.push({ id: 'org-acme', type: 'COMPANY', verifiedDomain: 'acme.com', domainVerificationStatus: 'VERIFIED' });

  await assert.rejects(
    () => runOAuthSignup({ role: 'RECRUITER', employerType: 'CONSULTANCY', email: 'person@acme.com', emailVerified: true }),
    (error) => error.statusCode === 422 && error.code === 'EMAIL_DOMAIN_COMPANY_CLAIMED',
  );
});

test('an OAuth state token can only be consumed once - a replay of an already-used state is rejected', async () => {
  mockGoogleFetch({ email: 'recruiter@gmail.com', emailVerified: true });
  const authUrl = await getOAuthAuthorizationUrl('google', { role: 'RECRUITER', employerType: 'CONSULTANCY', mode: 'signup', next: null });
  const state64 = new URL(authUrl).searchParams.get('state');

  await completeOAuthSignIn('google', 'fake-code', state64);

  await assert.rejects(
    () => completeOAuthSignIn('google', 'fake-code', state64),
    (error) => error.statusCode === 400,
  );
});

test('an expired OAuth state token is rejected, not silently honoured', async () => {
  mockGoogleFetch({ email: 'expired@gmail.com', emailVerified: true });
  const authUrl = await getOAuthAuthorizationUrl('google', { role: 'RECRUITER', employerType: 'CONSULTANCY', mode: 'signup', next: null });
  const state64 = new URL(authUrl).searchParams.get('state');

  // Simulate the 10-minute OAUTH_STATE TTL having elapsed.
  const tokenHash = crypto.createHash('sha256').update(state64).digest('hex');
  const row = state.authTokens.find((item) => item.tokenHash === tokenHash);
  row.expiresAt = new Date(Date.now() - 1000);

  await assert.rejects(
    () => completeOAuthSignIn('google', 'fake-code', state64),
    (error) => error.statusCode === 400,
  );
});

test('a tampered/forged state value is rejected outright - it is an opaque server-side token, not client-decodable data', async () => {
  await assert.rejects(
    () => completeOAuthSignIn('google', 'fake-code', 'attacker-supplied-not-a-real-token'),
    (error) => error.statusCode === 400,
  );
});

test('the employerType selected at OAuth /start is preserved verbatim through to /callback with no way for the client to alter it in between', async () => {
  mockGoogleFetch({ email: 'hr@newcorp.com', emailVerified: true });
  const authUrl = await getOAuthAuthorizationUrl('google', { role: 'RECRUITER', employerType: 'COMPANY', mode: 'signup', next: null });
  // The client only ever sees the opaque `state` query param below - there
  // is no employerType (or any other flow field) it could resend or edit
  // at callback time; consumeAuthToken looks it up server-side from the
  // token alone.
  const state64 = new URL(authUrl).searchParams.get('state');
  assert.equal(new URL(authUrl).searchParams.has('employerType'), false);

  const result = await completeOAuthSignIn('google', 'fake-code', state64);
  assert.equal(result.session.user.recruiterProfile.organisation.type, 'COMPANY');
});
