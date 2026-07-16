import dayjs from 'dayjs';
import { prisma } from '../config/db.js';
import { buildKeywordMatch } from './matchService.js';
import { sendPipelineEmail } from './emailService.js';
import { serializeApplication, serializeAtsNote } from '../serializers/index.js';
import { requireOrganisationContext, requireOrganisationRole } from './organisationAccessService.js';
import { recordAuditLog } from './auditLogService.js';

const stageLabelMap = {
  APPLIED: 'Applied',
  SHORTLISTED: 'Shortlisted',
  INTERVIEW_SCHEDULED: 'Interview',
  SELECTED: 'Selected',
  REJECTED: 'Rejected',
};

async function getApplicationWithRelations(organisationId, applicationId) {
  return prisma.application.findFirst({
    where: { id: applicationId, organisationId },
    include: {
      candidate: { include: { user: true } },
      job: { include: { requisition: true } },
      notes: {
        include: {
          author: {
            include: { recruiterProfile: { include: { organisation: true } }, candidateProfile: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
      activities: { orderBy: { createdAt: 'desc' } },
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
  const context = await requireOrganisationRole(actorUser, ['OWNER', 'ADMIN', 'RECRUITER', 'HIRING_MANAGER', 'INTERVIEWER', 'VIEWER'], organisationId);
  const application = await getApplicationWithRelations(context.organisationId, applicationId);
  if (!application) {
    const error = new Error('Application not found.');
    error.statusCode = 404;
    throw error;
  }

  return { context, application };
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
          message: 'Application submitted.',
        },
      },
    },
    include: {
      job: { include: { requisition: true } },
      candidate: true,
      activities: true,
      notes: true,
    },
  });

  return serializeApplication(application, { includeCoverLetter: true, includeCandidatePrivate: true });
}

export async function getRecruiterPipeline(actorUser, organisationId = null) {
  const context = await requireOrganisationContext(actorUser, organisationId);
  const applications = await prisma.application.findMany({
    where: { organisationId: context.organisationId },
    include: {
      candidate: true,
      job: { include: { requisition: true } },
      notes: {
        include: {
          author: { include: { recruiterProfile: { include: { organisation: true } }, candidateProfile: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
      activities: { orderBy: { createdAt: 'desc' } },
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

  return applications.map((application) => serializeApplication(application, { includeCoverLetter: true, includeCandidatePrivate: true }));
}

export async function updatePipelineStage(applicationId, actorUser, stage, organisationId = null, requestMeta = {}) {
  const { context, application } = await assertOrganisationCanAccessApplication(actorUser, applicationId, organisationId);

  const updated = await prisma.application.update({
    where: { id: applicationId },
    data: {
      currentStage: stage,
      statusLabel: stageLabelMap[stage],
      activities: {
        create: {
          organisationId: context.organisationId,
          message: `Moved to ${stageLabelMap[stage]}.`,
        },
      },
    },
    include: {
      candidate: { include: { user: true } },
      job: { include: { requisition: true } },
      activities: true,
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
  const { context } = await assertOrganisationCanAccessApplication(actorUser, applicationId, organisationId);
  const date = dayjs(payload.interviewScheduledAt).toDate();
  const updated = await prisma.application.update({
    where: { id: applicationId },
    data: {
      currentStage: 'INTERVIEW_SCHEDULED',
      statusLabel: 'Interview',
      interviewScheduledAt: date,
      interviewerName: payload.interviewerName,
      activities: {
        create: {
          organisationId: context.organisationId,
          message: `Interview scheduled with ${payload.interviewerName} on ${dayjs(date).format('DD MMM YYYY, hh:mm A')}.`,
        },
      },
    },
    include: {
      candidate: { include: { user: true } },
      job: { include: { requisition: true } },
      activities: true,
      notes: true,
      interviewProcesses: true,
    },
  });

  await Promise.all([
    sendPipelineEmail(updated.candidate.user.email, 'INTERVIEW_SCHEDULED', updated.job.title, {
      interviewScheduledAt: date,
      interviewerName: payload.interviewerName,
    }),
    recordAuditLog({
      organisationId: context.organisationId,
      actorUserId: actorUser.id,
      action: 'application.interview.schedule',
      entityType: 'Application',
      entityId: applicationId,
      afterData: {
        interviewScheduledAt: updated.interviewScheduledAt,
        interviewerName: updated.interviewerName,
      },
      ...requestMeta,
    }),
  ]);

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

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'application.note.create',
    entityType: 'AtsNote',
    entityId: note.id,
    afterData: note,
    ...requestMeta,
  });

  return serializeAtsNote(note);
}

export async function getCandidateApplications(candidateId) {
  const applications = await prisma.application.findMany({
    where: { candidateId },
    include: {
      job: { include: { recruiter: { include: { recruiterProfile: { include: { organisation: true } } } }, requisition: true } },
      candidate: true,
      activities: { orderBy: { createdAt: 'desc' } },
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
