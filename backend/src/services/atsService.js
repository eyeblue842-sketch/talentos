import crypto from 'crypto';
import { prisma } from '../config/db.js';
import { buildKeywordMatch } from './matchService.js';
import { sendPipelineEmail, sendRecruiterOutreachEmail } from './emailService.js';
import { serializeApplication, serializeAtsNote } from '../serializers/index.js';
import { requireOrganisationContext, requireOrganisationRole } from './organisationAccessService.js';
import { recordAuditLog } from './auditLogService.js';
import { createNotification } from './notificationService.js';
import { cancelInterviewMeeting, scheduleInterviewMeeting } from '../meeting/meetingService.js';

const allowedStages = {
  APPLIED: ['SHORTLISTED', 'REJECTED'],
  SHORTLISTED: ['INTERVIEW_SCHEDULED', 'REJECTED', 'APPLIED'],
  INTERVIEW_SCHEDULED: ['SELECTED', 'REJECTED', 'SHORTLISTED'],
  SELECTED: [],
  REJECTED: [],
};

const readableRoles = ['OWNER', 'ADMIN', 'RECRUITER', 'HIRING_MANAGER', 'INTERVIEWER', 'VIEWER'];
const writableRoles = ['OWNER', 'ADMIN', 'RECRUITER', 'HIRING_MANAGER'];

const stageLabelMap = {
  APPLIED: 'Applied',
  SHORTLISTED: 'Shortlisted',
  INTERVIEW_SCHEDULED: 'Interview',
  SELECTED: 'Selected',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
};

const recruiterResumeDbSourceName = 'Resume Database';

const candidateVisibleStatusMap = {
  APPLIED: 'Application Received',
  SHORTLISTED: 'Under Review',
  INTERVIEW_SCHEDULED: 'Interview Stage',
  SELECTED: 'Selected',
  REJECTED: 'Application Closed',
  WITHDRAWN: 'Application Withdrawn',
};

function isMissingInterviewMeetingInfrastructure(error) {
  return error?.code === 'P2021'
    || error?.code === 'P2022'
    || error?.message?.includes('InterviewMeeting')
    || error?.message?.includes('interviewMeeting');
}

function generatePublicReference() {
  return crypto.randomBytes(10).toString('hex').slice(0, 10).toUpperCase();
}

async function getWritableOrganisationContext(actorUser, organisationId = null) {
  return requireOrganisationRole(actorUser, writableRoles, organisationId);
}

async function ensureRequirementJob(context, jobId, requisitionId = null) {
  const job = await prisma.job.findFirst({
    where: {
      id: jobId,
      organisationId: context.organisationId,
      requisitionId: requisitionId || undefined,
    },
    include: {
      requisition: true,
    },
  });

  if (!job) {
    const error = new Error('Job not found.');
    error.statusCode = 404;
    throw error;
  }

  return job;
}

async function ensureResumeCandidate(candidateId) {
  const candidate = await prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    include: {
      user: true,
    },
  });

  if (!candidate) {
    const error = new Error('Candidate not found.');
    error.statusCode = 404;
    throw error;
  }

  return candidate;
}

async function buildResumeWorkflowApplication(tx, { organisationId, actorUser, candidate, job, stage, requestMeta = {} }) {
  const existing = await tx.application.findUnique({
    where: {
      jobId_candidateId: {
        jobId: job.id,
        candidateId: candidate.id,
      },
    },
    include: {
      candidate: { include: { user: true, resumeBuilder: true } },
      job: { include: { requisition: true, recruiter: true, hiringManager: true } },
      submittedApplication: true,
      activities: { include: { actorUser: true }, orderBy: { createdAt: 'desc' } },
      notes: {
        include: { author: { include: { recruiterProfile: { include: { organisation: true } }, candidateProfile: true } } },
        orderBy: { createdAt: 'desc' },
      },
      interviewProcesses: {
        include: {
          createdBy: true,
          rounds: {
            include: {
              panelMembers: { include: { user: true } },
              feedbacks: { include: { interviewer: true } },
            },
          },
        },
      },
    },
  });

  if (existing) {
    return { application: existing, duplicate: true, created: false };
  }

  const matchScore = buildKeywordMatch(job.skillsRequired || [], candidate.skills || []);
  const nextStage = stage || 'APPLIED';
  const statusLabel = stageLabelMap[nextStage] || stageLabelMap.APPLIED;
  const candidateStatusMessage = nextStage === 'SHORTLISTED'
    ? candidateVisibleStatusMap.SHORTLISTED
    : candidateVisibleStatusMap.APPLIED;

  const application = await tx.application.create({
    data: {
      organisationId,
      jobId: job.id,
      candidateId: candidate.id,
      currentStage: nextStage,
      statusLabel,
      recruiterTag: nextStage === 'SHORTLISTED' ? 'SHORTLISTED' : null,
      matchScore,
    },
  });

  const jobApplication = await tx.jobApplication.create({
    data: {
      publicReference: generatePublicReference(),
      organisationId,
      jobId: job.id,
      candidateId: candidate.id,
      applicationId: application.id,
      sourceType: 'API',
      sourceName: recruiterResumeDbSourceName,
      candidateStatusUpdatedAt: new Date(),
    },
  });

  await tx.applicationActivity.create({
    data: {
      organisationId,
      applicationId: application.id,
      actorUserId: actorUser.id,
      eventType: nextStage === 'SHORTLISTED' ? 'SHORTLISTED_FROM_RESUME_SEARCH' : 'ADDED_FROM_RESUME_SEARCH',
      message: nextStage === 'SHORTLISTED'
        ? 'Candidate shortlisted from resume database.'
        : 'Candidate added to ATS from resume database.',
      metadata: {
        sourceName: recruiterResumeDbSourceName,
      },
    },
  });

  await tx.applicationTimeline.create({
    data: {
      organisationId,
      applicationId: jobApplication.id,
      actorUserId: actorUser.id,
      eventType: nextStage,
      message: `${candidateStatusMessage} for ${job.title}.`,
      metadata: {
        sourceName: recruiterResumeDbSourceName,
      },
      isCandidateVisible: true,
    },
  });

  await tx.auditLog.create({
    data: {
      organisationId,
      actorUserId: actorUser.id,
      action: nextStage === 'SHORTLISTED' ? 'resume-search.shortlist' : 'resume-search.add-to-ats',
      entityType: 'Application',
      entityId: application.id,
      afterData: {
        jobId: job.id,
        candidateId: candidate.id,
        currentStage: nextStage,
        sourceName: recruiterResumeDbSourceName,
      },
      ipAddress: requestMeta.ipAddress || null,
      userAgent: requestMeta.userAgent || null,
    },
  });

  const fullApplication = await tx.application.findUnique({
    where: { id: application.id },
    include: {
      candidate: { include: { user: true, resumeBuilder: true } },
      job: { include: { requisition: true, recruiter: true, hiringManager: true } },
      submittedApplication: true,
      activities: { include: { actorUser: true }, orderBy: { createdAt: 'desc' } },
      notes: {
        include: { author: { include: { recruiterProfile: { include: { organisation: true } }, candidateProfile: true } } },
        orderBy: { createdAt: 'desc' },
      },
      interviewProcesses: {
        include: {
          createdBy: true,
          rounds: {
            include: {
              panelMembers: { include: { user: true } },
              feedbacks: { include: { interviewer: true } },
            },
          },
        },
      },
    },
  });

  return { application: fullApplication, duplicate: false, created: true };
}

async function createActivity(organisationId, applicationId, payload) {
  return prisma.applicationActivity.create({
    data: {
      organisationId,
      applicationId,
      actorUserId: payload.actorUserId || null,
      eventType: payload.eventType || null,
      message: payload.message,
      metadata: payload.metadata || null,
    },
  });
}

async function createCandidateTimeline(jobApplicationId, organisationId, actorUserId, eventType, message, metadata = {}) {
  const jobApplication = await prisma.jobApplication.findFirst({
    where: { applicationId: jobApplicationId },
    select: { id: true },
  });

  if (!jobApplication) return;

  await prisma.applicationTimeline.create({
    data: {
      organisationId,
      applicationId: jobApplication.id,
      actorUserId: actorUserId || null,
      eventType,
      message,
      metadata,
      isCandidateVisible: true,
    },
  });

  await prisma.jobApplication.update({
    where: { id: jobApplication.id },
    data: {
      candidateStatusUpdatedAt: new Date(),
    },
  });
}

async function createCandidateNotification(application, title, message, entityType = 'Application') {
  if (!application?.candidate?.user?.id) return;
  await createNotification({
    organisationId: application.organisationId,
    recipientUserId: application.candidate.user.id,
    type: 'APPLICATION',
    title,
    message,
    entityType,
    entityId: application.submittedApplication?.id || application.id,
    metadata: {
      applicationId: application.submittedApplication?.id || application.id,
    },
  });
}

async function getApplicationWithRelations(organisationId, applicationId) {
  return prisma.application.findFirst({
    where: { id: applicationId, organisationId },
    include: {
      candidate: { include: { user: true, resumeBuilder: true } },
      job: {
        include: {
          requisition: true,
          recruiter: true,
          hiringManager: true,
        },
      },
      submittedApplication: true,
      notes: {
        include: {
          author: {
            include: { recruiterProfile: { include: { organisation: true } }, candidateProfile: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
      activities: {
        include: { actorUser: true },
        orderBy: { createdAt: 'desc' },
      },
      interviewProcesses: {
        include: {
          createdBy: true,
          rounds: {
            include: {
              panelMembers: { include: { user: true } },
              feedbacks: { include: { interviewer: true } },
            },
            orderBy: { sequence: 'asc' },
          },
        },
      },
    },
  });
}

async function assertOrganisationCanAccessApplication(actorUser, applicationId, organisationId = null) {
  const context = await requireOrganisationRole(actorUser, readableRoles, organisationId);
  const application = await getApplicationWithRelations(context.organisationId, applicationId);
  if (!application) {
    const error = new Error('Application not found.');
    error.statusCode = 404;
    throw error;
  }

  return { context, application };
}

function ensureTransitionAllowed(currentStage, nextStage) {
  if (!allowedStages[currentStage]?.includes(nextStage)) {
    const error = new Error(`Transition from ${currentStage} to ${nextStage} is not allowed.`);
    error.statusCode = 422;
    throw error;
  }
}

export async function applyToJob(candidateId, payload) {
  const [job, candidate] = await Promise.all([
    prisma.job.findUnique({ where: { id: payload.jobId } }),
    prisma.candidateProfile.findUnique({ where: { id: candidateId } }),
  ]);

  if (!job || job.status !== 'OPEN') {
    const error = new Error('Job not found.');
    error.statusCode = 404;
    throw error;
  }

  if (!candidate) {
    const error = new Error('Candidate profile not found.');
    error.statusCode = 404;
    throw error;
  }

  const matchScore = buildKeywordMatch(job.skillsRequired, candidate.skills);

  const application = await prisma.application.create({
    data: {
      organisationId: job.organisationId,
      jobId: payload.jobId,
      candidateId,
      coverLetter: payload.coverLetter,
      matchScore,
      activities: {
        create: {
          organisationId: job.organisationId,
          eventType: 'APPLICATION_SUBMITTED',
          message: 'Application submitted.',
        },
      },
    },
    include: {
      job: { include: { requisition: true } },
      candidate: true,
      activities: { include: { actorUser: true } },
      notes: true,
      interviewProcesses: true,
    },
  });

  return serializeApplication(application, { includeCoverLetter: true, includeCandidatePrivate: true });
}

export async function getRecruiterPipeline(actorUser, filters = {}, organisationId = null) {
  const context = await requireOrganisationContext(actorUser, organisationId);
  const applications = await prisma.application.findMany({
    where: {
      organisationId: context.organisationId,
      currentStage: filters.stage || undefined,
      jobId: filters.jobId || undefined,
    },
    include: {
      candidate: true,
      job: { include: { requisition: true, recruiter: true, hiringManager: true } },
      notes: {
        include: {
          author: { include: { recruiterProfile: { include: { organisation: true } }, candidateProfile: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
      activities: {
        include: { actorUser: true },
        orderBy: { createdAt: 'desc' },
      },
      interviewProcesses: {
        include: {
          createdBy: true,
          rounds: {
            include: {
              panelMembers: { include: { user: true } },
              feedbacks: { include: { interviewer: true } },
            },
            orderBy: { sequence: 'asc' },
          },
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const stageGroups = ['APPLIED', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'SELECTED', 'REJECTED', 'WITHDRAWN'].map((stage) => ({
    stage,
    count: applications.filter((application) => application.currentStage === stage).length,
  }));

  return {
    items: applications.map((application) => serializeApplication(application, { includeCoverLetter: true, includeCandidatePrivate: true })),
    stageGroups,
  };
}

export async function getApplicationDetail(actorUser, applicationId, organisationId = null) {
  const { application } = await assertOrganisationCanAccessApplication(actorUser, applicationId, organisationId);
  return serializeApplication(application, {
    includeCoverLetter: true,
    includeCandidatePrivate: true,
  });
}

export async function updatePipelineStage(applicationId, actorUser, stage, organisationId = null, requestMeta = {}) {
  const { context, application } = await assertOrganisationCanAccessApplication(actorUser, applicationId, organisationId);
  if (!writableRoles.includes(context.activeMembership.role)) {
    const error = new Error('You are not allowed to update this application stage.');
    error.statusCode = 403;
    throw error;
  }

  ensureTransitionAllowed(application.currentStage, stage);

  const updated = await prisma.application.update({
    where: { id: applicationId },
    data: {
      currentStage: stage,
      statusLabel: stageLabelMap[stage],
    },
    include: {
      candidate: { include: { user: true, resumeBuilder: true } },
      job: { include: { requisition: true, recruiter: true, hiringManager: true } },
      submittedApplication: true,
      activities: { include: { actorUser: true }, orderBy: { createdAt: 'desc' } },
      notes: {
        include: { author: { include: { recruiterProfile: { include: { organisation: true } }, candidateProfile: true } } },
        orderBy: { createdAt: 'desc' },
      },
      interviewProcesses: {
        include: {
          createdBy: true,
          rounds: {
            include: {
              panelMembers: { include: { user: true } },
              feedbacks: { include: { interviewer: true } },
            },
          },
        },
      },
    },
  });

  await Promise.all([
    createActivity(context.organisationId, applicationId, {
      actorUserId: actorUser.id,
      eventType: 'STAGE_CHANGED',
      message: `Moved to ${stageLabelMap[stage]}.`,
      metadata: { fromStage: application.currentStage, toStage: stage },
    }),
    createCandidateTimeline(
      application.submittedApplication?.id || application.id,
      context.organisationId,
      actorUser.id,
      stage,
      `${candidateVisibleStatusMap[stage]} for ${updated.job.title}.`,
      { fromStage: application.currentStage, toStage: stage },
    ),
    createNotification({
      organisationId: context.organisationId,
      recipientUserId: updated.job.recruiterId,
      type: 'APPLICATION',
      title: 'Application stage updated',
      message: `${updated.candidate.fullName} moved to ${stageLabelMap[stage]} for ${updated.job.title}.`,
      entityType: 'Application',
      entityId: applicationId,
    }),
    createCandidateNotification(updated, candidateVisibleStatusMap[stage], `${candidateVisibleStatusMap[stage]} for ${updated.job.title}.`),
    sendPipelineEmail(application.candidate.user.email, stage, application.job.title),
    recordAuditLog({
      organisationId: context.organisationId,
      actorUserId: actorUser.id,
      action: 'application.stage.update',
      entityType: 'Application',
      entityId: applicationId,
      beforeData: { currentStage: application.currentStage, statusLabel: application.statusLabel },
      afterData: { currentStage: updated.currentStage, statusLabel: updated.statusLabel },
      ...requestMeta,
    }),
  ]);

  return serializeApplication(updated, { includeCoverLetter: true, includeCandidatePrivate: true });
}

export async function scheduleInterview(applicationId, actorUser, payload, organisationId = null, requestMeta = {}) {
  const normalizedPanelMembers = (payload.panelMembers || payload.panelUserIds || []).map((member, index) => (
    typeof member === 'string'
      ? {
          userId: member,
          isLead: index === 0,
          isObserver: false,
          feedbackRequired: true,
        }
      : {
          userId: String(member.userId || '').trim(),
          isLead: Boolean(member.isLead),
          isObserver: Boolean(member.isObserver),
          feedbackRequired: member.feedbackRequired !== false,
      }
  ));

  const runLegacyScheduling = async () => {
    const { context, application } = await assertOrganisationCanAccessApplication(actorUser, applicationId, organisationId);
    const round = (application.interviewProcesses || [])
      .flatMap((process) => process.rounds || [])
      .find((item) => item.id === payload.roundId);

    if (!round) {
      const error = new Error('Interview round not found.');
      error.statusCode = 404;
      throw error;
    }

    const membershipUserIds = normalizedPanelMembers.map((item) => item.userId).filter(Boolean);
    const memberships = await prisma.organisationMembership.findMany({
      where: {
        organisationId: context.organisationId,
        userId: { in: membershipUserIds },
        status: 'ACTIVE',
      },
    });

    if (memberships.length !== membershipUserIds.length) {
      const error = new Error('Interview panel members must belong to the organisation.');
      error.statusCode = 422;
      throw error;
    }

    await prisma.interviewRound.update({
      where: { id: round.id },
      data: {
        status: 'SCHEDULED',
        interviewType: payload.interviewType,
        scheduledStartAt: new Date(payload.scheduledStartAt),
        scheduledEndAt: new Date(payload.scheduledEndAt),
        timezone: payload.timezone || round.timezone || 'UTC',
        meetingMode: payload.meetingMode || round.meetingMode || 'VIRTUAL',
        meetingLocation: payload.meetingLocation || null,
        meetingLink: payload.meetingLink || null,
        officeAddress: payload.officeAddress || null,
        candidateInstructions: payload.candidateInstructions || null,
        instructions: payload.notes || null,
        durationMinutes: payload.durationMinutes || round.durationMinutes || 60,
        rescheduleCount: round.rescheduleCount || 0,
      },
    });

    await prisma.application.update({
      where: { id: application.id },
      data: {
        currentStage: 'INTERVIEW_SCHEDULED',
        statusLabel: stageLabelMap.INTERVIEW_SCHEDULED,
      },
    });

    await Promise.all([
      createActivity(context.organisationId, applicationId, {
        actorUserId: actorUser.id,
        eventType: 'INTERVIEW_SCHEDULED',
        message: `${round.roundName} interview scheduled.`,
        metadata: { roundId: round.id },
      }),
      ...normalizedPanelMembers.map((member) => createNotification({
        organisationId: context.organisationId,
        recipientUserId: member.userId,
        type: 'INTERVIEW',
        title: 'Interview scheduled',
        message: `${round.roundName} has been scheduled.`,
        entityType: 'InterviewRound',
        entityId: round.id,
        metadata: { applicationId, roundId: round.id },
      })),
      recordAuditLog({
        organisationId: context.organisationId,
        actorUserId: actorUser.id,
        action: 'application.interview.schedule',
        entityType: 'InterviewRound',
        entityId: round.id,
        afterData: {
          scheduledStartAt: payload.scheduledStartAt,
          scheduledEndAt: payload.scheduledEndAt,
          panelUserIds: membershipUserIds,
        },
        ...requestMeta,
      }),
    ]);

    const updatedLegacy = await getApplicationWithRelations(context.organisationId, applicationId);
    return serializeApplication(updatedLegacy, { includeCoverLetter: true, includeCandidatePrivate: true });
  };

  if (!prisma.interviewMeeting?.create) {
    return runLegacyScheduling();
  }

  try {
    await scheduleInterviewMeeting(applicationId, actorUser, {
      ...payload,
      panelMembers: normalizedPanelMembers,
      notes: payload.notes || null,
    }, organisationId, requestMeta);
  } catch (error) {
    if (!isMissingInterviewMeetingInfrastructure(error)) {
      throw error;
    }
    return runLegacyScheduling();
  }

  const context = await requireOrganisationContext(actorUser, organisationId);
  const updated = await getApplicationWithRelations(context.organisationId, applicationId);
  return serializeApplication(updated, { includeCoverLetter: true, includeCandidatePrivate: true });
}

export async function cancelInterview(applicationId, actorUser, payload, organisationId = null, requestMeta = {}) {
  const runLegacyCancellation = async () => {
    const { context, application } = await assertOrganisationCanAccessApplication(actorUser, applicationId, organisationId);
    const round = (application.interviewProcesses || [])
      .flatMap((process) => process.rounds || [])
      .find((item) => item.id === payload.roundId);

    if (!round) {
      const error = new Error('Interview round not found.');
      error.statusCode = 404;
      throw error;
    }

    await prisma.interviewRound.update({
      where: { id: round.id },
      data: {
        status: 'CANCELLED',
        cancelReason: payload.cancelReason,
      },
    });

    await Promise.all([
      createActivity(context.organisationId, applicationId, {
        actorUserId: actorUser.id,
        eventType: 'INTERVIEW_CANCELLED',
        message: `${round.roundName} interview cancelled.`,
        metadata: { roundId: round.id, cancelReason: payload.cancelReason },
      }),
      recordAuditLog({
        organisationId: context.organisationId,
        actorUserId: actorUser.id,
        action: 'application.interview.cancel',
        entityType: 'InterviewRound',
        entityId: round.id,
        afterData: { cancelReason: payload.cancelReason },
        ...requestMeta,
      }),
    ]);

    const updatedLegacy = await getApplicationWithRelations(context.organisationId, applicationId);
    return serializeApplication(updatedLegacy, { includeCoverLetter: true, includeCandidatePrivate: true });
  };

  if (!prisma.interviewMeeting?.update) {
    return runLegacyCancellation();
  }

  try {
    await cancelInterviewMeeting(applicationId, actorUser, payload, organisationId, requestMeta);
  } catch (error) {
    const canFallbackToLegacy = isMissingInterviewMeetingInfrastructure(error)
      || (error?.statusCode === 422 && error?.message === 'This interview has not been scheduled yet.');

    if (!canFallbackToLegacy) {
      throw error;
    }

    return runLegacyCancellation();
  }

  const context = await requireOrganisationContext(actorUser, organisationId);
  const updated = await getApplicationWithRelations(context.organisationId, applicationId);
  return serializeApplication(updated, { includeCoverLetter: true, includeCandidatePrivate: true });
}

export async function addAtsNote(applicationId, actorUser, content, organisationId = null, requestMeta = {}) {
  const { context } = await assertOrganisationCanAccessApplication(actorUser, applicationId, organisationId);
  const note = await prisma.atsNote.create({
    data: {
      organisationId: context.organisationId,
      applicationId,
      authorId: actorUser.id,
      content,
    },
    include: {
      author: { include: { recruiterProfile: { include: { organisation: true } }, candidateProfile: true } },
    },
  });

  await Promise.all([
    createActivity(context.organisationId, applicationId, {
      actorUserId: actorUser.id,
      eventType: 'NOTE_ADDED',
      message: 'Recruiter note added.',
      metadata: { noteId: note.id },
    }),
    recordAuditLog({
      organisationId: context.organisationId,
      actorUserId: actorUser.id,
      action: 'application.note.create',
      entityType: 'AtsNote',
      entityId: note.id,
      afterData: note,
      ...requestMeta,
    }),
  ]);

  return serializeAtsNote(note);
}

export async function updateAtsNote(applicationId, noteId, actorUser, content, organisationId = null, requestMeta = {}) {
  const { context } = await assertOrganisationCanAccessApplication(actorUser, applicationId, organisationId);
  const note = await prisma.atsNote.findFirst({
    where: { id: noteId, applicationId, organisationId: context.organisationId },
    include: { author: true },
  });

  if (!note) {
    const error = new Error('Note not found.');
    error.statusCode = 404;
    throw error;
  }

  if (note.authorId !== actorUser.id) {
    const error = new Error('You can edit only your own notes.');
    error.statusCode = 403;
    throw error;
  }

  const updated = await prisma.atsNote.update({
    where: { id: noteId },
    data: { content },
    include: {
      author: { include: { recruiterProfile: { include: { organisation: true } }, candidateProfile: true } },
    },
  });

  await Promise.all([
    createActivity(context.organisationId, applicationId, {
      actorUserId: actorUser.id,
      eventType: 'NOTE_UPDATED',
      message: 'Recruiter note updated.',
      metadata: { noteId },
    }),
    recordAuditLog({
      organisationId: context.organisationId,
      actorUserId: actorUser.id,
      action: 'application.note.update',
      entityType: 'AtsNote',
      entityId: noteId,
      beforeData: note,
      afterData: updated,
      ...requestMeta,
    }),
  ]);

  return serializeAtsNote(updated);
}

export async function deleteAtsNote(applicationId, noteId, actorUser, organisationId = null, requestMeta = {}) {
  const { context } = await assertOrganisationCanAccessApplication(actorUser, applicationId, organisationId);
  const note = await prisma.atsNote.findFirst({
    where: { id: noteId, applicationId, organisationId: context.organisationId },
  });

  if (!note) {
    const error = new Error('Note not found.');
    error.statusCode = 404;
    throw error;
  }

  if (note.authorId !== actorUser.id) {
    const error = new Error('You can delete only your own notes.');
    error.statusCode = 403;
    throw error;
  }

  await prisma.atsNote.delete({ where: { id: noteId } });
  await Promise.all([
    createActivity(context.organisationId, applicationId, {
      actorUserId: actorUser.id,
      eventType: 'NOTE_DELETED',
      message: 'Recruiter note deleted.',
      metadata: { noteId },
    }),
    recordAuditLog({
      organisationId: context.organisationId,
      actorUserId: actorUser.id,
      action: 'application.note.delete',
      entityType: 'AtsNote',
      entityId: noteId,
      beforeData: note,
      ...requestMeta,
    }),
  ]);

  return { deleted: true };
}

export async function getCandidateApplications(candidateId) {
  const applications = await prisma.application.findMany({
    where: { candidateId },
    include: {
      job: { include: { recruiter: { include: { recruiterProfile: { include: { organisation: true } } } }, requisition: true } },
      candidate: true,
      activities: { include: { actorUser: true }, orderBy: { createdAt: 'desc' } },
      interviewProcesses: {
        include: {
          createdBy: true,
          rounds: {
            include: {
              panelMembers: { include: { user: true } },
              feedbacks: { include: { interviewer: true } },
            },
          },
        },
      },
    },
    orderBy: { appliedAt: 'desc' },
  });

  return applications.map((application) => serializeApplication(application, { includeCoverLetter: true, includeCandidatePrivate: true }));
}

export async function addCandidatesToAts(actorUser, payload, organisationId = null, requestMeta = {}) {
  const context = await getWritableOrganisationContext(actorUser, organisationId);
  const job = await ensureRequirementJob(context, payload.jobId, payload.requisitionId || null);
  const items = [];

  for (const candidateId of payload.candidateIds) {
    try {
      const candidate = await ensureResumeCandidate(candidateId);
      const result = await prisma.$transaction((tx) => buildResumeWorkflowApplication(tx, {
        organisationId: context.organisationId,
        actorUser,
        candidate,
        job,
        stage: 'APPLIED',
        requestMeta,
      }));

      items.push({
        candidateId,
        success: !result.duplicate,
        duplicate: result.duplicate,
        application: serializeApplication(result.application, { includeCoverLetter: true, includeCandidatePrivate: true }),
      });

      if (!result.duplicate && job.recruiterId && job.recruiterId !== actorUser.id) {
        await createNotification({
          organisationId: context.organisationId,
          recipientUserId: job.recruiterId,
          type: 'APPLICATION',
          title: 'Candidate added to ATS',
          message: `${candidate.fullName} was added to ${job.title} from the resume database.`,
          entityType: 'Application',
          entityId: result.application.id,
        });
      }
    } catch (error) {
      items.push({
        candidateId,
        success: false,
        duplicate: false,
        error: error.message,
      });
    }
  }

  return {
    job: { id: job.id, title: job.title, requisitionId: job.requisitionId || null },
    items,
  };
}

export async function shortlistCandidatesFromResumeSearch(actorUser, payload, organisationId = null, requestMeta = {}) {
  const context = await getWritableOrganisationContext(actorUser, organisationId);
  const job = await ensureRequirementJob(context, payload.jobId, payload.requisitionId || null);
  const items = [];

  for (const candidateId of payload.candidateIds) {
    try {
      const candidate = await ensureResumeCandidate(candidateId);
      const existing = await prisma.application.findUnique({
        where: {
          jobId_candidateId: {
            jobId: job.id,
            candidateId,
          },
        },
      });

      if (!existing) {
        const created = await prisma.$transaction((tx) => buildResumeWorkflowApplication(tx, {
          organisationId: context.organisationId,
          actorUser,
          candidate,
          job,
          stage: 'SHORTLISTED',
          requestMeta,
        }));
        items.push({
          candidateId,
          success: true,
          duplicate: false,
          application: serializeApplication(created.application, { includeCoverLetter: true, includeCandidatePrivate: true }),
        });
        if (job.recruiterId && job.recruiterId !== actorUser.id) {
          await createNotification({
            organisationId: context.organisationId,
            recipientUserId: job.recruiterId,
            type: 'APPLICATION',
            title: 'Candidate shortlisted',
            message: `${candidate.fullName} was shortlisted for ${job.title} from the resume database.`,
            entityType: 'Application',
            entityId: created.application.id,
          });
        }
        continue;
      }

      if (existing.currentStage === 'SHORTLISTED') {
        const current = await getApplicationDetail(actorUser, existing.id, context.organisationId);
        items.push({
          candidateId,
          success: false,
          duplicate: true,
          application: current,
        });
        continue;
      }

      const updated = await updatePipelineStage(existing.id, actorUser, 'SHORTLISTED', context.organisationId, requestMeta);
      items.push({
        candidateId,
        success: true,
        duplicate: false,
        application: updated,
      });
      if (job.recruiterId && job.recruiterId !== actorUser.id) {
        await createNotification({
          organisationId: context.organisationId,
          recipientUserId: job.recruiterId,
          type: 'APPLICATION',
          title: 'Candidate shortlisted',
          message: `${candidate.fullName} was shortlisted for ${job.title}.`,
          entityType: 'Application',
          entityId: updated.id,
        });
      }
    } catch (error) {
      items.push({
        candidateId,
        success: false,
        duplicate: false,
        error: error.message,
      });
    }
  }

  return {
    job: { id: job.id, title: job.title, requisitionId: job.requisitionId || null },
    items,
  };
}

export async function tagCandidatesFromResumeSearch(actorUser, payload, organisationId = null, requestMeta = {}) {
  const context = await getWritableOrganisationContext(actorUser, organisationId);
  const items = [];

  for (const candidateId of payload.candidateIds) {
    try {
      await ensureResumeCandidate(candidateId);
      const savedCandidate = await prisma.savedCandidate.upsert({
        where: {
          recruiterId_candidateId: {
            recruiterId: actorUser.recruiterProfile.id,
            candidateId,
          },
        },
        update: {
          organisationId: context.organisationId,
          tag: payload.tag,
        },
        create: {
          organisationId: context.organisationId,
          recruiterId: actorUser.recruiterProfile.id,
          candidateId,
          tag: payload.tag,
        },
      });

      await recordAuditLog({
        organisationId: context.organisationId,
        actorUserId: actorUser.id,
        action: 'resume-search.tag',
        entityType: 'SavedCandidate',
        entityId: savedCandidate.id,
        afterData: { tag: payload.tag, candidateId },
        ...requestMeta,
      });

      items.push({ candidateId, success: true, tag: payload.tag });
    } catch (error) {
      items.push({ candidateId, success: false, error: error.message });
    }
  }

  return { items };
}

export async function emailCandidatesFromResumeSearch(actorUser, payload, organisationId = null, requestMeta = {}) {
  const context = await getWritableOrganisationContext(actorUser, organisationId);
  const job = payload.jobId ? await ensureRequirementJob(context, payload.jobId, null) : null;
  const items = [];

  for (const candidateId of payload.candidateIds) {
    try {
      const candidate = await ensureResumeCandidate(candidateId);
      if (!candidate.user?.email) {
        items.push({ candidateId, success: false, error: 'Candidate email unavailable.' });
        continue;
      }

      const body = job
        ? `${payload.body}\n\nContext: ${job.title}`
        : payload.body;
      await sendRecruiterOutreachEmail(candidate.user.email, payload.subject, body);
      await recordAuditLog({
        organisationId: context.organisationId,
        actorUserId: actorUser.id,
        action: 'resume-search.email',
        entityType: 'CandidateProfile',
        entityId: candidateId,
        metadata: {
          jobId: job?.id || null,
          subject: payload.subject,
        },
        ...requestMeta,
      });
      items.push({ candidateId, success: true });
    } catch (error) {
      items.push({ candidateId, success: false, error: error.message });
    }
  }

  return {
    job: job ? { id: job.id, title: job.title } : null,
    items,
  };
}
