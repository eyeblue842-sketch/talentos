import dayjs from 'dayjs';
import { prisma } from '../config/db.js';
import {
  serializeInterviewFeedback,
  serializeInterviewProcess,
  serializeInterviewRound,
} from '../serializers/index.js';
import { requireOrganisationContext, requireOrganisationRole } from './organisationAccessService.js';
import { recordAuditLog } from './auditLogService.js';
import { createNotification } from './notificationService.js';

const readableRoles = ['OWNER', 'ADMIN', 'RECRUITER', 'HIRING_MANAGER', 'INTERVIEWER', 'VIEWER'];
const writableRoles = ['OWNER', 'ADMIN', 'RECRUITER', 'HIRING_MANAGER'];
const panelEligibleRoles = ['OWNER', 'ADMIN', 'RECRUITER', 'HIRING_MANAGER', 'INTERVIEWER'];

const roundInclude = {
  owner: true,
  panelMembers: { include: { user: true } },
  feedbacks: { include: { interviewer: true } },
  interviewProcess: {
    include: {
      application: {
        include: {
          candidate: { include: { user: true } },
          job: true,
          submittedApplication: true,
        },
      },
    },
  },
};

function formatSchedule(value) {
  return value ? dayjs(value).format('DD MMM YYYY, hh:mm A') : 'Not scheduled';
}

function normalizePanelMembers(panelMembers = [], legacyPanelUserIds = []) {
  const normalized = panelMembers.length
    ? panelMembers.map((member) => ({
        userId: String(member.userId || '').trim(),
        isLead: Boolean(member.isLead),
        isObserver: Boolean(member.isObserver),
        feedbackRequired: member.feedbackRequired !== false,
      }))
    : legacyPanelUserIds.map((userId, index) => ({
        userId: String(userId || '').trim(),
        isLead: index === 0,
        isObserver: false,
        feedbackRequired: true,
      }));

  const uniqueUserIds = new Set();
  let leadCount = 0;

  for (const member of normalized) {
    if (!member.userId) {
      const error = new Error('Panel member is required.');
      error.statusCode = 422;
      throw error;
    }

    if (uniqueUserIds.has(member.userId)) {
      const error = new Error('Duplicate panel members are not allowed.');
      error.statusCode = 422;
      throw error;
    }

    uniqueUserIds.add(member.userId);
    if (member.isLead) leadCount += 1;
  }

  if (leadCount > 1) {
    const error = new Error('Only one lead interviewer can be assigned to a round.');
    error.statusCode = 422;
    throw error;
  }

  return normalized;
}

async function validatePanelMembers(organisationId, panelMembers) {
  if (!panelMembers.length) return [];

  const memberships = await prisma.organisationMembership.findMany({
    where: {
      organisationId,
      userId: { in: panelMembers.map((member) => member.userId) },
      status: 'ACTIVE',
      role: { in: panelEligibleRoles },
    },
  });

  if (memberships.length !== panelMembers.length) {
    const error = new Error('All panel members must belong to the organisation and hold an interview-eligible role.');
    error.statusCode = 422;
    throw error;
  }

  return memberships;
}

function buildRoundData(payload) {
  return {
    roundName: payload.roundName,
    sequence: payload.sequence,
    interviewType: payload.interviewType,
    status: payload.status || 'PLANNED',
    durationMinutes: payload.durationMinutes ?? null,
    ownerUserId: payload.ownerUserId || null,
    timezone: payload.timezone || null,
    meetingMode: payload.meetingMode || null,
    scheduledStartAt: payload.scheduledStartAt ? new Date(payload.scheduledStartAt) : null,
    scheduledEndAt: payload.scheduledEndAt ? new Date(payload.scheduledEndAt) : null,
    meetingLocation: payload.meetingLocation || null,
    meetingLink: payload.meetingLink || null,
    officeAddress: payload.officeAddress || null,
    candidateInstructions: payload.candidateInstructions || null,
    instructions: payload.instructions || null,
    internalNotes: payload.internalNotes || null,
    cancelReason: payload.cancelReason || null,
    scorecardCriteria: payload.scorecardCriteria || null,
    calendarProvider: payload.calendarProvider || 'ICS',
  };
}

async function getApplicationOr404(organisationId, applicationId) {
  const application = await prisma.application.findFirst({
    where: { id: applicationId, organisationId },
    include: {
      candidate: { include: { user: true } },
      job: true,
      submittedApplication: true,
    },
  });

  if (!application) {
    const error = new Error('Application not found.');
    error.statusCode = 404;
    throw error;
  }

  return application;
}

async function getInterviewProcessOr404(organisationId, interviewProcessId) {
  const process = await prisma.interviewProcess.findFirst({
    where: { id: interviewProcessId, organisationId },
    include: {
      createdBy: true,
      rounds: {
        include: {
          owner: true,
          panelMembers: { include: { user: true } },
          feedbacks: { include: { interviewer: true } },
        },
        orderBy: { sequence: 'asc' },
      },
    },
  });

  if (!process) {
    const error = new Error('Interview process not found.');
    error.statusCode = 404;
    throw error;
  }

  return process;
}

async function getInterviewRoundOr404(organisationId, roundId) {
  const round = await prisma.interviewRound.findFirst({
    where: { id: roundId, organisationId },
    include: roundInclude,
  });

  if (!round) {
    const error = new Error('Interview round not found.');
    error.statusCode = 404;
    throw error;
  }

  return round;
}

async function createApplicationActivity(organisationId, applicationId, actorUserId, eventType, message, metadata = {}) {
  await prisma.applicationActivity.create({
    data: {
      organisationId,
      applicationId,
      actorUserId,
      eventType,
      message,
      metadata,
    },
  });
}

async function createCandidateTimeline(jobApplicationId, organisationId, actorUserId, eventType, message, metadata = {}) {
  if (!jobApplicationId) return;
  await prisma.applicationTimeline.create({
    data: {
      organisationId,
      applicationId: jobApplicationId,
      actorUserId,
      eventType,
      message,
      metadata,
      isCandidateVisible: true,
    },
  });
}

async function createRoundNotifications(round, title, message, metadata = {}) {
  const application = round.interviewProcess.application;
  const notificationMetadata = {
    applicationId: application.submittedApplication?.id || application.id,
    roundId: round.id,
    ...metadata,
  };

  const notificationWrites = [];

  if (application.candidate?.userId) {
    notificationWrites.push(createNotification({
      organisationId: application.organisationId,
      recipientUserId: application.candidate.userId,
      type: 'INTERVIEW',
      title,
      message,
      entityType: 'InterviewRound',
      entityId: round.id,
      metadata: notificationMetadata,
    }));
  }

  for (const member of round.panelMembers || []) {
    notificationWrites.push(createNotification({
      organisationId: round.organisationId,
      recipientUserId: member.userId,
      type: 'INTERVIEW',
      title,
      message,
      entityType: 'InterviewRound',
      entityId: round.id,
      metadata: notificationMetadata,
    }));
  }

  if (round.ownerUserId) {
    const alreadyIncluded = (round.panelMembers || []).some((member) => member.userId === round.ownerUserId);
    if (!alreadyIncluded) {
      notificationWrites.push(createNotification({
        organisationId: round.organisationId,
        recipientUserId: round.ownerUserId,
        type: 'INTERVIEW',
        title,
        message,
        entityType: 'InterviewRound',
        entityId: round.id,
        metadata: notificationMetadata,
      }));
    }
  }

  await Promise.all(notificationWrites);
}

async function _createReminderNotificationsIfDue(round) {
  if (!round.scheduledStartAt) return;

  const hoursUntilInterview = dayjs(round.scheduledStartAt).diff(dayjs(), 'hour', true);
  const metadata = {
    applicationId: round.interviewProcess.application.submittedApplication?.id || round.interviewProcess.application.id,
    roundId: round.id,
    reminder: true,
  };

  const createReminder = (title, message) => createRoundNotifications(round, title, message, metadata);

  if (hoursUntilInterview <= 24 && hoursUntilInterview > 1) {
    await createReminder('Interview reminder', `${round.roundName} starts within 24 hours on ${formatSchedule(round.scheduledStartAt)}.`);
  }

  if (hoursUntilInterview <= 1 && hoursUntilInterview >= 0) {
    await createReminder('Interview reminder', `${round.roundName} starts within the next hour on ${formatSchedule(round.scheduledStartAt)}.`);
  }
}

function buildCalendarDescription(round) {
  const lines = [
    round.candidateInstructions ? `Instructions: ${round.candidateInstructions}` : null,
    round.instructions ? `Round Notes: ${round.instructions}` : null,
    round.meetingLink ? `Meeting Link: ${round.meetingLink}` : null,
    round.officeAddress ? `Office Address: ${round.officeAddress}` : null,
  ].filter(Boolean);

  return lines.join('\\n');
}

function buildIcsTimestamp(value) {
  return new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export async function createInterviewPlan(actorUser, payload, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationRole(actorUser, writableRoles, organisationId);
  await getApplicationOr404(context.organisationId, payload.applicationId);

  const process = await prisma.interviewProcess.create({
    data: {
      organisationId: context.organisationId,
      applicationId: payload.applicationId,
      title: payload.title,
      status: payload.status || 'PLANNED',
      createdById: actorUser.id,
      rounds: payload.rounds?.length
        ? {
            create: payload.rounds.map((round) => ({
              organisationId: context.organisationId,
              ...buildRoundData(round),
              panelMembers: normalizePanelMembers(round.panelMembers || [], round.panelUserIds || []).length
                ? {
                    create: normalizePanelMembers(round.panelMembers || [], round.panelUserIds || []).map((member) => ({
                      organisationId: context.organisationId,
                      userId: member.userId,
                      isLead: member.isLead,
                      isObserver: member.isObserver,
                      feedbackRequired: member.feedbackRequired,
                    })),
                  }
                : undefined,
            })),
          }
        : undefined,
    },
    include: {
      createdBy: true,
      rounds: {
        include: {
          owner: true,
          panelMembers: { include: { user: true } },
          feedbacks: { include: { interviewer: true } },
        },
        orderBy: { sequence: 'asc' },
      },
    },
  });

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'interview.plan.create',
    entityType: 'InterviewProcess',
    entityId: process.id,
    afterData: process,
    ...requestMeta,
  });

  return serializeInterviewProcess(process);
}

export async function addInterviewRound(actorUser, interviewProcessId, payload, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationRole(actorUser, writableRoles, organisationId);
  const process = await getInterviewProcessOr404(context.organisationId, interviewProcessId);
  const panelMembers = normalizePanelMembers(payload.panelMembers || [], payload.panelUserIds || []);
  await validatePanelMembers(context.organisationId, panelMembers);

  const round = await prisma.interviewRound.create({
    data: {
      organisationId: context.organisationId,
      interviewProcessId,
      ...buildRoundData(payload),
      panelMembers: panelMembers.length
        ? {
            create: panelMembers.map((member) => ({
              organisationId: context.organisationId,
              userId: member.userId,
              isLead: member.isLead,
              isObserver: member.isObserver,
              feedbackRequired: member.feedbackRequired,
            })),
          }
        : undefined,
    },
    include: {
      owner: true,
      panelMembers: { include: { user: true } },
      feedbacks: { include: { interviewer: true } },
      interviewProcess: {
        include: {
          application: {
            include: {
              candidate: { include: { user: true } },
              job: true,
              submittedApplication: true,
            },
          },
        },
      },
    },
  });

  await createApplicationActivity(context.organisationId, process.applicationId, actorUser.id, 'INTERVIEW_ROUND_CREATED', `Interview round ${round.roundName} created.`, {
    roundId: round.id,
    sequence: round.sequence,
  });

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'interview.round.create',
    entityType: 'InterviewRound',
    entityId: round.id,
    afterData: round,
    ...requestMeta,
  });

  return serializeInterviewRound(round);
}

export async function updateInterviewRound(actorUser, roundId, payload, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationRole(actorUser, writableRoles, organisationId);
  const existing = await getInterviewRoundOr404(context.organisationId, roundId);
  const panelMembers = payload.panelMembers || payload.panelUserIds
    ? normalizePanelMembers(payload.panelMembers || [], payload.panelUserIds || [])
    : null;

  if (panelMembers) {
    await validatePanelMembers(context.organisationId, panelMembers);
  }

  const updated = await prisma.interviewRound.update({
    where: { id: roundId },
    data: {
      ...(payload.roundName !== undefined ? { roundName: payload.roundName } : {}),
      ...(payload.sequence !== undefined ? { sequence: payload.sequence } : {}),
      ...(payload.interviewType !== undefined ? { interviewType: payload.interviewType } : {}),
      ...(payload.status !== undefined ? { status: payload.status } : {}),
      ...(payload.durationMinutes !== undefined ? { durationMinutes: payload.durationMinutes ?? null } : {}),
      ...(payload.ownerUserId !== undefined ? { ownerUserId: payload.ownerUserId || null } : {}),
      ...(payload.timezone !== undefined ? { timezone: payload.timezone || null } : {}),
      ...(payload.meetingMode !== undefined ? { meetingMode: payload.meetingMode || null } : {}),
      ...(payload.scheduledStartAt !== undefined ? { scheduledStartAt: payload.scheduledStartAt ? new Date(payload.scheduledStartAt) : null } : {}),
      ...(payload.scheduledEndAt !== undefined ? { scheduledEndAt: payload.scheduledEndAt ? new Date(payload.scheduledEndAt) : null } : {}),
      ...(payload.meetingLocation !== undefined ? { meetingLocation: payload.meetingLocation || null } : {}),
      ...(payload.meetingLink !== undefined ? { meetingLink: payload.meetingLink || null } : {}),
      ...(payload.officeAddress !== undefined ? { officeAddress: payload.officeAddress || null } : {}),
      ...(payload.candidateInstructions !== undefined ? { candidateInstructions: payload.candidateInstructions || null } : {}),
      ...(payload.instructions !== undefined ? { instructions: payload.instructions || null } : {}),
      ...(payload.internalNotes !== undefined ? { internalNotes: payload.internalNotes || null } : {}),
      ...(payload.scorecardCriteria !== undefined ? { scorecardCriteria: payload.scorecardCriteria || null } : {}),
      ...(panelMembers
        ? {
            panelMembers: {
              deleteMany: {},
              create: panelMembers.map((member) => ({
                organisationId: context.organisationId,
                userId: member.userId,
                isLead: member.isLead,
                isObserver: member.isObserver,
                feedbackRequired: member.feedbackRequired,
              })),
            },
          }
        : {}),
    },
    include: roundInclude,
  });

  await createApplicationActivity(context.organisationId, updated.interviewProcess.applicationId, actorUser.id, 'INTERVIEW_ROUND_UPDATED', `Interview round ${updated.roundName} updated.`, {
    roundId: updated.id,
  });

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'interview.round.update',
    entityType: 'InterviewRound',
    entityId: updated.id,
    beforeData: existing,
    afterData: updated,
    ...requestMeta,
  });

  return serializeInterviewRound(updated);
}

export async function duplicateInterviewRound(actorUser, roundId, payload = {}, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationRole(actorUser, writableRoles, organisationId);
  const existing = await getInterviewRoundOr404(context.organisationId, roundId);
  const processId = existing.interviewProcessId;
  const allRounds = await prisma.interviewRound.findMany({
    where: { interviewProcessId: processId },
    orderBy: { sequence: 'asc' },
  });

  const nextSequence = payload.sequence ?? Math.max(...allRounds.map((item) => item.sequence), 0) + 1;
  const duplicated = await prisma.interviewRound.create({
    data: {
      organisationId: context.organisationId,
      interviewProcessId: processId,
      roundName: payload.roundName || `${existing.roundName} Repeat`,
      sequence: nextSequence,
      interviewType: existing.interviewType,
      status: 'PLANNED',
      durationMinutes: existing.durationMinutes,
      ownerUserId: existing.ownerUserId,
      timezone: existing.timezone,
      meetingMode: existing.meetingMode,
      meetingLocation: existing.meetingLocation,
      meetingLink: null,
      officeAddress: existing.officeAddress,
      candidateInstructions: existing.candidateInstructions,
      instructions: existing.instructions,
      internalNotes: existing.internalNotes,
      scorecardCriteria: existing.scorecardCriteria,
      calendarProvider: existing.calendarProvider || 'ICS',
      panelMembers: {
        create: (existing.panelMembers || []).map((member) => ({
          organisationId: context.organisationId,
          userId: member.userId,
          isLead: member.isLead,
          isObserver: member.isObserver,
          feedbackRequired: member.feedbackRequired,
        })),
      },
    },
    include: roundInclude,
  });

  await createApplicationActivity(context.organisationId, duplicated.interviewProcess.applicationId, actorUser.id, 'INTERVIEW_ROUND_DUPLICATED', `Interview round ${duplicated.roundName} created from ${existing.roundName}.`, {
    roundId: duplicated.id,
    sourceRoundId: existing.id,
  });

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'interview.round.duplicate',
    entityType: 'InterviewRound',
    entityId: duplicated.id,
    beforeData: { sourceRoundId: existing.id },
    afterData: duplicated,
    ...requestMeta,
  });

  return serializeInterviewRound(duplicated);
}

export async function listInterviewPlans(actorUser, applicationId, organisationId = null) {
  const context = await requireOrganisationRole(actorUser, readableRoles, organisationId);
  await getApplicationOr404(context.organisationId, applicationId);

  const plans = await prisma.interviewProcess.findMany({
    where: {
      organisationId: context.organisationId,
      applicationId,
    },
    include: {
      createdBy: true,
      rounds: {
        include: {
          owner: true,
          panelMembers: { include: { user: true } },
          feedbacks: { include: { interviewer: true } },
        },
        orderBy: { sequence: 'asc' },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return plans.map(serializeInterviewProcess);
}

export async function submitInterviewFeedback(actorUser, roundId, payload, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationContext(actorUser, organisationId);
  const round = await getInterviewRoundOr404(context.organisationId, roundId);
  const actorRole = context.activeMembership.role;
  const panelMember = round.panelMembers.some((member) => member.userId === actorUser.id);
  const isPrivileged = writableRoles.includes(actorRole);

  if (!panelMember && !isPrivileged) {
    const error = new Error('You are not allowed to submit feedback for this interview round.');
    error.statusCode = 403;
    throw error;
  }

  if (round.feedbackLockedAt) {
    const error = new Error('Feedback is locked for this interview round.');
    error.statusCode = 403;
    throw error;
  }

  const existing = await prisma.interviewFeedback.findUnique({
    where: {
      interviewRoundId_interviewerId: {
        interviewRoundId: roundId,
        interviewerId: actorUser.id,
      },
    },
  });

  if (existing?.finalizedAt) {
    const error = new Error('Submitted feedback is locked and cannot be modified.');
    error.statusCode = 403;
    throw error;
  }

  const feedback = await prisma.interviewFeedback.upsert({
    where: {
      interviewRoundId_interviewerId: {
        interviewRoundId: roundId,
        interviewerId: actorUser.id,
      },
    },
    update: {
      recommendation: payload.recommendation || null,
      overallScore: payload.overallScore ?? null,
      technicalRating: payload.technicalRating ?? null,
      communicationRating: payload.communicationRating ?? null,
      problemSolvingRating: payload.problemSolvingRating ?? null,
      cultureFitRating: payload.cultureFitRating ?? null,
      strengths: payload.strengths || null,
      weaknesses: payload.weaknesses || null,
      detailedNotes: payload.detailedNotes || null,
      comments: payload.comments || null,
      criteriaScores: payload.criteriaScores || null,
      submittedAt: new Date(),
      finalizedAt: payload.finalize ? new Date() : null,
    },
    create: {
      organisationId: context.organisationId,
      interviewRoundId: roundId,
      interviewerId: actorUser.id,
      recommendation: payload.recommendation || null,
      overallScore: payload.overallScore ?? null,
      technicalRating: payload.technicalRating ?? null,
      communicationRating: payload.communicationRating ?? null,
      problemSolvingRating: payload.problemSolvingRating ?? null,
      cultureFitRating: payload.cultureFitRating ?? null,
      strengths: payload.strengths || null,
      weaknesses: payload.weaknesses || null,
      detailedNotes: payload.detailedNotes || null,
      comments: payload.comments || null,
      criteriaScores: payload.criteriaScores || null,
      submittedAt: new Date(),
      finalizedAt: payload.finalize ? new Date() : null,
    },
    include: {
      interviewer: true,
    },
  });

  const refreshedRound = await getInterviewRoundOr404(context.organisationId, roundId);
  const requiredPanelUserIds = refreshedRound.panelMembers
    .filter((member) => !member.isObserver && member.feedbackRequired)
    .map((member) => member.userId);
  const finalizedFeedbackUserIds = (refreshedRound.feedbacks || [])
    .filter((item) => item.finalizedAt)
    .map((item) => item.interviewerId);

  if (requiredPanelUserIds.length && requiredPanelUserIds.every((userId) => finalizedFeedbackUserIds.includes(userId))) {
    await prisma.interviewRound.update({
      where: { id: roundId },
      data: { feedbackLockedAt: new Date() },
    });
  }

  const linkedApplicationId = refreshedRound.interviewProcess?.applicationId || round.interviewProcess?.applicationId || null;
  const linkedApplication = refreshedRound.interviewProcess?.application || round.interviewProcess?.application || null;

  if (linkedApplicationId) {
    await createApplicationActivity(
      context.organisationId,
      linkedApplicationId,
      actorUser.id,
      payload.finalize ? 'INTERVIEW_FEEDBACK_SUBMITTED' : 'INTERVIEW_FEEDBACK_DRAFTED',
      `${actorUser.email} ${payload.finalize ? 'submitted' : 'saved'} feedback for ${refreshedRound.roundName}.`,
      {
        roundId,
        interviewerId: actorUser.id,
        finalized: Boolean(payload.finalize),
      },
    );
  }

  if (linkedApplication?.job?.recruiterId) {
    await createNotification({
      organisationId: context.organisationId,
      recipientUserId: linkedApplication.job.recruiterId,
      type: 'FEEDBACK',
      title: payload.finalize ? 'Interview feedback submitted' : 'Interview feedback drafted',
      message: `${actorUser.email} ${payload.finalize ? 'submitted' : 'saved'} feedback for ${refreshedRound.roundName}.`,
      entityType: 'InterviewFeedback',
      entityId: feedback.id,
      metadata: {
        roundId,
        applicationId: linkedApplication.submittedApplication?.id || linkedApplication.id,
      },
    });
  }

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: payload.finalize ? 'interview.feedback.finalize' : 'interview.feedback.save',
    entityType: 'InterviewFeedback',
    entityId: feedback.id,
    beforeData: existing,
    afterData: feedback,
    ...requestMeta,
  });

  return serializeInterviewFeedback(feedback);
}

export async function listInterviewFeedback(actorUser, roundId, organisationId = null) {
  const context = await requireOrganisationContext(actorUser, organisationId);
  const round = await getInterviewRoundOr404(context.organisationId, roundId);
  const actorRole = context.activeMembership.role;
  const isPanelMember = round.panelMembers.some((member) => member.userId === actorUser.id);
  const isPrivileged = readableRoles.includes(actorRole);

  if (!isPanelMember && !isPrivileged) {
    const error = new Error('You are not allowed to view this interview round.');
    error.statusCode = 403;
    throw error;
  }

  return round.feedbacks.map(serializeInterviewFeedback);
}

export async function decideInterviewRound(actorUser, roundId, payload, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationRole(actorUser, writableRoles, organisationId);
  const round = await getInterviewRoundOr404(context.organisationId, roundId);
  const application = round.interviewProcess.application;
  const nextRound = await prisma.interviewRound.findFirst({
    where: {
      interviewProcessId: round.interviewProcessId,
      sequence: { gt: round.sequence },
    },
    orderBy: { sequence: 'asc' },
  });

  const roundUpdate = {
    decision: payload.decision,
    decisionReason: payload.reason || null,
  };
  const applicationUpdate = {};

  if (payload.decision === 'MOVE_NEXT_ROUND') {
    if (!nextRound) {
      const error = new Error('No next interview round is configured for this process.');
      error.statusCode = 422;
      throw error;
    }
    roundUpdate.status = 'COMPLETED';
    roundUpdate.completedAt = new Date();
    roundUpdate.feedbackLockedAt = round.feedbackLockedAt || new Date();
  } else if (payload.decision === 'REJECT') {
    roundUpdate.status = 'COMPLETED';
    roundUpdate.completedAt = new Date();
    applicationUpdate.currentStage = 'REJECTED';
    applicationUpdate.statusLabel = 'Rejected';
  } else if (payload.decision === 'HOLD') {
    roundUpdate.status = 'COMPLETED';
    roundUpdate.completedAt = new Date();
    applicationUpdate.currentStage = 'INTERVIEW_SCHEDULED';
    applicationUpdate.statusLabel = 'Interview Hold';
  } else if (payload.decision === 'CANCEL') {
    roundUpdate.status = 'CANCELLED';
    roundUpdate.cancelReason = payload.reason || round.cancelReason || 'Interview round cancelled.';
  } else if (payload.decision === 'COMPLETE') {
    roundUpdate.status = 'COMPLETED';
    roundUpdate.completedAt = new Date();
    roundUpdate.feedbackLockedAt = round.feedbackLockedAt || new Date();
  } else if (payload.decision === 'READY_FOR_OFFER') {
    roundUpdate.status = 'COMPLETED';
    roundUpdate.completedAt = new Date();
    roundUpdate.feedbackLockedAt = round.feedbackLockedAt || new Date();
    applicationUpdate.currentStage = 'SELECTED';
    applicationUpdate.statusLabel = 'Ready for offer';
  }

  const updatedRound = await prisma.interviewRound.update({
    where: { id: roundId },
    data: roundUpdate,
    include: roundInclude,
  });

  if (Object.keys(applicationUpdate).length) {
    await prisma.application.update({
      where: { id: application.id },
      data: applicationUpdate,
    });
  }

  const eventType = `INTERVIEW_DECISION_${payload.decision}`;
  const message = payload.decision === 'MOVE_NEXT_ROUND'
    ? `${updatedRound.roundName} completed. Candidate moves to ${nextRound.roundName}.`
    : payload.decision === 'READY_FOR_OFFER'
      ? `${updatedRound.roundName} completed and candidate marked ready for offer.`
      : `${updatedRound.roundName} decision updated to ${payload.decision.replaceAll('_', ' ')}.`;

  await createApplicationActivity(context.organisationId, application.id, actorUser.id, eventType, message, {
    roundId,
    decision: payload.decision,
    reason: payload.reason || null,
  });

  await createCandidateTimeline(
    application.submittedApplication?.id,
    context.organisationId,
    actorUser.id,
    eventType,
    payload.decision === 'REJECT'
      ? `Interview outcome update: your process for ${application.job.title} has been closed.`
      : payload.decision === 'MOVE_NEXT_ROUND'
        ? `Interview update: you are moving to the next round for ${application.job.title}.`
        : payload.decision === 'READY_FOR_OFFER'
          ? `Interview update: you have cleared the interview process for ${application.job.title}.`
          : `Interview update recorded for ${updatedRound.roundName}.`,
    { roundId, decision: payload.decision },
  );

  await createRoundNotifications(updatedRound, 'Interview decision updated', message, {
    decision: payload.decision,
  });

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'interview.round.decision',
    entityType: 'InterviewRound',
    entityId: roundId,
    beforeData: { decision: round.decision, status: round.status },
    afterData: { decision: payload.decision, status: updatedRound.status, reason: payload.reason || null },
    ...requestMeta,
  });

  return serializeInterviewRound(updatedRound);
}

export async function getInterviewRoundCalendar(actorUser, roundId, organisationId = null) {
  const context = await requireOrganisationRole(actorUser, readableRoles, organisationId);
  const round = await getInterviewRoundOr404(context.organisationId, roundId);

  if (!round.scheduledStartAt || !round.scheduledEndAt) {
    const error = new Error('This interview round is not scheduled yet.');
    error.statusCode = 422;
    throw error;
  }

  const application = round.interviewProcess.application;
  const summary = `${application.job.title} - ${round.roundName}`;
  const description = buildCalendarDescription(round);
  const location = round.meetingMode === 'VIRTUAL'
    ? (round.meetingLink || 'Virtual meeting')
    : (round.officeAddress || round.meetingLocation || 'Office');

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Careeriz//Interview Calendar//EN',
    'BEGIN:VEVENT',
    `UID:${round.id}@careeriz`,
    `DTSTAMP:${buildIcsTimestamp(new Date())}`,
    `DTSTART:${buildIcsTimestamp(round.scheduledStartAt)}`,
    `DTEND:${buildIcsTimestamp(round.scheduledEndAt)}`,
    `SUMMARY:${summary.replace(/\n/g, ' ')}`,
    `DESCRIPTION:${description.replace(/\n/g, '\\n')}`,
    `LOCATION:${location.replace(/\n/g, ' ')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  return {
    filename: `${application.job.title}-${round.roundName}.ics`.replace(/[^A-Za-z0-9._-]+/g, '-'),
    content: ics,
  };
}
