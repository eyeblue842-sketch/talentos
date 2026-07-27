import { prisma } from '../config/db.js';
import { recordAuditLog } from './auditLogService.js';
import { createNotification } from './notificationService.js';
import { sendOfferStatusEmail, sendQueuedEmailPayload } from './emailService.js';
import { requestCandidateDataExport } from './candidateService.js';
import { getResumeIntelligence } from '../intelligence/services/resumeIntelligenceService.js';
import { runCandidateIntelligenceGenerationTask } from '../intelligence/services/candidateIntelligenceService.js';
import { getCandidateMatchIntelligence, getBatchCandidateMatchIntelligence } from '../intelligence/services/candidateMatchService.js';
import { getJobIntelligence } from '../intelligence/services/jobIntelligenceService.js';
import { getInterviewIntelligence } from '../intelligence/services/interviewIntelligenceService.js';
import { getAnalyticsInsight } from '../intelligence/services/analyticsInsightService.js';
import { parseTalentSearchQuery } from '../intelligence/services/talentSearchService.js';
import { processResumeImportItem } from './resumeImportService.js';

function normalizeResumeFilename(filename) {
  return String(filename || '')
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferResumeSkills(filename) {
  const normalized = normalizeResumeFilename(filename).toLowerCase();
  const knownSkills = ['react', 'nextjs', 'next js', 'node', 'nodejs', 'javascript', 'typescript', 'java', 'spring', 'aws', 'python', 'sql', 'docker', 'kubernetes'];
  return knownSkills
    .filter((skill) => normalized.includes(skill))
    .map((skill) => skill.replace('nextjs', 'Next.js').replace('nodejs', 'Node.js'))
    .slice(0, 8);
}

function inferResumeTitle(filename) {
  const normalized = normalizeResumeFilename(filename).toLowerCase();
  const titleMap = [
    ['frontend', 'Frontend Developer'],
    ['backend', 'Backend Developer'],
    ['full stack', 'Full Stack Developer'],
    ['java', 'Java Developer'],
    ['python', 'Python Developer'],
    ['react', 'React Developer'],
    ['data analyst', 'Data Analyst'],
    ['product manager', 'Product Manager'],
  ];
  const match = titleMap.find(([token]) => normalized.includes(token));
  return match?.[1] || null;
}

function buildDeterministicResumeParse(filename, candidateProfile) {
  const inferredSkills = inferResumeSkills(filename);
  const inferredTitle = inferResumeTitle(filename);
  const suggestedUpdates = {
    currentTitle: !candidateProfile?.currentTitle && inferredTitle ? inferredTitle : null,
    skills: inferredSkills.length ? inferredSkills : null,
  };

  const availableFields = Object.entries(suggestedUpdates)
    .filter(([, value]) => value && (!Array.isArray(value) || value.length))
    .map(([field]) => field);

  return {
    parsingStatus: availableFields.length ? 'PARTIAL' : 'FAILED',
    parsedData: {
      parser: 'careeriz-worker-deterministic',
      extractedTextAvailable: false,
      summary: availableFields.length
        ? 'Careeriz generated limited metadata-based suggestions during background resume parsing.'
        : 'No structured parse suggestions were available for this resume.',
      suggestedUpdates,
      availableFields,
      processedAt: new Date().toISOString(),
    },
  };
}

async function handleResumeParsingTask(task) {
  const asset = await prisma.resumeAsset.findUnique({
    where: { id: task.payload?.assetId || task.entityId || '' },
    include: { candidate: true },
  });
  if (!asset || asset.status === 'DELETED') return 'cancelled';

  await prisma.resumeAsset.update({
    where: { id: asset.id },
    data: { parsingStatus: 'PROCESSING' },
  });

  const parsed = buildDeterministicResumeParse(asset.originalFilename, asset.candidate);
  await prisma.resumeAsset.update({
    where: { id: asset.id },
    data: {
      parsingStatus: parsed.parsingStatus,
      parsedData: parsed.parsedData,
    },
  });
  return 'success';
}

async function handleResumeImportProcessingTask(task) {
  const itemId = task.payload?.itemId || task.entityId || '';
  if (!itemId) return 'cancelled';
  await processResumeImportItem(itemId, task.updatedByUserId || null);
  return 'success';
}

async function handleInterviewReminderTask(task) {
  const reminder = await prisma.meetingReminder.findUnique({
    where: { id: task.payload?.reminderId || task.entityId || '' },
    include: {
      participant: true,
      meeting: {
        include: {
          participants: true,
          interviewRound: {
            include: {
              interviewProcess: {
                include: {
                  application: {
                    include: {
                      candidate: { include: { user: true } },
                      submittedApplication: true,
                      job: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!reminder || reminder.status !== 'SCHEDULED' || !reminder.meeting || reminder.meeting.status !== 'SCHEDULED') return 'cancelled';

  const round = reminder.meeting.interviewRound;
  const application = round.interviewProcess.application;
  const participant = reminder.participant;

  if (participant.userId) {
    await createNotification({
      organisationId: reminder.organisationId,
      recipientUserId: participant.userId,
      type: 'INTERVIEW',
      title: 'Interview reminder',
      message: `${round.roundName} for ${application.job?.title || 'this role'} starts soon.`,
      entityType: 'InterviewRound',
      entityId: round.id,
      metadata: {
        roundId: round.id,
        meetingId: reminder.meeting.id,
        reminderType: reminder.reminderType,
      },
    });
  }

  await prisma.meetingReminder.update({
    where: { id: reminder.id },
    data: {
      status: 'SENT',
      sentAt: new Date(),
    },
  });

  return 'success';
}

async function handleOfferReminderTask(task) {
  const offer = await prisma.offer.findUnique({
    where: { id: task.payload?.offerId || task.entityId || '' },
    include: {
      candidate: { include: { user: true } },
      job: true,
    },
  });
  if (!offer || !['RELEASED', 'VIEWED'].includes(offer.status)) return 'cancelled';

  if (offer.candidate?.userId) {
    await createNotification({
      organisationId: offer.organisationId,
      recipientUserId: offer.candidate.userId,
      type: 'OFFER',
      title: 'Offer reminder',
      message: `Your offer for ${offer.job?.title || 'this role'} is expiring soon.`,
      entityType: 'Offer',
      entityId: offer.id,
      metadata: {
        reminderWindow: task.payload?.reminderWindow || 'scheduled',
      },
    });
  }
  if (offer.candidate?.user?.email) {
    await sendOfferStatusEmail(
      offer.candidate.user.email,
      'Your Careeriz offer is expiring soon',
      `Your offer for ${offer.job?.title || 'this role'} is expiring soon. Please review it before the expiry time.`,
      { queueOnFailure: false },
    );
  }
  return 'success';
}

async function handleOfferExpiryTask(task) {
  const offer = await prisma.offer.findUnique({
    where: { id: task.payload?.offerId || task.entityId || '' },
    include: {
      candidate: { include: { user: true } },
      job: true,
    },
  });
  if (!offer || !['RELEASED', 'VIEWED'].includes(offer.status)) return 'cancelled';
  if (!offer.expiryAt || new Date(offer.expiryAt) > new Date()) return 'cancelled';

  await prisma.$transaction(async (tx) => {
    await tx.offer.update({
      where: { id: offer.id },
      data: {
        status: 'EXPIRED',
        updatedAt: new Date(),
      },
    });
    await tx.offerAccessToken.updateMany({
      where: {
        offerId: offer.id,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
    await tx.application.updateMany({
      where: { id: offer.applicationId },
      data: {
        currentStage: 'REJECTED',
        statusLabel: 'Offer Expired',
      },
    });
  });

  if (offer.candidate?.userId) {
    await createNotification({
      organisationId: offer.organisationId,
      recipientUserId: offer.candidate.userId,
      type: 'OFFER',
      title: 'Offer expired',
      message: `Your offer for ${offer.job?.title || 'this role'} has expired.`,
      entityType: 'Offer',
      entityId: offer.id,
    });
  }

  await recordAuditLog({
    organisationId: offer.organisationId,
    actorUserId: null,
    action: 'worker.offer.expire',
    entityType: 'Offer',
    entityId: offer.id,
    metadata: { taskId: task.id },
  });

  return 'success';
}

async function handleEmailRetryTask(task) {
  if (!task.payload?.message) return 'cancelled';
  await sendQueuedEmailPayload(task.payload.message);
  return 'success';
}

async function handleNotificationRetryTask(task) {
  if (!task.payload?.notification) return 'cancelled';
  await createNotification(task.payload.notification);
  return 'success';
}

async function handleIntelligenceExecutionTask(task) {
  const requestedByUserId = task.payload?.requestedByUserId;
  const operation = task.payload?.operation;
  const request = task.payload?.request;
  if (!requestedByUserId || !operation || !request) return 'cancelled';

  const actorUser = await prisma.user.findUnique({
    where: { id: requestedByUserId },
    include: {
      recruiterProfile: true,
      candidateProfile: true,
    },
  });
  if (!actorUser) return 'cancelled';

  switch (operation) {
    case 'resume':
      await getResumeIntelligence(actorUser, request);
      break;
    case 'match':
      await getCandidateMatchIntelligence(actorUser, request);
      break;
    case 'match-batch':
      await getBatchCandidateMatchIntelligence(actorUser, request);
      break;
    case 'job':
      await getJobIntelligence(actorUser, request);
      break;
    case 'interview':
      await getInterviewIntelligence(actorUser, request);
      break;
    case 'analytics':
      await getAnalyticsInsight(actorUser, request);
      break;
    case 'search-parse':
      await parseTalentSearchQuery(actorUser, request);
      break;
    default:
      return 'cancelled';
  }
  return 'success';
}

async function handleCandidateIntelligenceGenerationTask(task) {
  return runCandidateIntelligenceGenerationTask(task);
}

async function handleDataExportTask(task) {
  const candidateId = task.payload?.candidateId;
  const userId = task.payload?.userId;
  if (!candidateId || !userId) return 'cancelled';
  await requestCandidateDataExport(candidateId, userId);
  return 'success';
}

async function handleCleanupTask() {
  const expiryCutoff = new Date();
  await prisma.intelligenceResult.updateMany({
    where: {
      expiresAt: { lte: expiryCutoff },
      supersededAt: null,
    },
    data: {
      supersededAt: expiryCutoff,
    },
  });
  return 'success';
}

export async function processBackgroundTask(task) {
  switch (task.type) {
    case 'RESUME_PARSING':
      return handleResumeParsingTask(task);
    case 'RESUME_IMPORT_PROCESSING':
      return handleResumeImportProcessingTask(task);
    case 'INTERVIEW_REMINDER':
      return handleInterviewReminderTask(task);
    case 'OFFER_REMINDER':
      return handleOfferReminderTask(task);
    case 'OFFER_EXPIRY':
      return handleOfferExpiryTask(task);
    case 'EMAIL_RETRY':
      return handleEmailRetryTask(task);
    case 'NOTIFICATION_RETRY':
      return handleNotificationRetryTask(task);
    case 'INTELLIGENCE_EXECUTION':
      return handleIntelligenceExecutionTask(task);
    case 'CANDIDATE_INTELLIGENCE_GENERATION':
      return handleCandidateIntelligenceGenerationTask(task);
    case 'DATA_EXPORT':
      return handleDataExportTask(task);
    case 'STALE_RESULT_CLEANUP':
      return handleCleanupTask(task);
    default:
      return 'cancelled';
  }
}
