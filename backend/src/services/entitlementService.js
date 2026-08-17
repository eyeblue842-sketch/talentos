import { prisma } from '../config/db.js';

function buildEntitlementError(message, code, statusCode = 402) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

// Live, server-authoritative available-credit balance. Deliberately NOT a
// stored counter (section 7) - always derived by summing the immutable
// ledger. GRANT rows whose expiresAt has passed stop contributing to the
// sum the instant the server clock passes it, independent of whether the
// expiry-sweep scheduler has run yet (see backgroundTaskHandlers'
// handleSubscriptionRenewalReminderTask/handleJobAutoCloseTask sibling,
// scheduleJobCreditExpiryTasks, for the audit-trail-only sweep).
export async function getAvailableJobCredits(organisationId, client = prisma) {
  const rows = await client.$queryRaw`
    SELECT COALESCE(SUM("amount"), 0)::int AS balance
    FROM "JobPostingCreditLedger"
    WHERE "organisationId" = ${organisationId}
      AND ("entryType" != 'GRANT' OR "expiresAt" IS NULL OR "expiresAt" > NOW())
      AND ("entryType" != 'GRANT' OR "validFrom" IS NULL OR "validFrom" <= NOW())
  `;
  const balance = Array.isArray(rows) && rows[0] ? Number(rows[0].balance) : 0;
  return Math.max(0, balance);
}

export async function canPublishJob(organisationId, client = prisma) {
  const available = await getAvailableJobCredits(organisationId, client);
  return available > 0;
}

// The "current" subscription is the most-recently-expiring row that is not
// SUSPENDED/REFUNDED. Those two are the only statuses that revoke access
// immediately regardless of expiresAt (B1 hardening, section 6: dispute/
// suspension/refund "may restrict access earlier according to audited
// policy"). CANCELLED is deliberately NOT in this exclusion list -
// cancelling means "do not renew", not "revoke now": a cancelled
// subscription's paid-for access (and its still-unexpired included
// credits) continues normally until expiresAt, judged purely by comparing
// expiresAt to the current server time. Once expiresAt actually passes,
// it naturally stops being "current" without needing a status write at
// exactly that instant (never trusting the stored `status` alone for the
// live decision, since a scheduler may not have relabelled it EXPIRED yet).
const IMMEDIATE_REVOCATION_STATUSES = ['SUSPENDED', 'REFUNDED'];

export async function getCurrentSubscription(organisationId, client = prisma) {
  return client.companySubscription.findFirst({
    where: {
      organisationId,
      status: { notIn: IMMEDIATE_REVOCATION_STATUSES },
    },
    orderBy: { expiresAt: 'desc' },
  });
}

export async function isSubscriptionCurrentlyActive(subscription) {
  if (!subscription) return false;
  if (IMMEDIATE_REVOCATION_STATUSES.includes(subscription.status)) return false;
  return new Date(subscription.expiresAt) > new Date();
}

export async function hasActiveAtsAccess(organisationId, client = prisma) {
  const subscription = await getCurrentSubscription(organisationId, client);
  return Boolean(subscription?.atsAccess) && isSubscriptionCurrentlyActive(subscription);
}

export async function hasActiveResumeDatabaseAccess(organisationId, client = prisma) {
  const subscription = await getCurrentSubscription(organisationId, client);
  return Boolean(subscription?.resumeDatabaseAccess) && isSubscriptionCurrentlyActive(subscription);
}

export async function getSubscriptionExpiry(organisationId, client = prisma) {
  const subscription = await getCurrentSubscription(organisationId, client);
  if (!subscription || !(await isSubscriptionCurrentlyActive(subscription))) return null;
  return subscription.expiresAt;
}

// Called from inside the same $transaction that activates a job (section
// 10, steps 2-3-7). Throws JOB_POSTING_QUOTA_EXCEEDED if no credit is
// available; the caller's transaction then rolls back and nothing is
// consumed. `idempotencyKey` must be unique per publish ATTEMPT (generated
// server-side by the caller, never client-supplied) so retried requests
// cannot double-consume.
export async function consumeJobCredit(tx, { organisationId, jobId, actorUserId, idempotencyKey }) {
  const available = await getAvailableJobCredits(organisationId, tx);
  if (available <= 0) {
    throw buildEntitlementError('No job-posting credits are available for this organisation.', 'JOB_POSTING_QUOTA_EXCEEDED', 402);
  }

  return tx.jobPostingCreditLedger.create({
    data: {
      organisationId,
      entryType: 'CONSUME',
      amount: -1,
      jobId,
      idempotencyKey,
      createdByUserId: actorUserId || null,
    },
  });
}

// Reverses a single consumed credit (e.g. an unused-job refund, or an admin
// correction). Positive amount, no jobId (the job that consumed it keeps
// its own history) - see billingService for the refund-before-use flow.
export async function reverseJobCreditConsumption(tx, { organisationId, reason, actorUserId, idempotencyKey }) {
  return tx.jobPostingCreditLedger.create({
    data: {
      organisationId,
      entryType: 'REVERSAL',
      amount: 1,
      reason,
      idempotencyKey,
      createdByUserId: actorUserId || null,
    },
  });
}

export async function grantSubscriptionIncludedCredits(tx, { organisationId, subscriptionId, purchaseId, amount, validFrom, expiresAt, idempotencyKey }) {
  if (amount <= 0) return null;
  return tx.jobPostingCreditLedger.create({
    data: {
      organisationId,
      entryType: 'GRANT',
      source: 'SUBSCRIPTION_GRANT',
      amount,
      subscriptionId,
      purchaseId,
      validFrom: validFrom || null,
      expiresAt,
      idempotencyKey,
    },
  });
}

export async function grantPurchasedCredit(tx, { organisationId, purchaseId, amount, expiresAt, idempotencyKey }) {
  return tx.jobPostingCreditLedger.create({
    data: {
      organisationId,
      entryType: 'GRANT',
      source: 'PURCHASED_CREDIT',
      amount,
      purchaseId,
      expiresAt,
      idempotencyKey,
    },
  });
}

// Privileged, audited administrative correction (section 15: "manual credit
// adjustment with reason"). Deliberately PLATFORM-admin-only, not gated by
// the org-scoped 'organisation.billing.manage' permission: a company's own
// OWNER/ADMIN having this permission for normal billing management must
// NOT be able to grant their own organisation free job credits, which
// would defeat the payment system entirely. Callers (adminBillingRoutes)
// must enforce the platform-admin check (requirePlatformAdmin middleware)
// before invoking this - this function trusts that authorization already
// happened, exactly like the rest of adminBillingService.
export async function adminAdjustJobCredits(actorUser, organisationId, amount, reason, requestMeta = {}) {
  const entry = await prisma.$transaction(async (tx) => {
    const created = await tx.jobPostingCreditLedger.create({
      data: {
        organisationId,
        entryType: 'ADMIN_ADJUSTMENT',
        source: 'ADMIN_ADJUSTMENT',
        amount,
        reason,
        idempotencyKey: `admin-adjust:${organisationId}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`,
        createdByUserId: actorUser.id,
      },
    });
    await tx.auditLog.create({
      data: {
        organisationId,
        actorUserId: actorUser.id,
        action: 'admin.billing.creditLedger.adjust',
        entityType: 'JobPostingCreditLedger',
        entityId: created.id,
        afterData: created,
        metadata: { amount, reason },
        ipAddress: requestMeta.ipAddress || null,
        userAgent: requestMeta.userAgent || null,
      },
    });
    return created;
  });

  return entry;
}

// Dashboard-facing breakdown (section 12: "included credits, consumed
// credits, separately purchased credits, available credits"). Lifetime
// totals for included/purchased/consumed (including credits that have
// since expired unused), vs. `available` which is the same live figure
// getAvailableJobCredits returns.
export async function getJobCreditBreakdown(organisationId, client = prisma) {
  const rows = await client.jobPostingCreditLedger.groupBy({
    by: ['entryType', 'source'],
    where: { organisationId },
    _sum: { amount: true },
  });

  let includedGranted = 0;
  let purchasedGranted = 0;
  let adminAdjusted = 0;
  let consumed = 0;
  let reversed = 0;
  let expired = 0;

  for (const row of rows) {
    const sum = row._sum.amount || 0;
    if (row.entryType === 'GRANT' && row.source === 'SUBSCRIPTION_GRANT') includedGranted += sum;
    else if (row.entryType === 'GRANT' && row.source === 'PURCHASED_CREDIT') purchasedGranted += sum;
    else if (row.entryType === 'ADMIN_ADJUSTMENT') adminAdjusted += sum;
    else if (row.entryType === 'CONSUME') consumed += Math.abs(sum);
    else if (row.entryType === 'REVERSAL') reversed += sum;
    else if (row.entryType === 'EXPIRY') expired += Math.abs(sum);
  }

  const available = await getAvailableJobCredits(organisationId, client);

  return { includedGranted, purchasedGranted, adminAdjusted, consumed, reversed, expired, available };
}

export async function getEntitlementSummary(organisationId, client = prisma) {
  const [availableCredits, subscription] = await Promise.all([
    getAvailableJobCredits(organisationId, client),
    getCurrentSubscription(organisationId, client),
  ]);
  const active = await isSubscriptionCurrentlyActive(subscription);

  return {
    availableJobCredits: availableCredits,
    subscription: subscription || null,
    hasActiveAtsAccess: Boolean(subscription?.atsAccess) && active,
    hasActiveResumeDatabaseAccess: Boolean(subscription?.resumeDatabaseAccess) && active,
    subscriptionExpiresAt: active ? subscription.expiresAt : null,
  };
}

export { buildEntitlementError };
