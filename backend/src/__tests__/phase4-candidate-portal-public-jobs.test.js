import test, { before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

let prisma;
let searchPublicJobs;
let getPublicJobDetail;
let getPublicOrganisationProfile;
let getCandidateSelfProfile;
let updateCandidateSelfProfile;
let listSavedJobs;
let saveJobForCandidate;
let removeSavedJob;
let getCandidateRecommendations;
let listCandidateNotifications;
let markCandidateNotificationRead;
let getCandidateDashboard;

let state;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function now() {
  return new Date('2026-07-16T12:00:00.000Z');
}

function seedState() {
  state = {
    organisations: [
      {
        id: 'org-1',
        name: 'Acme Labs',
        slug: 'acme-labs',
        status: 'ACTIVE',
        careersEnabled: true,
        publicDescription: 'Builds hiring software.',
        industry: 'Software',
        organisationSize: '51-200',
        headquarters: 'Bengaluru',
        publicLocations: ['Bengaluru', 'Remote'],
        cultureSummary: 'High ownership.',
        benefitsSummary: 'Health coverage.',
        createdAt: now(),
        updatedAt: now(),
      },
      {
        id: 'org-2',
        name: 'Dormant Corp',
        slug: 'dormant-corp',
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
        title: 'Frontend Engineer',
        slug: 'frontend-engineer',
        description: 'Ship polished product experiences.',
        skillsRequired: ['React', 'Next.js', 'Accessibility'],
        experienceMin: 2,
        experienceMax: 5,
        salaryMin: 18,
        salaryMax: 24,
        currency: 'INR',
        isPublic: true,
        publicSalaryEnabled: true,
        featuredInPortal: true,
        location: 'Bengaluru',
        employmentType: 'FULL_TIME',
        workplaceType: 'HYBRID',
        numberOfOpenings: 2,
        responsibilities: ['Build candidate experiences'],
        requirements: ['Strong React fundamentals'],
        benefits: ['Health insurance'],
        applicationDeadline: new Date('2026-08-01T00:00:00.000Z'),
        status: 'OPEN',
        archivedAt: null,
        createdAt: new Date('2026-07-15T00:00:00.000Z'),
        updatedAt: now(),
      },
      {
        id: 'job-public-2',
        organisationId: 'org-1',
        title: 'Backend Engineer',
        slug: 'backend-engineer',
        description: 'Scale APIs and data systems.',
        skillsRequired: ['Node.js', 'PostgreSQL'],
        experienceMin: 3,
        experienceMax: 6,
        salaryMin: 20,
        salaryMax: 28,
        currency: 'INR',
        isPublic: true,
        publicSalaryEnabled: false,
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
        createdAt: new Date('2026-07-14T00:00:00.000Z'),
        updatedAt: now(),
      },
      {
        id: 'job-closed',
        organisationId: 'org-1',
        title: 'Closed role',
        slug: 'closed-role',
        description: 'Closed.',
        skillsRequired: ['React'],
        experienceMin: 1,
        experienceMax: 2,
        salaryMin: 10,
        salaryMax: 12,
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
        createdAt: new Date('2026-07-10T00:00:00.000Z'),
        updatedAt: now(),
      },
      {
        id: 'job-archived',
        organisationId: 'org-1',
        title: 'Archived role',
        slug: 'archived-role',
        description: 'Archived.',
        skillsRequired: ['React'],
        experienceMin: 1,
        experienceMax: 2,
        salaryMin: 10,
        salaryMax: 12,
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
        status: 'OPEN',
        archivedAt: now(),
        createdAt: new Date('2026-07-10T00:00:00.000Z'),
        updatedAt: now(),
      },
      {
        id: 'job-inactive-org',
        organisationId: 'org-2',
        title: 'Inactive org role',
        slug: 'inactive-org-role',
        description: 'Hidden due to organisation.',
        skillsRequired: ['Node.js'],
        experienceMin: 2,
        experienceMax: 3,
        salaryMin: 12,
        salaryMax: 14,
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
        createdAt: new Date('2026-07-12T00:00:00.000Z'),
        updatedAt: now(),
      },
    ],
    candidates: [
      {
        id: 'candidate-1',
        fullName: 'Aarav Sharma',
        currentTitle: 'Frontend Engineer',
        currentDesignation: 'Frontend Engineer',
        currentEmployer: 'Acme Labs',
        headline: 'Product-minded engineer',
        location: 'Bengaluru',
        currentCity: 'Bengaluru',
        preferredLocations: ['Bengaluru', 'Remote'],
        preferredRoles: ['frontend', 'product engineer'],
        totalExperience: 4,
        workplacePreferences: ['HYBRID', 'REMOTE'],
        employmentPreferences: ['FULL_TIME'],
        availability: 'IMMEDIATE',
        noticePeriodDays: 30,
        currentCtcLpa: 16,
        expectedCtcLpa: 22,
        skills: ['React', 'Next.js', 'Node.js'],
        summary: 'Ships polished product flows.',
        educationEntries: [{ degree: 'B.Tech Computer Science' }],
        experienceEntries: [{ company: 'Acme Labs', title: 'Frontend Engineer', isCurrent: true }],
        resumeUrl: '/private/resume.pdf',
        profileImageUrl: null,
        portfolioUrl: 'https://portfolio.example.com',
        linkedInUrl: 'https://linkedin.com/in/aarav',
        githubUrl: 'https://github.com/aarav',
        profileVisibility: 'PRIVATE',
        recommendationEnabled: true,
        notifyForSavedJobUpdates: true,
        notifyForRecommendations: true,
        notifyForInterviews: true,
        profileViews: 3,
        sharedResumeSlug: 'aarav-sharma',
        lastActiveAt: now(),
        updatedAt: now(),
      },
      {
        id: 'candidate-2',
        fullName: 'Incomplete User',
        currentTitle: null,
        currentDesignation: null,
        currentEmployer: 'Other Corp',
        headline: null,
        location: null,
        currentCity: null,
        preferredLocations: [],
        preferredRoles: [],
        totalExperience: 0,
        workplacePreferences: [],
        employmentPreferences: [],
        availability: 'IMMEDIATE',
        noticePeriodDays: null,
        currentCtcLpa: null,
        expectedCtcLpa: null,
        skills: [],
        summary: null,
        educationEntries: [],
        experienceEntries: [],
        resumeUrl: null,
        profileImageUrl: null,
        portfolioUrl: null,
        linkedInUrl: null,
        githubUrl: null,
        profileVisibility: 'PRIVATE',
        recommendationEnabled: true,
        notifyForSavedJobUpdates: true,
        notifyForRecommendations: true,
        notifyForInterviews: true,
        profileViews: 0,
        sharedResumeSlug: 'incomplete',
        lastActiveAt: now(),
        updatedAt: now(),
      },
    ],
    applications: [
      {
        id: 'application-1',
        candidateId: 'candidate-1',
        jobId: 'job-public-1',
        statusLabel: 'Interview',
        appliedAt: now(),
      },
    ],
    savedJobs: [
      {
        id: 'saved-removed',
        candidateId: 'candidate-1',
        jobId: null,
        organisationId: 'org-1',
        jobSlugSnapshot: 'removed-role',
        jobTitleSnapshot: 'Removed Role',
        organisationNameSnapshot: 'Acme Labs',
        createdAt: now(),
      },
    ],
    notifications: [
      {
        id: 'notification-1',
        recipientUserId: 'user-1',
        type: 'JOB',
        title: 'Saved job updated',
        message: 'Frontend Engineer has new details.',
        entityType: 'Job',
        entityId: 'job-public-1',
        metadata: { jobSlug: 'frontend-engineer' },
        readAt: null,
        createdAt: now(),
      },
      {
        id: 'notification-2',
        recipientUserId: 'user-2',
        type: 'JOB',
        title: 'Other user notification',
        message: 'Should stay hidden.',
        entityType: 'Job',
        entityId: 'job-public-2',
        metadata: { jobSlug: 'backend-engineer' },
        readAt: null,
        createdAt: now(),
      },
    ],
    organisationPosts: [
      {
        id: 'post-1',
        organisationId: 'org-1',
        authorUserId: 'recruiter-user-1',
        content: 'We are growing our frontend hiring team.',
        imageUrl: null,
        status: 'PUBLISHED',
        publishedAt: now(),
        createdAt: now(),
        updatedAt: now(),
      },
    ],
    interviews: [
      {
        id: 'interview-1',
        roundName: 'Panel',
        scheduledStartAt: new Date('2026-07-20T10:00:00.000Z'),
        scheduledEndAt: new Date('2026-07-20T11:00:00.000Z'),
        status: 'SCHEDULED',
        interviewProcess: {
          application: {
            candidateId: 'candidate-1',
            jobId: 'job-public-1',
          },
        },
      },
    ],
  };
}

function attachJob(job) {
  return {
    ...clone(job),
    organisation: clone(state.organisations.find((item) => item.id === job.organisationId) || null),
  };
}

function isPublicVisible(job) {
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

before(async () => {
  ({ prisma } = await import('../config/db.js'));
  ({ searchPublicJobs, getPublicJobDetail, getPublicOrganisationProfile } = await import('../services/publicPortalService.js'));
  ({
    getCandidateSelfProfile,
    updateCandidateSelfProfile,
    listSavedJobs,
    saveJobForCandidate,
    removeSavedJob,
    getCandidateRecommendations,
    listCandidateNotifications,
    markCandidateNotificationRead,
    getCandidateDashboard,
  } = await import('../services/candidateService.js'));
});

beforeEach(() => {
  seedState();

  prisma.job.count = async ({ where }) => state.jobs.filter((job) => (!where || isPublicVisible(job))).length;
  prisma.job.findMany = async ({ where = {}, take, orderBy, distinct, include } = {}) => {
    let rows = state.jobs.filter((job) => {
      if (!isPublicVisible(job)) return false;
      if (where.id?.not && job.id === where.id.not) return false;
      if (where.organisation?.slug && state.organisations.find((item) => item.id === job.organisationId)?.slug !== where.organisation.slug) return false;
      return true;
    });

    if (distinct?.includes('location')) {
      rows = Object.values(rows.reduce((accumulator, job) => {
        accumulator[job.location] ||= job;
        return accumulator;
      }, {}));
    }

    if (take) rows = rows.slice(0, take);
    return rows.map((job) => (include?.organisation ? attachJob(job) : clone(job)));
  };

  prisma.job.findFirst = async ({ where = {}, include } = {}) => {
    const job = state.jobs.find((item) => {
      if (where.slug && item.slug !== where.slug) return false;
      if (where.id && typeof where.id === 'string' && item.id !== where.id) return false;
      if (where.id?.not && item.id === where.id.not) return false;
      return isPublicVisible(item);
    });
    return job ? (include?.organisation ? attachJob(job) : clone(job)) : null;
  };

  prisma.organisation.findFirst = async ({ where = {} }) => {
    const organisation = state.organisations.find((item) => item.slug === where.slug && item.status === where.status && item.careersEnabled === where.careersEnabled);
    return organisation ? clone(organisation) : null;
  };

  prisma.savedJob.findMany = async ({ where = {}, include, select, take, skip = 0 } = {}) => {
    let rows = state.savedJobs.filter((item) => {
      if (where.candidateId && item.candidateId !== where.candidateId) return false;
      if (where.jobId?.in && !where.jobId.in.includes(item.jobId)) return false;
      return true;
    });
    rows = rows.slice(skip, take ? skip + take : undefined);
    return rows.map((row) => {
      if (select) {
        return { jobId: row.jobId };
      }

      return {
        ...clone(row),
        job: include?.job && row.jobId ? attachJob(state.jobs.find((job) => job.id === row.jobId)) : null,
      };
    });
  };

  prisma.savedJob.count = async ({ where = {} } = {}) => state.savedJobs.filter((item) => !where.candidateId || item.candidateId === where.candidateId).length;
  prisma.savedJob.upsert = async ({ where, create, update, include }) => {
    const existing = state.savedJobs.find((item) => item.candidateId === where.candidateId_jobId.candidateId && item.jobId === where.candidateId_jobId.jobId);
    if (existing) {
      Object.assign(existing, update);
      return { ...clone(existing), job: include?.job ? attachJob(state.jobs.find((job) => job.id === existing.jobId)) : null };
    }

    const created = { id: `saved-${state.savedJobs.length + 1}`, createdAt: now(), ...create };
    state.savedJobs.push(created);
    return { ...clone(created), job: include?.job ? attachJob(state.jobs.find((job) => job.id === created.jobId)) : null };
  };
  prisma.savedJob.findFirst = async ({ where = {} } = {}) => clone(state.savedJobs.find((item) => item.candidateId === where.candidateId && item.jobId === where.jobId) || null);
  prisma.savedJob.delete = async ({ where }) => {
    const index = state.savedJobs.findIndex((item) => item.id === where.id);
    state.savedJobs.splice(index, 1);
  };
  prisma.candidateActivity = {
    create: async () => ({}),
  };
  prisma.auditLog = {
    create: async () => ({}),
  };
  prisma.candidateJobView = {
    count: async ({ where = {} } = {}) => state.interviews.filter((item) => item.interviewProcess.application.candidateId === where.candidateId).length,
    findMany: async ({ where = {}, take, skip = 0 } = {}) => state.interviews
      .filter((item) => item.interviewProcess.application.candidateId === where.candidateId)
      .slice(skip, take ? skip + take : undefined)
      .map((item) => ({
        id: `view-${item.id}`,
        candidateId: where.candidateId,
        jobId: item.interviewProcess.application.jobId,
        firstViewedAt: now(),
        lastViewedAt: now(),
        viewCount: 1,
        job: attachJob(state.jobs.find((job) => job.id === item.interviewProcess.application.jobId)),
      })),
    upsert: async () => ({ id: 'view-1' }),
    deleteMany: async () => ({ count: 0 }),
  };

  prisma.candidateProfile.findUnique = async ({ where, include } = {}) => {
    const profile = state.candidates.find((item) => item.id === where.id);
    if (!profile) return null;
    return {
      ...clone(profile),
      resumeBuilder: include?.resumeBuilder ? { id: `rb-${profile.id}` } : undefined,
    };
  };
  prisma.candidateProfile.update = async ({ where, data, include } = {}) => {
    const profile = state.candidates.find((item) => item.id === where.id);
    Object.assign(profile, data, { updatedAt: now() });
    return {
      ...clone(profile),
      resumeBuilder: include?.resumeBuilder ? { id: `rb-${profile.id}` } : undefined,
    };
  };
  prisma.candidateProfile.findMany = async ({ select } = {}) => state.candidates.map((profile) => {
    if (!select) return clone(profile);
    const picked = {};
    for (const key of Object.keys(select)) picked[key] = clone(profile[key]);
    return picked;
  });
  prisma.organisationPost = {
    findMany: async ({ where = {} } = {}) => state.organisationPosts
      .filter((post) => (!where.organisationId || post.organisationId === where.organisationId) && (!where.status || post.status === where.status))
      .map((post) => ({
        ...clone(post),
        authorUser: {
          id: post.authorUserId,
          name: 'Hiring Team',
          email: 'hiring@acme.example',
        },
      })),
  };

  prisma.application.findMany = async ({ where = {}, select, include, take } = {}) => {
    let rows = state.applications.filter((item) => (!where.candidateId || item.candidateId === where.candidateId));
    if (take) rows = rows.slice(0, take);
    return rows.map((row) => {
      if (select) {
        return { jobId: row.jobId };
      }

      return {
        ...clone(row),
        appliedAt: new Date(row.appliedAt),
        job: include?.job ? attachJob(state.jobs.find((job) => job.id === row.jobId)) : undefined,
      };
    });
  };
  prisma.application.count = async ({ where = {} } = {}) => state.applications.filter((item) => !where.candidateId || item.candidateId === where.candidateId).length;

  prisma.notification.count = async ({ where = {} } = {}) => state.notifications.filter((item) => item.recipientUserId === where.recipientUserId && (!('readAt' in where) || item.readAt === where.readAt)).length;
  prisma.notification.findMany = async ({ where = {}, take, skip = 0 } = {}) => {
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

  prisma.interviewRound.findMany = async ({ where = {}, take } = {}) => {
    let rows = state.interviews.filter((item) => item.interviewProcess.application.candidateId === where.interviewProcess.application.candidateId);
    if (take) rows = rows.slice(0, take);
    return rows.map((row) => ({
      ...clone(row),
      scheduledStartAt: new Date(row.scheduledStartAt),
      scheduledEndAt: new Date(row.scheduledEndAt),
      interviewProcess: {
        application: {
          job: attachJob(state.jobs.find((job) => job.id === row.interviewProcess.application.jobId)),
        },
      },
    }));
  };
});

test('public search returns only open public jobs and hides private salary when not public', async () => {
  const result = await searchPublicJobs({ keyword: 'engineer' });

  assert.equal(result.items.length, 2);
  assert.deepEqual(result.items.map((item) => item.slug), ['frontend-engineer', 'backend-engineer']);
  assert.equal(result.items[1].salaryMin, null);
  assert.equal(result.items[1].salaryMax, null);
  assert.equal(result.items[0].organisation.id, 'org-1');
  assert.equal(result.items[0].recruiter, undefined);
});

test('public job detail returns safe job data and similar jobs stay public', async () => {
  const result = await getPublicJobDetail('frontend-engineer');

  assert.equal(result.job.slug, 'frontend-engineer');
  assert.equal(result.job.organisation.name, 'Acme Labs');
  assert.ok(!('salaryMax' in result.job) || result.job.salaryMax === 24);
  assert.deepEqual(result.similarJobs.map((item) => item.slug), ['backend-engineer']);
});

test('public organisation profile includes only public-safe fields and open jobs', async () => {
  const result = await getPublicOrganisationProfile('acme-labs');

  assert.equal(result.organisation.name, 'Acme Labs');
  assert.equal(result.organisation.publicDescription, 'Builds hiring software.');
  assert.equal(result.organisation.memberships, undefined);
  assert.deepEqual(result.jobs.items.map((item) => item.slug), ['frontend-engineer', 'backend-engineer']);
  assert.equal(result.posts.length, 1);
  assert.equal(result.peopleInsights.sampleSize, 1);
  assert.equal(result.peopleInsights.hasEnoughData, false);
});

test('candidate self profile returns private data and profile completion', async () => {
  const result = await getCandidateSelfProfile('candidate-1');

  assert.equal(result.profile.currentCtcLpa, 16);
  assert.equal(result.profile.expectedCtcLpa, 22);
  assert.equal(typeof result.completion.percentage, 'number');
  assert.ok(result.completion.percentage > 0);
  assert.ok(result.completion.percentage < 100);
  assert.ok(result.completion.missingSections.length > 0);
});

test('candidate self profile update normalizes values and keeps ownership scoped', async () => {
  const result = await updateCandidateSelfProfile('candidate-1', {
    fullName: 'Aarav Sharma',
    currentTitle: 'Senior Frontend Engineer',
    skills: ['React', ' React ', 'TypeScript'],
    preferredRoles: ['frontend engineer', 'frontend engineer', 'ui engineer'],
  });

  assert.equal(result.profile.currentTitle, 'Senior Frontend Engineer');
  assert.deepEqual(result.profile.skills, ['React', 'TypeScript']);
  assert.deepEqual(result.profile.preferredRoles, ['frontend engineer', 'ui engineer']);
});

test('saved jobs support save, duplicate prevention, list, and remove while preserving removed history', async () => {
  const first = await saveJobForCandidate('candidate-1', 'job-public-2');
  const second = await saveJobForCandidate('candidate-1', 'job-public-2');
  const listed = await listSavedJobs('candidate-1');

  assert.equal(first.snapshot.slug, 'backend-engineer');
  assert.equal(second.snapshot.slug, 'backend-engineer');
  assert.equal(listed.items.length, 2);
  assert.equal(listed.items[0].snapshot.slug, 'removed-role');

  await removeSavedJob('candidate-1', 'job-public-2');
  const afterRemove = await listSavedJobs('candidate-1');
  assert.equal(afterRemove.items.length, 1);
});

test('recommendations are deterministic and fall back when the profile is incomplete', async () => {
  const ranked = await getCandidateRecommendations('candidate-1', { excludeSaved: true });
  const fallback = await getCandidateRecommendations('candidate-2', { excludeSaved: true });

  assert.equal(ranked.isFallback, false);
  assert.deepEqual(ranked.recommendedJobs.map((item) => item.slug), ['backend-engineer']);
  assert.equal(fallback.isFallback, true);
  assert.equal(fallback.recommendedJobs[0].slug, 'frontend-engineer');
});

test('candidate notifications are recipient-scoped and mark-read updates only owned records', async () => {
  const beforeRows = await listCandidateNotifications('candidate-1', 'user-1', { unreadOnly: true });
  assert.equal(beforeRows.items.length, 1);
  assert.equal(beforeRows.items[0].link, '/jobs/frontend-engineer');

  const updated = await markCandidateNotificationRead('user-1', 'notification-1');
  assert.equal(updated.isUnread, false);

  const afterRows = await listCandidateNotifications('candidate-1', 'user-1', { unreadOnly: true });
  assert.equal(afterRows.items.length, 0);
});

test('candidate notifications never trust malformed legacy destinations', async () => {
  state.notifications.push({
    id: 'notification-3',
    recipientUserId: 'user-1',
    type: 'SYSTEM',
    title: 'Legacy payload',
    message: 'Review your notifications.',
    entityType: 'Job',
    entityId: 'job-public-1',
    metadata: {
      jobSlug: 'https://evil.example/phish',
      destinationType: 'javascript:alert(1)',
      redirectTo: '//evil.example',
    },
    readAt: null,
    createdAt: now(),
  });

  const rows = await listCandidateNotifications('candidate-1', 'user-1', {});
  const legacy = rows.items.find((item) => item.id === 'notification-3');
  assert.equal(legacy.link, '/candidate/saved-jobs');
});

test('candidate dashboard returns scoped metrics, saved jobs, notifications, and recommendations', async () => {
  await saveJobForCandidate('candidate-1', 'job-public-2');
  const dashboard = await getCandidateDashboard('candidate-1', 'user-1');

  assert.equal(dashboard.metrics.savedJobsCount, 2);
  assert.equal(dashboard.metrics.unreadNotificationsCount, 1);
  assert.equal(dashboard.savedJobs.length, 2);
  assert.equal(dashboard.notifications.length, 1);
  assert.equal(dashboard.upcomingInterviews.length, 1);
});

test('best-effort audit failures do not block saved jobs, but required audits still fail profile updates', async () => {
  prisma.auditLog.create = async () => {
    const error = new Error('Audit contention');
    error.code = 'P2002';
    throw error;
  };

  const saved = await saveJobForCandidate('candidate-1', 'job-public-2', { actorUserId: 'user-1' });
  assert.equal(saved.snapshot.slug, 'backend-engineer');

  await assert.rejects(
    () => updateCandidateSelfProfile('candidate-1', {
      fullName: 'Aarav Sharma',
      currentTitle: 'Principal Frontend Engineer',
    }, { actorUserId: 'user-1' }),
    /Audit contention/
  );
});
