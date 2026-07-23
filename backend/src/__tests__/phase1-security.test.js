import test, { before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import request from 'supertest';

let app;
let prisma;
let state;
let getSentEmails;
let resetSentEmails;
let getEmailTransportInfo;
let resolveEmailTransportInfo;
let resolveElasticConfig;
let searchCandidatesWithAdapters;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function latestEmailLinkToken(paramName) {
  const emails = getSentEmails();
  const email = emails[emails.length - 1];
  assert.ok(email, `Expected a sent email containing ${paramName}.`);
  const match = email.text.match(/https?:\/\/\S+/);
  assert.ok(match, 'Expected the email body to contain a URL.');
  const url = new URL(match[0]);
  const token = url.searchParams.get(paramName);
  assert.ok(token, `Expected URL parameter ${paramName}.`);
  return token;
}

function withRelationsUser(user, include = {}) {
  if (!user) return null;
  return {
    ...clone(user),
    recruiterProfile: include.recruiterProfile ? {
      ...clone(state.recruiterProfiles.find((item) => item.userId === user.id) || null),
      organisation: include.recruiterProfile.include?.organisation
        ? clone(state.organisations.find((item) => item.id === state.recruiterProfiles.find((entry) => entry.userId === user.id)?.organisationId) || null)
        : undefined,
    } : undefined,
    candidateProfile: include.candidateProfile ? clone(state.candidateProfiles.find((item) => item.userId === user.id) || null) : undefined,
  };
}

function withRelationsJob(job, include = {}) {
  if (!job) return null;
  return {
    ...clone(job),
    _count: include._count ? { applications: state.applications.filter((item) => item.jobId === job.id).length } : undefined,
    recruiter: include.recruiter
      ? withRelationsUser(state.users.find((item) => item.id === job.recruiterId), include.recruiter.include || {})
      : undefined,
  };
}

function withRelationsCandidate(candidate, include = {}) {
  if (!candidate) return null;
  return {
    ...clone(candidate),
    user: include.user ? clone(state.users.find((item) => item.id === candidate.userId) || null) : undefined,
    resumeBuilder: include.resumeBuilder ? clone(state.resumeBuilders.find((item) => item.candidateId === candidate.id) || null) : undefined,
  };
}

function withRelationsApplication(application, include = {}) {
  if (!application) return null;
  return {
    ...clone(application),
    job: include.job ? withRelationsJob(state.jobs.find((item) => item.id === application.jobId), include.job.include || {}) : undefined,
    candidate: include.candidate ? withRelationsCandidate(state.candidateProfiles.find((item) => item.id === application.candidateId), include.candidate.include || {}) : undefined,
    notes: include.notes ? state.notes.filter((item) => item.applicationId === application.id).map((item) => ({
      ...clone(item),
      author: include.notes.include?.author
        ? withRelationsUser(state.users.find((user) => user.id === item.authorId), include.notes.include.author.include || {})
        : undefined,
    })) : undefined,
    activities: include.activities ? state.activities.filter((item) => item.applicationId === application.id).map(clone) : undefined,
  };
}

async function seedState() {
  const recruiterHash = await bcrypt.hash('Password123', 12);
  const candidateHash = await bcrypt.hash('Password123', 12);

  state = {
    users: [
      {
        id: 'recruiter-1',
        email: 'owner@company.com',
        passwordHash: recruiterHash,
        role: 'RECRUITER',
        isActive: true,
        sessionVersion: 0,
        emailVerifiedAt: new Date('2026-01-01'),
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      },
      {
        id: 'recruiter-2',
        email: 'other@company.com',
        passwordHash: recruiterHash,
        role: 'RECRUITER',
        isActive: true,
        sessionVersion: 0,
        emailVerifiedAt: new Date('2026-01-01'),
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      },
      {
        id: 'candidate-1-user',
        email: 'candidate1@example.com',
        passwordHash: candidateHash,
        role: 'CANDIDATE',
        isActive: true,
        sessionVersion: 0,
        emailVerifiedAt: new Date('2026-01-01'),
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      },
      {
        id: 'candidate-2-user',
        email: 'candidate2@example.com',
        passwordHash: candidateHash,
        role: 'CANDIDATE',
        isActive: true,
        sessionVersion: 0,
        emailVerifiedAt: new Date('2026-01-01'),
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      },
    ],
    recruiterProfiles: [
      {
        id: 'recruiter-profile-1',
        userId: 'recruiter-1',
        organisationId: 'organisation-1',
        companyEmailDomain: 'company.com',
        officeLocations: [],
        profileCompleted: true,
        companyName: 'Owner Corp',
      },
      {
        id: 'recruiter-profile-2',
        userId: 'recruiter-2',
        organisationId: 'organisation-2',
        companyEmailDomain: 'company.com',
        officeLocations: [],
        profileCompleted: true,
        companyName: 'Other Corp',
      },
    ],
    candidateProfiles: [
      {
        id: 'candidate-1',
        userId: 'candidate-1-user',
        fullName: 'Candidate One',
        location: 'Bengaluru',
        preferredLocations: [],
        totalExperience: 4,
        currentCtcLpa: null,
        expectedCtcLpa: null,
        availability: 'IMMEDIATE',
        skills: ['React', 'Node.js'],
        summary: 'Frontend engineer',
        resumeUrl: '/resume-1.pdf',
        sharedResumeSlug: 'candidate-one',
        profileViews: 3,
        lastActiveAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      },
      {
        id: 'candidate-2',
        userId: 'candidate-2-user',
        fullName: 'Candidate Two',
        location: 'Mumbai',
        preferredLocations: [],
        totalExperience: 6,
        currentCtcLpa: null,
        expectedCtcLpa: null,
        availability: 'ONE_MONTH',
        skills: ['Java'],
        summary: 'Backend engineer',
        resumeUrl: '/resume-2.pdf',
        sharedResumeSlug: 'candidate-two',
        profileViews: 1,
        lastActiveAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      },
    ],
    jobs: [
      {
        id: 'job-1',
        organisationId: 'organisation-1',
        recruiterId: 'recruiter-1',
        title: 'Frontend Engineer',
        slug: 'frontend-engineer',
        description: 'Build frontend systems',
        skillsRequired: ['React'],
        experienceMin: 2,
        experienceMax: 5,
        salaryMin: 10,
        salaryMax: 20,
        location: 'Bengaluru',
        employmentType: 'FULL_TIME',
        status: 'OPEN',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      },
    ],
    applications: [
      {
        id: 'application-1',
        organisationId: 'organisation-1',
        jobId: 'job-1',
        candidateId: 'candidate-1',
        currentStage: 'APPLIED',
        statusLabel: 'Applied',
        coverLetter: 'Interested in the role.',
        recruiterTag: null,
        appliedAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        interviewScheduledAt: null,
        interviewerName: null,
        recruiterNotes: null,
        matchScore: 90,
      },
    ],
    notes: [],
    activities: [],
    authTokens: [],
    resumeBuilders: [],
    organisations: [
      {
        id: 'organisation-1',
        name: 'Owner Corp',
        slug: 'owner-corp',
        status: 'ACTIVE',
        website: null,
        logoUrl: null,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      },
      {
        id: 'organisation-2',
        name: 'Other Corp',
        slug: 'other-corp',
        status: 'ACTIVE',
        website: null,
        logoUrl: null,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      },
    ],
    organisationMemberships: [
      {
        id: 'membership-1',
        organisationId: 'organisation-1',
        userId: 'recruiter-1',
        role: 'OWNER',
        status: 'ACTIVE',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      },
      {
        id: 'membership-2',
        organisationId: 'organisation-2',
        userId: 'recruiter-2',
        role: 'OWNER',
        status: 'ACTIVE',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      },
    ],
  };
}

function installPrismaMocks() {
  prisma.user ||= {};
  prisma.organisation ||= {};
  prisma.organisationMembership ||= {};
  prisma.job ||= {};
  prisma.application ||= {};
  prisma.candidateProfile ||= {};
  prisma.authToken ||= {};
  prisma.savedCandidate ||= {};

  prisma.user.findUnique = async ({ where, include = {} }) => {
    const user = state.users.find((item) => (
      (where.id && item.id === where.id) ||
      (where.email && item.email === where.email)
    ));
    return withRelationsUser(user, include);
  };

  prisma.user.create = async ({ data, include = {} }) => {
    const user = {
      id: `user-${state.users.length + 1}`,
      email: data.email,
      passwordHash: data.passwordHash,
      role: data.role,
      isActive: true,
      sessionVersion: data.sessionVersion ?? 0,
      emailVerifiedAt: data.emailVerifiedAt || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    state.users.push(user);

    if (data.recruiterProfile?.create) {
      state.recruiterProfiles.push({
        id: `recruiter-profile-${state.recruiterProfiles.length + 1}`,
        userId: user.id,
        ...data.recruiterProfile.create,
      });
    }

    if (data.candidateProfile?.create) {
      state.candidateProfiles.push({
        id: `candidate-profile-${state.candidateProfiles.length + 1}`,
        userId: user.id,
        preferredLocations: [],
        currentCtcLpa: null,
        expectedCtcLpa: null,
        availability: 'IMMEDIATE',
        summary: null,
        resumeUrl: null,
        profileViews: 0,
        lastActiveAt: null,
        updatedAt: new Date(),
        ...data.candidateProfile.create,
      });
    }

    return withRelationsUser(user, include);
  };

  prisma.user.update = async ({ where, data, include = {} }) => {
    const user = state.users.find((item) => item.id === where.id);
    const nextData = { ...data };
    if (data.sessionVersion?.increment) {
      user.sessionVersion += data.sessionVersion.increment;
      delete nextData.sessionVersion;
    }
    Object.assign(user, nextData, { updatedAt: new Date() });
    return withRelationsUser(user, include);
  };

  prisma.organisation.findUnique = async ({ where }) => clone(state.organisations.find((item) => item.id === where.id || item.slug === where.slug) || null);
  prisma.organisation.create = async ({ data }) => {
    const organisation = {
      id: `organisation-${state.organisations.length + 1}`,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    };
    state.organisations.push(organisation);
    return clone(organisation);
  };

  prisma.organisationMembership.findMany = async ({ where = {}, include = {} }) => {
    let memberships = [...state.organisationMemberships];
    if (where.userId) {
      memberships = memberships.filter((item) => item.userId === where.userId);
    }
    if (where.organisationId) {
      memberships = memberships.filter((item) => item.organisationId === where.organisationId);
    }
    if (where.status) {
      memberships = memberships.filter((item) => item.status === where.status);
    }
    return memberships.map((membership) => ({
      ...clone(membership),
      organisation: include.organisation ? clone(state.organisations.find((item) => item.id === membership.organisationId) || null) : undefined,
      user: include.user ? clone(state.users.find((item) => item.id === membership.userId) || null) : undefined,
    }));
  };
  prisma.organisationMembership.create = async ({ data }) => {
    const membership = {
      id: `membership-${state.organisationMemberships.length + 1}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    };
    state.organisationMemberships.push(membership);
    return clone(membership);
  };

  prisma.candidateProfile.findUnique = async ({ where, include = {} }) => {
    const candidate = state.candidateProfiles.find((item) => item.id === where.id);
    return withRelationsCandidate(candidate, include);
  };

  prisma.candidateProfile.findMany = async ({ where = {}, include = {} }) => {
    let candidates = [...state.candidateProfiles];
    if (where.id?.in) {
      candidates = candidates.filter((item) => where.id.in.includes(item.id));
    }
    return candidates.map((candidate) => withRelationsCandidate(candidate, include));
  };

  prisma.job.findUnique = async ({ where }) => clone(state.jobs.find((item) => item.id === where.id) || null);
  prisma.job.findFirst = async ({ where = {}, include = {} }) => {
    const job = state.jobs.find((item) => (
      (!where.id || item.id === where.id)
      && (!where.organisationId || item.organisationId === where.organisationId)
    ));
    return withRelationsJob(job, include);
  };
  prisma.job.findMany = async ({ where = {}, include = {} }) => {
    let jobs = [...state.jobs];
    if (where.recruiterId) {
      jobs = jobs.filter((item) => item.recruiterId === where.recruiterId);
    }
    if (where.status) {
      jobs = jobs.filter((item) => item.status === where.status);
    }
    return jobs.map((job) => withRelationsJob(job, include));
  };
  prisma.job.update = async ({ where, data }) => {
    const job = state.jobs.find((item) => item.id === where.id);
    Object.assign(job, data, { updatedAt: new Date() });
    return clone(job);
  };

  prisma.application.findUnique = async ({ where, include = {} }) => {
    const application = state.applications.find((item) => item.id === where.id);
    return withRelationsApplication(application, include);
  };
  prisma.application.findFirst = async ({ where = {}, include = {} }) => {
    const application = state.applications.find((item) => (
      (!where.id || item.id === where.id)
      && (!where.organisationId || item.organisationId === where.organisationId)
    ));
    return withRelationsApplication(application, include);
  };
  prisma.application.update = async ({ where, data, include = {} }) => {
    const application = state.applications.find((item) => item.id === where.id);
    Object.assign(application, data, { updatedAt: new Date() });
    if (data.activities?.create) {
      state.activities.push({
        id: `activity-${state.activities.length + 1}`,
        applicationId: application.id,
        message: data.activities.create.message,
        createdAt: new Date(),
      });
    }
    return withRelationsApplication(application, include);
  };
  prisma.application.findMany = async ({ where = {}, include = {} }) => {
    let applications = [...state.applications];
    if (where.candidateId) {
      applications = applications.filter((item) => item.candidateId === where.candidateId);
    }
    if (where.job?.recruiterId) {
      applications = applications.filter((item) => state.jobs.find((job) => job.id === item.jobId)?.recruiterId === where.job.recruiterId);
    }
    return applications.map((application) => withRelationsApplication(application, include));
  };

  prisma.savedCandidate.findMany = async ({ where = {} }) => {
    let saved = [...(state.savedCandidates || [])];
    if (where.organisationId) {
      saved = saved.filter((item) => item.organisationId === where.organisationId);
    }
    if (where.candidateId?.in) {
      saved = saved.filter((item) => where.candidateId.in.includes(item.candidateId));
    }
    if (where.tag) {
      saved = saved.filter((item) => item.tag === where.tag);
    }
    return saved.map(clone);
  };

  prisma.recruiterSavedSearch ||= {};
  prisma.recruiterSavedSearch.create = async ({ data }) => ({
    id: `saved-search-${Date.now()}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...clone(data),
  });

  prisma.authToken.updateMany = async ({ where, data }) => {
    let count = 0;
    for (const token of state.authTokens) {
      const matches =
        (where.userId === undefined || token.userId === where.userId)
        && (where.tokenHash === undefined || token.tokenHash === where.tokenHash)
        && (where.type === undefined || token.type === where.type)
        && (where.consumedAt === undefined || token.consumedAt === where.consumedAt)
        && (!where.expiresAt?.gt || token.expiresAt > where.expiresAt.gt);

      if (matches) {
        token.consumedAt = data.consumedAt;
        count += 1;
      }
    }
    return { count };
  };
  prisma.authToken.create = async ({ data }) => {
    const token = {
      id: `token-${state.authTokens.length + 1}`,
      createdAt: new Date(),
      consumedAt: null,
      ...data,
    };
    state.authTokens.push(token);
    return clone(token);
  };
  prisma.authToken.findUnique = async ({ where, include = {} }) => {
    const token = state.authTokens.find((item) => (
      (where.tokenHash && item.tokenHash === where.tokenHash)
      || (where.id && item.id === where.id)
    ));
    if (!token) return null;
    return {
      ...clone(token),
      user: include.user ? withRelationsUser(state.users.find((item) => item.id === token.userId), include.user.include || {}) : undefined,
    };
  };
  prisma.authToken.update = async ({ where, data }) => {
    const token = state.authTokens.find((item) => item.id === where.id);
    Object.assign(token, data);
    return clone(token);
  };

  prisma.$transaction = async (callback) => callback(prisma);
}

async function loginAs(email, password = 'Password123') {
  const response = await request(app).post('/api/auth/login').send({ email, password });
  assert.equal(response.statusCode, 200);
  return response.body.data.token;
}

before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.FRONTEND_URL = 'http://localhost:3000';
  process.env.JWT_SECRET = '12345678901234567890123456789012';
  process.env.SMTP_HOST = 'smtp.example.com';
  process.env.SMTP_PORT = '587';
  process.env.SMTP_USER = 'smtp-user';
  process.env.SMTP_PASS = 'smtp-pass';
  process.env.GOOGLE_CLIENT_ID = 'google-client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret';
  process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/api/auth/google/callback';

  ({ app } = await import('../app.js'));
  ({ prisma } = await import('../config/db.js'));
  ({
    __getSentEmails: getSentEmails,
    __resetSentEmails: resetSentEmails,
    __getEmailTransportInfo: getEmailTransportInfo,
    __resolveEmailTransportInfo: resolveEmailTransportInfo,
  } = await import('../services/emailService.js'));
  ({ __resolveElasticConfig: resolveElasticConfig } = await import('../config/elastic.js'));
  ({ __searchCandidatesWithAdapters: searchCandidatesWithAdapters } = await import('../services/searchService.js'));
});

beforeEach(async () => {
  await seedState();
  installPrismaMocks();
  resetSentEmails();
});

test('registration requires verification and does not expose sensitive tokens in API responses', async () => {
  const response = await request(app).post('/api/auth/signup').send({
    email: 'newcandidate@example.com',
    password: 'Password123',
    role: 'CANDIDATE',
  });

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.data.emailVerificationRequired, true);
  assert.equal(response.body.data.verificationToken, undefined);
  assert.equal(response.body.data.user.passwordHash, undefined);
  assert.equal(state.authTokens[0].type, 'EMAIL_VERIFICATION');
  assert.notEqual(state.authTokens[0].tokenHash, latestEmailLinkToken('token'));
  assert.equal(getEmailTransportInfo().kind, 'test');
  assert.equal(getSentEmails().length, 1);
});

test('candidate signup defaults to CANDIDATE when role is omitted', async () => {
  const response = await request(app).post('/api/auth/signup').send({
    email: 'defaultcandidate@example.com',
    password: 'Password123',
    fullName: 'Default Candidate',
  });

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.data.user.role, 'CANDIDATE');
  assert.equal(state.users.find((item) => item.email === 'defaultcandidate@example.com')?.role, 'CANDIDATE');
  assert.ok(state.candidateProfiles.some((item) => item.fullName === 'Default Candidate'));
});

test('privileged role injection is rejected during public signup', async () => {
  const response = await request(app).post('/api/auth/signup').send({
    email: 'admininject@example.com',
    password: 'Password123',
    role: 'ADMIN',
  });

  assert.equal(response.statusCode, 422);
  assert.equal(state.users.some((item) => item.email === 'admininject@example.com'), false);
});

test('login is blocked before verification and succeeds after single-use email verification', async () => {
  const signup = await request(app).post('/api/auth/signup').send({
    email: 'unverified@example.com',
    password: 'Password123',
    role: 'CANDIDATE',
  });
  assert.equal(signup.statusCode, 201);

  const verificationToken = latestEmailLinkToken('token');
  const blockedLogin = await request(app).post('/api/auth/login').send({
    email: 'unverified@example.com',
    password: 'Password123',
  });
  assert.equal(blockedLogin.statusCode, 403);

  const verify = await request(app).post('/api/auth/email-verification/confirm').send({ token: verificationToken });
  assert.equal(verify.statusCode, 200);

  const verifyAgain = await request(app).post('/api/auth/email-verification/confirm').send({ token: verificationToken });
  assert.equal(verifyAgain.statusCode, 400);

  const login = await request(app).post('/api/auth/login').send({
    email: 'unverified@example.com',
    password: 'Password123',
  });
  assert.equal(login.statusCode, 200);
  assert.equal(login.body.data.session.user.passwordHash, undefined);
});

test('invalid login returns 401', async () => {
  const response = await request(app).post('/api/auth/login').send({
    email: 'owner@company.com',
    password: 'wrong-password',
  });

  assert.equal(response.statusCode, 401);
});

test('login response and authenticated session expose the same canonical backend role', async () => {
  const login = await request(app).post('/api/auth/login').send({
    email: 'owner@company.com',
    password: 'Password123',
  });

  assert.equal(login.statusCode, 200);
  assert.equal(login.body.data.session.user.role, 'RECRUITER');

  const me = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${login.body.data.token}`);

  assert.equal(me.statusCode, 200);
  assert.equal(me.body.data.role, 'RECRUITER');
});

test('protected endpoints require authentication', async () => {
  const response = await request(app).get('/api/jobs');
  assert.equal(response.statusCode, 401);
});

test('candidate sessions cannot access recruiter-only APIs', async () => {
  const token = await loginAs('candidate1@example.com');
  const response = await request(app)
    .get('/api/jobs')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(response.statusCode, 403);
});

test('job ownership is hidden with 404 for cross-organisation access', async () => {
  const token = await loginAs('other@company.com');
  const response = await request(app)
    .patch('/api/jobs/job-1')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Tampered title' });

  assert.equal(response.statusCode, 404);
});

test('resume search denies candidates and falls back safely for recruiters when Elasticsearch is disabled', async () => {
  const candidateToken = await loginAs('candidate1@example.com');
  const denied = await request(app)
    .get('/api/resumes/search')
    .set('Authorization', `Bearer ${candidateToken}`);

  assert.equal(denied.statusCode, 403);

  const recruiterToken = await loginAs('owner@company.com');
  const allowed = await request(app)
    .get('/api/resumes/search')
    .set('Authorization', `Bearer ${recruiterToken}`);

  assert.equal(allowed.statusCode, 200);
  assert.equal(Array.isArray(allowed.body.data), true);
  assert.equal(allowed.body.meta.searchMode, 'database');
  assert.match(allowed.body.meta.warning, /standard database fallback/i);
  assert.equal(resolveElasticConfig().enabled, false);
});

test('resume search still validates recruiter filters and falls back when Elasticsearch is disabled', async () => {
  const recruiterToken = await loginAs('owner@company.com');
  const response = await request(app)
    .get('/api/resumes/search?keyword=nomatch')
    .set('Authorization', `Bearer ${recruiterToken}`);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.meta.searchMode, 'database');
  assert.match(response.body.meta.warning, /standard database fallback/i);
});

test('resume search still validates recruiter filters when Elasticsearch is disabled', async () => {
  const recruiterToken = await loginAs('owner@company.com');
  const response = await request(app)
    .get('/api/resumes/search?minExperience=not-a-number')
    .set('Authorization', `Bearer ${recruiterToken}`);

  assert.equal(response.statusCode, 422);
  assert.equal(response.body.success, false);
  assert.equal(response.body.details.fieldErrors.minExperience[0], 'minExperience must be a number.');
});

test('resume search backend failures are surfaced instead of silently falling back to candidate data', async () => {
  const failingElastic = {
    async search() {
      throw new Error('Search backend unavailable');
    },
  };
  let fallbackQueried = false;

  await assert.rejects(
    () => searchCandidatesWithAdapters({}, {
      elasticClient: failingElastic,
      candidateProfileDelegate: {
        async findMany() {
          fallbackQueried = true;
          return [];
        },
      },
    }),
    /Search backend unavailable/
  );

  assert.equal(fallbackQueried, false);
});

test('ATS stage transition hides cross-organisation applications', async () => {
  const token = await loginAs('other@company.com');
  const response = await request(app)
    .patch('/api/ats/pipeline/application-1/stage')
    .set('Authorization', `Bearer ${token}`)
    .send({ stage: 'SHORTLISTED' });

  assert.equal(response.statusCode, 404);
});

test('logout invalidates an issued JWT immediately', async () => {
  const token = await loginAs('candidate1@example.com');

  const beforeLogout = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(beforeLogout.statusCode, 200);

  const logout = await request(app)
    .post('/api/auth/logout')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(logout.statusCode, 200);

  const afterLogout = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(afterLogout.statusCode, 401);
});

test('password reset requires a short-lived reset session, invalidates prior JWTs, and does not expose tokens', async () => {
  const jwt = await loginAs('candidate1@example.com');

  const requestReset = await request(app)
    .post('/api/auth/password-reset/request')
    .send({ email: 'candidate1@example.com' });
  assert.equal(requestReset.statusCode, 200);
  assert.equal(requestReset.body.data.resetToken, undefined);
  assert.equal(getEmailTransportInfo().kind, 'test');
  assert.equal(getSentEmails().length, 1);

  const resetToken = latestEmailLinkToken('token');
  assert.notEqual(state.authTokens[0].tokenHash, resetToken);

  const createSession = await request(app)
    .post('/api/auth/password-reset/session')
    .send({ token: resetToken });
  assert.equal(createSession.statusCode, 200);
  assert.ok(createSession.body.data.token);

  const reset = await request(app)
    .post('/api/auth/password-reset/confirm')
    .send({ token: createSession.body.data.token, password: 'NewPassword123' });
  assert.equal(reset.statusCode, 200);

  const resetAgain = await request(app)
    .post('/api/auth/password-reset/confirm')
    .send({ token: createSession.body.data.token, password: 'AnotherPassword123' });
  assert.equal(resetAgain.statusCode, 400);

  const reusedResetLink = await request(app)
    .post('/api/auth/password-reset/session')
    .send({ token: resetToken });
  assert.equal(reusedResetLink.statusCode, 400);

  const staleJwt = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${jwt}`);
  assert.equal(staleJwt.statusCode, 401);

  const oldLogin = await request(app).post('/api/auth/login').send({
    email: 'candidate1@example.com',
    password: 'Password123',
  });
  assert.equal(oldLogin.statusCode, 401);

  const newLogin = await request(app).post('/api/auth/login').send({
    email: 'candidate1@example.com',
    password: 'NewPassword123',
  });
  assert.equal(newLogin.statusCode, 200);
});

test('email verification resend uses the isolated test transport even when SMTP env vars are configured', async () => {
  state.users.find((item) => item.id === 'candidate-1-user').emailVerifiedAt = null;

  const response = await request(app)
    .post('/api/auth/email-verification/request')
    .send({ email: 'candidate1@example.com' });

  assert.equal(response.statusCode, 200);
  assert.equal(getEmailTransportInfo().kind, 'test');
  assert.equal(getSentEmails().length, 1);
  assert.match(getSentEmails()[0].text, /email-verification\/confirm\?token=/);
});

test('SMTP transport remains the selected runtime mode outside test when SMTP is configured', () => {
  assert.deepEqual(resolveEmailTransportInfo({
    isTest: false,
    smtpHost: 'smtp.example.com',
    smtpPort: 587,
  }), {
    kind: 'smtp',
    usesSmtp: true,
    host: 'smtp.example.com',
    port: 587,
  });

  assert.deepEqual(resolveEmailTransportInfo({
    isTest: false,
    smtpHost: '',
    smtpPort: 587,
  }), {
    kind: 'stub',
    usesSmtp: false,
    host: null,
    port: null,
  });
});

test('inactive and deleted users are rejected even with previously valid JWTs', async () => {
  const inactiveToken = await loginAs('candidate1@example.com');
  state.users.find((item) => item.id === 'candidate-1-user').isActive = false;

  const inactiveResponse = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${inactiveToken}`);
  assert.equal(inactiveResponse.statusCode, 401);

  const deletedToken = await loginAs('candidate2@example.com');
  state.users = state.users.filter((item) => item.id !== 'candidate-2-user');

  const deletedResponse = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${deletedToken}`);
  assert.equal(deletedResponse.statusCode, 401);
});

test('wrong token type, expired token, and replayed tokens are rejected', async () => {
  await request(app).post('/api/auth/signup').send({
    email: 'typed-token@example.com',
    password: 'Password123',
    role: 'CANDIDATE',
  });
  const verificationToken = latestEmailLinkToken('token');

  const wrongType = await request(app)
    .post('/api/auth/password-reset/session')
    .send({ token: verificationToken });
  assert.equal(wrongType.statusCode, 400);

  const verificationRecord = state.authTokens.find((item) => item.type === 'EMAIL_VERIFICATION');
  verificationRecord.expiresAt = new Date('2025-01-01');

  const expired = await request(app)
    .post('/api/auth/email-verification/confirm')
    .send({ token: verificationToken });
  assert.equal(expired.statusCode, 400);
});

test('concurrent token consumption allows one success and one rejection', async () => {
  const requestReset = await request(app)
    .post('/api/auth/password-reset/request')
    .send({ email: 'candidate1@example.com' });
  assert.equal(requestReset.statusCode, 200);

  const resetToken = latestEmailLinkToken('token');
  const [first, second] = await Promise.all([
    request(app).post('/api/auth/password-reset/session').send({ token: resetToken }),
    request(app).post('/api/auth/password-reset/session').send({ token: resetToken }),
  ]);

  const statuses = [first.statusCode, second.statusCode].sort((a, b) => a - b);
  assert.deepEqual(statuses, [200, 400]);
});

test('OAuth start uses opaque state and valid callback redirects with a handoff code instead of a JWT', async () => {
  const start = await request(app).get('/api/auth/oauth/google/start?role=CANDIDATE&mode=login');
  assert.equal(start.statusCode, 302);

  const providerUrl = new URL(start.headers.location);
  const stateToken = providerUrl.searchParams.get('state');
  assert.ok(stateToken);
  assert.equal(providerUrl.searchParams.get('role'), null);

  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    if (String(url).includes('oauth2.googleapis.com/token')) {
      return new Response(JSON.stringify({ access_token: 'oauth-access-token' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      email: 'oauthcandidate@example.com',
      name: 'OAuth Candidate',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const callback = await request(app)
      .get(`/api/auth/oauth/google/callback?code=oauth-code&state=${stateToken}`);
    assert.equal(callback.statusCode, 302);
    assert.match(callback.headers.location, /\/api\/auth\/oauth\/callback\?/);
    assert.equal(callback.headers.location.includes('oauthToken='), false);
    assert.equal(callback.headers.location.includes('eyJ'), false);
  } finally {
    global.fetch = originalFetch;
  }
});

test('tampered, expired, replayed, and unsupported OAuth state requests are rejected', async () => {
  const unsupported = await request(app).get('/api/auth/oauth/unknown/start');
  assert.equal(unsupported.statusCode, 302);
  assert.match(unsupported.headers.location, /oauthError=/);

  const start = await request(app).get('/api/auth/oauth/google/start?role=CANDIDATE&mode=login');
  const stateToken = new URL(start.headers.location).searchParams.get('state');

  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    if (String(url).includes('oauth2.googleapis.com/token')) {
      return new Response(JSON.stringify({ access_token: 'oauth-access-token' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      email: 'validcandidate@example.com',
      name: 'Valid Candidate',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const tampered = await request(app)
      .get(`/api/auth/oauth/google/callback?code=oauth-code&state=${stateToken}tampered`);
    assert.equal(tampered.statusCode, 302);
    assert.match(tampered.headers.location, /oauthError=/);

    const expiredToken = await request(app).get('/api/auth/oauth/google/start?role=CANDIDATE&mode=login');
    const expiredState = new URL(expiredToken.headers.location).searchParams.get('state');
    state.authTokens[state.authTokens.length - 1].expiresAt = new Date('2025-01-01');
    const expired = await request(app)
      .get(`/api/auth/oauth/google/callback?code=oauth-code&state=${expiredState}`);
    assert.equal(expired.statusCode, 302);
    assert.match(expired.headers.location, /oauthError=/);

    const success = await request(app)
      .get(`/api/auth/oauth/google/callback?code=oauth-code&state=${stateToken}`);
    assert.equal(success.statusCode, 302);

    const replay = await request(app)
      .get(`/api/auth/oauth/google/callback?code=oauth-code&state=${stateToken}`);
    assert.equal(replay.statusCode, 302);
    assert.match(replay.headers.location, /oauthError=/);
  } finally {
    global.fetch = originalFetch;
  }
});

test('OAuth role context is server-side, cannot be escalated client-side, and recruiter OAuth enforces company email policy', async () => {
  const originalFetch = global.fetch;
  let profileEmail = 'candidateoauth@example.com';
  global.fetch = async (url) => {
    if (String(url).includes('oauth2.googleapis.com/token')) {
      return new Response(JSON.stringify({ access_token: 'oauth-access-token' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      email: profileEmail,
      name: 'Personal Mail User',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const candidateStart = await request(app).get('/api/auth/oauth/google/start?role=CANDIDATE&mode=signup');
    const candidateState = new URL(candidateStart.headers.location).searchParams.get('state');
    const candidateCallback = await request(app)
      .get(`/api/auth/oauth/google/callback?code=oauth-code&state=${candidateState}&role=RECRUITER`);
    assert.equal(candidateCallback.statusCode, 302);
    assert.match(candidateCallback.headers.location, /next=%2Fcandidate%2Fonboarding/);
    assert.equal(state.users.find((item) => item.email === 'candidateoauth@example.com')?.role, 'CANDIDATE');

    profileEmail = 'gmailuser@gmail.com';
    const recruiterStart = await request(app).get('/api/auth/oauth/google/start?role=RECRUITER&mode=signup');
    const recruiterState = new URL(recruiterStart.headers.location).searchParams.get('state');
    const recruiterCallback = await request(app)
      .get(`/api/auth/oauth/google/callback?code=oauth-code&state=${recruiterState}`);
    assert.equal(recruiterCallback.statusCode, 302);
    assert.match(recruiterCallback.headers.location, /oauthError=/);
    assert.equal(state.users.some((item) => item.role === 'RECRUITER' && item.email === 'gmailuser@gmail.com'), false);
  } finally {
    global.fetch = originalFetch;
  }
});
