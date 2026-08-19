import test, { before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

let prisma;
let calculateProfileCompletion;
let recordCandidateJobView;
let listCandidateJobApplications;
let withdrawCandidateApplication;

const candidateUser = {
  id: 'user-1',
  candidateProfile: {
    id: 'candidate-1',
  },
};

before(async () => {
  ({ prisma } = await import('../config/db.js'));
  ({ calculateProfileCompletion, recordCandidateJobView } = await import('../services/candidateService.js'));
  ({ listCandidateJobApplications, withdrawCandidateApplication } = await import('../services/applicationWorkflowService.js'));
});

beforeEach(() => {
  prisma.job.findFirst = async () => ({
    id: 'job-1',
    organisationId: 'org-1',
    title: 'Frontend Engineer',
    slug: 'frontend-engineer',
    status: 'OPEN',
    archivedAt: null,
    isPublic: true,
    organisation: {
      status: 'ACTIVE',
      careersEnabled: true,
    },
  });
  prisma.candidateJobView = {
    upsert: async () => ({ id: 'view-1' }),
    count: async () => 0,
    findMany: async () => [],
    deleteMany: async () => ({ count: 0 }),
  };
  prisma.candidateActivity = {
    create: async () => ({}),
  };
  prisma.jobApplication.count = async () => 1;
  prisma.jobApplication.findMany = async () => [{
    id: 'application-1',
    publicReference: 'APP-42',
    submittedAt: new Date('2026-07-17T09:15:00.000Z'),
    updatedAt: new Date('2026-07-18T09:15:00.000Z'),
    withdrawnAt: null,
    application: {
      currentStage: 'SHORTLISTED',
    },
    job: {
      id: 'job-1',
      title: 'Frontend Engineer',
      slug: 'frontend-engineer',
      location: 'Bengaluru',
      employmentType: 'FULL_TIME',
      workplaceType: 'HYBRID',
      organisation: {
        name: 'Acme Labs',
        slug: 'acme-labs',
      },
    },
    resumeSnapshot: {
      filename: 'resume.pdf',
    },
    timeline: [{
      id: 'timeline-1',
      eventType: 'SHORTLISTED',
      message: 'Your application is under review.',
      metadata: {},
      isCandidateVisible: true,
      createdAt: new Date('2026-07-18T09:15:00.000Z'),
    }],
  }];
  prisma.jobApplication.findFirst = async ({ where }) => {
    if (where.id !== 'application-1' || where.candidateId !== 'candidate-1') return null;
    return {
      id: 'application-1',
      organisationId: 'org-1',
      candidateId: 'candidate-1',
      publicReference: 'APP-42',
      withdrawnAt: null,
      withdrawalReason: null,
      job: {
        id: 'job-1',
        title: 'Frontend Engineer',
        slug: 'frontend-engineer',
        location: 'Bengaluru',
        employmentType: 'FULL_TIME',
        workplaceType: 'HYBRID',
        organisation: {
          id: 'org-1',
          name: 'Acme Labs',
          slug: 'acme-labs',
        },
      },
      candidate: {
        id: 'candidate-1',
        fullName: 'Aarav Sharma',
        currentTitle: 'Frontend Engineer',
        headline: 'Frontend Engineer',
        location: 'Bengaluru',
        user: {
          id: 'user-1',
          email: 'candidate@example.com',
        },
        skills: ['React'],
        totalExperience: 4,
        availability: 'IMMEDIATE',
        latestResumeAssetId: 'resume-1',
      },
      application: {
        id: 'legacy-application-1',
        currentStage: 'SHORTLISTED',
        statusLabel: 'Shortlisted',
      },
      resumeSnapshot: {
        id: 'snapshot-1',
        filename: 'resume.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
      },
      answers: [],
      timeline: [{
        id: 'timeline-1',
        eventType: 'SHORTLISTED',
        message: 'Your application is under review.',
        metadata: {},
        isCandidateVisible: true,
        createdAt: new Date('2026-07-18T09:15:00.000Z'),
      }],
    };
  };
  prisma.$transaction = async (callback) => callback({
    application: {
      update: async () => ({}),
    },
    jobApplication: {
      update: async () => ({}),
    },
    applicationTimeline: {
      create: async () => ({}),
    },
    applicationActivity: {
      create: async () => ({}),
    },
    organisationMembership: {
      findMany: async () => [{ userId: 'recruiter-1' }],
    },
    notification: {
      create: async () => ({}),
    },
  });
  prisma.notification = {
    create: async () => ({}),
  };
  prisma.auditLog = {
    create: async () => ({}),
  };
});

test('weighted profile completion treats a complete fresher profile as fully complete without employment history', () => {
  const result = calculateProfileCompletion({
    fullName: 'Riya Singh',
    phoneNumber: '+91 9876543210',
    currentTitle: 'Graduate Engineer',
    location: 'Pune',
    latestResumeAssetId: 'resume-1',
    skills: ['React', 'Node.js', 'Testing'],
    totalExperience: 0,
    experienceEntries: [],
    educationEntries: [
      { degree: 'B.Tech', institution: 'Pune Institute of Technology', fieldOfStudy: 'Computer Science', year: 2026 },
    ],
    certificationEntries: [
      { name: 'React Developer Certification', issuingOrganisation: 'Meta' },
    ],
    projectEntries: [
      { projectName: 'Campus Placement Portal', summary: 'Built a portal to track campus recruitment.' },
    ],
    preferredRoles: ['frontend engineer'],
    preferredLocations: ['Pune'],
    workplacePreferences: ['HYBRID'],
    employmentPreferences: ['FULL_TIME'],
    headline: 'Entry-level frontend engineer',
    summary: 'Ready to take on frontend engineering roles.',
    linkedInUrl: 'https://linkedin.com/in/riya',
    updatedAt: new Date('2026-07-17T09:00:00.000Z'),
  });

  assert.equal(result.percentage, 100);
  assert.deepEqual(result.missingSections, []);
});

test('weighted profile completion does not automatically reach 100% for an otherwise-incomplete fresher profile', () => {
  const result = calculateProfileCompletion({
    fullName: 'Kabir Rao',
    phoneNumber: null,
    currentTitle: 'Graduate Engineer',
    location: 'Pune',
    latestResumeAssetId: null,
    skills: ['React'],
    totalExperience: 0,
    experienceEntries: [],
    educationEntries: [],
    certificationEntries: [],
    projectEntries: [],
    preferredRoles: [],
    preferredLocations: [],
    workplacePreferences: [],
    employmentPreferences: [],
    headline: null,
    summary: null,
    linkedInUrl: null,
    updatedAt: new Date('2026-07-17T09:00:00.000Z'),
  });

  assert.equal(result.percentage < 100, true);
  assert.equal(result.missingSections.includes('Resume availability'), true);
  assert.equal(result.missingSections.includes('Education'), true);
  // The zero-experience exemption is narrow: it only ever satisfies
  // "Experience history" itself, never any other section.
  assert.equal(result.missingSections.includes('Experience history'), false);
});

test('weighted profile completion treats a complete experienced candidate as fully complete', () => {
  const result = calculateProfileCompletion({
    fullName: 'Meera Nair',
    phoneNumber: '+91 9123456780',
    currentTitle: 'Senior Backend Engineer',
    location: 'Bengaluru',
    latestResumeAssetId: 'resume-2',
    skills: ['Node.js', 'PostgreSQL', 'AWS'],
    totalExperience: 6,
    experienceEntries: [
      { company: 'Acme Labs', title: 'Senior Backend Engineer' },
    ],
    educationEntries: [
      { degree: 'B.E.', institution: 'Anna University', fieldOfStudy: 'Computer Science', year: 2018 },
    ],
    certificationEntries: [
      { name: 'AWS Certified Solutions Architect' },
    ],
    projectEntries: [
      { projectName: 'Payments Platform', summary: 'Led the payments platform rebuild.' },
    ],
    preferredRoles: ['backend engineer'],
    preferredLocations: ['Bengaluru'],
    workplacePreferences: ['HYBRID'],
    employmentPreferences: ['FULL_TIME'],
    headline: 'Senior Backend Engineer',
    summary: 'Backend engineer with 6 years building payment systems.',
    linkedInUrl: 'https://linkedin.com/in/meera',
    updatedAt: new Date('2026-07-17T09:00:00.000Z'),
  });

  assert.equal(result.percentage, 100);
  assert.deepEqual(result.missingSections, []);
});

test('weighted profile completion highlights missing sections for experienced candidates', () => {
  const result = calculateProfileCompletion({
    fullName: 'Dev Mehta',
    currentTitle: 'Backend Engineer',
    location: null,
    latestResumeAssetId: null,
    skills: ['Node.js'],
    totalExperience: 5,
    preferredRoles: [],
    preferredLocations: [],
    workplacePreferences: [],
    employmentPreferences: [],
    headline: null,
    summary: null,
    linkedInUrl: null,
    portfolioUrl: null,
    githubUrl: null,
    updatedAt: new Date('2026-07-17T09:00:00.000Z'),
  });

  assert.equal(result.percentage < 50, true);
  assert.equal(result.missingSections.includes('Resume availability'), true);
  assert.equal(result.missingSections.includes('Preferences'), true);
});

test('recordCandidateJobView uses candidate-owned upsert tracking for public jobs', async () => {
  const result = await recordCandidateJobView('candidate-1', 'job-1', {
    source: 'JOB_DETAIL',
    referrerClassification: 'PUBLIC_JOB_DETAIL',
  });

  assert.equal(result.recorded, true);
});

test('candidate application list returns candidate-safe statuses and latest updates', async () => {
  const result = await listCandidateJobApplications(candidateUser, { filter: 'ACTIVE' });

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].status, 'Under Review');
  assert.equal(result.items[0].stage, 'UNDER_REVIEW');
  assert.equal(result.items[0].latestUpdate, 'Your application is under review.');
});

test('candidate withdrawal is allowed only for owned withdrawable applications and returns updated detail', async () => {
  const result = await withdrawCandidateApplication(candidateUser, 'application-1', {
    reason: 'NO_LONGER_INTERESTED',
    note: 'Withdrawing for now.',
  });

  assert.equal(result.canWithdraw, true);
  assert.equal(result.status, 'Under Review');
});
