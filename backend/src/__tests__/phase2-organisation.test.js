import test, { before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

let prisma;
let createOrganisationForUser;
let listOrganisationMembers;
let addOrganisationMember;
let updateOrganisationMember;
let createRequisition;
let approveRequisition;
let createJob;
let listRecruiterJobs;
let getAuthorizedCandidateDetail;
let submitInterviewFeedback;
let listInterviewFeedback;
let createNotification;
let listNotifications;
let recordAuditLog;

let state;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function seedState() {
  state = {
    users: [
      { id: 'owner-1', email: 'owner@acme.com', role: 'RECRUITER', isActive: true },
      { id: 'recruiter-1', email: 'recruiter@acme.com', role: 'RECRUITER', isActive: true },
      { id: 'outsider-1', email: 'owner@beta.com', role: 'RECRUITER', isActive: true },
      { id: 'candidate-user-1', email: 'candidate@example.com', role: 'CANDIDATE', isActive: true },
      { id: 'interviewer-1', email: 'panel@acme.com', role: 'RECRUITER', isActive: true },
      { id: 'viewer-1', email: 'viewer@acme.com', role: 'RECRUITER', isActive: true },
    ],
    organisations: [
      { id: 'org-1', name: 'Acme', slug: 'acme', status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date() },
      { id: 'org-2', name: 'Beta', slug: 'beta', status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date() },
    ],
    memberships: [
      { id: 'mem-1', organisationId: 'org-1', userId: 'owner-1', role: 'OWNER', status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date() },
      { id: 'mem-2', organisationId: 'org-1', userId: 'recruiter-1', role: 'RECRUITER', status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date() },
      { id: 'mem-3', organisationId: 'org-2', userId: 'outsider-1', role: 'OWNER', status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date() },
      { id: 'mem-4', organisationId: 'org-1', userId: 'interviewer-1', role: 'INTERVIEWER', status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date() },
      { id: 'mem-5', organisationId: 'org-1', userId: 'viewer-1', role: 'VIEWER', status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date() },
    ],
    recruiterProfiles: [
      { id: 'rp-1', userId: 'owner-1', organisationId: 'org-1', companyEmailDomain: 'acme.com', officeLocations: [], profileCompleted: true },
      { id: 'rp-2', userId: 'recruiter-1', organisationId: 'org-1', companyEmailDomain: 'acme.com', officeLocations: [], profileCompleted: true },
      { id: 'rp-3', userId: 'outsider-1', organisationId: 'org-2', companyEmailDomain: 'beta.com', officeLocations: [], profileCompleted: true },
      { id: 'rp-4', userId: 'interviewer-1', organisationId: 'org-1', companyEmailDomain: 'acme.com', officeLocations: [], profileCompleted: true },
      { id: 'rp-5', userId: 'viewer-1', organisationId: 'org-1', companyEmailDomain: 'acme.com', officeLocations: [], profileCompleted: true },
    ],
    candidates: [
      {
        id: 'candidate-1',
        userId: 'candidate-user-1',
        fullName: 'Candidate One',
        headline: 'Frontend Engineer',
        location: 'Bengaluru',
        preferredLocations: [],
        totalExperience: 4,
        currentCtcLpa: 12,
        expectedCtcLpa: 16,
        availability: 'IMMEDIATE',
        skills: ['React', 'Node.js'],
        summary: 'Summary',
        resumeUrl: '/private.pdf',
        sharedResumeSlug: 'candidate-one',
        profileViews: 5,
        lastActiveAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    resumeBuilders: [
      { id: 'rb-1', candidateId: 'candidate-1', template: 'classic', personal: {}, education: {}, experience: [], skills: [], projects: [], completedScore: 80, updatedAt: new Date() },
    ],
    savedCandidates: [],
    requisitions: [],
    jobs: [
      {
        id: 'job-1',
        organisationId: 'org-1',
        recruiterId: 'owner-1',
        requisitionId: null,
        title: 'Frontend Engineer',
        slug: 'frontend-engineer',
        description: 'Role',
        skillsRequired: ['React'],
        experienceMin: 2,
        experienceMax: 5,
        salaryMin: 10,
        salaryMax: 20,
        location: 'Bengaluru',
        employmentType: 'FULL_TIME',
        status: 'OPEN',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    applications: [
      {
        id: 'app-1',
        organisationId: 'org-1',
        jobId: 'job-1',
        candidateId: 'candidate-1',
        currentStage: 'APPLIED',
        statusLabel: 'Applied',
        coverLetter: null,
        recruiterTag: null,
        appliedAt: new Date(),
        updatedAt: new Date(),
        interviewScheduledAt: null,
        interviewerName: null,
        recruiterNotes: null,
        matchScore: 90,
      },
    ],
    interviewProcesses: [
      { id: 'process-1', organisationId: 'org-1', applicationId: 'app-1', title: 'Standard Process', status: 'PLANNED', createdById: 'owner-1', createdAt: new Date(), updatedAt: new Date() },
    ],
    interviewRounds: [
      { id: 'round-1', organisationId: 'org-1', interviewProcessId: 'process-1', roundName: 'Technical', sequence: 1, interviewType: 'TECHNICAL', status: 'PLANNED', scheduledStartAt: null, scheduledEndAt: null, scorecardCriteria: [{ key: 'technical', label: 'Technical Skills' }], feedbackLockedAt: null, createdAt: new Date(), updatedAt: new Date() },
    ],
    interviewPanels: [
      { id: 'panel-1', organisationId: 'org-1', interviewRoundId: 'round-1', userId: 'interviewer-1', createdAt: new Date() },
    ],
    interviewFeedbacks: [],
    notifications: [],
    auditLogs: [],
  };
}

function actor(userId) {
  const user = state.users.find((item) => item.id === userId);
  const recruiterProfile = state.recruiterProfiles.find((item) => item.userId === userId) || null;
  const memberships = state.memberships
    .filter((item) => item.userId === userId && item.status === 'ACTIVE')
    .map((item) => ({ ...clone(item), organisation: clone(state.organisations.find((org) => org.id === item.organisationId)) }));
  return {
    ...clone(user),
    recruiterProfile: recruiterProfile ? clone(recruiterProfile) : null,
    memberships,
    activeMembership: memberships[0] || null,
  };
}

function installPrismaMocks() {
  prisma.$transaction = async (callback) => callback(prisma);
  prisma.organisation.findUnique = async ({ where }) => clone(state.organisations.find((item) => item.id === where.id || item.slug === where.slug) || null);
  prisma.organisation.create = async ({ data }) => {
    const created = { id: `org-${state.organisations.length + 1}`, status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date(), ...data };
    state.organisations.push(created);
    return clone(created);
  };

  prisma.organisationMembership.findMany = async ({ where = {}, include = {} }) => {
    let rows = [...state.memberships];
    if (where.userId) rows = rows.filter((item) => item.userId === where.userId);
    if (where.organisationId) rows = rows.filter((item) => item.organisationId === where.organisationId);
    if (where.status) rows = rows.filter((item) => item.status === where.status);
    return rows.map((item) => ({
      ...clone(item),
      organisation: include.organisation ? clone(state.organisations.find((org) => org.id === item.organisationId)) : undefined,
      user: include.user ? clone(state.users.find((user) => user.id === item.userId)) : undefined,
    }));
  };
  prisma.organisationMembership.findFirst = async ({ where = {}, include = {} }) => {
    const item = state.memberships.find((row) => (
      (!where.id || row.id === where.id)
      && (!where.organisationId || row.organisationId === where.organisationId)
      && (!where.userId || row.userId === where.userId)
      && (!where.status || row.status === where.status)
      && (!where.role || (typeof where.role === 'string' ? row.role === where.role : where.role.in?.includes(row.role)))
    ));
    if (!item) return null;
    return {
      ...clone(item),
      organisation: include.organisation ? clone(state.organisations.find((org) => org.id === item.organisationId)) : undefined,
      user: include.user ? clone(state.users.find((user) => user.id === item.userId)) : undefined,
    };
  };
  prisma.organisationMembership.create = async ({ data }) => {
    const created = { id: `mem-${state.memberships.length + 1}`, createdAt: new Date(), updatedAt: new Date(), ...data };
    state.memberships.push(created);
    return clone(created);
  };
  prisma.organisationMembership.upsert = async ({ where, update, create, include = {} }) => {
    const existing = state.memberships.find((item) => item.organisationId === where.organisationId_userId.organisationId && item.userId === where.organisationId_userId.userId);
    if (existing) {
      Object.assign(existing, update, { updatedAt: new Date() });
      return {
        ...clone(existing),
        organisation: include.organisation ? clone(state.organisations.find((org) => org.id === existing.organisationId)) : undefined,
        user: include.user ? clone(state.users.find((user) => user.id === existing.userId)) : undefined,
      };
    }
    const created = { id: `mem-${state.memberships.length + 1}`, createdAt: new Date(), updatedAt: new Date(), ...create };
    state.memberships.push(created);
    return {
      ...clone(created),
      organisation: include.organisation ? clone(state.organisations.find((org) => org.id === created.organisationId)) : undefined,
      user: include.user ? clone(state.users.find((user) => user.id === created.userId)) : undefined,
    };
  };
  prisma.organisationMembership.update = async ({ where, data, include = {} }) => {
    const existing = state.memberships.find((item) => item.id === where.id);
    Object.assign(existing, data, { updatedAt: new Date() });
    return {
      ...clone(existing),
      organisation: include.organisation ? clone(state.organisations.find((org) => org.id === existing.organisationId)) : undefined,
      user: include.user ? clone(state.users.find((user) => user.id === existing.userId)) : undefined,
    };
  };

  prisma.user.findUnique = async ({ where }) => clone(state.users.find((item) => item.id === where.id) || null);
  prisma.recruiterProfile.update = async ({ where, data }) => {
    const profile = state.recruiterProfiles.find((item) => item.userId === where.userId);
    Object.assign(profile, data);
    return clone(profile);
  };

  prisma.auditLog.create = async ({ data }) => {
    const log = { id: `audit-${state.auditLogs.length + 1}`, createdAt: new Date(), ...data };
    state.auditLogs.push(log);
    return clone(log);
  };
  prisma.auditLog.findMany = async ({ where }) => state.auditLogs.filter((item) => item.organisationId === where.organisationId).map(clone);

  prisma.notification.create = async ({ data }) => {
    const item = { id: `notification-${state.notifications.length + 1}`, readAt: null, createdAt: new Date(), ...data };
    state.notifications.push(item);
    return clone(item);
  };
  prisma.notification.findMany = async ({ where }) => state.notifications.filter((item) => item.recipientUserId === where.recipientUserId && (!where.organisationId || item.organisationId === where.organisationId)).map(clone);
  prisma.notification.updateMany = async ({ where, data }) => {
    for (const item of state.notifications) {
      if (item.recipientUserId === where.recipientUserId && where.id.in.includes(item.id)) {
        item.readAt = data.readAt;
      }
    }
    return { count: where.id.in.length };
  };

  prisma.jobRequisition.create = async ({ data, include = {} }) => {
    const item = { id: `req-${state.requisitions.length + 1}`, createdAt: new Date(), updatedAt: new Date(), approvedAt: null, approvedById: null, ...data };
    state.requisitions.push(item);
    return hydrateRequisition(item, include);
  };
  prisma.jobRequisition.findMany = async ({ where, include = {} }) => state.requisitions.filter((item) => item.organisationId === where.organisationId).map((item) => hydrateRequisition(item, include));
  prisma.jobRequisition.findFirst = async ({ where, include = {} }) => {
    const item = state.requisitions.find((row) => row.id === where.id && row.organisationId === where.organisationId);
    return item ? hydrateRequisition(item, include) : null;
  };
  prisma.jobRequisition.update = async ({ where, data, include = {} }) => {
    const item = state.requisitions.find((row) => row.id === where.id);
    Object.assign(item, data, { updatedAt: new Date() });
    return hydrateRequisition(item, include);
  };

  prisma.job.create = async ({ data, include = {} }) => {
    const item = { id: `job-${state.jobs.length + 1}`, createdAt: new Date(), updatedAt: new Date(), ...data };
    state.jobs.push(item);
    return hydrateJob(item, include);
  };
  prisma.job.findUnique = async ({ where }) => clone(state.jobs.find((item) => item.id === where.id || item.slug === where.slug) || null);
  prisma.job.findMany = async ({ where = {}, include = {} }) => {
    let rows = [...state.jobs];
    if (where.organisationId) rows = rows.filter((item) => item.organisationId === where.organisationId);
    if (where.status) rows = rows.filter((item) => item.status === where.status);
    return rows.map((item) => hydrateJob(item, include));
  };

  prisma.candidateProfile.findUnique = async ({ where, include = {} }) => {
    const item = state.candidates.find((candidate) => candidate.id === where.id);
    if (!item) return null;
    return {
      ...clone(item),
      user: include.user ? clone(state.users.find((user) => user.id === item.userId)) : undefined,
      resumeBuilder: include.resumeBuilder ? clone(state.resumeBuilders.find((builder) => builder.candidateId === item.id) || null) : undefined,
      applications: include.applications ? state.applications.filter((application) => application.candidateId === item.id && application.organisationId === include.applications.where.organisationId).map(clone) : undefined,
      savedByRecruiters: include.savedByRecruiters ? state.savedCandidates.filter((saved) => saved.candidateId === item.id && saved.organisationId === include.savedByRecruiters.where.organisationId).map(clone) : undefined,
    };
  };

  prisma.savedCandidate.upsert = async ({ where, update, create, include = {} }) => {
    const existing = state.savedCandidates.find((item) => item.recruiterId === where.recruiterId_candidateId.recruiterId && item.candidateId === where.recruiterId_candidateId.candidateId);
    if (existing) {
      Object.assign(existing, update);
      return hydrateSavedCandidate(existing, include);
    }
    const item = { id: `saved-${state.savedCandidates.length + 1}`, createdAt: new Date(), ...create };
    state.savedCandidates.push(item);
    return hydrateSavedCandidate(item, include);
  };

  prisma.interviewRound.findFirst = async ({ where, include = {} }) => {
    const round = state.interviewRounds.find((item) => item.id === where.id && item.organisationId === where.organisationId);
    if (!round) return null;
    return hydrateRound(round, include);
  };
  prisma.interviewFeedback.findUnique = async ({ where }) => clone(state.interviewFeedbacks.find((item) => item.interviewRoundId === where.interviewRoundId_interviewerId.interviewRoundId && item.interviewerId === where.interviewRoundId_interviewerId.interviewerId) || null);
  prisma.interviewFeedback.upsert = async ({ where, update, create, include = {} }) => {
    let item = state.interviewFeedbacks.find((row) => row.interviewRoundId === where.interviewRoundId_interviewerId.interviewRoundId && row.interviewerId === where.interviewRoundId_interviewerId.interviewerId);
    if (item) {
      Object.assign(item, update, { updatedAt: new Date() });
    } else {
      item = { id: `feedback-${state.interviewFeedbacks.length + 1}`, createdAt: new Date(), updatedAt: new Date(), ...create };
      state.interviewFeedbacks.push(item);
    }
    return {
      ...clone(item),
      interviewer: include.interviewer ? clone(state.users.find((user) => user.id === item.interviewerId)) : undefined,
    };
  };
}

function hydrateRequisition(item, include = {}) {
  return {
    ...clone(item),
    createdBy: include.createdBy ? clone(state.users.find((user) => user.id === item.createdById)) : undefined,
    approvedBy: include.approvedBy ? clone(state.users.find((user) => user.id === item.approvedById) || null) : undefined,
    recruiter: include.recruiter ? clone(state.users.find((user) => user.id === item.recruiterId) || null) : undefined,
    hiringManager: include.hiringManager ? clone(state.users.find((user) => user.id === item.hiringManagerId) || null) : undefined,
  };
}

function hydrateJob(item, include = {}) {
  return {
    ...clone(item),
    requisition: include.requisition ? clone(state.requisitions.find((req) => req.id === item.requisitionId) || null) : undefined,
    _count: include._count ? { applications: state.applications.filter((app) => app.jobId === item.id).length } : undefined,
  };
}

function hydrateSavedCandidate(item, include = {}) {
  return {
    ...clone(item),
    candidate: include.candidate ? clone(state.candidates.find((candidate) => candidate.id === item.candidateId)) : undefined,
  };
}

function hydrateRound(round, include = {}) {
  return {
    ...clone(round),
    panelMembers: include.panelMembers ? state.interviewPanels.filter((panel) => panel.interviewRoundId === round.id).map((panel) => ({
      ...clone(panel),
      user: include.panelMembers.include?.user ? clone(state.users.find((user) => user.id === panel.userId)) : undefined,
    })) : undefined,
    feedbacks: include.feedbacks ? state.interviewFeedbacks.filter((feedback) => feedback.interviewRoundId === round.id).map((feedback) => ({
      ...clone(feedback),
      interviewer: include.feedbacks.include?.interviewer ? clone(state.users.find((user) => user.id === feedback.interviewerId)) : undefined,
    })) : undefined,
  };
}

before(async () => {
  ({ prisma } = await import('../config/db.js'));
  ({ createOrganisationForUser, listOrganisationMembers, addOrganisationMember, updateOrganisationMember } = await import('../services/organisationService.js'));
  ({ createRequisition, approveRequisition } = await import('../services/requisitionService.js'));
  ({ createJob, listRecruiterJobs } = await import('../services/jobService.js'));
  ({ getAuthorizedCandidateDetail } = await import('../services/searchService.js'));
  ({ submitInterviewFeedback, listInterviewFeedback } = await import('../services/interviewService.js'));
  ({ createNotification, listNotifications } = await import('../services/notificationService.js'));
  ({ recordAuditLog } = await import('../services/auditLogService.js'));
});

beforeEach(() => {
  seedState();
  installPrismaMocks();
});

test('organisation creation creates owner membership and recruiter backfill hook', async () => {
  const created = await createOrganisationForUser(actor('recruiter-1'), { name: 'New Org', slug: 'new-org' });
  assert.equal(created.slug, 'new-org');
  assert.equal(state.memberships.some((item) => item.organisationId === created.id && item.userId === 'recruiter-1' && item.role === 'OWNER'), true);
  assert.equal(state.recruiterProfiles.find((item) => item.userId === 'recruiter-1').organisationId, 'org-1');
});

test('membership creation and role update are restricted to owner/admin and recorded', async () => {
  const member = await addOrganisationMember(actor('owner-1'), { userId: 'viewer-1', role: 'HIRING_MANAGER' }, 'org-1');
  assert.equal(member.role, 'HIRING_MANAGER');

  const updated = await updateOrganisationMember(actor('owner-1'), member.id, { status: 'INACTIVE' }, 'org-1');
  assert.equal(updated.status, 'INACTIVE');
  assert.equal(state.auditLogs.length >= 2, true);
});

test('recruiters cannot add organisation members', async () => {
  await assert.rejects(
    () => addOrganisationMember(actor('recruiter-1'), { userId: 'viewer-1', role: 'VIEWER' }, 'org-1'),
    /Insufficient organisation permissions/
  );
});

test('requisition creation and approval obey organisation roles', async () => {
  const requisition = await createRequisition(actor('recruiter-1'), {
    requisitionCode: 'REQ-100',
    title: 'Platform Recruiter',
    department: 'Talent',
  }, 'org-1');
  assert.equal(requisition.requisitionCode, 'REQ-100');

  await assert.rejects(
    () => approveRequisition(actor('recruiter-1'), requisition.id, { approvalStatus: 'APPROVED' }, 'org-1'),
    /Insufficient organisation permissions/
  );

  const approved = await approveRequisition(actor('owner-1'), requisition.id, { approvalStatus: 'APPROVED' }, 'org-1');
  assert.equal(approved.approvalStatus, 'APPROVED');
});

test('organisation-scoped job access hides other organisation records', async () => {
  await createJob(actor('owner-1'), {
    title: 'Backend Engineer',
    description: 'Build APIs',
    skillsRequired: ['Node.js'],
    experienceMin: 3,
    experienceMax: 6,
    location: 'Remote',
  }, 'org-1');

  const acmeJobs = await listRecruiterJobs(actor('owner-1'), 'org-1');
  const betaJobs = await listRecruiterJobs(actor('outsider-1'), 'org-2');
  assert.equal(acmeJobs.length >= 2, true);
  assert.equal(betaJobs.length, 0);
});

test('candidate search cards stay minimal and candidate detail requires organisation reason', async () => {
  state.savedCandidates.push({ id: 'saved-1', organisationId: 'org-1', recruiterId: 'rp-1', candidateId: 'candidate-1', tag: null, createdAt: new Date() });
  const detail = await getAuthorizedCandidateDetail('candidate-1', 'org-1');
  assert.equal(detail.user.email, 'candidate@example.com');
  assert.equal(detail.resumeUrl, '/private.pdf');

  await assert.rejects(
    () => getAuthorizedCandidateDetail('candidate-1', 'org-2'),
    /Candidate not found/
  );
});

test('interview feedback is isolated per interviewer and panel access is enforced', async () => {
  const feedback = await submitInterviewFeedback(actor('interviewer-1'), 'round-1', {
    recommendation: 'HIRE',
    overallScore: 82,
    finalize: true,
  }, 'org-1');
  assert.equal(feedback.finalized, true);

  const visible = await listInterviewFeedback(actor('interviewer-1'), 'round-1', 'org-1');
  assert.equal(visible.length, 1);

  await assert.rejects(
    () => submitInterviewFeedback(actor('viewer-1'), 'round-1', { recommendation: 'NO_HIRE' }, 'org-1'),
    /not allowed to submit feedback/
  );
});

test('notifications are recipient-scoped and audit logs scrub sensitive fields', async () => {
  await createNotification({
    organisationId: 'org-1',
    recipientUserId: 'owner-1',
    type: 'SYSTEM',
    title: 'New audit event',
    message: 'Check membership changes.',
  });
  await createNotification({
    organisationId: 'org-1',
    recipientUserId: 'recruiter-1',
    type: 'SYSTEM',
    title: 'Different recipient',
    message: 'Only recruiter should see this.',
  });

  const ownerNotifications = await listNotifications('owner-1', 'org-1');
  assert.equal(ownerNotifications.length, 1);

  const log = await recordAuditLog({
    organisationId: 'org-1',
    actorUserId: 'owner-1',
    action: 'membership.change',
    entityType: 'OrganisationMembership',
    beforeData: { passwordHash: 'secret', role: 'VIEWER' },
    afterData: { token: 'abc', role: 'ADMIN' },
  });
  assert.equal(log.beforeData.passwordHash, undefined);
  assert.equal(log.afterData.token, undefined);
});
