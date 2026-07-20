import test, { before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

let app;
let prisma;
let signToken;
let state;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function now() {
  return new Date('2026-07-17T10:00:00.000Z');
}

function seedState() {
  state = {
    users: [
      { id: 'candidate-user-1', email: 'candidate1@example.com', role: 'CANDIDATE', isActive: true, sessionVersion: 0, emailVerifiedAt: now() },
      { id: 'candidate-user-2', email: 'candidate2@example.com', role: 'CANDIDATE', isActive: true, sessionVersion: 0, emailVerifiedAt: now() },
      { id: 'recruiter-user-1', email: 'recruiter@example.com', role: 'RECRUITER', isActive: true, sessionVersion: 0, emailVerifiedAt: now() },
    ],
    candidateProfiles: [
      {
        id: 'candidate-1',
        userId: 'candidate-user-1',
        fullName: 'Candidate One',
        currentTitle: 'Frontend Engineer',
        headline: 'Builds polished UI',
        location: 'Bengaluru',
        preferredLocations: ['Bengaluru'],
        preferredRoles: ['frontend engineer'],
        totalExperience: 4,
        workplacePreferences: ['HYBRID'],
        employmentPreferences: ['FULL_TIME'],
        availability: 'IMMEDIATE',
        noticePeriodDays: 30,
        currentCtcLpa: 12,
        expectedCtcLpa: 18,
        skills: ['React', 'Next.js'],
        summary: 'Candidate summary',
        profileVisibility: 'PRIVATE',
        recommendationEnabled: true,
        notifyForSavedJobUpdates: true,
        notifyForRecommendations: true,
        notifyForInterviews: true,
        profileViews: 2,
        sharedResumeSlug: 'candidate-one',
        updatedAt: now(),
      },
      {
        id: 'candidate-2',
        userId: 'candidate-user-2',
        fullName: 'Candidate Two',
        currentTitle: 'Backend Engineer',
        headline: 'APIs and data',
        location: 'Remote',
        preferredLocations: ['Remote'],
        preferredRoles: ['backend engineer'],
        totalExperience: 5,
        workplacePreferences: ['REMOTE'],
        employmentPreferences: ['FULL_TIME'],
        availability: 'ONE_MONTH',
        noticePeriodDays: 60,
        currentCtcLpa: 15,
        expectedCtcLpa: 22,
        skills: ['Node.js'],
        summary: 'Other summary',
        profileVisibility: 'PRIVATE',
        recommendationEnabled: true,
        notifyForSavedJobUpdates: true,
        notifyForRecommendations: true,
        notifyForInterviews: true,
        profileViews: 1,
        sharedResumeSlug: 'candidate-two',
        updatedAt: now(),
      },
    ],
    organisations: [
      {
        id: 'org-1',
        name: 'Acme Labs',
        slug: 'acme-labs',
        status: 'ACTIVE',
        careersEnabled: true,
        website: 'https://acme.example.com',
        logoUrl: 'https://acme.example.com/logo.png',
        publicDescription: 'Builds recruitment software.',
        industry: 'Software',
        organisationSize: '51-200',
        headquarters: 'Bengaluru',
        publicLocations: ['Bengaluru', 'Remote'],
        cultureSummary: 'High ownership.',
        benefitsSummary: 'Health and learning benefits.',
        createdAt: now(),
        updatedAt: now(),
      },
      {
        id: 'org-2',
        name: 'Inactive Corp',
        slug: 'inactive-corp',
        status: 'INACTIVE',
        careersEnabled: true,
        publicLocations: [],
        createdAt: now(),
        updatedAt: now(),
      },
    ],
    jobs: [
      {
        id: 'job-public-1',
        organisationId: 'org-1',
        recruiterId: 'recruiter-user-1',
        title: 'Frontend Engineer',
        slug: 'frontend-engineer',
        description: 'Build candidate-facing features.',
        skillsRequired: ['React', 'Next.js'],
        experienceMin: 2,
        experienceMax: 5,
        salaryMin: 14,
        salaryMax: 20,
        currency: 'INR',
        isPublic: true,
        publicSalaryEnabled: true,
        featuredInPortal: true,
        location: 'Bengaluru',
        employmentType: 'FULL_TIME',
        workplaceType: 'HYBRID',
        numberOfOpenings: 2,
        responsibilities: [],
        requirements: [],
        benefits: [],
        applicationDeadline: null,
        status: 'OPEN',
        archivedAt: null,
        createdAt: new Date('2026-07-16T10:00:00.000Z'),
        updatedAt: now(),
      },
      {
        id: 'job-public-2',
        organisationId: 'org-1',
        recruiterId: 'recruiter-user-1',
        title: 'Design Systems Engineer',
        slug: 'design-systems-engineer',
        description: 'Drive UI consistency.',
        skillsRequired: ['React', 'Accessibility'],
        experienceMin: 3,
        experienceMax: 6,
        salaryMin: 15,
        salaryMax: 21,
        currency: 'INR',
        isPublic: true,
        publicSalaryEnabled: false,
        featuredInPortal: false,
        location: 'Bengaluru',
        employmentType: 'FULL_TIME',
        workplaceType: 'ONSITE',
        numberOfOpenings: 1,
        responsibilities: [],
        requirements: [],
        benefits: [],
        applicationDeadline: null,
        status: 'OPEN',
        archivedAt: null,
        createdAt: new Date('2026-07-15T10:00:00.000Z'),
        updatedAt: now(),
      },
      {
        id: 'job-private',
        organisationId: 'org-1',
        recruiterId: 'recruiter-user-1',
        title: 'Private Role',
        slug: 'private-role',
        description: 'Not public.',
        skillsRequired: ['Node.js'],
        experienceMin: 2,
        experienceMax: 4,
        salaryMin: 10,
        salaryMax: 12,
        currency: 'INR',
        isPublic: false,
        publicSalaryEnabled: true,
        featuredInPortal: false,
        location: 'Remote',
        employmentType: 'FULL_TIME',
        workplaceType: 'REMOTE',
        numberOfOpenings: 1,
        responsibilities: [],
        requirements: [],
        benefits: [],
        applicationDeadline: null,
        status: 'OPEN',
        archivedAt: null,
        createdAt: new Date('2026-07-14T10:00:00.000Z'),
        updatedAt: now(),
      },
      {
        id: 'job-closed',
        organisationId: 'org-1',
        recruiterId: 'recruiter-user-1',
        title: 'Closed Role',
        slug: 'closed-role',
        description: 'Closed.',
        skillsRequired: ['React'],
        experienceMin: 1,
        experienceMax: 2,
        salaryMin: 9,
        salaryMax: 10,
        currency: 'INR',
        isPublic: true,
        publicSalaryEnabled: true,
        featuredInPortal: false,
        location: 'Bengaluru',
        employmentType: 'FULL_TIME',
        workplaceType: 'ONSITE',
        numberOfOpenings: 1,
        responsibilities: [],
        requirements: [],
        benefits: [],
        applicationDeadline: null,
        status: 'CLOSED',
        archivedAt: null,
        createdAt: new Date('2026-07-13T10:00:00.000Z'),
        updatedAt: now(),
      },
      {
        id: 'job-inactive-org',
        organisationId: 'org-2',
        recruiterId: 'recruiter-user-1',
        title: 'Inactive Org Role',
        slug: 'inactive-org-role',
        description: 'Hidden by org status.',
        skillsRequired: ['React'],
        experienceMin: 1,
        experienceMax: 2,
        salaryMin: 9,
        salaryMax: 10,
        currency: 'INR',
        isPublic: true,
        publicSalaryEnabled: true,
        featuredInPortal: false,
        location: 'Pune',
        employmentType: 'FULL_TIME',
        workplaceType: 'ONSITE',
        numberOfOpenings: 1,
        responsibilities: [],
        requirements: [],
        benefits: [],
        applicationDeadline: null,
        status: 'OPEN',
        archivedAt: null,
        createdAt: new Date('2026-07-13T10:00:00.000Z'),
        updatedAt: now(),
      },
    ],
    savedJobs: [
      {
        id: 'saved-1',
        candidateId: 'candidate-2',
        jobId: 'job-public-1',
        organisationId: 'org-1',
        jobSlugSnapshot: 'frontend-engineer',
        jobTitleSnapshot: 'Frontend Engineer',
        organisationNameSnapshot: 'Acme Labs',
        createdAt: now(),
      },
    ],
    notifications: [
      {
        id: 'notification-1',
        recipientUserId: 'candidate-user-1',
        type: 'JOB',
        title: 'Saved job updated',
        message: 'Frontend Engineer changed.',
        entityType: 'Job',
        entityId: 'frontend-engineer',
        readAt: null,
        createdAt: now(),
      },
      {
        id: 'notification-2',
        recipientUserId: 'candidate-user-2',
        type: 'JOB',
        title: 'Other notification',
        message: 'Should stay private.',
        entityType: 'Job',
        entityId: 'design-systems-engineer',
        readAt: null,
        createdAt: now(),
      },
    ],
  };
}

function publicJobVisible(job) {
  const organisation = state.organisations.find((item) => item.id === job.organisationId);
  return Boolean(
    job.status === 'OPEN'
    && job.isPublic
    && !job.archivedAt
    && organisation?.status === 'ACTIVE'
    && organisation?.careersEnabled
    && (!job.applicationDeadline || new Date(job.applicationDeadline) >= now())
  );
}

function attachOrganisation(job) {
  return {
    ...clone(job),
    organisation: clone(state.organisations.find((item) => item.id === job.organisationId) || null),
  };
}

function authHeader(userId) {
  return { Authorization: `Bearer ${signToken({ userId, sessionVersion: 0 })}` };
}

before(async () => {
  ({ app } = await import('../app.js'));
  ({ prisma } = await import('../config/db.js'));
  ({ signToken } = await import('../utils/jwt.js'));
});

beforeEach(() => {
  seedState();

  prisma.organisationMembership.findMany = async () => [];
  prisma.user.findUnique = async ({ where, include = {} }) => {
    const user = state.users.find((item) => item.id === where.id) || null;
    if (!user) return null;
    return {
      ...clone(user),
      recruiterProfile: include.recruiterProfile ? null : undefined,
      candidateProfile: include.candidateProfile ? clone(state.candidateProfiles.find((item) => item.userId === user.id) || null) : undefined,
    };
  };

  prisma.job.count = async ({ where = {} } = {}) => state.jobs.filter((job) => {
    if (!publicJobVisible(job)) return false;
    if (where.AND) {
      if (where.AND.some((clause) => clause.location?.contains && !job.location.toLowerCase().includes(clause.location.contains.toLowerCase()))) {
        return false;
      }
    }
    return true;
  }).length;

  prisma.job.findMany = async ({ where = {}, include = {}, orderBy = [], skip = 0, take, select, distinct } = {}) => {
    let rows = state.jobs.filter((job) => {
      if (where.id?.not && job.id === where.id.not) return false;
      if (!publicJobVisible(job)) return false;
      if (where.slug && job.slug !== where.slug) return false;
      if (where.organisation?.slug && state.organisations.find((item) => item.id === job.organisationId)?.slug !== where.organisation.slug) return false;
      if (where.AND) {
        for (const clause of where.AND) {
          if (clause.location?.contains && !job.location.toLowerCase().includes(clause.location.contains.toLowerCase())) return false;
          if (clause.title?.contains && !job.title.toLowerCase().includes(clause.title.contains.toLowerCase())) return false;
          if (clause.skillsRequired?.hasSome && !clause.skillsRequired.hasSome.some((skill) => job.skillsRequired.includes(skill))) return false;
          if (clause.organisation?.name?.contains && !state.organisations.find((item) => item.id === job.organisationId)?.name.toLowerCase().includes(clause.organisation.name.contains.toLowerCase())) return false;
        }
      }
      return true;
    });

    if (distinct?.includes('location')) {
      rows = Object.values(rows.reduce((accumulator, job) => {
        accumulator[job.location] ||= job;
        return accumulator;
      }, {}));
    }

    rows.sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id));
    rows = rows.slice(skip, take ? skip + take : undefined);

    if (select) {
      return rows.map((row) => {
        const picked = {};
        for (const key of Object.keys(select)) picked[key] = row[key];
        return picked;
      });
    }

    return rows.map((row) => (include.organisation ? attachOrganisation(row) : clone(row)));
  };

  prisma.job.findFirst = async ({ where = {}, include = {} } = {}) => {
    const row = state.jobs.find((job) => {
      if (where.slug && job.slug !== where.slug) return false;
      if (where.id && typeof where.id === 'string' && job.id !== where.id) return false;
      if (where.id?.not && job.id === where.id.not) return false;
      if (!publicJobVisible(job)) return false;
      return true;
    });
    return row ? (include.organisation ? attachOrganisation(row) : clone(row)) : null;
  };

  prisma.organisation.findFirst = async ({ where = {} } = {}) => {
    const row = state.organisations.find((organisation) => (
      organisation.slug === where.slug
      && organisation.status === where.status
      && organisation.careersEnabled === where.careersEnabled
    ));
    return row ? clone(row) : null;
  };

  prisma.organisation.findMany = async ({ where = {}, select } = {}) => {
    const rows = state.organisations.filter((organisation) => (
      organisation.status === where.status
      && organisation.careersEnabled === where.careersEnabled
      && state.jobs.some((job) => job.organisationId === organisation.id && publicJobVisible(job))
    ));
    return rows.map((row) => ({
      slug: row.slug,
      updatedAt: row.updatedAt,
      ...(select?.name ? { name: row.name } : {}),
    }));
  };

  prisma.savedJob.findMany = async ({ where = {}, select } = {}) => {
    const rows = state.savedJobs.filter((item) => {
      if (where.candidateId && item.candidateId !== where.candidateId) return false;
      if (where.jobId?.in && !where.jobId.in.includes(item.jobId)) return false;
      return true;
    });
    return rows.map((row) => (select ? { jobId: row.jobId } : clone(row)));
  };
  prisma.savedJob.findFirst = async ({ where = {} } = {}) => clone(state.savedJobs.find((item) => item.candidateId === where.candidateId && item.jobId === where.jobId) || null);
  prisma.savedJob.upsert = async ({ where, create } = {}) => {
    const existing = state.savedJobs.find((item) => item.candidateId === where.candidateId_jobId.candidateId && item.jobId === where.candidateId_jobId.jobId);
    if (existing) return clone(existing);
    const saved = { id: `saved-${state.savedJobs.length + 1}`, ...create, createdAt: now() };
    state.savedJobs.push(saved);
    return clone(saved);
  };
  prisma.savedJob.delete = async ({ where }) => {
    state.savedJobs = state.savedJobs.filter((item) => item.id !== where.id);
  };
  prisma.savedJob.count = async ({ where = {} } = {}) => state.savedJobs.filter((item) => !where.candidateId || item.candidateId === where.candidateId).length;

  prisma.candidateProfile.findUnique = async ({ where } = {}) => clone(state.candidateProfiles.find((item) => item.id === where.id) || null);
  prisma.candidateProfile.update = async ({ where, data } = {}) => {
    const profile = state.candidateProfiles.find((item) => item.id === where.id);
    Object.assign(profile, data);
    return clone(profile);
  };
  prisma.candidateActivity = {
    create: async () => ({}),
  };
  prisma.auditLog = {
    create: async () => ({}),
  };

  prisma.notification.count = async ({ where = {} } = {}) => state.notifications.filter((item) => item.recipientUserId === where.recipientUserId && (!('readAt' in where) || item.readAt === where.readAt)).length;
  prisma.notification.findMany = async ({ where = {}, skip = 0, take } = {}) => {
    let rows = state.notifications.filter((item) => {
      if (where.recipientUserId && item.recipientUserId !== where.recipientUserId) return false;
      if (where.readAt === null && item.readAt !== null) return false;
      if (where.type && item.type !== where.type) return false;
      return true;
    });
    rows = rows.slice(skip, take ? skip + take : undefined);
    return rows.map(clone);
  };
  prisma.notification.findFirst = async ({ where = {} } = {}) => clone(state.notifications.find((item) => item.id === where.id && item.recipientUserId === where.recipientUserId) || null);
  prisma.notification.update = async ({ where, data } = {}) => {
    const notification = state.notifications.find((item) => item.id === where.id);
    Object.assign(notification, data);
    return clone(notification);
  };
  prisma.notification.updateMany = async ({ where = {}, data } = {}) => {
    state.notifications
      .filter((item) => item.recipientUserId === where.recipientUserId && (!('readAt' in where) || item.readAt === where.readAt))
      .forEach((item) => Object.assign(item, data));
  };
});

test('public job listing route returns only eligible jobs and excludes internal fields', async () => {
  const response = await request(app).get('/api/public/jobs').query({ sort: 'newest' });

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data.map((item) => item.slug), ['frontend-engineer', 'design-systems-engineer']);
  assert.equal(response.body.data[0].organisationId, undefined);
  assert.equal(response.body.data[0].recruiter, undefined);
});

test('public job listing route preserves filters and pagination', async () => {
  const response = await request(app).get('/api/public/jobs').query({
    location: 'Bengaluru',
    page: 2,
    pageSize: 1,
    sort: 'newest',
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.meta.page, 2);
  assert.equal(response.body.meta.pageCount, 2);
  assert.equal(response.body.data[0].slug, 'design-systems-engineer');
});

test('public job detail route returns safe 404 for invalid slug', async () => {
  const response = await request(app).get('/api/public/jobs/missing-role');
  assert.equal(response.status, 404);
});

test('public organisation route returns public-safe fields and scoped jobs', async () => {
  const response = await request(app).get('/api/public/companies/acme-labs');

  assert.equal(response.status, 200);
  assert.equal(response.body.data.organisation.name, 'Acme Labs');
  assert.equal(response.body.data.organisation.memberships, undefined);
  assert.deepEqual(response.body.data.jobs.items.map((item) => item.slug), ['frontend-engineer', 'design-systems-engineer']);
});

test('public organisation route returns safe 404 for invalid slug', async () => {
  const response = await request(app).get('/api/public/companies/unknown-company');
  assert.equal(response.status, 404);
});

test('candidate self-service routes require candidate authentication', async () => {
  const response = await request(app).get('/api/candidate/profile');
  assert.equal(response.status, 401);
});

test('recruiter access to candidate self-service routes is denied', async () => {
  const response = await request(app)
    .get('/api/candidate/profile')
    .set(authHeader('recruiter-user-1'));

  assert.equal(response.status, 403);
});

test('candidate profile route reads and updates only the authenticated candidate profile', async () => {
  const readResponse = await request(app)
    .get('/api/candidate/profile')
    .set(authHeader('candidate-user-1'));

  assert.equal(readResponse.status, 200);
  assert.equal(readResponse.body.data.profile.id, 'candidate-1');

  const updateResponse = await request(app)
    .patch('/api/candidate/profile')
    .set(authHeader('candidate-user-1'))
    .send({ fullName: 'Updated Candidate One', currentTitle: 'Senior Frontend Engineer' });

  assert.equal(updateResponse.status, 200);
  assert.equal(updateResponse.body.data.profile.fullName, 'Updated Candidate One');
  assert.equal(state.candidateProfiles.find((item) => item.id === 'candidate-2').fullName, 'Candidate Two');
});

test('candidate self-service validation failures return 422', async () => {
  const response = await request(app)
    .patch('/api/candidate/profile')
    .set(authHeader('candidate-user-1'))
    .send({ fullName: 'A' });

  assert.equal(response.status, 422);
});

test('candidate saved-job ownership is enforced', async () => {
  const response = await request(app)
    .delete('/api/candidate/saved-jobs/job-public-1')
    .set(authHeader('candidate-user-1'));

  assert.equal(response.status, 404);
});

test('candidate notifications are recipient scoped', async () => {
  const listResponse = await request(app)
    .get('/api/candidate/notifications')
    .set(authHeader('candidate-user-1'));

  assert.equal(listResponse.status, 200);
  assert.deepEqual(listResponse.body.data.map((item) => item.id), ['notification-1']);

  const markOtherResponse = await request(app)
    .post('/api/candidate/notifications/read')
    .set(authHeader('candidate-user-1'))
    .send({ notificationId: 'notification-2' });

  assert.equal(markOtherResponse.status, 404);
});
