import { prisma } from '../config/db.js';
import { recordAuditLog } from './auditLogService.js';
import { enqueueBackgroundTask } from './backgroundTaskService.js';
import { activatePurchase } from './billingService.js';
import { getActiveProductPlan, buildProductSnapshot, isSubscriptionProduct } from './productCatalogueService.js';
import { razorpayGateway } from './razorpayService.js';

// Platform-level (Careeriz staff) billing administration (section 15).
// These endpoints are cross-tenant, gated by the platform UserRole (ADMIN /
// PLATFORM_ADMIN) via auth(['ADMIN']) at the route level - NOT by
// requireEnterprisePermission, which is scoped to a single organisation and
// has no meaning for "reconcile payments across every company."

export async function listPurchasesForReconciliation(filters = {}) {
  const where = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.organisationId ? { organisationId: filters.organisationId } : {}),
    ...(filters.productCode ? { productCode: filters.productCode } : {}),
    ...(filters.requiresManualReview ? { requiresManualReview: true } : {}),
  };

  return prisma.purchase.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: Math.min(200, Number(filters.take) || 100),
    include: { organisation: { select: { id: true, name: true, slug: true } }, invoice: true, subscription: true },
  });
}

export async function listWebhookEventsForReconciliation(filters = {}) {
  const where = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.eventType ? { eventType: filters.eventType } : {}),
  };
  return prisma.paymentWebhookEvent.findMany({
    where,
    orderBy: { receivedAt: 'desc' },
    take: Math.min(200, Number(filters.take) || 100),
  });
}

export async function getCreditLedgerForOrganisation(organisationId) {
  return prisma.jobPostingCreditLedger.findMany({
    where: { organisationId },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
}

// "Resend renewal reminder" (section 15). Resets the sent marker and
// re-enqueues the same idempotent task type the scheduler itself uses, so
// the retry-safe/idempotent handler code path is identical either way.
export async function resendRenewalReminder(actorUser, organisationId, requestMeta = {}) {
  const subscription = await prisma.companySubscription.findFirst({
    where: { organisationId, status: { in: ['ACTIVE', 'EXPIRING_SOON'] } },
    orderBy: { expiresAt: 'desc' },
  });
  if (!subscription) {
    const error = new Error('No active subscription found for this organisation.');
    error.statusCode = 404;
    throw error;
  }

  await prisma.companySubscription.update({
    where: { id: subscription.id },
    data: { renewalReminderSentAt: null, renewalReminderFailedAt: null },
  });

  const task = await enqueueBackgroundTask({
    organisationId,
    type: 'SUBSCRIPTION_RENEWAL_REMINDER',
    entityType: 'CompanySubscription',
    entityId: subscription.id,
    idempotencyKey: `sub-renewal-reminder:manual:${subscription.id}:${Date.now()}`,
    payload: { subscriptionId: subscription.id },
    nextAttemptAt: new Date(),
    createdByUserId: actorUser.id,
  });

  await recordAuditLog({
    organisationId,
    actorUserId: actorUser.id,
    action: 'admin.billing.renewalReminder.resend',
    entityType: 'CompanySubscription',
    entityId: subscription.id,
    metadata: { taskId: task.id },
    ...requestMeta,
  });

  return { subscriptionId: subscription.id, taskId: task.id };
}

export async function suspendSubscription(actorUser, organisationId, reason, requestMeta = {}) {
  // Deliberately does NOT exclude CANCELLED - a subscription that is
  // cancelled (won't renew) but still within its paid term is exactly the
  // kind of row a dispute/policy-violation suspension needs to reach.
  const subscription = await prisma.companySubscription.findFirst({
    where: { organisationId, status: { notIn: ['SUSPENDED', 'REFUNDED'] } },
    orderBy: { expiresAt: 'desc' },
  });
  if (!subscription) {
    const error = new Error('No suspendable subscription found for this organisation.');
    error.statusCode = 404;
    throw error;
  }

  const updated = await prisma.companySubscription.update({
    where: { id: subscription.id },
    data: { status: 'SUSPENDED', suspendedAt: new Date(), suspensionReason: reason },
  });

  await recordAuditLog({
    organisationId,
    actorUserId: actorUser.id,
    action: 'admin.billing.subscription.suspend',
    entityType: 'CompanySubscription',
    entityId: subscription.id,
    beforeData: subscription,
    afterData: updated,
    metadata: { reason },
    ...requestMeta,
  });

  return updated;
}

export async function reactivateSubscription(actorUser, organisationId, reason, requestMeta = {}) {
  const subscription = await prisma.companySubscription.findFirst({
    where: { organisationId, status: 'SUSPENDED' },
    orderBy: { expiresAt: 'desc' },
  });
  if (!subscription) {
    const error = new Error('No suspended subscription found for this organisation.');
    error.statusCode = 404;
    throw error;
  }

  const nextStatus = new Date(subscription.expiresAt) > new Date() ? 'ACTIVE' : 'EXPIRED';
  const updated = await prisma.companySubscription.update({
    where: { id: subscription.id },
    data: { status: nextStatus, suspendedAt: null, suspensionReason: null },
  });

  await recordAuditLog({
    organisationId,
    actorUserId: actorUser.id,
    action: 'admin.billing.subscription.reactivate',
    entityType: 'CompanySubscription',
    entityId: subscription.id,
    beforeData: subscription,
    afterData: updated,
    metadata: { reason },
    ...requestMeta,
  });

  return updated;
}

// The ONE privileged manual-activation path (section 15: "Never create an
// unrestricted 'mark as paid' action"). Requires an external provider
// reference AND a human-entered reason, and writes a distinct admin-actor
// audit entry on top of activatePurchase's own purchaser-actor entry, so
// the audit trail always shows WHO overrode the automated flow and WHY.
// B1 hardening, section 7: "no activation based only on administrator-
// entered external reference". The admin supplies a Razorpay payment id as
// a POINTER, not as proof - this function always fetches that payment from
// Razorpay's API server-side and only proceeds to activatePurchase if
// Razorpay itself confirms status=captured and the amount/currency match
// this exact purchase's server-authoritative snapshot. If Razorpay is not
// configured (PAYMENT_PROVIDER_DISABLED) or does not confirm the payment,
// this throws instead of activating - there is no code path here that
// grants entitlement purely because an admin typed a string.
export async function manuallyVerifyPurchase(actorUser, purchaseId, providerReference, reason, requestMeta = {}) {
  const purchase = await prisma.purchase.findUnique({ where: { id: purchaseId } });
  if (!purchase) {
    const error = new Error('Purchase not found.');
    error.statusCode = 404;
    throw error;
  }
  if (purchase.status === 'PAID') {
    return purchase;
  }

  const remotePayment = await razorpayGateway.fetchRazorpayPayment(providerReference);

  if (remotePayment.status !== 'captured') {
    const error = new Error(`Razorpay reports this payment as "${remotePayment.status}", not captured. Cannot activate.`);
    error.statusCode = 409;
    error.code = 'PAYMENT_NOT_CAPTURED';
    throw error;
  }
  if (purchase.providerOrderId && remotePayment.order_id !== purchase.providerOrderId) {
    const error = new Error('This payment belongs to a different Razorpay order than the one recorded for this purchase.');
    error.statusCode = 409;
    error.code = 'ORDER_MISMATCH';
    throw error;
  }
  if (remotePayment.amount !== purchase.amountPaise || remotePayment.currency !== purchase.currency) {
    const error = new Error('The captured payment amount/currency does not match this purchase.');
    error.statusCode = 409;
    error.code = 'AMOUNT_MISMATCH';
    throw error;
  }

  const activated = await activatePurchase(purchaseId, { providerPaymentId: remotePayment.id }, { source: 'admin_manual' });

  await recordAuditLog({
    organisationId: purchase.organisationId,
    actorUserId: actorUser.id,
    action: 'admin.billing.purchase.manualVerify',
    entityType: 'Purchase',
    entityId: purchaseId,
    metadata: { providerReference, verifiedAmount: remotePayment.amount, verifiedStatus: remotePayment.status, reason },
    ...requestMeta,
  });

  return activated;
}

// Clears the manual-review flag after a human has looked at a refund that
// billingService.handleRefund could not safely auto-resolve. This does NOT
// itself move money or credits - see adminAdjustJobCredits
// (entitlementService) for a separate, explicitly-audited ledger
// correction if the reviewer decides one is warranted.
export async function reviewFlaggedRefund(actorUser, purchaseId, approve, reason, requestMeta = {}) {
  const purchase = await prisma.purchase.findUnique({ where: { id: purchaseId } });
  if (!purchase) {
    const error = new Error('Purchase not found.');
    error.statusCode = 404;
    throw error;
  }

  const updated = await prisma.purchase.update({
    where: { id: purchaseId },
    data: {
      requiresManualReview: false,
      manualReviewReason: `${purchase.manualReviewReason || ''} | Reviewed by admin: ${approve ? 'approved' : 'rejected'} - ${reason}`.trim(),
    },
  });

  await recordAuditLog({
    organisationId: purchase.organisationId,
    actorUserId: actorUser.id,
    action: 'admin.billing.refund.review',
    entityType: 'Purchase',
    entityId: purchaseId,
    beforeData: purchase,
    afterData: updated,
    metadata: { approve, reason },
    ...requestMeta,
  });

  return updated;
}

// Grant a FREE subscription to an organisation (spec section 15:
// "complimentary subscription grants"). Rather than duplicate the
// subscription/credit/invoice logic, we reuse the single entitlement-granting
// primitive (activatePurchase): we create a synthetic COMPLIMENTARY Purchase at
// amountPaise 0 with a money-zeroed productSnapshot, then activate it. The real
// product plan still drives the access term and included job credits, while the
// zeroed snapshot makes the generated GST invoice a correct Rupees-0 invoice -
// no money is ever recorded as collected. Only a subscription product can be
// comped (not the one-off job-post credit). Idempotency is left to the caller's
// confirmation step; a repeated grant simply stacks another free term, which an
// operator controls.
export async function grantComplimentarySubscription(actorUser, organisationId, options = {}, requestMeta = {}) {
  const { productCode, reason } = options;

  const organisation = await prisma.organisation.findUnique({ where: { id: organisationId }, select: { id: true } });
  if (!organisation) {
    const error = new Error('Organisation not found.');
    error.statusCode = 404;
    throw error;
  }

  if (!isSubscriptionProduct(productCode)) {
    const error = new Error('Complimentary grants are only available for subscription products.');
    error.statusCode = 400;
    error.code = 'NOT_A_SUBSCRIPTION_PRODUCT';
    throw error;
  }

  const plan = await getActiveProductPlan(productCode);
  if (!plan) {
    const error = new Error(`Product ${productCode} is not available.`);
    error.statusCode = 404;
    error.code = 'PRODUCT_NOT_FOUND';
    throw error;
  }

  // Keep term / credits / active-days from the real plan; zero every monetary
  // field so the invoice and recorded amount are a clean Rupees 0.
  const productSnapshot = {
    ...buildProductSnapshot(plan),
    baseAmountPaise: 0,
    gstAmountPaise: 0,
    gstRatePercent: 0,
    totalAmountPaise: 0,
    complimentary: true,
  };

  const purchase = await prisma.purchase.create({
    data: {
      organisationId,
      purchaserUserId: actorUser.id,
      productPlanId: plan.id,
      productCode: plan.code,
      productVersion: plan.version,
      productSnapshot,
      provider: 'COMPLIMENTARY',
      status: 'PENDING',
      currency: plan.currency,
      amountPaise: 0,
      idempotencyKey: `comp:${organisationId}:${plan.code}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`,
    },
  });

  const activated = await activatePurchase(purchase.id, {}, { source: 'admin_complimentary' });

  await recordAuditLog({
    organisationId,
    actorUserId: actorUser.id,
    action: 'admin.billing.subscription.complimentaryGrant',
    entityType: 'Purchase',
    entityId: purchase.id,
    afterData: activated,
    metadata: { productCode: plan.code, reason, subscriptionId: activated?.subscription?.id || null },
    ...requestMeta,
  });

  return activated;
}
