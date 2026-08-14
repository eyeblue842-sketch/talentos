import test, { before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

let prisma;
let env;
let activatePurchase;
let handleRazorpayWebhook;

let state;

function buildFakeTx() {
  return {
    purchase: {
      updateMany: async ({ where, data }) => {
        const purchase = state.purchases.find((p) => p.id === where.id);
        if (!purchase || purchase.status !== where.status) return { count: 0 };
        Object.assign(purchase, data);
        return { count: 1 };
      },
      findUnique: async ({ where, include }) => {
        const purchase = state.purchases.find((p) => p.id === where.id);
        if (!purchase) return null;
        const result = { ...purchase };
        if (include?.productPlan) result.productPlan = state.productPlans.find((p) => p.id === purchase.productPlanId) || null;
        if (include?.subscription) result.subscription = state.subscriptions.find((s) => s.purchaseId === purchase.id) || null;
        if (include?.invoice) result.invoice = state.invoices.find((i) => i.purchaseId === purchase.id) || null;
        return result;
      },
    },
    companySubscription: {
      findFirst: async ({ where }) => state.subscriptions.find((s) => s.organisationId === where.organisationId) || null,
      create: async ({ data }) => {
        const sub = { id: `sub-${state.subscriptions.length + 1}`, ...data };
        state.subscriptions.push(sub);
        return sub;
      },
    },
    jobPostingCreditLedger: {
      create: async ({ data }) => {
        const entry = { id: `ledger-${state.ledger.length + 1}`, ...data };
        state.ledger.push(entry);
        return entry;
      },
    },
    companyBillingProfile: {
      findUnique: async () => null,
    },
    invoice: {
      count: async () => state.invoices.length,
      create: async ({ data }) => {
        const invoice = { id: `inv-${state.invoices.length + 1}`, invoiceNumber: `INV-TEST-${state.invoices.length + 1}`, ...data };
        state.invoices.push(invoice);
        return invoice;
      },
    },
    auditLog: {
      create: async ({ data }) => {
        state.auditLogs.push(data);
        return { id: `audit-${state.auditLogs.length}`, ...data };
      },
    },
  };
}

before(async () => {
  ({ prisma } = await import('../config/db.js'));
  ({ env } = await import('../config/env.js'));
  ({ activatePurchase, handleRazorpayWebhook } = await import('../services/billingService.js'));
});

beforeEach(() => {
  state = { purchases: [], productPlans: [], subscriptions: [], ledger: [], invoices: [], auditLogs: [], webhookEvents: [] };

  prisma.$transaction = async (fn) => fn(buildFakeTx());
  prisma.purchase = {
    findUnique: async ({ where }) => state.purchases.find((p) => p.id === where.id || p.providerOrderId === where.providerOrderId) || null,
    update: async ({ where, data }) => {
      const purchase = state.purchases.find((p) => p.id === where.id);
      Object.assign(purchase, data);
      return purchase;
    },
  };
  prisma.paymentWebhookEvent = {
    findUnique: async ({ where }) => state.webhookEvents.find((e) => e.dedupeKey === where.dedupeKey) || null,
    create: async ({ data }) => {
      const row = { id: `webhook-${state.webhookEvents.length + 1}`, ...data };
      state.webhookEvents.push(row);
      return row;
    },
    update: async ({ where, data }) => {
      const row = state.webhookEvents.find((e) => e.id === where.id);
      Object.assign(row, data);
      return row;
    },
  };
  // postActivationSideEffects (best-effort notification/email fan-out) runs
  // after every activation - stub these so it never attempts a real network
  // call against the shared Supabase test database.
  prisma.organisationMembership = { findMany: async () => [] };
  prisma.user = { findUnique: async () => null };

  state.productPlans.push({
    id: 'plan-ats-6m', code: 'ATS_DB_6M', version: 1, durationMonths: 6, includedJobCredits: 3,
  });
  state.productPlans.push({
    id: 'plan-job-post', code: 'JOB_POST_45D', version: 1, durationMonths: null, includedJobCredits: 1,
  });
});

test('activatePurchase on a subscription product creates an ACTIVE CompanySubscription with the correct expiry and grants included credits', async () => {
  state.purchases.push({
    id: 'purchase-1', organisationId: 'org-1', productCode: 'ATS_DB_6M', productPlanId: 'plan-ats-6m',
    productSnapshot: { baseAmountPaise: 5000000, gstAmountPaise: 900000, totalAmountPaise: 5900000, gstRatePercent: 18 },
    status: 'PENDING', purchaserUserId: 'user-1',
  });

  const result = await activatePurchase('purchase-1', { providerPaymentId: 'pay_1' });

  assert.equal(result.status, 'PAID');
  assert.equal(state.subscriptions.length, 1);
  const [subscription] = state.subscriptions;
  assert.equal(subscription.status, 'ACTIVE');
  assert.equal(subscription.atsAccess, true);
  assert.equal(subscription.resumeDatabaseAccess, true);
  assert.equal(subscription.includedJobCredits, 3);

  const grant = state.ledger.find((entry) => entry.entryType === 'GRANT' && entry.source === 'SUBSCRIPTION_GRANT');
  assert.ok(grant, 'expected a SUBSCRIPTION_GRANT ledger row');
  assert.equal(grant.amount, 3);
  assert.equal(grant.expiresAt.getTime(), subscription.expiresAt.getTime());

  assert.equal(state.invoices.length, 1);
  assert.equal(state.auditLogs.some((log) => log.action === 'billing.purchase.activated'), true);
});

test('activatePurchase on JOB_POST_45D grants exactly 1 purchased credit that does NOT expire (B1 hardening section 5: the unconfirmed 12-month assumption was removed)', async () => {
  state.purchases.push({
    id: 'purchase-2', organisationId: 'org-1', productCode: 'JOB_POST_45D', productPlanId: 'plan-job-post',
    productSnapshot: { baseAmountPaise: 150000, gstAmountPaise: 27000, totalAmountPaise: 177000, gstRatePercent: 18 },
    status: 'PENDING', purchaserUserId: 'user-1',
  });

  await activatePurchase('purchase-2', { providerPaymentId: 'pay_2' });

  const grant = state.ledger.find((entry) => entry.entryType === 'GRANT' && entry.source === 'PURCHASED_CREDIT');
  assert.ok(grant);
  assert.equal(grant.amount, 1);
  assert.equal(grant.expiresAt, null, 'purchased credits must not expire while BILLING_PURCHASED_CREDIT_EXPIRY_ENABLED is unset/false');
  assert.equal(state.subscriptions.length, 0, 'a standalone job-credit purchase must not create a subscription');
});

test('renewal (early, before the current term ends) extends the access window from the old expiresAt and gates the new credit grant with validFrom so it cannot stack with the still-valid old credits', async () => {
  const oldExpiresAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000); // 5 days from now
  state.subscriptions.push({
    id: 'sub-existing', organisationId: 'org-1', purchaseId: 'purchase-old', status: 'ACTIVE', expiresAt: oldExpiresAt,
  });
  state.purchases.push({
    id: 'purchase-renewal', organisationId: 'org-1', productCode: 'ATS_DB_6M', productPlanId: 'plan-ats-6m',
    productSnapshot: { baseAmountPaise: 5000000, gstAmountPaise: 900000, totalAmountPaise: 5900000, gstRatePercent: 18 },
    status: 'PENDING', purchaserUserId: 'user-1',
  });

  await activatePurchase('purchase-renewal', { providerPaymentId: 'pay_renewal' });

  const newSubscription = state.subscriptions.find((sub) => sub.id !== 'sub-existing');
  assert.equal(newSubscription.startsAt.getTime(), oldExpiresAt.getTime(), 'early renewal must start after the current paid term ends');

  const newGrant = state.ledger.find((entry) => entry.entryType === 'GRANT' && entry.subscriptionId === newSubscription.id);
  assert.ok(newGrant);
  assert.equal(newGrant.validFrom.getTime(), oldExpiresAt.getTime(), 'the fresh included quota must not become usable before the old term ends');
});

test('activatePurchase is idempotent: a second call for an already-PAID purchase does not grant a second time', async () => {
  state.purchases.push({
    id: 'purchase-3', organisationId: 'org-1', productCode: 'JOB_POST_45D', productPlanId: 'plan-job-post',
    productSnapshot: { baseAmountPaise: 150000, gstAmountPaise: 27000, totalAmountPaise: 177000, gstRatePercent: 18 },
    status: 'PENDING', purchaserUserId: 'user-1',
  });

  await activatePurchase('purchase-3', { providerPaymentId: 'pay_3' });
  assert.equal(state.ledger.length, 1);

  // Simulates the webhook arriving after the checkout-verify fast path
  // already activated the same purchase (section 6: "duplicate webhook
  // protection", "safe retry behaviour").
  await activatePurchase('purchase-3', { providerPaymentId: 'pay_3' });
  assert.equal(state.ledger.length, 1, 'no second GRANT row should be created for an already-PAID purchase');
  assert.equal(state.invoices.length, 1, 'no second invoice should be created');
});

function signWebhookBody(rawBody) {
  return crypto.createHmac('sha256', env.razorpayWebhookSecret).update(rawBody).digest('hex');
}

test('handleRazorpayWebhook rejects an invalid signature before touching any purchase or writing any event row', async () => {
  const rawBody = Buffer.from(JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_x', order_id: 'order_x' } } } }));

  await assert.rejects(
    () => handleRazorpayWebhook({ rawBody, signature: 'not-a-real-signature', eventIdHeader: 'evt_1' }),
    (error) => error.code === 'INVALID_WEBHOOK_SIGNATURE' && error.statusCode === 400,
  );
  assert.equal(state.webhookEvents.length, 0);
});

test('handleRazorpayWebhook activates the matching purchase on payment.captured and is a no-op replay the second time', async () => {
  state.purchases.push({
    id: 'purchase-4', organisationId: 'org-1', productCode: 'JOB_POST_45D', productPlanId: 'plan-job-post',
    productSnapshot: { baseAmountPaise: 150000, gstAmountPaise: 27000, totalAmountPaise: 177000, gstRatePercent: 18 },
    status: 'PENDING', purchaserUserId: 'user-1', providerOrderId: 'order_webhook_1', amountPaise: 177000, currency: 'INR',
  });

  const rawBody = Buffer.from(JSON.stringify({
    event: 'payment.captured',
    payload: { payment: { entity: { id: 'pay_webhook_1', order_id: 'order_webhook_1', status: 'captured', amount: 177000, currency: 'INR' } } },
  }));
  const signature = signWebhookBody(rawBody);

  const first = await handleRazorpayWebhook({ rawBody, signature, eventIdHeader: 'evt_webhook_1' });
  assert.equal(first.duplicate, false);
  assert.equal(state.purchases[0].status, 'PAID');
  assert.equal(state.ledger.length, 1);
  assert.equal(state.webhookEvents.length, 1);
  assert.equal(state.webhookEvents[0].status, 'PROCESSED');

  // Razorpay webhook replay (network retry, at-least-once delivery) -
  // section 6/14/17: "webhook replay: no duplicate effect".
  const second = await handleRazorpayWebhook({ rawBody, signature, eventIdHeader: 'evt_webhook_1' });
  assert.equal(second.duplicate, true);
  assert.equal(state.ledger.length, 1, 'replay must not grant a second credit');
  assert.equal(state.webhookEvents.length, 1, 'replay must not create a second webhook-event row');
});

test('handleRazorpayWebhook refuses to activate on a captured amount mismatch and flags the purchase for manual review instead (section 7)', async () => {
  state.purchases.push({
    id: 'purchase-5', organisationId: 'org-1', productCode: 'JOB_POST_45D', productPlanId: 'plan-job-post',
    productSnapshot: { baseAmountPaise: 150000, gstAmountPaise: 27000, totalAmountPaise: 177000, gstRatePercent: 18 },
    status: 'PENDING', purchaserUserId: 'user-1', providerOrderId: 'order_webhook_mismatch', currency: 'INR', amountPaise: 177000,
  });

  const rawBody = Buffer.from(JSON.stringify({
    event: 'payment.captured',
    // Captured for a different amount than this purchase's snapshot -
    // must never be treated as "close enough".
    payload: { payment: { entity: { id: 'pay_mismatch', order_id: 'order_webhook_mismatch', status: 'captured', amount: 1, currency: 'INR' } } },
  }));
  const signature = signWebhookBody(rawBody);

  await handleRazorpayWebhook({ rawBody, signature, eventIdHeader: 'evt_mismatch_1' });

  const purchase = state.purchases.find((p) => p.id === 'purchase-5');
  assert.equal(purchase.status, 'PENDING', 'a mismatched amount must never flip status to PAID');
  assert.equal(purchase.requiresManualReview, true);
  assert.equal(state.ledger.length, 0, 'no credit may be granted on a mismatched activation attempt');
});
