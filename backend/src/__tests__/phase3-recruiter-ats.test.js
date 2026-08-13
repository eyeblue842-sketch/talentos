import test, { before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createJobSchema } from '@careeriz/shared';

let prisma;
let createJob;
let updateJobStatus;
let getJobDetail;
let searchCandidates;
let getAuthorizedCandidateDetail;
let saveCandidateForRecruiter;
let removeSavedCandidate;
let getSavedCandidates;
let getRecruiterPipeline;
let updatePipelineStage;
let addAtsNote;
let scheduleInterview;
let cancelInterview;
let getRecruiterDashboard;

let state;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function now() {
  return new Date('2026-07-16T12:00:00.000Z');
}

function seedState() {
  state = {
    users: [
      { id: 'owner-1', email: 'owner@acme.com', role: 'RECRUITER', isActive: true },
      { id: 'recruiter-1', email: 'recruiter@acme.com', role: 'RECRUITER', isActive: true },
      { id: 'manager-1', email: 'manager@acme.com', role: 'RECRUITER', isActive: true },
      { id: 'interviewer-1', email: 'panel@acme.com', role: 'RECRUITER', isActive: true },
      { id: 'viewer-1', email: 'viewer@acme.com', role: 'RECRUITER', isActive: true },
      { id: 'owner-2', email: 'owner@beta.com', role: 'RECRUITER', isActive: true },
      { id: 'candidate-user-1', email: 'candidate@example.com', role: 'CANDIDATE', isActive: true },
      { id: 'candidate-user-2', email: 'candidate2@example.com', role: 'CANDIDATE', isActive: true },
    ],
    organisations: [
      { id: 'org-1', name: 'Acme', slug: 'acme', status: 'ACTIVE', createdAt: now(), updatedAt: now() },
      { id: 'org-2', name: 'Beta', slug: 'beta', status: 'ACTIVE', createdAt: now(), updatedAt: now() },
    ],
    memberships: [
      { id: 'mem-1', organisationId: 'org-1', userId: 'owner-1', role: 'OWNER', status: 'ACTIVE', createdAt: now(), updatedAt: now() },
      { id: 'mem-2', organisationId: 'org-1', userId: 'recruiter-1', role: 'RECRUITER', status: 'ACTIVE', createdAt: now(), updatedAt: now() },
      { id: 'mem-3', organisationId: 'org-1', userId: 'manager-1', role: 'HIRING_MANAGER', status: 'ACTIVE', createdAt: now(), updatedAt: now() },
      { id: 'mem-4', organisationId: 'org-1', userId: 'interviewer-1', role: 'INTERVIEWER', status: 'ACTIVE', createdAt: now(), updatedAt: now() },
      { id: 'mem-5', organisationId: 'org-1', userId: 'viewer-1', role: 'VIEWER', status: 'ACTIVE', createdAt: now(), updatedAt: now() },
      { id: 'mem-6', organisationId: 'org-2', userId: 'owner-2', role: 'OWNER', status: 'ACTIVE', createdAt: now(), updatedAt: now() },
    ],
    recruiterProfiles: [
      { id: 'rp-1', userId: 'owner-1', organisationId: 'org-1', companyEmailDomain: 'acme.com', officeLocations: [], profileCompleted: true },
      { id: 'rp-2', userId: 'recruiter-1', organisationId: 'org-1', companyEmailDomain: 'acme.com', officeLocations: [], profileCompleted: true },
      { id: 'rp-3', userId: 'manager-1', organisationId: 'org-1', companyEmailDomain: 'acme.com', officeLocations: [], profileCompleted: true },
      { id: 'rp-4', userId: 'interviewer-1', organisationId: 'org-1', companyEmailDomain: 'acme.com', officeLocations: [], profileCompleted: true },
      { id: 'rp-5', userId: 'viewer-1', organisationId: 'org-1', companyEmailDomain: 'acme.com', officeLocations: [], profileCompleted: true },
      { id: 'rp-6', userId: 'owner-2', organisationId: 'org-2', companyEmailDomain: 'beta.com', officeLocations: [], profileCompleted: true },
    ],
    requisitions: [
      {
        id: 'req-1',
        organisationId: 'org-1',
        requisitionCode: 'REQ-1',
        title: 'Frontend Engineer',
        approvalStatus: 'APPROVED',
        createdAt: now(),
        updatedAt: now(),
      },
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
        summary: 'Strong frontend engineer',
        resumeUrl: '/private/candidate-1.pdf',
        sharedResumeSlug: 'candidate-one',
        profileViews: 5,
        lastActiveAt: now(),
        updatedAt: now(),
      },
      {
        id: 'candidate-2',
        userId: 'candidate-user-2',
        fullName: 'Candidate Two',
        headline: 'QA Engineer',
        location: 'Hyderabad',
        preferredLocations: [],
        totalExperience: 1,
        currentCtcLpa: 5,
        expectedCtcLpa: 7,
        availability: 'TWO_WEEKS',
        skills: ['Testing', 'Playwright'],
        summary: 'QA profile',
        resumeUrl: null,
        sharedResumeSlug: 'candidate-two',
        profileViews: 1,
        lastActiveAt: now(),
        updatedAt: now(),
      },
    ],
    resumeBuilders: [
      {
        id: 'rb-1',
        candidateId: 'candidate-1',
        template: 'classic',
        personal: {},
        education: [{ degree: 'B.Tech', school: 'IIT' }],
        experience: [{ role: 'Engineer', company: 'Acme', summary: 'Built apps' }],
        skills: ['React'],
        projects: [],
        completedScore: 90,
        updatedAt: now(),
      },
    ],
    jobs: [
      {
        id: 'job-1',
        organisationId: 'org-1',
        recruiterId: 'recruiter-1',
        hiringManagerId: 'manager-1',
        requisitionId: 'req-1',
        title: 'Frontend Engineer',
        slug: 'frontend-engineer',
        description: 'Build recruiter workflows',
        skillsRequired: ['React'],
        experienceMin: 2,
        experienceMax: 5,
        salaryMin: 10,
        salaryMax: 20,
        currency: 'INR',
        location: 'Bengaluru',
        employmentType: 'FULL_TIME',
        workplaceType: 'HYBRID',
        numberOfOpenings: 2,
        department: 'Engineering',
        businessUnit: 'Product',
        applicationDeadline: new Date('2026-07-25T00:00:00.000Z'),
        status: 'OPEN',
        archivedAt: null,
        createdAt: now(),
        updatedAt: now(),
      },
      {
        id: 'job-2',
        organisationId: 'org-2',
        recruiterId: 'owner-2',
        hiringManagerId: null,
        requisitionId: null,
        title: 'Backend Engineer',
        slug: 'backend-engineer',
        description: 'Beta role',
        skillsRequired: ['Node.js'],
        experienceMin: 3,
        experienceMax: 6,
        salaryMin: 15,
        salaryMax: 25,
        currency: 'INR',
        location: 'Remote',
        employmentType: 'FULL_TIME',
        workplaceType: 'REMOTE',
        numberOfOpenings: 1,
        department: 'Engineering',
        businessUnit: 'Platform',
        applicationDeadline: null,
        status: 'OPEN',
        archivedAt: null,
        createdAt: now(),
        updatedAt: now(),
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
        coverLetter: 'Hello',
        recruiterTag: null,
        appliedAt: now(),
        updatedAt: now(),
        interviewScheduledAt: null,
        interviewerName: null,
        recruiterNotes: null,
        matchScore: 92,
      },
      {
        id: 'app-2',
        organisationId: 'org-2',
        jobId: 'job-2',
        candidateId: 'candidate-2',
        currentStage: 'APPLIED',
        statusLabel: 'Applied',
        coverLetter: null,
        recruiterTag: null,
        appliedAt: now(),
        updatedAt: now(),
        interviewScheduledAt: null,
        interviewerName: null,
        recruiterNotes: null,
        matchScore: 70,
      },
    ],
    notes: [],
    activities: [],
    interviewProcesses: [
      { id: 'process-1', organisationId: 'org-1', applicationId: 'app-1', title: 'Default process', status: 'PLANNED', createdById: 'recruiter-1', createdAt: now(), updatedAt: now() },
    ],
    interviewRounds: [
      {
        id: 'round-1',
        organisationId: 'org-1',
        interviewProcessId: 'process-1',
        roundName: 'Technical',
        sequence: 1,
        interviewType: 'TECHNICAL',
        status: 'PLANNED',
        scheduledStartAt: null,
        scheduledEndAt: null,
        meetingLocation: null,
        meetingLink: null,
        cancelReason: null,
        scorecardCriteria: [{ key: 'technical', label: 'Technical Skills' }],
        feedbackLockedAt: null,
        createdAt: now(),
        updatedAt: now(),
      },
    ],
    interviewPanels: [
      { id: 'panel-1', organisationId: 'org-1', interviewRoundId: 'round-1', userId: 'interviewer-1', createdAt: now() },
    ],
    interviewFeedbacks: [],
    savedCandidates: [],
    notifications: [],
    auditLogs: [],
  };
}

function actor(userId, organisationId = null) {
  const user = state.users.find((item) => item.id === userId);
  const recruiterProfile = state.recruiterProfiles.find((item) => item.userId === userId) || null;
  const memberships = state.memberships
    .filter((item) => item.userId === userId && item.status === 'ACTIVE')
    .map((item) => ({
      ...clone(item),
      organisation: clone(state.organisations.find((org) => org.id === item.organisationId)),
    }));
  const activeMembership = organisationId
    ? memberships.find((item) => item.organisationId === organisationId) || null
    : memberships[0] || null;

  return {
    ...clone(user),
    recruiterProfile: recruiterProfile ? clone(recruiterProfile) : null,
    memberships,
    activeMembership,
  };
}

function maybeIncludeAuthor(note, include = {}) {
  if (!include.author) return undefined;
  const author = state.users.find((item) => item.id === note.authorId);
  return {
    ...clone(author),
    recruiterProfile: include.author.include?.recruiterProfile
      ? clone(state.recruiterProfiles.find((item) => item.userId === note.authorId) || null)
      : undefined,
    candidateProfile: include.author.include?.candidateProfile
      ? clone(state.candidates.find((item) => item.userId === note.authorId) || null)
      : undefined,
  };
}

function hydrateJob(job, include = {}) {
  return {
    ...clone(job),
    requisition: include.requisition ? clone(state.requisitions.find((item) => item.id === job.requisitionId) || null) : undefined,
    recruiter: include.recruiter ? clone(state.users.find((item) => item.id === job.recruiterId) || null) : undefined,
    hiringManager: include.hiringManager ? clone(state.users.find((item) => item.id === job.hiringManagerId) || null) : undefined,
    organisation: include.organisation ? clone(state.organisations.find((item) => item.id === job.organisationId) || null) : undefined,
    _count: include._count ? { applications: state.applications.filter((item) => item.jobId === job.id).length } : undefined,
  };
}

function hydrateRound(round, include = {}) {
  return {
    ...clone(round),
    panelMembers: include.panelMembers
      ? state.interviewPanels.filter((item) => item.interviewRoundId === round.id).map((item) => ({
          ...clone(item),
          user: include.panelMembers.include?.user ? clone(state.users.find((user) => user.id === item.userId)) : undefined,
        }))
      : undefined,
    feedbacks: include.feedbacks ? [] : undefined,
    interviewProcess: include.interviewProcess ? clone(state.interviewProcesses.find((item) => item.id === round.interviewProcessId)) : undefined,
  };
}

function hydrateApplication(application, include = {}) {
  return {
    ...clone(application),
    candidate: include.candidate
      ? {
          ...clone(state.candidates.find((item) => item.id === application.candidateId)),
          user: include.candidate.include?.user ? clone(state.users.find((item) => item.id === state.candidates.find((candidate) => candidate.id === application.candidateId).userId)) : undefined,
          resumeBuilder: include.candidate.include?.resumeBuilder ? clone(state.resumeBuilders.find((item) => item.candidateId === application.candidateId) || null) : undefined,
        }
      : undefined,
    job: include.job ? hydrateJob(state.jobs.find((item) => item.id === application.jobId), include.job.include || {}) : undefined,
    notes: include.notes
      ? state.notes
          .filter((item) => item.applicationId === application.id)
          .sort((a, b) => b.createdAt - a.createdAt)
          .map((item) => ({ ...clone(item), author: maybeIncludeAuthor(item, include.notes.include) }))
      : undefined,
    activities: include.activities
      ? state.activities
          .filter((item) => item.applicationId === application.id)
          .sort((a, b) => b.createdAt - a.createdAt)
          .map((item) => ({
            ...clone(item),
            actorUser: include.activities.include?.actorUser ? clone(state.users.find((user) => user.id === item.actorUserId) || null) : undefined,
          }))
      : undefined,
    interviewProcesses: include.interviewProcesses
      ? state.interviewProcesses
          .filter((item) => item.applicationId === application.id)
          .map((item) => ({
            ...clone(item),
            createdBy: include.interviewProcesses.include?.createdBy ? clone(state.users.find((user) => user.id === item.createdById) || null) : undefined,
            rounds: state.interviewRounds
              .filter((round) => round.interviewProcessId === item.id)
              .sort((a, b) => a.sequence - b.sequence)
              .map((round) => hydrateRound(round, include.interviewProcesses.include?.rounds?.include || {})),
          }))
      : undefined,
  };
}

function installPrismaMocks() {
  prisma.$transaction = async (callback) => callback(prisma);

  prisma.organisationMembership.findMany = async ({ where = {}, include = {} }) => state.memberships
    .filter((item) => {
      if (where.userId?.in && !where.userId.in.includes(item.userId)) return false;
      if (where.userId && typeof where.userId === 'string' && item.userId !== where.userId) return false;
      if (where.organisationId && item.organisationId !== where.organisationId) return false;
      if (where.status && item.status !== where.status) return false;
      if (where.role?.in && !where.role.in.includes(item.role)) return false;
      return true;
    })
    .map((item) => ({
      ...clone(item),
      organisation: include.organisation ? clone(state.organisations.find((org) => org.id === item.organisationId)) : undefined,
      user: include.user ? clone(state.users.find((user) => user.id === item.userId)) : undefined,
    }));

  prisma.organisationMembership.findFirst = async ({ where = {}, include = {} }) => {
    const membership = state.memberships.find((item) => {
      if (where.organisationId && item.organisationId !== where.organisationId) return false;
      if (where.userId && item.userId !== where.userId) return false;
      if (where.status && item.status !== where.status) return false;
      if (where.role?.in && !where.role.in.includes(item.role)) return false;
      return true;
    });
    if (!membership) return null;
    return {
      ...clone(membership),
      organisation: include.organisation ? clone(state.organisations.find((org) => org.id === membership.organisationId)) : undefined,
      user: include.user ? clone(state.users.find((user) => user.id === membership.userId)) : undefined,
    };
  };

  prisma.jobRequisition.findFirst = async ({ where }) => clone(state.requisitions.find((item) => (
    item.id === where.id
    && item.organisationId === where.organisationId
    && item.approvalStatus === where.approvalStatus
  )) || null);
  prisma.jobRequisition.count = async ({ where = {} } = {}) => state.requisitions.filter((item) => {
    if (where.organisationId && item.organisationId !== where.organisationId) return false;
    if (where.status?.in && !where.status.in.includes(item.status)) return false;
    return true;
  }).length;

  prisma.job.findUnique = async ({ where }) => clone(state.jobs.find((item) => item.id === where.id || item.slug === where.slug) || null);
  prisma.job.findFirst = async ({ where, include = {} }) => {
    const job = state.jobs.find((item) => item.id === where.id && item.organisationId === where.organisationId);
    return job ? hydrateJob(job, include) : null;
  };
  prisma.job.findMany = async ({ where = {}, include = {}, skip = 0, take = 100 }) => state.jobs
    .filter((item) => {
      if (where.organisationId && item.organisationId !== where.organisationId) return false;
      if (where.status) {
        if (typeof where.status === 'string' && item.status !== where.status) return false;
        if (where.status.in && !where.status.in.includes(item.status)) return false;
      }
      if (where.title?.contains && !item.title.toLowerCase().includes(where.title.contains.toLowerCase())) return false;
      if (where.applicationDeadline?.not === null && item.applicationDeadline === null) return false;
      if (where.applicationDeadline?.lte && (!item.applicationDeadline || new Date(item.applicationDeadline) > new Date(where.applicationDeadline.lte))) return false;
      if (where.applicationDeadline?.gte && (!item.applicationDeadline || new Date(item.applicationDeadline) < new Date(where.applicationDeadline.gte))) return false;
      return true;
    })
    .slice(skip, skip + take)
    .map((item) => hydrateJob(item, include));
  prisma.job.count = async ({ where = {} }) => (await prisma.job.findMany({ where })).length;
  prisma.job.create = async ({ data, include = {} }) => {
    const job = { id: `job-${state.jobs.length + 1}`, createdAt: now(), updatedAt: now(), ...data };
    state.jobs.push(job);
    return hydrateJob(job, include);
  };
  prisma.job.update = async ({ where, data, include = {} }) => {
    const job = state.jobs.find((item) => item.id === where.id);
    Object.assign(job, data, { updatedAt: now() });
    return hydrateJob(job, include);
  };
  prisma.job.delete = async ({ where }) => {
    state.jobs = state.jobs.filter((item) => item.id !== where.id);
    return { id: where.id };
  };

  prisma.application.findFirst = async ({ where, include = {} }) => {
    const application = state.applications.find((item) => item.id === where.id && item.organisationId === where.organisationId);
    return application ? hydrateApplication(application, include) : null;
  };
  prisma.application.findMany = async ({ where = {}, include = {} }) => state.applications
    .filter((item) => {
      if (where.organisationId && item.organisationId !== where.organisationId) return false;
      if (where.currentStage && item.currentStage !== where.currentStage) return false;
      if (where.jobId && item.jobId !== where.jobId) return false;
      if (where.candidateId && item.candidateId !== where.candidateId) return false;
      return true;
    })
    .map((item) => hydrateApplication(item, include));
  prisma.application.update = async ({ where, data, include = {} }) => {
    const application = state.applications.find((item) => item.id === where.id);
    Object.assign(application, data, { updatedAt: now() });
    return hydrateApplication(application, include);
  };
  prisma.application.count = async ({ where = {} }) => (await prisma.application.findMany({ where })).length;
  prisma.application.groupBy = async ({ by, where = {}, _count }) => {
    assert.deepEqual(by, ['currentStage']);
    assert.ok(_count.currentStage);
    const rows = state.applications.filter((item) => !where.organisationId || item.organisationId === where.organisationId);
    const counts = new Map();
    for (const row of rows) {
      counts.set(row.currentStage, (counts.get(row.currentStage) || 0) + 1);
    }
    return [...counts.entries()].map(([currentStage, count]) => ({ currentStage, _count: { currentStage: count } }));
  };

  prisma.candidateProfile.findMany = async ({ where = {}, include = {} }) => state.candidates
    .filter((item) => {
      if (where.id?.in && !where.id.in.includes(item.id)) return false;
      if (where.location?.contains && !item.location.toLowerCase().includes(where.location.contains.toLowerCase())) return false;
      if (where.availability && item.availability !== where.availability) return false;
      if (where.totalExperience?.gte !== undefined && item.totalExperience < where.totalExperience.gte) return false;
      if (where.totalExperience?.lte !== undefined && item.totalExperience > where.totalExperience.lte) return false;
      if (where.OR?.length) {
        const matched = where.OR.some((condition) => {
          if (condition.fullName?.contains) return item.fullName.toLowerCase().includes(condition.fullName.contains.toLowerCase());
          if (condition.headline?.contains) return item.headline.toLowerCase().includes(condition.headline.contains.toLowerCase());
          if (condition.skills?.has) return item.skills.includes(condition.skills.has);
          return false;
        });
        if (!matched) return false;
      }
      return true;
    })
    .map((item) => ({
      ...clone(item),
      resumeBuilder: include.resumeBuilder ? clone(state.resumeBuilders.find((builder) => builder.candidateId === item.id) || null) : undefined,
    }));
  prisma.candidateProfile.findUnique = async ({ where, include = {} }) => {
    const candidate = state.candidates.find((item) => item.id === where.id);
    if (!candidate) return null;
    return {
      ...clone(candidate),
      user: include.user ? clone(state.users.find((user) => user.id === candidate.userId) || null) : undefined,
      resumeBuilder: include.resumeBuilder ? clone(state.resumeBuilders.find((builder) => builder.candidateId === candidate.id) || null) : undefined,
      applications: include.applications
        ? state.applications
            .filter((application) => application.candidateId === candidate.id && application.organisationId === include.applications.where.organisationId)
            .map((application) => hydrateApplication(application, include.applications.include))
        : undefined,
      savedByRecruiters: include.savedByRecruiters
        ? state.savedCandidates.filter((item) => item.candidateId === candidate.id && item.organisationId === include.savedByRecruiters.where.organisationId).map(clone)
        : undefined,
    };
  };

  prisma.savedCandidate.findMany = async ({ where = {}, include = {}, skip = 0, take = 100 } = {}) => state.savedCandidates
    .filter((item) => {
      if (where.organisationId && item.organisationId !== where.organisationId) return false;
      if (where.candidateId && typeof where.candidateId === 'string' && item.candidateId !== where.candidateId) return false;
      if (where.candidateId?.in && !where.candidateId.in.includes(item.candidateId)) return false;
      if (where.recruiterId && item.recruiterId !== where.recruiterId) return false;
      if (where.tag && item.tag !== where.tag) return false;
      return true;
    })
    .slice(skip, skip + take)
    .map((item) => ({
      ...clone(item),
      candidate: include.candidate ? clone(state.candidates.find((candidate) => candidate.id === item.candidateId)) : undefined,
      recruiter: include.recruiter ? { ...clone(state.recruiterProfiles.find((profile) => profile.id === item.recruiterId)), user: clone(state.users.find((user) => user.id === state.recruiterProfiles.find((profile) => profile.id === item.recruiterId)?.userId) || null) } : undefined,
    }));
  prisma.savedCandidate.findFirst = async ({ where = {} }) => clone(state.savedCandidates.find((item) => (
    (!where.organisationId || item.organisationId === where.organisationId)
    && (!where.recruiterId || item.recruiterId === where.recruiterId)
    && (!where.candidateId || item.candidateId === where.candidateId)
  )) || null);
  prisma.savedCandidate.count = async ({ where = {} }) => (await prisma.savedCandidate.findMany({ where })).length;
  prisma.savedCandidate.upsert = async ({ where, update, create, include = {} }) => {
    let saved = state.savedCandidates.find((item) => item.recruiterId === where.recruiterId_candidateId.recruiterId && item.candidateId === where.recruiterId_candidateId.candidateId);
    if (saved) {
      Object.assign(saved, update);
    } else {
      saved = { id: `saved-${state.savedCandidates.length + 1}`, createdAt: now(), ...create };
      state.savedCandidates.push(saved);
    }
    return {
      ...clone(saved),
      candidate: include.candidate ? clone(state.candidates.find((candidate) => candidate.id === saved.candidateId)) : undefined,
    };
  };
  prisma.savedCandidate.delete = async ({ where }) => {
    state.savedCandidates = state.savedCandidates.filter((item) => item.id !== where.id);
    return { id: where.id };
  };

  prisma.atsNote.create = async ({ data, include = {} }) => {
    const note = { id: `note-${state.notes.length + 1}`, createdAt: now(), updatedAt: now(), ...data };
    state.notes.push(note);
    return { ...clone(note), author: maybeIncludeAuthor(note, include) };
  };
  prisma.atsNote.findFirst = async ({ where, include = {} }) => {
    const note = state.notes.find((item) => item.id === where.id && item.applicationId === where.applicationId && item.organisationId === where.organisationId);
    return note ? { ...clone(note), author: include.author ? maybeIncludeAuthor(note, include) : undefined } : null;
  };
  prisma.atsNote.update = async ({ where, data, include = {} }) => {
    const note = state.notes.find((item) => item.id === where.id);
    Object.assign(note, data, { updatedAt: now() });
    return { ...clone(note), author: maybeIncludeAuthor(note, include) };
  };
  prisma.atsNote.delete = async ({ where }) => {
    state.notes = state.notes.filter((item) => item.id !== where.id);
    return { id: where.id };
  };

  prisma.applicationActivity.create = async ({ data }) => {
    const activity = { id: `activity-${state.activities.length + 1}`, createdAt: now(), updatedAt: now(), ...data };
    state.activities.push(activity);
    return clone(activity);
  };
  prisma.jobApplication = {
    findFirst: async ({ where = {} } = {}) => {
      const application = state.applications.find((item) => item.id === where.applicationId);
      return application ? { id: application.id } : null;
    },
    update: async ({ where, data }) => {
      const application = state.applications.find((item) => item.id === where.id);
      if (!application) return null;
      Object.assign(application, data, { updatedAt: now() });
      return clone(application);
    },
  };
  prisma.applicationTimeline = {
    create: async ({ data }) => ({
      id: `timeline-${state.activities.length + 1}`,
      createdAt: now(),
      ...data,
    }),
  };

  prisma.notification.create = async ({ data }) => {
    const notification = { id: `notification-${state.notifications.length + 1}`, readAt: null, createdAt: now(), ...data };
    state.notifications.push(notification);
    return clone(notification);
  };

  prisma.auditLog.create = async ({ data }) => {
    const auditLog = { id: `audit-${state.auditLogs.length + 1}`, createdAt: now(), ...data };
    state.auditLogs.push(auditLog);
    return clone(auditLog);
  };

  prisma.interviewRound.findFirst = async ({ where, include = {} }) => {
    const round = state.interviewRounds.find((item) => (
      item.id === where.id
      && item.organisationId === where.organisationId
      && state.interviewProcesses.find((process) => process.id === item.interviewProcessId)?.applicationId === where.interviewProcess.applicationId
    ));
    return round ? hydrateRound(round, include) : null;
  };
  prisma.interviewRound.findUnique = async ({ where }) => clone(state.interviewRounds.find((item) => item.id === where.id) || null);
  prisma.interviewRound.update = async ({ where, data }) => {
    const round = state.interviewRounds.find((item) => item.id === where.id);
    Object.assign(round, data, { updatedAt: now() });
    if (data.panelMembers) {
      state.interviewPanels = state.interviewPanels.filter((item) => item.interviewRoundId !== round.id);
      for (const panel of data.panelMembers.create) {
        state.interviewPanels.push({
          id: `panel-${state.interviewPanels.length + 1}`,
          interviewRoundId: round.id,
          createdAt: now(),
          ...panel,
        });
      }
    }
    return clone(round);
  };
  prisma.interviewRound.findMany = async ({ where = {}, include = {}, take = 100 }) => state.interviewRounds
    .filter((item) => {
      if (where.organisationId && item.organisationId !== where.organisationId) return false;
      if (where.status && item.status !== where.status) return false;
      if (where.scheduledStartAt?.gte && (!item.scheduledStartAt || new Date(item.scheduledStartAt) < new Date(where.scheduledStartAt.gte))) return false;
      return true;
    })
    .slice(0, take)
    .map((item) => ({
      ...clone(item),
      interviewProcess: include.interviewProcess
        ? {
            ...clone(state.interviewProcesses.find((process) => process.id === item.interviewProcessId)),
            application: hydrateApplication(
              state.applications.find((application) => application.id === state.interviewProcesses.find((process) => process.id === item.interviewProcessId).applicationId),
              include.interviewProcess.include.application.include
            ),
          }
        : undefined,
    }));

  prisma.user.findUnique = async ({ where }) => clone(state.users.find((item) => item.id === where.id) || null);
}

before(async () => {
  ({ prisma } = await import('../config/db.js'));
  ({ createJob, updateJobStatus, getJobDetail } = await import('../services/jobService.js'));
  ({ searchCandidates, getAuthorizedCandidateDetail } = await import('../services/searchService.js'));
  ({ saveCandidateForRecruiter, removeSavedCandidate, getSavedCandidates } = await import('../services/resumeService.js'));
  ({ getRecruiterPipeline, updatePipelineStage, addAtsNote, scheduleInterview, cancelInterview } = await import('../services/atsService.js'));
  ({ getRecruiterDashboard } = await import('../services/dashboardService.js'));
});

beforeEach(() => {
  seedState();
  installPrismaMocks();
});

test('recruiter can create and close an organisation-scoped job', async () => {
  const created = await createJob(actor('recruiter-1'), {
    title: 'Product Designer',
    description: 'Own UI design',
    skillsRequired: ['Figma'],
    experienceMin: 3,
    experienceMax: 6,
    salaryMin: 12,
    salaryMax: 18,
    currency: 'INR',
    location: 'Remote',
    employmentType: 'FULL_TIME',
    workplaceType: 'REMOTE',
    numberOfOpenings: 1,
    recruiterId: 'recruiter-1',
    hiringManagerId: 'manager-1',
    requisitionId: 'req-1',
  }, 'org-1');

  assert.equal(created.organisationId, 'org-1');
  assert.equal(created.status, 'DRAFT');
  assert.equal(state.auditLogs.some((item) => item.action === 'job.create' && item.organisationId === 'org-1'), true);

  const closed = await updateJobStatus(created.id, actor('recruiter-1'), 'CLOSED', 'org-1');
  assert.equal(closed.status, 'CLOSED');
});

test('cross-organisation job access is hidden and range validation rejects invalid values', async () => {
  await assert.rejects(
    () => getJobDetail(actor('owner-2'), 'job-1', 'org-2'),
    /Job not found/
  );

  assert.throws(
    () => createJobSchema.parse({
      title: 'Bad job',
      description: 'Invalid range description for schema validation.',
      skillsRequired: ['Node.js'],
      experienceMin: 5,
      experienceMax: 2,
      salaryMin: 12,
      salaryMax: 18,
      location: 'Remote',
    }),
    /Minimum experience must be less than or equal to maximum experience/
  );

  assert.throws(
    () => createJobSchema.parse({
      title: 'Bad salary',
      description: 'Invalid salary description for schema validation.',
      skillsRequired: ['Node.js'],
      experienceMin: 2,
      experienceMax: 5,
      salaryMin: 20,
      salaryMax: 10,
      location: 'Remote',
    }),
    /Minimum salary must be less than or equal to maximum salary/
  );
});

test('resume database search is recruiter-usable and candidate data stays minimised', async () => {
  await saveCandidateForRecruiter(actor('recruiter-1'), 'candidate-1', 'org-1', 'SHORTLISTED');
  await saveCandidateForRecruiter(actor('owner-2'), 'candidate-1', 'org-2', 'REJECTED');

  const results = await searchCandidates({ keyword: 'Frontend', skill: 'React', page: 1, pageSize: 10 }, 'org-1');
  assert.equal(results.items.length, 1);
  assert.equal(results.items[0].savedByOrganisation, true);
  assert.deepEqual(results.items[0].organisationTags, ['SHORTLISTED']);
  assert.equal('resumeUrl' in results.items[0], false);
  assert.equal('user' in results.items[0], false);
});

test('authorised candidate detail is org-scoped and cross-organisation saved tags do not leak', async () => {
  await saveCandidateForRecruiter(actor('recruiter-1'), 'candidate-1', 'org-1', 'SHORTLISTED');
  await saveCandidateForRecruiter(actor('owner-2'), 'candidate-1', 'org-2', 'REJECTED');

  const detail = await getAuthorizedCandidateDetail('candidate-1', 'org-1', { actorUserId: 'recruiter-1' });
  assert.equal(detail.user.email, 'candidate@example.com');
  assert.deepEqual(detail.organisationTags, ['SHORTLISTED']);
  assert.equal(detail.organisationApplications.length, 1);
  assert.equal(detail.organisationApplications[0].organisationId, 'org-1');
  assert.equal(state.auditLogs.some((item) => item.action === 'candidate.detail.access'), true);

  await assert.rejects(
    () => getAuthorizedCandidateDetail('candidate-2', 'org-1'),
    /Candidate not found/
  );
});

test('save, unsave, and saved-candidate filters stay organisation-specific', async () => {
  await saveCandidateForRecruiter(actor('recruiter-1'), 'candidate-1', 'org-1', 'SHORTLISTED');
  await saveCandidateForRecruiter(actor('owner-2'), 'candidate-1', 'org-2', 'REJECTED');

  const orgOneSaved = await getSavedCandidates(actor('recruiter-1'), { tag: 'SHORTLISTED' }, 'org-1');
  assert.equal(orgOneSaved.items.length, 1);
  assert.equal(orgOneSaved.items[0].tag, 'SHORTLISTED');

  const orgTwoSaved = await getSavedCandidates(actor('owner-2'), { tag: 'REJECTED' }, 'org-2');
  assert.equal(orgTwoSaved.items.length, 1);
  assert.equal(orgTwoSaved.items[0].tag, 'REJECTED');

  await removeSavedCandidate(actor('recruiter-1'), 'candidate-1', 'org-1');
  const updated = await getSavedCandidates(actor('recruiter-1'), {}, 'org-1');
  assert.equal(updated.items.length, 0);
});

test('pipeline groups applications by stage and valid transitions create side effects', async () => {
  const pipeline = await getRecruiterPipeline(actor('recruiter-1'), {}, 'org-1');
  assert.equal(pipeline.items.length, 1);
  assert.deepEqual(pipeline.stageGroups.find((item) => item.stage === 'APPLIED'), { stage: 'APPLIED', count: 1 });

  const updated = await updatePipelineStage('app-1', actor('recruiter-1'), 'SHORTLISTED', 'org-1');
  assert.equal(updated.currentStage, 'SHORTLISTED');
  assert.equal(state.activities.some((item) => item.eventType === 'STAGE_CHANGED'), true);
  assert.equal(state.notifications.some((item) => item.entityId === 'app-1' && item.type === 'APPLICATION'), true);
  assert.equal(state.auditLogs.some((item) => item.action === 'application.stage.update'), true);

  await assert.rejects(
    () => updatePipelineStage('app-1', actor('recruiter-1'), 'SELECTED', 'org-1'),
    /not allowed/
  );

  await assert.rejects(
    () => updatePipelineStage('app-1', actor('owner-2'), 'SHORTLISTED', 'org-2'),
    /Application not found/
  );
});

test('notes are organisation-scoped and timeline entries omit sensitive data', async () => {
  const note = await addAtsNote('app-1', actor('recruiter-1'), 'Strong shortlist case.', 'org-1');
  assert.equal(note.authorId, 'recruiter-1');
  assert.equal(state.activities.some((item) => item.eventType === 'NOTE_ADDED'), true);

  const detail = await getAuthorizedCandidateDetail('candidate-1', 'org-1');
  const noteContent = detail.organisationApplications[0].notes[0].content;
  assert.equal(noteContent, 'Strong shortlist case.');
  assert.equal(JSON.stringify(detail).includes('passwordHash'), false);
  assert.equal(JSON.stringify(detail).includes('verificationToken'), false);
});

test('interview scheduling enforces organisation panel membership and creates side effects', async () => {
  const scheduled = await scheduleInterview('app-1', actor('recruiter-1'), {
    roundId: 'round-1',
    interviewType: 'TECHNICAL',
    scheduledStartAt: '2026-07-20T10:00:00.000Z',
    scheduledEndAt: '2026-07-20T11:00:00.000Z',
    panelUserIds: ['interviewer-1', 'manager-1'],
    meetingLink: 'https://meet.example.com/round-1',
  }, 'org-1');

  assert.equal(scheduled.currentStage, 'INTERVIEW_SCHEDULED');
  assert.equal(state.interviewRounds.find((item) => item.id === 'round-1').status, 'SCHEDULED');
  assert.equal(state.activities.some((item) => item.eventType === 'INTERVIEW_SCHEDULED'), true);
  assert.equal(state.notifications.filter((item) => item.entityType === 'InterviewRound').length, 2);
  assert.equal(state.auditLogs.some((item) => item.action === 'application.interview.schedule'), true);

  await assert.rejects(
    () => scheduleInterview('app-1', actor('recruiter-1'), {
      roundId: 'round-1',
      interviewType: 'TECHNICAL',
      scheduledStartAt: '2026-07-20T12:00:00.000Z',
      scheduledEndAt: '2026-07-20T13:00:00.000Z',
      panelUserIds: ['owner-2'],
    }, 'org-1'),
    /must belong to the organisation/
  );

  await cancelInterview('app-1', actor('recruiter-1'), { roundId: 'round-1', cancelReason: 'Candidate unavailable' }, 'org-1');
  assert.equal(state.interviewRounds.find((item) => item.id === 'round-1').status, 'CANCELLED');
  assert.equal(state.activities.some((item) => item.eventType === 'INTERVIEW_CANCELLED'), true);
  assert.equal(state.auditLogs.some((item) => item.action === 'application.interview.cancel'), true);
});

test('dashboard metrics stay organisation-scoped and empty orgs return zero-like states', async () => {
  const closingSoonDeadline = new Date();
  closingSoonDeadline.setDate(closingSoonDeadline.getDate() + 7);

  await saveCandidateForRecruiter(actor('recruiter-1'), 'candidate-1', 'org-1', 'SHORTLISTED');
  state.jobs.push({
    id: 'job-3',
    organisationId: 'org-1',
    recruiterId: 'recruiter-1',
    hiringManagerId: null,
    requisitionId: null,
    title: 'Closing Soon Job',
    slug: 'closing-soon-job',
    description: 'Closing soon',
    skillsRequired: ['React'],
    experienceMin: 1,
    experienceMax: 3,
    salaryMin: null,
    salaryMax: null,
    currency: null,
    location: 'Remote',
    employmentType: 'FULL_TIME',
    workplaceType: 'REMOTE',
    numberOfOpenings: 1,
    department: null,
    businessUnit: null,
    applicationDeadline: closingSoonDeadline,
    status: 'OPEN',
    archivedAt: null,
    createdAt: now(),
    updatedAt: now(),
  });
  state.organisations.push({ id: 'org-3', name: 'Empty Org', slug: 'empty-org', status: 'ACTIVE', createdAt: now(), updatedAt: now() });
  state.users.push({ id: 'viewer-2', email: 'viewer2@empty.com', role: 'RECRUITER', isActive: true });
  state.memberships.push({ id: 'mem-7', organisationId: 'org-3', userId: 'viewer-2', role: 'VIEWER', status: 'ACTIVE', createdAt: now(), updatedAt: now() });

  const dashboard = await getRecruiterDashboard(actor('recruiter-1'), 'org-1');
  assert.equal(dashboard.activeJobsCount >= 1, true);
  assert.equal(dashboard.savedCandidatesCount, 1);
  assert.equal(dashboard.recentApplications.every((item) => item.organisationId === 'org-1'), true);
  assert.equal(dashboard.jobsClosingSoon.some((item) => item.organisationId === 'org-1'), true);

  const emptyDashboard = await getRecruiterDashboard(actor('viewer-2'), 'org-3');
  assert.equal(emptyDashboard.activeJobsCount, 0);
  assert.equal(emptyDashboard.applicantsCount, 0);
  assert.deepEqual(emptyDashboard.recentApplications, []);
});
