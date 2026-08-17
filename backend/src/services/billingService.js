import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { requireEnterprisePermission } from './enterprisePermissionService.js';
import { recordAuditLog } from './auditLogService.js';
import { createNotification } from './notificationService.js';
import { sendPaymentReceiptEmail } from './emailService.js';
import {
  getActiveProductPlan,
  getProductCatalogue,
  buildProductSnapshot,
  isSubscriptionProduct,
} from './productCatalogueService.js';
import {
  createRazorpayOrder,
  verifyPaymentSignature,
  fetchRazorpayPayment,
  getPublicKeyId,
  getConfiguredButtonIds,
  isRazorpayEnabled,
  verifyWebhookSignature,
  hashRawBody,
} from './razorpayService.js';
import {
  getAvailableJobCredits,
  getEntitlementSummary,
  getJobCreditBreakdown,
  grantPurchasedCredit,
  grantSubscriptionIncludedCredits,
} from './entitlementService.js';
import { addCalendarMonths } from '../utils/dateUtils.js';
import { runSerializableTransaction } from '../utils/serializableTransaction.js';

function buildBillingError(message, code, statusCode) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

export function getPublicCatalogueConfig() {
  return {
    razorpayEnabled: isRazorpayEnabled(),
    razorpayKeyId: getPublicKeyId(),
    buttonIds: getConfiguredButtonIds(),
  };
}

export async function getPublicCatalogue() {
  const plans = await getProductCatalogue();
  return {
    products: plans.map(buildProductSnapshot),
    ...getPublicCatalogueConfig(),
  };
}

// Section 5/6: creates the internal Purchase intent AND the Razorpay Order
// in the same operation, with organisationId/purchaserUserId/productCode
// stamped into the order's `notes` server-side before the customer ever
// sees a checkout modal. This is what lets the webhook/verify handlers
// later prove which company a payment belongs to.
export async function createPurchaseIntent(actorUser, organisationId, productCode, requestMeta = {}, clientIdempotencyKey = null) {
  const context = await requireEnterprisePermission(actorUser, 'organisation.billing.manage', organisationId);

  if (clientIdempotencyKey) {
    const existing = await prisma.purchase.findFirst({
      where: {
        organisationId: context.organisationId,
        idempotencyKey: `client:${clientIdempotencyKey}`,
        status: 'PENDING',
        createdAt: { gt: new Date(Date.now() - 15 * 60 * 1000) },
      },
    });
    if (existing) {
      return buildPurchaseIntentResponse(existing);
    }
  }

  const plan = await getActiveProductPlan(productCode);
  if (!plan) {
    throw buildBillingError(`Product ${productCode} is not available for purchase.`, 'PRODUCT_NOT_FOUND', 404);
  }

  const productSnapshot = buildProductSnapshot(plan);
  const idempotencyKey = clientIdempotencyKey
    ? `client:${clientIdempotencyKey}`
    : `purchase:${context.organisationId}:${productCode}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;

  const purchase = await prisma.purchase.create({
    data: {
      organisationId: context.organisationId,
      purchaserUserId: actorUser.id,
      productPlanId: plan.id,
      productCode: plan.code,
      productVersion: plan.version,
      productSnapshot,
      status: 'PENDING',
      currency: plan.currency,
      amountPaise: plan.totalAmountPaise,
      idempotencyKey,
    },
  });

  if (!isRazorpayEnabled()) {
    // Purchase intent still recorded (auditable, section 6) but no order
    // can be created until real Test Mode credentials are configured.
    await recordAuditLog({
      organisationId: context.organisationId,
      actorUserId: actorUser.id,
      action: 'billing.purchase.intent.created_unconfigured',
      entityType: 'Purchase',
      entityId: purchase.id,
      afterData: purchase,
      ...requestMeta,
    });
    throw buildBillingError('Payments are not configured yet. Contact an administrator to complete Razorpay setup.', 'PAYMENT_PROVIDER_DISABLED', 503);
  }

  const notes = {
    purchaseId: purchase.id,
    organisationId: context.organisationId,
    purchaserUserId: actorUser.id,
    productCode: plan.code,
  };

  const order = await createRazorpayOrder({
    amountPaise: plan.totalAmountPaise,
    currency: plan.currency,
    receipt: purchase.id,
    notes,
  });

  const updated = await prisma.purchase.update({
    where: { id: purchase.id },
    data: { providerOrderId: order.id, notesSnapshot: notes },
  });

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'billing.purchase.intent.create',
    entityType: 'Purchase',
    entityId: purchase.id,
    afterData: updated,
    ...requestMeta,
  });

  return buildPurchaseIntentResponse(updated);
}

function buildPurchaseIntentResponse(purchase) {
  return {
    purchaseId: purchase.id,
    orderId: purchase.providerOrderId,
    amountPaise: purchase.amountPaise,
    currency: purchase.currency,
    keyId: getPublicKeyId(),
    productSnapshot: purchase.productSnapshot,
    status: purchase.status,
  };
}

async function nextInvoiceNumber(tx, year) {
  const count = await tx.invoice.count({
    where: { invoiceDate: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } },
  });
  return `INV-${year}-${String(count + 1).padStart(6, '0')}`;
}

// B1 hardening, section 9: never guess a CGST/SGST-vs-IGST split. Entitlement
// activation (the thing that matters for the customer's access) never
// depends on this - it can proceed with a payment before billing details are
// complete. But the invoice's tax SPLIT must not be asserted as fact unless
// both the seller's and the customer's GST state codes are actually known:
// when either is missing, the invoice is created with supplyType=UNKNOWN,
// status=REVIEW_REQUIRED, and cgst/sgst/igst all 0 - totalTaxPaise and
// totalPayablePaise remain correct (18%) throughout, only the split is
// withheld pending an operator supplying the missing data.
async function createInvoiceForPurchase(tx, purchase) {
  const billingProfile = await tx.companyBillingProfile.findUnique({ where: { organisationId: purchase.organisationId } });
  const sellerStateCode = env.billingSellerStateCode;
  const customerStateCode = billingProfile?.stateCode || null;
  const jurisdictionKnown = Boolean(sellerStateCode && customerStateCode);

  const supplyType = !jurisdictionKnown
    ? 'UNKNOWN'
    : customerStateCode === sellerStateCode ? 'INTRA_STATE' : 'INTER_STATE';
  const status = jurisdictionKnown ? 'FINAL' : 'REVIEW_REQUIRED';

  const gstAmountPaise = purchase.productSnapshot.gstAmountPaise;
  let cgstPaise = 0;
  let sgstPaise = 0;
  let igstPaise = 0;
  if (supplyType === 'INTRA_STATE') {
    cgstPaise = Math.floor(gstAmountPaise / 2);
    sgstPaise = gstAmountPaise - cgstPaise;
  } else if (supplyType === 'INTER_STATE') {
    igstPaise = gstAmountPaise;
  }

  const now = new Date();
  const invoiceNumber = await nextInvoiceNumber(tx, now.getUTCFullYear());

  return tx.invoice.create({
    data: {
      organisationId: purchase.organisationId,
      purchaseId: purchase.id,
      invoiceNumber,
      invoiceDate: now,
      billingProfileSnapshot: billingProfile || null,
      productSnapshot: purchase.productSnapshot,
      supplyType,
      status,
      taxableValuePaise: purchase.productSnapshot.baseAmountPaise,
      gstRatePercent: purchase.productSnapshot.gstRatePercent,
      cgstPaise,
      sgstPaise,
      igstPaise,
      totalTaxPaise: gstAmountPaise,
      totalPayablePaise: purchase.productSnapshot.totalAmountPaise,
      providerReference: purchase.providerPaymentId,
    },
  });
}

// The single entitlement-granting function (section 6/7/9). Idempotent and
// safe to call twice for the same purchaseId (e.g. once from the
// checkout-verify "fast path" and once from the webhook "source of truth"
// path racing each other) - the conditional `updateMany(... status: PENDING
// ...)` guard ensures only the first caller to win the race performs the
// grant; the loser observes count !== 1 and returns the already-activated
// row untouched.
export async function activatePurchase(purchaseId, paymentMeta = {}, requestMeta = {}) {
  return runSerializableTransaction(prisma, async (tx) => {
    const claim = await tx.purchase.updateMany({
      where: { id: purchaseId, status: 'PENDING' },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        ...(paymentMeta.providerPaymentId ? { providerPaymentId: paymentMeta.providerPaymentId } : {}),
      },
    });

    if (claim.count !== 1) {
      return tx.purchase.findUnique({
        where: { id: purchaseId },
        include: { subscription: true, invoice: true },
      });
    }

    const purchase = await tx.purchase.findUnique({ where: { id: purchaseId }, include: { productPlan: true } });
    const plan = purchase.productPlan;
    let subscription = null;

    if (isSubscriptionProduct(purchase.productCode)) {
      const existing = await tx.companySubscription.findFirst({
        where: { organisationId: purchase.organisationId, status: { notIn: ['SUSPENDED', 'REFUNDED'] } },
        orderBy: { expiresAt: 'desc' },
      });
      const now = new Date();
      // Renewal stacking: a renewal purchased before the current subscription
      // lapses extends the ACCESS WINDOW from the existing expiresAt rather
      // than from "now", so paid-for time is never lost. The fresh included
      // credit GRANT below is separately gated by validFrom=startsAt so it
      // does not become usable (or stack with any still-valid credits from
      // the prior term) until that same instant - "early renewal begins
      // after the current paid term ends" (section 5) and "unused included
      // credits do not roll over into renewal" apply to both the access
      // window and the credits together, not just the dates.
      const isEarlyRenewal = existing && new Date(existing.expiresAt) > now;
      const startsAt = isEarlyRenewal ? new Date(existing.expiresAt) : now;
      const expiresAt = addCalendarMonths(startsAt, plan.durationMonths);

      subscription = await tx.companySubscription.create({
        data: {
          organisationId: purchase.organisationId,
          purchaseId: purchase.id,
          productCode: purchase.productCode,
          productVersion: purchase.productVersion,
          planSnapshot: purchase.productSnapshot,
          status: 'ACTIVE',
          startsAt,
          expiresAt,
          atsAccess: true,
          resumeDatabaseAccess: true,
          includedJobCredits: plan.includedJobCredits,
        },
      });

      if (plan.includedJobCredits > 0) {
        await grantSubscriptionIncludedCredits(tx, {
          organisationId: purchase.organisationId,
          subscriptionId: subscription.id,
          purchaseId: purchase.id,
          amount: plan.includedJobCredits,
          validFrom: isEarlyRenewal ? startsAt : null,
          expiresAt,
          idempotencyKey: `sub-grant:${purchase.id}`,
        });
      }
    } else {
      // Separately purchased job-posting credits do not expire for now
      // (binding policy - B1 hardening section 5; the unconfirmed 12-month
      // assumption was removed). BILLING_PURCHASED_CREDIT_EXPIRY_ENABLED
      // keeps this configurable for later without another schema/code
      // change - see backend/.env.example.
      const expiresAt = env.billingPurchasedCreditExpiryEnabled
        ? addCalendarMonths(new Date(), env.billingPurchasedCreditValidityMonths)
        : null;
      await grantPurchasedCredit(tx, {
        organisationId: purchase.organisationId,
        purchaseId: purchase.id,
        amount: 1,
        expiresAt,
        idempotencyKey: `credit-grant:${purchase.id}`,
      });
    }

    const invoice = await createInvoiceForPurchase(tx, purchase);

    await tx.auditLog.create({
      data: {
        organisationId: purchase.organisationId,
        actorUserId: purchase.purchaserUserId,
        action: 'billing.purchase.activated',
        entityType: 'Purchase',
        entityId: purchase.id,
        afterData: { purchase, subscription, invoiceNumber: invoice.invoiceNumber },
        metadata: { source: requestMeta.source || 'unknown' },
      },
    });

    return tx.purchase.findUnique({ where: { id: purchase.id }, include: { subscription: true, invoice: true } });
  });
}

async function postActivationSideEffects(purchase) {
  if (!purchase) return;
  try {
    const admins = await prisma.organisationMembership.findMany({
      where: { organisationId: purchase.organisationId, status: 'ACTIVE', role: { in: ['OWNER', 'ADMIN'] } },
      select: { userId: true },
    });
    await Promise.all(admins.map((membership) => createNotification({
      organisationId: purchase.organisationId,
      recipientUserId: membership.userId,
      type: 'BILLING',
      title: 'Payment received',
      message: `Your payment for ${purchase.productSnapshot?.name || purchase.productCode} was successful.`,
      entityType: 'Purchase',
      entityId: purchase.id,
    }).catch(() => {})));

    const purchaser = await prisma.user.findUnique({ where: { id: purchase.purchaserUserId } });
    if (purchaser?.email) {
      await sendPaymentReceiptEmail({
        to: purchaser.email,
        productName: purchase.productSnapshot?.name || purchase.productCode,
        amountPaise: purchase.amountPaise,
        invoiceNumber: purchase.invoice?.invoiceNumber || null,
      }).catch(() => {});
    }
  } catch {
    // Best-effort notifications only - never fail entitlement grant on
    // notification/email delivery problems.
  }
}

// Client-side "fast path" verification, called right after Razorpay
// Standard Checkout's handler fires with a success payload. This is a
// UX-latency optimisation ONLY (skips waiting for the webhook round-trip);
// the webhook remains authoritative and idempotent with this path.
export async function verifyCheckoutPayment(actorUser, organisationId, payload, requestMeta = {}) {
  const context = await requireEnterprisePermission(actorUser, 'organisation.billing.manage', organisationId);
  const { purchaseId, razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = payload;

  const purchase = await prisma.purchase.findFirst({
    where: { id: purchaseId, organisationId: context.organisationId },
  });
  if (!purchase) {
    throw buildBillingError('Purchase not found for this organisation.', 'PURCHASE_NOT_FOUND', 404);
  }
  if (purchase.providerOrderId !== orderId) {
    throw buildBillingError('Order reference does not match this purchase.', 'ORDER_MISMATCH', 400);
  }

  if (!verifyPaymentSignature({ orderId, paymentId, signature })) {
    await recordAuditLog({
      organisationId: context.organisationId,
      actorUserId: actorUser.id,
      action: 'billing.purchase.signature_invalid',
      entityType: 'Purchase',
      entityId: purchase.id,
      ...requestMeta,
    });
    throw buildBillingError('Payment signature verification failed.', 'PAYMENT_VERIFICATION_FAILED', 400);
  }

  const remotePayment = await fetchRazorpayPayment(paymentId);
  if (
    remotePayment.order_id !== orderId
    || remotePayment.status !== 'captured'
    || remotePayment.amount !== purchase.amountPaise
    || remotePayment.currency !== purchase.currency
  ) {
    throw buildBillingError('Payment is not in a captured state yet. It will be activated once confirmed.', 'PAYMENT_PENDING', 202);
  }

  const activated = await activatePurchase(purchase.id, { providerPaymentId: paymentId }, { source: 'checkout_verify' });
  await postActivationSideEffects(activated);
  return activated;
}

export async function markPurchaseFailed(purchaseId, reason) {
  return prisma.$transaction(async (tx) => {
    const updateResult = await tx.purchase.updateMany({
      where: { id: purchaseId, status: 'PENDING' },
      data: { status: 'FAILED', failedAt: new Date(), failureReason: reason?.slice(0, 500) || 'Payment failed.' },
    });
    const purchase = await tx.purchase.findUnique({ where: { id: purchaseId } });
    if (updateResult.count === 1 && purchase) {
      await tx.auditLog.create({
        data: {
          organisationId: purchase.organisationId,
          actorUserId: purchase.purchaserUserId,
          action: 'billing.purchase.failed',
          entityType: 'Purchase',
          entityId: purchase.id,
          metadata: { reason },
        },
      });
    }
    return purchase;
  });
}

// Refund/reversal policy (section 14):
//  - JOB_POST_45D: if the org's live credit balance can absorb removing
//    this grant without going negative, treat it as still-unused and
//    auto-reverse. Otherwise flag for manual admin review rather than
//    guessing which credit was consumed (the ledger is a running balance,
//    not per-unit tokens - see entitlementService).
//  - Subscriptions: ALWAYS flagged for manual review on refund. Automating
//    "was any of the included access actually used" is not safe to infer
//    from the ledger alone, so a human makes the call.
export async function handleRefund(purchaseId, refundEntity = {}) {
  return prisma.$transaction(async (tx) => {
    const purchase = await tx.purchase.findUnique({ where: { id: purchaseId } });
    if (!purchase || ['REFUNDED', 'PARTIALLY_REFUNDED'].includes(purchase.status)) {
      return purchase;
    }

    const isFullRefund = !refundEntity?.amount || refundEntity.amount >= purchase.amountPaise;
    const nextStatus = isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

    if (purchase.productCode === 'JOB_POST_45D') {
      const available = await getAvailableJobCredits(purchase.organisationId, tx);
      if (available >= 1) {
        await tx.jobPostingCreditLedger.create({
          data: {
            organisationId: purchase.organisationId,
            entryType: 'REVERSAL',
            amount: -1,
            purchaseId: purchase.id,
            reason: 'Refund issued for an unused job-posting credit.',
            idempotencyKey: `refund-reverse:${purchase.id}`,
          },
        });
        await tx.purchase.update({ where: { id: purchase.id }, data: { status: nextStatus, refundedAt: new Date() } });
      } else {
        await tx.purchase.update({
          where: { id: purchase.id },
          data: {
            status: nextStatus,
            refundedAt: new Date(),
            requiresManualReview: true,
            manualReviewReason: 'Refund received but the organisation credit balance suggests this credit may already be consumed. Verify manually before adjusting the ledger.',
          },
        });
      }
    } else {
      await tx.purchase.update({
        where: { id: purchase.id },
        data: {
          status: nextStatus,
          refundedAt: new Date(),
          requiresManualReview: true,
          manualReviewReason: 'Subscription refund requires manual entitlement review.',
        },
      });
    }

    await tx.auditLog.create({
      data: {
        organisationId: purchase.organisationId,
        action: 'billing.purchase.refunded',
        entityType: 'Purchase',
        entityId: purchase.id,
        metadata: {
          refundId: refundEntity?.id || null,
          amount: refundEntity?.amount ?? null,
          status: refundEntity?.status || null,
          isFullRefund,
        },
      },
    });

    return tx.purchase.findUnique({ where: { id: purchase.id } });
  });
}

export async function flagPurchaseDispute(purchaseId, disputeEntity = {}) {
  return prisma.$transaction(async (tx) => {
    const purchase = await tx.purchase.update({
      where: { id: purchaseId },
      data: {
        disputeStatus: disputeEntity?.status || 'created',
        requiresManualReview: true,
        manualReviewReason: 'Payment disputed/charged back - entitlement suspended pending review.',
      },
    });

    await tx.companySubscription.updateMany({
      where: { purchaseId: purchase.id, status: { notIn: ['CANCELLED', 'REFUNDED'] } },
      data: { status: 'SUSPENDED', suspendedAt: new Date(), suspensionReason: 'Payment disputed.' },
    });

    await tx.auditLog.create({
      data: {
        organisationId: purchase.organisationId,
        action: 'billing.purchase.disputed',
        entityType: 'Purchase',
        entityId: purchase.id,
        metadata: { disputeStatus: disputeEntity?.status || null },
      },
    });

    return purchase;
  });
}

// Raw webhook entrypoint (section 6). `rawBody` MUST be the unmodified
// request body Buffer (mounted via express.raw() ahead of express.json()
// in app.js) - signature verification over anything else (a re-serialized
// JSON.stringify, for example) would silently accept forged payloads.
export async function handleRazorpayWebhook({ rawBody, signature, eventIdHeader }) {
  if (!verifyWebhookSignature({ rawBody, signature })) {
    throw buildBillingError('Invalid Razorpay webhook signature.', 'INVALID_WEBHOOK_SIGNATURE', 400);
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    throw buildBillingError('Malformed webhook payload.', 'INVALID_WEBHOOK_PAYLOAD', 400);
  }

  const dedupeKey = eventIdHeader || hashRawBody(rawBody);
  const existing = await prisma.paymentWebhookEvent.findUnique({ where: { dedupeKey } });
  if (existing && existing.status === 'PROCESSED') {
    return { duplicate: true, eventId: existing.id };
  }

  const eventType = payload.event || 'unknown';
  const paymentEntity = payload.payload?.payment?.entity || null;
  const orderEntity = payload.payload?.order?.entity || null;
  const refundEntity = payload.payload?.refund?.entity || null;
  const disputeEntity = payload.payload?.dispute?.entity || null;

  // Deliberately minimal - never the full payload (section 6: "never log...
  // unnecessary billing personal information"). No card/bank/UPI/customer
  // PII fields are stored here.
  const summary = {
    paymentId: paymentEntity?.id || null,
    orderId: paymentEntity?.order_id || orderEntity?.id || null,
    refundId: refundEntity?.id || null,
    status: paymentEntity?.status || refundEntity?.status || disputeEntity?.status || null,
    amount: paymentEntity?.amount ?? orderEntity?.amount ?? refundEntity?.amount ?? null,
  };

  const webhookEventRow = existing || await prisma.paymentWebhookEvent.create({
    data: { eventType, dedupeKey, status: 'RECEIVED', summary },
  });

  let relatedPurchaseId = null;
  try {
    if (eventType === 'payment.captured' || eventType === 'order.paid') {
      const orderId = paymentEntity?.order_id || orderEntity?.id;
      const purchase = orderId ? await prisma.purchase.findUnique({ where: { providerOrderId: orderId } }) : null;
      if (purchase) {
        relatedPurchaseId = purchase.id;
        // Defense in depth beyond the webhook signature (which only proves
        // the delivery is genuinely from Razorpay, not that its amount
        // matches what WE expect for THIS purchase): refuse to activate on
        // a captured amount/currency mismatch, and flag for manual review
        // instead of silently activating or silently dropping the event.
        const amountMatches = paymentEntity?.amount == null || paymentEntity.amount === purchase.amountPaise;
        const currencyMatches = !paymentEntity?.currency || paymentEntity.currency === purchase.currency;
        if (!amountMatches || !currencyMatches) {
          await prisma.purchase.update({
            where: { id: purchase.id },
            data: { requiresManualReview: true, manualReviewReason: `Webhook payment amount/currency mismatch: expected ${purchase.amountPaise} ${purchase.currency}, received ${paymentEntity?.amount} ${paymentEntity?.currency}.` },
          });
        } else {
          const activated = await activatePurchase(purchase.id, { providerPaymentId: paymentEntity?.id }, { source: 'webhook' });
          await postActivationSideEffects(activated);
        }
      }
    } else if (eventType === 'payment.failed') {
      const orderId = paymentEntity?.order_id;
      const purchase = orderId ? await prisma.purchase.findUnique({ where: { providerOrderId: orderId } }) : null;
      if (purchase) {
        relatedPurchaseId = purchase.id;
        await markPurchaseFailed(purchase.id, paymentEntity?.error_description);
      }
    } else if (eventType === 'refund.processed' || eventType === 'refund.created') {
      const paymentId = refundEntity?.payment_id;
      const purchase = paymentId ? await prisma.purchase.findUnique({ where: { providerPaymentId: paymentId } }) : null;
      if (purchase) {
        relatedPurchaseId = purchase.id;
        await handleRefund(purchase.id, refundEntity);
      }
    } else if (eventType?.startsWith('payment.dispute')) {
      const paymentId = disputeEntity?.payment_id;
      const purchase = paymentId ? await prisma.purchase.findUnique({ where: { providerPaymentId: paymentId } }) : null;
      if (purchase) {
        relatedPurchaseId = purchase.id;
        await flagPurchaseDispute(purchase.id, disputeEntity);
      }
    }

    await prisma.paymentWebhookEvent.update({
      where: { id: webhookEventRow.id },
      data: {
        status: relatedPurchaseId ? 'PROCESSED' : 'IGNORED',
        relatedPurchaseId,
        processedAt: new Date(),
      },
    });
  } catch (error) {
    await prisma.paymentWebhookEvent.update({
      where: { id: webhookEventRow.id },
      data: {
        status: 'FAILED',
        processingError: String(error?.message || error).slice(0, 500),
        processedAt: new Date(),
      },
    });
    throw error;
  }

  return { duplicate: false, eventId: webhookEventRow.id };
}

export async function getBillingDashboard(actorUser, organisationId) {
  const context = await requireEnterprisePermission(actorUser, 'organisation.billing.read', organisationId);

  const [summary, creditBreakdown, purchases, invoices, recentLedger, billingProfile, jobs] = await Promise.all([
    getEntitlementSummary(context.organisationId),
    getJobCreditBreakdown(context.organisationId),
    prisma.purchase.findMany({
      where: { organisationId: context.organisationId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { invoice: true },
    }),
    prisma.invoice.findMany({ where: { organisationId: context.organisationId }, orderBy: { invoiceDate: 'desc' }, take: 50 }),
    prisma.jobPostingCreditLedger.findMany({ where: { organisationId: context.organisationId }, orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.companyBillingProfile.findUnique({ where: { organisationId: context.organisationId } }),
    prisma.job.findMany({
      where: { organisationId: context.organisationId, activatedAt: { not: null } },
      orderBy: { activeUntil: 'desc' },
      take: 50,
      select: { id: true, title: true, status: true, activatedAt: true, activeUntil: true, autoClosedAt: true },
    }),
  ]);

  return {
    ...summary,
    creditBreakdown,
    purchases,
    invoices,
    recentLedger,
    billingProfile,
    jobs,
  };
}

// B2 hardening, section 1: the ONLY billing-adjacent data a plain
// RECRUITER/HIRING_MANAGER may see. Deliberately hand-built (not a slice of
// getBillingDashboard's response) so a future field added to the full
// dashboard can never leak here by accident - no GSTIN, billing address,
// invoices, payment/provider references, purchase history, or credit-
// adjustment history, ever.
export async function getBillingEntitlementSummary(actorUser, organisationId) {
  const context = await requireEnterprisePermission(actorUser, 'organisation.billing.summary.read', organisationId);
  const summary = await getEntitlementSummary(context.organisationId);

  const daysRemaining = summary.subscriptionExpiresAt
    ? Math.ceil((new Date(summary.subscriptionExpiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
    : null;
  const renewalRequired = !summary.hasActiveAtsAccess
    || (daysRemaining != null && daysRemaining <= env.billingRenewalReminderDaysBefore);

  return {
    hasActiveAtsAccess: summary.hasActiveAtsAccess,
    hasActiveResumeDatabaseAccess: summary.hasActiveResumeDatabaseAccess,
    subscriptionExpiresAt: summary.subscriptionExpiresAt,
    availableJobCredits: summary.availableJobCredits,
    renewalRequired,
  };
}

export async function upsertBillingProfile(actorUser, organisationId, payload, requestMeta = {}) {
  const context = await requireEnterprisePermission(actorUser, 'organisation.billing.manage', organisationId);
  const existing = await prisma.companyBillingProfile.findUnique({ where: { organisationId: context.organisationId } });

  const profile = await prisma.companyBillingProfile.upsert({
    where: { organisationId: context.organisationId },
    update: { ...payload, updatedByUserId: actorUser.id },
    create: { ...payload, organisationId: context.organisationId, updatedByUserId: actorUser.id },
  });

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'billing.profile.update',
    entityType: 'CompanyBillingProfile',
    entityId: profile.id,
    beforeData: existing,
    afterData: profile,
    ...requestMeta,
  });

  return profile;
}

// "Cancel" means stop future renewal, NOT immediate suspension (B1
// hardening, section 6). This never revokes access itself - it only stamps
// status=CANCELLED + cancelledAt/cancellationReason; access continues to be
// judged the same way as always (entitlementService.isSubscriptionCurrentlyActive
// compares expiresAt to server time and only treats SUSPENDED/REFUNDED as
// immediate revocation), so the org keeps ATS/resume-database access and
// its included-but-unused credits right up to expiresAt, then lapses
// naturally like any other expiry - no separate "cancelled access ends
// now" code path exists to accidentally short-circuit that. There is no
// automatic refund here; see billingService.handleRefund for the
// separate, explicitly-triggered refund/reversal flow.
export async function cancelSubscription(actorUser, organisationId, reason, requestMeta = {}) {
  const context = await requireEnterprisePermission(actorUser, 'organisation.billing.manage', organisationId);
  const subscription = await prisma.companySubscription.findFirst({
    where: { organisationId: context.organisationId, status: { notIn: ['CANCELLED', 'SUSPENDED', 'REFUNDED', 'EXPIRED'] } },
    orderBy: { expiresAt: 'desc' },
  });
  if (!subscription) {
    throw buildBillingError('No active subscription to cancel.', 'SUBSCRIPTION_NOT_FOUND', 404);
  }

  const updated = await prisma.companySubscription.update({
    where: { id: subscription.id },
    data: { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: reason },
  });

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'billing.subscription.cancel',
    entityType: 'CompanySubscription',
    entityId: subscription.id,
    beforeData: subscription,
    afterData: updated,
    metadata: { reason },
    ...requestMeta,
  });

  return updated;
}
