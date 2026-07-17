import test, { before, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

let prisma;
let env;
let getRecruiterJobApplicationDetail;
let getCandidateResumeDownload;
let resolveLegacyResumePath;
let backfillLegacyResumeAssets;

const legacyRelativePath = 'legacy-tests/candidate-1-resume.pdf';
let legacyAbsolutePath;
let state;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function drainStream(stream) {
  await new Promise((resolve, reject) => {
    stream.on('error', reject);
    stream.on('end', resolve);
    stream.resume();
  });
}

function makeRecruiter(organisationId = 'org-1') {
  return {
    id: `recruiter-${organisationId}`,
    role: 'RECRUITER',
    activeMembership: { organisationId },
  };
}

function seedState() {
  state = {
    candidate: {
      id: 'candidate-1',
      userId: 'user-1',
      latestResumeAssetId: null,
      resumeUrl: `/uploads/${legacyRelativePath}`,
      applications: [{ organisationId: 'org-1' }],
      savedByRecruiters: [],
    },
    membershipsByUserId: {
      'recruiter-org-1': [{ organisationId: 'org-1', role: 'RECRUITER', status: 'ACTIVE', organisation: { status: 'ACTIVE' } }],
      'recruiter-org-2': [{ organisationId: 'org-2', role: 'RECRUITER', status: 'ACTIVE', organisation: { status: 'ACTIVE' } }],
    },
    jobApplication: {
      id: 'job-application-1',
      applicationId: 'legacy-application-1',
      organisationId: 'org-1',
      publicReference: 'APP-9812',
      submittedAt: new Date('2026-07-17T09:00:00.000Z'),
      sourceType: 'CAREER_PAGE',
      sourceName: 'Career Page',
      sourceCampaign: null,
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      utmTerm: null,
      utmContent: null,
      referrer: null,
      directLinkIdentifier: null,
      screeningSummary: { flags: 1, totalQuestions: 1 },
      job: {
        id: 'job-1',
        title: 'Frontend Engineer',
        slug: 'frontend-engineer',
        location: 'Bengaluru',
        organisation: { id: 'org-1', name: 'Acme Labs', slug: 'acme-labs' },
      },
      candidate: {
        id: 'candidate-1',
        fullName: 'Aarav Sharma',
        currentTitle: 'Frontend Engineer',
        headline: 'Frontend Engineer',
        location: 'Bengaluru',
        skills: ['React'],
        totalExperience: 6,
        availability: '30 days',
        latestResumeAssetId: null,
        resumeUrl: `/uploads/${legacyRelativePath}`,
        user: { email: 'aarav@example.com' },
      },
      application: {
        currentStage: 'APPLIED',
        statusLabel: 'Applied',
        notes: [
          {
            id: 'note-1',
            content: 'Strong portfolio',
            createdAt: new Date('2026-07-17T09:10:00.000Z'),
            author: { id: 'user-2', email: 'recruiter@example.com' },
          },
        ],
        activities: [
          {
            id: 'activity-1',
            eventType: 'NOTE_ADDED',
            message: 'Recruiter note added.',
            metadata: {},
            createdAt: new Date('2026-07-17T09:11:00.000Z'),
            actorUser: { id: 'user-2', email: 'recruiter@example.com', role: 'RECRUITER' },
          },
        ],
        interviewProcesses: [
          {
            id: 'process-1',
            title: 'Default process',
            status: 'ACTIVE',
            createdAt: new Date('2026-07-17T09:00:00.000Z'),
            rounds: [
              {
                id: 'round-1',
                roundName: 'Technical Round',
                interviewType: 'TECHNICAL',
                status: 'SCHEDULED',
                scheduledStartAt: new Date('2026-07-18T09:00:00.000Z'),
                scheduledEndAt: new Date('2026-07-18T10:00:00.000Z'),
                panelMembers: [],
                feedbacks: [],
              },
            ],
          },
        ],
      },
      resumeSnapshot: {
        id: 'snapshot-1',
        filename: 'submitted-resume.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 128,
      },
      answers: [
        {
          id: 'answer-1',
          originalQuestionId: 'question-1',
          questionTextSnapshot: 'Years of React experience',
          internalLabelSnapshot: 'React experience',
          helpTextSnapshot: null,
          placeholderSnapshot: null,
          questionTypeSnapshot: 'NUMBER',
          requiredSnapshot: true,
          optionsSnapshot: {},
          validationSnapshot: {},
          answerValue: 6,
          screeningOutcome: 'MEETS_CRITERIA',
          fileAsset: null,
        },
      ],
      flags: [
        {
          id: 'flag-1',
          questionId: 'question-1',
          outcome: 'REVIEW_REQUIRED',
          operator: 'LESS_THAN',
          internalReason: 'Review manually.',
          metadata: {},
          createdAt: new Date('2026-07-17T09:01:00.000Z'),
          resolvedAt: null,
        },
      ],
      timeline: [
        {
          id: 'timeline-1',
          eventType: 'APPLICATION_SUBMITTED',
          message: 'Application submitted.',
          metadata: {},
          isCandidateVisible: true,
          createdAt: new Date('2026-07-17T09:00:00.000Z'),
        },
      ],
    },
    auditEntries: [],
    backfillCandidates: [
      {
        id: 'candidate-legacy-1',
        userId: 'user-legacy-1',
        latestResumeAssetId: null,
        resumeUrl: `/uploads/${legacyRelativePath}`,
      },
    ],
    existingAssets: [],
    createdAssets: [],
    updatedCandidates: [],
  };
}

before(async () => {
  ({ prisma } = await import('../config/db.js'));
  ({ env } = await import('../config/env.js'));
  ({ getRecruiterJobApplicationDetail } = await import('../services/applicationWorkflowService.js'));
  ({ getCandidateResumeDownload } = await import('../services/resumeService.js'));
  ({ resolveLegacyResumePath } = await import('../services/legacyResumeService.js'));
  ({ backfillLegacyResumeAssets } = await import('../../scripts/backfill-legacy-resume-assets.js'));
  legacyAbsolutePath = path.resolve(process.cwd(), env.localStoragePath, legacyRelativePath);
});

beforeEach(() => {
  seedState();
  fs.mkdirSync(path.dirname(legacyAbsolutePath), { recursive: true });
  fs.writeFileSync(legacyAbsolutePath, 'legacy resume');

  prisma.organisationMembership.findMany = async ({ where }) => clone(state.membershipsByUserId[where.userId] || []);
  prisma.jobApplication.findFirst = async ({ where }) => {
    if (where.organisationId !== state.jobApplication.organisationId) return null;
    if (where.id !== state.jobApplication.id) return null;
    return clone(state.jobApplication);
  };
  prisma.candidateProfile.findUnique = async ({ where }) => {
    if (where.id !== state.candidate.id) return null;
    return clone(state.candidate);
  };
  prisma.candidateProfile.findFirst = async ({ where }) => {
    const hasApplicationAccess = state.candidate.applications.some((item) => item.organisationId === where.OR?.[0]?.applications?.some?.organisationId);
    const hasSavedAccess = state.candidate.savedByRecruiters.some((item) => item.organisationId === where.OR?.[1]?.savedByRecruiters?.some?.organisationId);
    if (where.id !== state.candidate.id || (!hasApplicationAccess && !hasSavedAccess)) {
      return null;
    }
    return clone(state.candidate);
  };
  prisma.resumeAsset.findUnique = async ({ where }) => clone(state.existingAssets.find((asset) => asset.id === where.id) || null);
  prisma.resumeAsset.findFirst = async ({ where }) => clone(state.existingAssets.find((asset) => asset.candidateId === where.candidateId && asset.storageKey === where.storageKey) || null);
  prisma.resumeAsset.create = async ({ data }) => {
    const created = { id: `asset-${state.createdAssets.length + 1}`, ...clone(data) };
    state.createdAssets.push(created);
    state.existingAssets.push(created);
    return clone(created);
  };
  prisma.candidateProfile.findMany = async () => clone(state.backfillCandidates);
  prisma.candidateProfile.update = async ({ where, data }) => {
    state.updatedCandidates.push({ id: where.id, ...clone(data) });
    const candidate = state.backfillCandidates.find((item) => item.id === where.id);
    if (candidate) {
      candidate.latestResumeAssetId = data.latestResumeAssetId;
    }
    return clone(candidate);
  };
  prisma.auditLog.create = async ({ data }) => {
    state.auditEntries.push(clone(data));
    return clone(data);
  };
});

afterEach(() => {
  fs.rmSync(path.dirname(legacyAbsolutePath), { recursive: true, force: true });
});

test('recruiter ATS detail is organisation-scoped and preserves legacy plus screening sections', async () => {
  const detail = await getRecruiterJobApplicationDetail({ ...makeRecruiter('org-1'), id: 'recruiter-org-1' }, 'job-application-1', 'org-1');

  assert.equal(detail.candidate.fullName, 'Aarav Sharma');
  assert.equal(detail.candidate.resumeDownloadUrl, '/api/resumes/candidate/candidate-1/download');
  assert.equal(detail.answers[0].questionText, 'Years of React experience');
  assert.equal(detail.flags[0].internalReason, 'Review manually.');
  assert.equal(detail.notes[0].content, 'Strong portfolio');
  assert.equal(detail.activities[0].eventType, 'NOTE_ADDED');
  assert.equal(detail.interviewProcesses[0].rounds[0].roundName, 'Technical Round');
});

test('recruiter ATS detail hides another organisation application', async () => {
  await assert.rejects(
    () => getRecruiterJobApplicationDetail({ ...makeRecruiter('org-2'), id: 'recruiter-org-2' }, 'job-application-1', 'org-2'),
    /Application not found/,
  );
});

test('candidate and same-organisation recruiter can access trusted legacy resumes through authenticated compatibility flow', async () => {
  const candidateDownload = await getCandidateResumeDownload(
    { id: 'user-1', role: 'CANDIDATE', candidateProfile: { id: 'candidate-1' } },
    'candidate-1',
  );
  assert.equal(candidateDownload.filename, 'candidate-1-resume.pdf');
  assert.equal(candidateDownload.contentLength, 'legacy resume'.length);
  await drainStream(candidateDownload.stream);

  const recruiterDownload = await getCandidateResumeDownload(
    { ...makeRecruiter('org-1'), id: 'recruiter-org-1' },
    'candidate-1',
    'org-1',
  );
  assert.equal(recruiterDownload.filename, 'candidate-1-resume.pdf');
  await drainStream(recruiterDownload.stream);
  assert.equal(state.auditEntries.length, 2);
});

test('legacy resume compatibility rejects cross-tenant, external, traversal, and missing-file access', async () => {
  await assert.rejects(
    () => getCandidateResumeDownload({ ...makeRecruiter('org-2'), id: 'recruiter-org-2' }, 'candidate-1', 'org-2'),
    /Resume not found/,
  );

  state.candidate.resumeUrl = 'https://malicious.example.com/resume.pdf';
  await assert.rejects(
    () => getCandidateResumeDownload({ id: 'user-1', role: 'CANDIDATE', candidateProfile: { id: 'candidate-1' } }, 'candidate-1'),
    /Legacy resume path is not eligible/,
  );

  assert.throws(() => resolveLegacyResumePath('/uploads/../secrets.txt'), /Legacy resume path is invalid/);

  state.candidate.resumeUrl = '/uploads/legacy-tests/missing.pdf';
  await assert.rejects(
    () => getCandidateResumeDownload({ id: 'user-1', role: 'CANDIDATE', candidateProfile: { id: 'candidate-1' } }, 'candidate-1'),
    /Resume file not found/,
  );
});

test('legacy resume backfill is idempotent and creates private asset metadata once', async () => {
  const firstRun = await backfillLegacyResumeAssets({ dryRun: false, logger: { log() {} } });
  assert.equal(firstRun.migrated, 1);
  assert.equal(state.createdAssets.length, 1);
  assert.equal(state.updatedCandidates.length, 1);

  const secondRun = await backfillLegacyResumeAssets({ dryRun: false, logger: { log() {} } });
  assert.equal(secondRun.skippedAlreadyMigrated, 1);
  assert.equal(state.createdAssets.length, 1);
  assert.equal(state.updatedCandidates.length, 1);
});
