import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { enqueueBackgroundTask, recoverExpiredLeaseTasks } from './backgroundTaskService.js';

function hoursFromNow(hours) {
  return new Date(Date.now() + (hours * 60 * 60 * 1000));
}

function daysFromNow(days) {
  return new Date(Date.now() + (days * 24 * 60 * 60 * 1000));
}

export async function scheduleProductionBackgroundTasks() {
  await Promise.all([
    scheduleResumeParsingTasks(),
    scheduleInterviewReminderTasks(),
    scheduleOfferReminderTasks(),
    scheduleOfferExpiryTasks(),
    scheduleSubscriptionRenewalReminderTasks(),
    scheduleJobAutoCloseTasks(),
    scheduleCleanupTasks(),
    recoverStuckTasks(),
  ]);
}

// Requeues (or dead-letters, if retries are exhausted) any task left in
// RUNNING past its lease — the signal that the worker which claimed it
// crashed, was killed, or lost its DB connection mid-task.
export async function recoverStuckTasks() {
  const recovered = await recoverExpiredLeaseTasks();
  if (recovered.length) {
    console.log(JSON.stringify({
      level: 'warn',
      event: 'worker.task.lease_expired_recovery',
      count: recovered.length,
      tasks: recovered.map((task) => ({
        id: task.id,
        type: task.type,
        entityId: task.entityId,
        previousOwner: task.previousOwner,
        nextStatus: task.nextStatus,
      })),
    }));
  }
  return recovered;
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
  const reminders = await prisma.meetingReminder.findMany({
    where: {
      status: 'SCHEDULED',
      backgroundTaskId: null,
      scheduledFor: { gt: new Date() },
    },
    select: {
      id: true,
      organisationId: true,
      scheduledFor: true,
      updatedAt: true,
      interviewMeetingId: true,
    },
    take: 100,
  });

  await Promise.all(reminders.map((reminder) => enqueueBackgroundTask({
    organisationId: reminder.organisationId,
    type: 'INTERVIEW_REMINDER',
    entityType: 'MeetingReminder',
    entityId: reminder.id,
    idempotencyKey: `meeting-reminder:${reminder.id}:${reminder.updatedAt.toISOString()}`,
    payload: { reminderId: reminder.id, meetingId: reminder.interviewMeetingId },
    nextAttemptAt: reminder.scheduledFor,
  })));
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

// Section 8: T-15 (configurable) renewal reminder. Gated on
// renewalReminderSentAt IS NULL so a subscription is only ever scheduled
// once - the idempotencyKey (keyed on updatedAt) is a second, independent
// safety net against duplicate enqueue if the gate is ever raced.
export async function scheduleSubscriptionRenewalReminderTasks() {
  const now = new Date();
  const reminderWindowEnd = daysFromNow(env.billingRenewalReminderDaysBefore);

  const subscriptions = await prisma.companySubscription.findMany({
    where: {
      status: { in: ['ACTIVE', 'EXPIRING_SOON'] },
      renewalReminderSentAt: null,
      expiresAt: { gt: now, lte: reminderWindowEnd },
    },
    select: { id: true, organisationId: true, expiresAt: true, updatedAt: true },
    take: 200,
  });

  await Promise.all(subscriptions.map((subscription) => enqueueBackgroundTask({
    organisationId: subscription.organisationId,
    type: 'SUBSCRIPTION_RENEWAL_REMINDER',
    entityType: 'CompanySubscription',
    entityId: subscription.id,
    idempotencyKey: `sub-renewal-reminder:${subscription.id}:${subscription.updatedAt.toISOString()}`,
    payload: { subscriptionId: subscription.id },
    nextAttemptAt: now,
  })));
}

// Section 11: entitlement reads already treat a job as inactive the instant
// server time passes activeUntil (see entitlementService/jobService), so
// this sweep only needs to be idempotent and eventually-consistent, not
// fast - it exists to flip status to CLOSED and notify the recruiter, not
// to enforce the cutoff itself.
export async function scheduleJobAutoCloseTasks() {
  const now = new Date();
  const jobs = await prisma.job.findMany({
    where: {
      status: 'OPEN',
      activeUntil: { lte: now },
      autoClosedAt: null,
    },
    select: { id: true, organisationId: true, activeUntil: true, updatedAt: true },
    take: 200,
  });

  await Promise.all(jobs.map((job) => enqueueBackgroundTask({
    organisationId: job.organisationId,
    type: 'JOB_AUTO_CLOSE',
    entityType: 'Job',
    entityId: job.id,
    idempotencyKey: `job-auto-close:${job.id}:${job.updatedAt.toISOString()}`,
    payload: { jobId: job.id },
    nextAttemptAt: new Date(job.activeUntil),
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
