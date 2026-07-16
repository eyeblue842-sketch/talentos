import { prisma } from '../config/db.js';
import {
  serializeInterviewFeedback,
  serializeInterviewProcess,
  serializeInterviewRound,
} from '../serializers/index.js';
import { requireOrganisationContext, requireOrganisationRole } from './organisationAccessService.js';
import { recordAuditLog } from './auditLogService.js';

async function getApplicationOr404(organisationId, applicationId) {
  const application = await prisma.application.findFirst({
    where: { id: applicationId, organisationId },
  });

  if (!application) {
    const error = new Error('Application not found.');
    error.statusCode = 404;
    throw error;
  }

  return application;
}

async function getInterviewRoundOr404(organisationId, roundId) {
  const round = await prisma.interviewRound.findFirst({
    where: { id: roundId, organisationId },
    include: {
      panelMembers: { include: { user: true } },
      feedbacks: { include: { interviewer: true } },
    },
  });

  if (!round) {
    const error = new Error('Interview round not found.');
    error.statusCode = 404;
    throw error;
  }

  return round;
}

export async function createInterviewPlan(actorUser, payload, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationRole(actorUser, ['OWNER', 'ADMIN', 'RECRUITER', 'HIRING_MANAGER'], organisationId);
  await getApplicationOr404(context.organisationId, payload.applicationId);

  const process = await prisma.interviewProcess.create({
    data: {
      organisationId: context.organisationId,
      applicationId: payload.applicationId,
      title: payload.title,
      status: payload.status || 'PLANNED',
      createdById: actorUser.id,
    },
    include: {
      createdBy: true,
      rounds: {
        include: {
          panelMembers: { include: { user: true } },
          feedbacks: { include: { interviewer: true } },
        },
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
  const context = await requireOrganisationRole(actorUser, ['OWNER', 'ADMIN', 'RECRUITER', 'HIRING_MANAGER'], organisationId);
  const process = await prisma.interviewProcess.findFirst({
    where: { id: interviewProcessId, organisationId: context.organisationId },
  });

  if (!process) {
    const error = new Error('Interview process not found.');
    error.statusCode = 404;
    throw error;
  }

  const round = await prisma.interviewRound.create({
    data: {
      organisationId: context.organisationId,
      interviewProcessId,
      roundName: payload.roundName,
      sequence: payload.sequence,
      interviewType: payload.interviewType,
      status: payload.status || 'PLANNED',
      scheduledStartAt: payload.scheduledStartAt ? new Date(payload.scheduledStartAt) : null,
      scheduledEndAt: payload.scheduledEndAt ? new Date(payload.scheduledEndAt) : null,
      scorecardCriteria: payload.scorecardCriteria || null,
      panelMembers: payload.panelUserIds?.length
        ? {
            create: payload.panelUserIds.map((userId) => ({
              organisationId: context.organisationId,
              userId,
            })),
          }
        : undefined,
    },
    include: {
      panelMembers: { include: { user: true } },
      feedbacks: { include: { interviewer: true } },
    },
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

export async function listInterviewPlans(actorUser, applicationId, organisationId = null) {
  const context = await requireOrganisationContext(actorUser, organisationId);
  const plans = await prisma.interviewProcess.findMany({
    where: {
      organisationId: context.organisationId,
      applicationId,
    },
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
    orderBy: { createdAt: 'asc' },
  });

  return plans.map(serializeInterviewProcess);
}

export async function submitInterviewFeedback(actorUser, roundId, payload, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationContext(actorUser, organisationId);
  const round = await getInterviewRoundOr404(context.organisationId, roundId);
  const actorRole = context.activeMembership.role;
  const isPanelMember = round.panelMembers.some((member) => member.userId === actorUser.id);
  const isPrivileged = ['OWNER', 'ADMIN', 'RECRUITER', 'HIRING_MANAGER'].includes(actorRole);

  if (!isPanelMember && !isPrivileged) {
    const error = new Error('You are not allowed to submit feedback for this interview round.');
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
    const error = new Error('Finalized feedback cannot be modified.');
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
      comments: payload.comments || null,
      criteriaScores: payload.criteriaScores || null,
      submittedAt: new Date(),
      finalizedAt: payload.finalize ? new Date() : null,
    },
    include: {
      interviewer: true,
    },
  });

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: payload.finalize ? 'interview.feedback.finalize' : 'interview.feedback.submit',
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
  const isPrivileged = ['OWNER', 'ADMIN', 'RECRUITER', 'HIRING_MANAGER'].includes(actorRole);

  if (!isPanelMember && !isPrivileged) {
    const error = new Error('You are not allowed to view this interview round.');
    error.statusCode = 403;
    throw error;
  }

  return round.feedbacks.map(serializeInterviewFeedback);
}
