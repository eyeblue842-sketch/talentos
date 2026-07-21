import { prisma } from '../config/db.js';
import { enqueueBackgroundTask } from './backgroundTaskService.js';

function hoursFromNow(hours) {
  return new Date(Date.now() + (hours * 60 * 60 * 1000));
}

export async function scheduleProductionBackgroundTasks() {
  await Promise.all([
    scheduleResumeParsingTasks(),
    scheduleInterviewReminderTasks(),
    scheduleOfferReminderTasks(),
    scheduleOfferExpiryTasks(),
    scheduleCleanupTasks(),
  ]);
}

export async function scheduleResumeParsingTasks() {
  const assets = await prisma.resumeAsset.findMany({
    where: {
      kind: 'RESUME',
      status: { not: 'DELETED' },
      parsingStatus: { in: ['PENDING', 'PROCESSING', 'PARTIAL', 'FAILED'] },
    },
    orderBy: { createdAt: 'asc' },
    take: 50,
  });

  await Promise.all(assets.map((asset) => enqueueBackgroundTask({
    type: 'RESUME_PARSING',
    entityType: 'ResumeAsset',
    entityId: asset.id,
    idempotencyKey: `resume-parse:${asset.id}:${asset.updatedAt.toISOString()}`,
    payload: { assetId: asset.id },
    nextAttemptAt: new Date(),
  })));
}

export async function scheduleInterviewReminderTasks() {
  const now = new Date();
  const in24Hours = hoursFromNow(24);
  const inOneHour = hoursFromNow(1);
  const rounds = await prisma.interviewRound.findMany({
    where: {
      status: 'SCHEDULED',
      scheduledStartAt: {
        gte: now,
        lte: in24Hours,
      },
    },
    select: {
      id: true,
      organisationId: true,
      scheduledStartAt: true,
      updatedAt: true,
    },
    take: 100,
  });

  await Promise.all(rounds.flatMap((round) => {
    const tasks = [];
    if (round.scheduledStartAt <= in24Hours) {
      tasks.push(enqueueBackgroundTask({
        organisationId: round.organisationId,
        type: 'INTERVIEW_REMINDER',
        entityType: 'InterviewRound',
        entityId: round.id,
        idempotencyKey: `interview-reminder-24h:${round.id}:${round.updatedAt.toISOString()}`,
        payload: { roundId: round.id, reminderWindow: '24h' },
        nextAttemptAt: new Date(Math.max(now.getTime(), new Date(round.scheduledStartAt).getTime() - (24 * 60 * 60 * 1000))),
      }));
    }
    if (round.scheduledStartAt <= inOneHour) {
      tasks.push(enqueueBackgroundTask({
        organisationId: round.organisationId,
        type: 'INTERVIEW_REMINDER',
        entityType: 'InterviewRound',
        entityId: round.id,
        idempotencyKey: `interview-reminder-1h:${round.id}:${round.updatedAt.toISOString()}`,
        payload: { roundId: round.id, reminderWindow: '1h' },
        nextAttemptAt: new Date(Math.max(now.getTime(), new Date(round.scheduledStartAt).getTime() - (60 * 60 * 1000))),
      }));
    }
    return tasks;
  }));
}

export async function scheduleOfferReminderTasks() {
  const now = new Date();
  const in24Hours = hoursFromNow(24);
  const offers = await prisma.offer.findMany({
    where: {
      status: { in: ['RELEASED', 'VIEWED'] },
      expiryAt: {
        gt: now,
        lte: in24Hours,
      },
    },
    select: {
      id: true,
      organisationId: true,
      expiryAt: true,
      updatedAt: true,
    },
    take: 100,
  });

  await Promise.all(offers.flatMap((offer) => {
    const tasks = [
      enqueueBackgroundTask({
        organisationId: offer.organisationId,
        type: 'OFFER_REMINDER',
        entityType: 'Offer',
        entityId: offer.id,
        idempotencyKey: `offer-reminder-24h:${offer.id}:${offer.updatedAt.toISOString()}`,
        payload: { offerId: offer.id, reminderWindow: '24h' },
        nextAttemptAt: new Date(Math.max(now.getTime(), new Date(offer.expiryAt).getTime() - (24 * 60 * 60 * 1000))),
      }),
      enqueueBackgroundTask({
        organisationId: offer.organisationId,
        type: 'OFFER_REMINDER',
        entityType: 'Offer',
        entityId: offer.id,
        idempotencyKey: `offer-reminder-1h:${offer.id}:${offer.updatedAt.toISOString()}`,
        payload: { offerId: offer.id, reminderWindow: '1h' },
        nextAttemptAt: new Date(Math.max(now.getTime(), new Date(offer.expiryAt).getTime() - (60 * 60 * 1000))),
      }),
    ];
    return tasks;
  }));
}

export async function scheduleOfferExpiryTasks() {
  const now = new Date();
  const offers = await prisma.offer.findMany({
    where: {
      status: { in: ['RELEASED', 'VIEWED'] },
      expiryAt: { lte: now },
    },
    select: {
      id: true,
      organisationId: true,
      expiryAt: true,
      updatedAt: true,
    },
    take: 100,
  });

  await Promise.all(offers.map((offer) => enqueueBackgroundTask({
    organisationId: offer.organisationId,
    type: 'OFFER_EXPIRY',
    entityType: 'Offer',
    entityId: offer.id,
    idempotencyKey: `offer-expiry:${offer.id}:${offer.updatedAt.toISOString()}`,
    payload: { offerId: offer.id },
    nextAttemptAt: new Date(offer.expiryAt),
  })));
}

export async function scheduleCleanupTasks() {
  const todayKey = new Date().toISOString().slice(0, 10);
  await enqueueBackgroundTask({
    type: 'STALE_RESULT_CLEANUP',
    entityType: 'IntelligenceResult',
    entityId: todayKey,
    idempotencyKey: `stale-cleanup:${todayKey}`,
    payload: {},
    nextAttemptAt: new Date(),
    maxAttempts: 1,
  });
}
