import test, { before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

let prisma;
let getPublicJobApplyContext;
let validateApplicationAnswers;
let submitJobApplication;
let getSentEmails;
let resetSentEmails;

let state;

function now() {
  return new Date('2026-08-17T09:00:00.000Z');
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function seedState() {
  state = {
    candidateUser: {
      id: 'user-1',
      role: 'CANDIDATE',
      candidateProfile: { id: 'candidate-1' },
    },
    candidateProfile: {
      id: 'candidate-1',
      userId: 'user-1',
      fullName: 'Aarav Sharma',
      currentTitle: 'Frontend Engineer',
      resumeUrl: '/api/candidate/resumes/resume-1/download',
      latestResumeAssetId: 'resume-1',
    },
    publicJob: {
      id: 'job-1',
      slug: 'frontend-engineer',
      title: 'Frontend Engineer',
      organisationId: 'org-1',
      visibility: 'EXTERNAL',
      isPublic: true,
      archivedAt: null,
      status: 'OPEN',
      applicationOpensAt: null,
      applicationClosesAt: new Date('2026-08-31T00:00:00.000Z'),
      applicationDeadline: new Date('2026-08-31T00:00:00.000Z'),
      applicationNotificationEmail: 'recruiter@acme.example',
      maxApplications: 10,
      organisation: {
        id: 'org-1',
        name: 'Acme Labs',
        slug: 'acme-labs',
        status: 'ACTIVE',
        careersEnabled: true,
      },
      screeningQuestions: [
        {
          id: 'question-1',
          questionText: 'Years of React experience',
          questionType: 'NUMBER',
          required: true,
          displayOrder: 0,
          isActive: true,
          config: {},
          validationConfig: { minNumber: 0, maxNumber: 20 },
          rules: [{
            operator: 'LESS_THAN',
            value: 5,
            outcome: 'REVIEW_REQUIRED',
            reason: 'Less than five years of React experience.',
          }],
        },
      ],
      _count: { submittedApplications: 0 },
    },
    resumeAsset: {
      id: 'resume-1',
      candidateId: 'candidate-1',
      ownerUserId: 'user-1',
      kind: 'RESUME',
      storageKey: 'resumes/resume-1.pdf',
      storageProvider: 'local',
      originalFilename: 'resume.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
      createdAt: now(),
    },
    organisationMemberships: [
      { userId: 'recruiter-1' },
    ],
    createdApplications: [],
    createdFlags: [],
    createdAnswers: [],
    createdTimelines: [],
    notifications: [],
  };
}

before(async () => {
  ({ prisma } = await import('../config/db.js'));
  ({
    getPublicJobApplyContext,
    validateApplicationAnswers,
    submitJobApplication,
  } = await import('../services/applicationWorkflowService.js'));
  ({
    __getSentEmails: getSentEmails,
    __resetSentEmails: resetSentEmails,
  } = await import('../services/emailService.js'));
});

beforeEach(() => {
  seedState();
  resetSentEmails();

  prisma.job.findFirst = async ({ where, include } = {}) => {
    if (where.slug && where.slug !== state.publicJob.slug) return null;
    if (where.id && where.id !== state.publicJob.id) return null;
    return clone({
      ...state.publicJob,
      screeningQuestions: include?.screeningQuestions ? state.publicJob.screeningQuestions.map(clone) : undefined,
    });
  };

  prisma.job.findUnique = async ({ where } = {}) => {
    if (where.id !== state.publicJob.id) return null;
    return clone(state.publicJob);
  };

  prisma.candidateProfile.findUnique = async ({ where, include } = {}) => {
    if (where.id !== state.candidateProfile.id) return null;
    return {
      ...clone(state.candidateProfile),
      user: include?.user ? { id: 'user-1', email: 'candidate@example.com' } : undefined,
    };
  };

  prisma.jobApplication.findUnique = async ({ where } = {}) => {
    const jobId = where.jobId_candidateId?.jobId;
    const candidateId = where.jobId_candidateId?.candidateId;
    return clone(state.createdApplications.find((item) => item.jobId === jobId && item.candidateId === candidateId) || null);
  };

  prisma.resumeAsset.findFirst = async ({ where } = {}) => {
    if (where.id && where.id !== state.resumeAsset.id) return null;
    if (where.candidateId && where.candidateId !== state.resumeAsset.candidateId) return null;
    if (where.kind && where.kind !== state.resumeAsset.kind) return null;
    return clone(state.resumeAsset);
  };

  prisma.organisationMembership.findMany = async () => state.organisationMemberships.map(clone);
  prisma.auditLog.create = async ({ data }) => clone({ id: 'audit-1', createdAt: now(), ...data });
  prisma.notification.create = async ({ data }) => {
    state.notifications.push(clone(data));
    return clone(data);
  };
  prisma.application.create = async ({ data }) => ({
    id: 'legacy-application-1',
    ...clone(data),
  });
  prisma.jobApplication.create = async ({ data }) => {
    const created = { id: 'job-application-1', ...clone(data) };
    state.createdApplications.push(created);
    return created;
  };
  prisma.applicationResumeSnapshot.create = async ({ data }) => clone(data);
  prisma.applicationScreeningAnswer.create = async ({ data }) => {
    state.createdAnswers.push(clone(data));
    return clone(data);
  };
  prisma.applicationFlag.create = async ({ data }) => {
    state.createdFlags.push(clone(data));
    return clone(data);
  };
  prisma.jobApplication.update = async ({ where, data }) => {
    const application = state.createdApplications.find((item) => item.id === where.id);
    Object.assign(application, clone(data));
    return clone(application);
  };
  prisma.applicationTimeline.create = async ({ data }) => {
    state.createdTimelines.push(clone(data));
    return clone(data);
  };
  prisma.$transaction = async (callback) => callback(prisma);
}
);

test('public apply context returns safe eligibility and screening questions', async () => {
  const result = await getPublicJobApplyContext('frontend-engineer', state.candidateUser);

  assert.equal(result.job.title, 'Frontend Engineer');
  assert.equal(result.eligibility.canApply, true);
  assert.equal(result.job.screeningQuestions[0].questionText, 'Years of React experience');
});

test('application answer validation rejects missing required answers', async () => {
  await assert.rejects(
    () => validateApplicationAnswers(state.candidateUser, {
      jobId: 'job-1',
      answers: [],
    }),
    /Answer required/,
  );
});

test('application submission creates answer snapshots and review flags without terminal rejection', async () => {
  prisma.jobApplication.findFirst = async ({ include } = {}) => ({
    id: 'job-application-1',
    applicationId: 'legacy-application-1',
    publicReference: 'AB12CD34',
    organisationId: 'org-1',
    submittedAt: now(),
    sourceType: 'CAREER_PAGE',
    sourceName: null,
    sourceCampaign: null,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmTerm: null,
    utmContent: null,
    referrer: null,
    directLinkIdentifier: null,
    screeningSummary: { flags: 1 },
    job: include?.job ? {
      id: 'job-1',
      title: 'Frontend Engineer',
      slug: 'frontend-engineer',
      location: 'Bengaluru',
      applicationNotificationEmail: 'recruiter@acme.example',
      organisation: { id: 'org-1', name: 'Acme Labs', slug: 'acme-labs' },
    } : undefined,
    candidate: include?.candidate ? {
      id: 'candidate-1',
      fullName: 'Aarav Sharma',
      headline: 'Frontend Engineer',
      currentTitle: 'Frontend Engineer',
      location: 'Bengaluru',
      user: { email: 'candidate@example.com' },
    } : undefined,
    application: include?.application ? {
      currentStage: 'APPLIED',
      statusLabel: 'Applied',
    } : undefined,
    resumeSnapshot: include?.resumeSnapshot ? {
      id: 'snapshot-1',
      filename: 'resume.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
    } : undefined,
    answers: include?.answers ? [{
      id: 'answer-1',
      originalQuestionId: 'question-1',
      questionTextSnapshot: 'Years of React experience',
      internalLabelSnapshot: null,
      helpTextSnapshot: null,
      placeholderSnapshot: null,
      questionTypeSnapshot: 'NUMBER',
      optionsSnapshot: {},
      validationSnapshot: { minNumber: 0, maxNumber: 20 },
      requiredSnapshot: true,
      answerValue: 3,
      screeningOutcome: 'REVIEW_REQUIRED',
      fileAsset: null,
    }] : undefined,
    flags: include?.flags ? [{
      id: 'flag-1',
      questionId: 'question-1',
      outcome: 'REVIEW_REQUIRED',
      operator: 'LESS_THAN',
      internalReason: 'Less than five years of React experience.',
      metadata: {},
      createdAt: now(),
      resolvedAt: null,
    }] : undefined,
    timeline: include?.timeline ? [{
      id: 'timeline-1',
      eventType: 'APPLICATION_SUBMITTED',
      message: 'Application submitted.',
      metadata: {},
      isCandidateVisible: true,
      createdAt: now(),
    }] : undefined,
  });

  const result = await submitJobApplication(state.candidateUser, {
    jobId: 'job-1',
    resumeAssetId: 'resume-1',
    consentAccepted: true,
    privacyAccepted: true,
    termsAccepted: true,
    answers: [{ questionId: 'question-1', value: 3 }],
    source: {
      sourceType: 'CAREER_PAGE',
      sourceName: 'Career Page<script>',
      referrer: 'https://example.com/jobs/frontend-engineer',
    },
  });

  assert.equal(state.createdAnswers.length, 1);
  assert.equal(state.createdFlags.length, 1);
  assert.equal(result.stage, 'APPLICATION_RECEIVED');
  assert.equal(getSentEmails().length, 1);
  assert.match(getSentEmails()[0].subject, /New application: Frontend Engineer - Aarav Sharma/);
  assert.match(getSentEmails()[0].text, /View application:/);
});
