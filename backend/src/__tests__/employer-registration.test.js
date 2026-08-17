import test, { before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// CAREERIZ EMPLOYER ACCESS, section 10: registration-flow coverage for the
// Consultancy Recruiter / Company Recruiter split. Exercises
// authService.registerUser end to end (through prisma mocks) rather than
// domainPolicyService in isolation - this is what proves employerType
// tampering, domain claiming, and pending-review behaviour actually work
// through the real registration path.

let prisma;
let registerUser;
let state;

function nextId(prefix) {
  state.counters[prefix] = (state.counters[prefix] || 0) + 1;
  return `${prefix}-${state.counters[prefix]}`;
}

before(async () => {
  ({ prisma } = await import('../config/db.js'));
  ({ registerUser } = await import('../services/authService.js'));
});

beforeEach(() => {
  state = {
    counters: {},
    users: [],
    organisations: [],
    memberships: [],
  };

  // Initial-setup gate: no platformSetupState mock at all makes
  // getSetupState() return null by construction (see setupService.js), so
  // only these counts matter for "already initialized".
  prisma.organisation.count = async () => 1;
  prisma.user.count = async () => 1;

  prisma.user.findUnique = async ({ where }) => {
    const user = state.users.find((item) => (where.id ? item.id === where.id : item.email === where.email));
    if (!user) return null;
    return {
      ...user,
      recruiterProfile: user.recruiterProfile
        ? { ...user.recruiterProfile, organisation: state.organisations.find((org) => org.id === user.recruiterProfile.organisationId) || null }
        : null,
      candidateProfile: user.candidateProfile || null,
    };
  };

  prisma.user.create = async ({ data }) => {
    const { recruiterProfile, candidateProfile, ...rest } = data;
    const user = {
      id: nextId('user'),
      sessionVersion: 0,
      emailVerifiedAt: null,
      mustChangePassword: false,
      isActive: true,
      accountStatus: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...rest,
    };
    if (recruiterProfile?.create) {
      user.recruiterProfile = { id: nextId('recruiter-profile'), userId: user.id, ...recruiterProfile.create };
    }
    if (candidateProfile?.create) {
      user.candidateProfile = { id: nextId('candidate-profile'), userId: user.id, ...candidateProfile.create };
    }
    state.users.push(user);
    return prisma.user.findUnique({ where: { id: user.id } });
  };

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

  prisma.authToken = {
    updateMany: async () => ({ count: 0 }),
    create: async ({ data }) => ({ id: nextId('token'), createdAt: new Date(), ...data }),
  };

  prisma.$transaction = async (callback) => callback(prisma);
});

function payload(overrides = {}) {
  return {
    email: 'recruiter@example.com',
    password: 'Password123!',
    role: 'RECRUITER',
    ...overrides,
  };
}

test('Consultancy Recruiter registration succeeds with a Gmail address', async () => {
  const result = await registerUser(payload({ email: 'recruiter@gmail.com', employerType: 'CONSULTANCY' }));
  assert.equal(result.user.recruiterProfile.organisation.type, 'CONSULTANCY');
  assert.equal(result.user.recruiterProfile.organisation.domainVerificationStatus, 'NOT_APPLICABLE');
});

test('Consultancy Recruiter registration succeeds with a business email', async () => {
  const result = await registerUser(payload({ email: 'owner@myagency.com', employerType: 'CONSULTANCY' }));
  assert.equal(result.user.recruiterProfile.organisation.type, 'CONSULTANCY');
});

test('Consultancy Recruiter registration rejects a disposable email', async () => {
  await assert.rejects(
    () => registerUser(payload({ email: 'temp@mailinator.com', employerType: 'CONSULTANCY' })),
    (error) => error.statusCode === 422 && error.code === 'EMAIL_DOMAIN_DISPOSABLE',
  );
});

test('Company Recruiter registration rejects Gmail', async () => {
  await assert.rejects(
    () => registerUser(payload({ email: 'hr@gmail.com', employerType: 'COMPANY' })),
    (error) => error.statusCode === 422 && error.code === 'EMAIL_DOMAIN_CONSUMER',
  );
});

test('Company Recruiter registration rejects Yahoo and Outlook', async () => {
  await assert.rejects(
    () => registerUser(payload({ email: 'hr@yahoo.com', employerType: 'COMPANY' })),
    (error) => error.code === 'EMAIL_DOMAIN_CONSUMER',
  );
  await assert.rejects(
    () => registerUser(payload({ email: 'hr@outlook.com', employerType: 'COMPANY' })),
    (error) => error.code === 'EMAIL_DOMAIN_CONSUMER',
  );
});

test('Company Recruiter registration rejects a disposable domain', async () => {
  await assert.rejects(
    () => registerUser(payload({ email: 'hr@mailinator.com', employerType: 'COMPANY' })),
    (error) => error.code === 'EMAIL_DOMAIN_DISPOSABLE',
  );
});

test('Company Recruiter registration with an unknown business domain succeeds and starts PENDING review', async () => {
  const result = await registerUser(payload({ email: 'hr@newcorp.com', employerType: 'COMPANY' }));
  assert.equal(result.user.recruiterProfile.organisation.type, 'COMPANY');
  assert.equal(result.user.recruiterProfile.organisation.verifiedDomain, 'newcorp.com');
  assert.equal(result.user.recruiterProfile.organisation.domainVerificationStatus, 'PENDING');
});

test('Company Recruiter registration for a domain already verified by another organisation is rejected, not silently joined', async () => {
  state.organisations.push({
    id: 'org-acme',
    name: 'Acme',
    slug: 'acme',
    type: 'COMPANY',
    verifiedDomain: 'acme.com',
    domainVerificationStatus: 'VERIFIED',
  });

  await assert.rejects(
    () => registerUser(payload({ email: 'newhire@acme.com', employerType: 'COMPANY' })),
    (error) => error.statusCode === 409 && error.code === 'EMAIL_DOMAIN_ALREADY_CLAIMED',
  );

  // Confirms the rejection did not create a second organisation for the
  // same verified domain (no silent duplicate / claim).
  assert.equal(state.organisations.filter((org) => org.verifiedDomain === 'acme.com').length, 1);
});

test('a database-level unique-constraint conflict on the organisation slug is translated into a stable, non-crashing error', async () => {
  const originalCreate = prisma.organisation.create;
  prisma.organisation.create = async () => {
    const dbError = new Error('Unique constraint failed on the fields: (`slug`)');
    dbError.code = 'P2002';
    dbError.meta = { target: ['slug'] };
    throw dbError;
  };

  await assert.rejects(
    () => registerUser(payload({ email: 'someone@newcorp.com', employerType: 'COMPANY' })),
    (error) => error.statusCode === 409 && error.code === 'ORGANISATION_SLUG_CONFLICT',
  );

  prisma.organisation.create = originalCreate;
});

test('a database-level unique-constraint conflict on the domain (the real concurrency guard) is translated into the same stable EMAIL_DOMAIN_ALREADY_CLAIMED error', async () => {
  // Simulates two requests racing past the pre-check (assertEmailAllowedForEmployerType
  // sees no existing row yet) with the LOSING transaction's INSERT hitting
  // the database's partial unique index - proven for real against Postgres
  // in the disposable-database concurrency test; this proves the
  // application-layer translation in isolation. The winning transaction's
  // row is pushed to `state.organisations` BEFORE the mocked create throws,
  // simulating that it already committed - this is what
  // createRecruiterOrganisation's post-conflict findFirst re-check
  // (the authoritative signal, not the raw error shape) will see.
  const originalCreate = prisma.organisation.create;
  prisma.organisation.create = async () => {
    state.organisations.push({ id: 'org-winner', name: 'NewCorp', slug: 'newcorp', type: 'COMPANY', verifiedDomain: 'newcorp.com', domainVerificationStatus: 'PENDING' });
    const dbError = new Error('Unique constraint failed on the fields: (`verifiedDomain`)');
    dbError.code = 'P2002';
    dbError.meta = { target: 'Organisation_company_verified_domain_key' };
    throw dbError;
  };

  await assert.rejects(
    () => registerUser(payload({ email: 'racer@newcorp.com', employerType: 'COMPANY' })),
    (error) => error.statusCode === 409 && error.code === 'EMAIL_DOMAIN_ALREADY_CLAIMED',
  );

  prisma.organisation.create = originalCreate;
});

test('a same-domain race loser gets EMAIL_DOMAIN_ALREADY_CLAIMED even when the raw database error reports a slug conflict, not a domain one', async () => {
  // Proves the fix for the exact scenario the real 8-way concurrency
  // harness exposed: under real concurrency, Postgres does not guarantee
  // WHICH of two simultaneous unique-index violations a losing transaction
  // observes first. A loser must never see the unrelated-sounding
  // ORGANISATION_SLUG_CONFLICT for a race it lost because of the DOMAIN,
  // not the slug.
  const originalCreate = prisma.organisation.create;
  prisma.organisation.create = async () => {
    state.organisations.push({ id: 'org-winner', name: 'NewCorp', slug: 'newcorp', type: 'COMPANY', verifiedDomain: 'newcorp.com', domainVerificationStatus: 'PENDING' });
    const dbError = new Error('Unique constraint failed on the fields: (`slug`)');
    dbError.code = 'P2002';
    dbError.meta = { target: ['slug'] };
    throw dbError;
  };

  await assert.rejects(
    () => registerUser(payload({ email: 'racer2@newcorp.com', employerType: 'COMPANY' })),
    (error) => error.statusCode === 409 && error.code === 'EMAIL_DOMAIN_ALREADY_CLAIMED',
  );

  prisma.organisation.create = originalCreate;
});

test('employerType is required for recruiter registration and cannot be omitted to skip the domain check', async () => {
  await assert.rejects(
    () => registerUser(payload({ email: 'hr@gmail.com', employerType: undefined })),
    (error) => error.statusCode === 422 && error.code === 'EMPLOYER_TYPE_REQUIRED',
  );
});

test('an invalid employerType value is rejected rather than defaulting to the more permissive policy', async () => {
  await assert.rejects(
    () => registerUser(payload({ email: 'hr@gmail.com', employerType: 'SUPERADMIN' })),
    (error) => error.statusCode === 422 && error.code === 'EMPLOYER_TYPE_REQUIRED',
  );
});

test('a client cannot set organisation.type directly - only employerType (which is independently re-validated) has any effect', async () => {
  // Simulates a tampered payload that includes a raw `type` field alongside
  // a mismatched employerType. authService.registerUser never reads
  // payload.type at all - the classification result (server-derived from
  // employerType + the actual email domain) is the only source for the
  // organisation's stored type.
  const tampered = payload({
    email: 'recruiter@gmail.com',
    employerType: 'CONSULTANCY',
    type: 'COMPANY',
  });

  const result = await registerUser(tampered);
  assert.equal(result.user.recruiterProfile.organisation.type, 'CONSULTANCY');
});

test('candidate registration is unaffected by employer-type logic', async () => {
  const result = await registerUser({
    email: 'candidate@gmail.com',
    password: 'Password123!',
    role: 'CANDIDATE',
  });
  assert.equal(result.user.role, 'CANDIDATE');
  assert.equal(result.user.recruiterProfile, null);
});
