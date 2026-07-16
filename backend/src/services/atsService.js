import dayjs from 'dayjs';
import { prisma } from '../config/db.js';
import { buildKeywordMatch } from './matchService.js';
import { sendPipelineEmail } from './emailService.js';
import { serializeApplication, serializeAtsNote } from '../serializers/index.js';
import { requireOrganisationContext, requireOrganisationRole } from './organisationAccessService.js';
import { recordAuditLog } from './auditLogService.js';
import { createNotification } from './notificationService.js';

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
};

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

async function getInterviewRoundForApplication(organisationId, applicationId, roundId) {
  return prisma.interviewRound.findFirst({
    where: {
      id: roundId,
      organisationId,
      interviewProcess: { applicationId },
    },
    include: {
      panelMembers: { include: { user: true } },
      interviewProcess: true,
    },
  });
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

  const stageGroups = ['APPLIED', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'SELECTED', 'REJECTED'].map((stage) => ({
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
    createNotification({
      organisationId: context.organisationId,
      recipientUserId: updated.job.recruiterId,
      type: 'APPLICATION',
      title: 'Application stage updated',
      message: `${updated.candidate.fullName} moved to ${stageLabelMap[stage]} for ${updated.job.title}.`,
      entityType: 'Application',
      entityId: applicationId,
    }),
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
  const { context, application } = await assertOrganisationCanAccessApplication(actorUser, applicationId, organisationId);
  if (!writableRoles.includes(context.activeMembership.role)) {
    const error = new Error('You are not allowed to schedule interviews for this application.');
    error.statusCode = 403;
    throw error;
  }

  const round = await getInterviewRoundForApplication(context.organisationId, applicationId, payload.roundId);
  if (!round) {
    const error = new Error('Interview round not found.');
    error.statusCode = 404;
    throw error;
  }

  const validPanelMemberships = await prisma.organisationMembership.findMany({
    where: {
      organisationId: context.organisationId,
      userId: { in: payload.panelUserIds },
      status: 'ACTIVE',
      role: { in: ['OWNER', 'ADMIN', 'RECRUITER', 'HIRING_MANAGER', 'INTERVIEWER'] },
    },
  });

  if (validPanelMemberships.length !== payload.panelUserIds.length) {
    const error = new Error('All panel members must belong to the organisation and hold an interview-eligible role.');
    error.statusCode = 422;
    throw error;
  }

  const scheduledStartAt = dayjs(payload.scheduledStartAt).toDate();
  const scheduledEndAt = dayjs(payload.scheduledEndAt).toDate();
  const priorRound = await prisma.interviewRound.findUnique({ where: { id: round.id } });

  await prisma.$transaction(async (tx) => {
    await tx.interviewRound.update({
      where: { id: round.id },
      data: {
        interviewType: payload.interviewType,
        status: payload.status || 'SCHEDULED',
        scheduledStartAt,
        scheduledEndAt,
        meetingLocation: payload.meetingLocation || null,
        meetingLink: payload.meetingLink || null,
        cancelReason: null,
        panelMembers: {
          deleteMany: {},
          create: payload.panelUserIds.map((userId) => ({
            organisationId: context.organisationId,
            userId,
          })),
        },
      },
    });

    await tx.application.update({
      where: { id: applicationId },
      data: {
        currentStage: 'INTERVIEW_SCHEDULED',
        statusLabel: stageLabelMap.INTERVIEW_SCHEDULED,
        interviewScheduledAt: scheduledStartAt,
        interviewerName: round.roundName,
      },
    });
  });

  await Promise.all([
    createActivity(context.organisationId, applicationId, {
      actorUserId: actorUser.id,
      eventType: priorRound?.scheduledStartAt ? 'INTERVIEW_RESCHEDULED' : 'INTERVIEW_SCHEDULED',
      message: `Interview ${priorRound?.scheduledStartAt ? 'rescheduled' : 'scheduled'} for ${round.roundName} on ${dayjs(scheduledStartAt).format('DD MMM YYYY, hh:mm A')}.`,
      metadata: {
        roundId: round.id,
        scheduledStartAt,
        scheduledEndAt,
        panelUserIds: payload.panelUserIds,
      },
    }),
    ...payload.panelUserIds.map((userId) => createNotification({
      organisationId: context.organisationId,
      recipientUserId: userId,
      type: 'INTERVIEW',
      title: priorRound?.scheduledStartAt ? 'Interview rescheduled' : 'Interview scheduled',
      message: `${application.candidate.fullName} has a ${round.roundName} round on ${dayjs(scheduledStartAt).format('DD MMM YYYY, hh:mm A')}.`,
      entityType: 'InterviewRound',
      entityId: round.id,
    })),
    recordAuditLog({
      organisationId: context.organisationId,
      actorUserId: actorUser.id,
      action: priorRound?.scheduledStartAt ? 'application.interview.reschedule' : 'application.interview.schedule',
      entityType: 'InterviewRound',
      entityId: round.id,
      beforeData: priorRound,
      afterData: {
        scheduledStartAt,
        scheduledEndAt,
        meetingLocation: payload.meetingLocation || null,
        meetingLink: payload.meetingLink || null,
        panelUserIds: payload.panelUserIds,
      },
      ...requestMeta,
    }),
  ]);

  const updated = await getApplicationWithRelations(context.organisationId, applicationId);
  return serializeApplication(updated, { includeCoverLetter: true, includeCandidatePrivate: true });
}

export async function cancelInterview(applicationId, actorUser, payload, organisationId = null, requestMeta = {}) {
  const { context } = await assertOrganisationCanAccessApplication(actorUser, applicationId, organisationId);
  if (!writableRoles.includes(context.activeMembership.role)) {
    const error = new Error('You are not allowed to cancel interviews for this application.');
    error.statusCode = 403;
    throw error;
  }

  const round = await getInterviewRoundForApplication(context.organisationId, applicationId, payload.roundId);
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
      message: `Interview cancelled for ${round.roundName}.`,
      metadata: { roundId: round.id, cancelReason: payload.cancelReason },
    }),
    ...round.panelMembers.map((member) => createNotification({
      organisationId: context.organisationId,
      recipientUserId: member.userId,
      type: 'INTERVIEW',
      title: 'Interview cancelled',
      message: `${round.roundName} interview has been cancelled.`,
      entityType: 'InterviewRound',
      entityId: round.id,
    })),
    recordAuditLog({
      organisationId: context.organisationId,
      actorUserId: actorUser.id,
      action: 'application.interview.cancel',
      entityType: 'InterviewRound',
      entityId: round.id,
      afterData: { status: 'CANCELLED', cancelReason: payload.cancelReason },
      ...requestMeta,
    }),
  ]);

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
