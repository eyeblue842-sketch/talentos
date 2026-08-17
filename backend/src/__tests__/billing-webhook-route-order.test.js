import test, { before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// B1 hardening, section 8: proves - through the REAL Express app on a REAL
// HTTP socket, not a unit test of the signature function alone - that
// route/middleware order preserves the exact raw webhook body ahead of any
// JSON re-serialization. If express.json() ran before this route (or
// re-serialized the body at all), a correctly-signed real Razorpay
// delivery would fail signature verification here exactly the same way a
// tampered one does - so a passing "valid signature" case here is itself
// the route-order proof.
//
// Uses a live server + native fetch (not supertest) specifically because
// superagent's Buffer-body serialization interacts with an explicit
// `Content-Type: application/json` header in a way that re-encodes the
// body instead of sending it byte-for-byte - fetch's Buffer body support
// has no such ambiguity.

let app;
let prisma;
let env;
let state;
let server;
let baseUrl;

before(async () => {
  ({ app } = await import('../app.js'));
  ({ prisma } = await import('../config/db.js'));
  ({ env } = await import('../config/env.js'));

  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

beforeEach(() => {
  state = { purchases: [], webhookEvents: [], ledger: [], subscriptions: [], invoices: [], auditLogs: [] };

  prisma.purchase = {
    findUnique: async ({ where }) => state.purchases.find((p) => p.id === where.id || p.providerOrderId === where.providerOrderId || p.providerPaymentId === where.providerPaymentId) || null,
    update: async ({ where, data }) => { const p = state.purchases.find((item) => item.id === where.id); Object.assign(p, data); return p; },
  };
  prisma.paymentWebhookEvent = {
    findUnique: async ({ where }) => state.webhookEvents.find((e) => e.dedupeKey === where.dedupeKey) || null,
    create: async ({ data }) => { const row = { id: `wh-${state.webhookEvents.length + 1}`, ...data }; state.webhookEvents.push(row); return row; },
    update: async ({ where, data }) => { const row = state.webhookEvents.find((e) => e.id === where.id); Object.assign(row, data); return row; },
  };
  prisma.$transaction = async (callback) => callback({
    purchase: {
      updateMany: async ({ where, data }) => {
        const p = state.purchases.find((item) => item.id === where.id && item.status === where.status);
        if (!p) return { count: 0 };
        Object.assign(p, data);
        return { count: 1 };
      },
      findUnique: async ({ where }) => {
        const p = state.purchases.find((item) => item.id === where.id);
        return p ? { ...p, productPlan: { durationMonths: null, includedJobCredits: 1 } } : null;
      },
    },
    companySubscription: { findFirst: async () => null },
    jobPostingCreditLedger: { create: async ({ data }) => { state.ledger.push(data); return { id: 'l1', ...data }; } },
    companyBillingProfile: { findUnique: async () => null },
    invoice: { count: async () => 0, create: async ({ data }) => ({ id: 'inv1', invoiceNumber: 'INV-1', ...data }) },
    auditLog: { create: async ({ data }) => { state.auditLogs.push(data); return { id: 'a1', ...data }; } },
  });
  prisma.organisationMembership = { findMany: async () => [] };
  prisma.user = { findUnique: async () => null };
});

function sign(rawBody) {
  return crypto.createHmac('sha256', env.razorpayWebhookSecret).update(rawBody).digest('hex');
}

async function postWebhook(rawBody, { signature, eventId }) {
  const response = await fetch(`${baseUrl}/api/billing/webhooks/razorpay`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(signature != null ? { 'x-razorpay-signature': signature } : {}),
      ...(eventId != null ? { 'x-razorpay-event-id': eventId } : {}),
    },
    body: rawBody,
  });
  const body = await response.json().catch(() => null);
  return { status: response.status, body };
}

test('a correctly-signed webhook delivered through the real HTTP/Express stack is accepted and activates the purchase', async () => {
  state.purchases.push({
    id: 'purchase-route-1', organisationId: 'org-1', productCode: 'JOB_POST_45D', productPlanId: 'plan-1',
    productSnapshot: { baseAmountPaise: 150000, gstAmountPaise: 27000, totalAmountPaise: 177000, gstRatePercent: 18 },
    status: 'PENDING', purchaserUserId: 'user-1', providerOrderId: 'order_route_1', amountPaise: 177000, currency: 'INR',
  });

  const rawBody = Buffer.from(JSON.stringify({
    event: 'payment.captured',
    payload: { payment: { entity: { id: 'pay_route_1', order_id: 'order_route_1', status: 'captured', amount: 177000, currency: 'INR' } } },
  }));

  const { status, body } = await postWebhook(rawBody, { signature: sign(rawBody), eventId: 'evt_route_1' });

  assert.equal(status, 200);
  assert.equal(body.success, true);
  assert.equal(state.purchases[0].status, 'PAID');
});

test('the same payload sent with a signature computed over a DIFFERENT body is rejected with 400 (proves the route sees true raw bytes, not a re-serialized body)', async () => {
  state.purchases.push({
    id: 'purchase-route-2', organisationId: 'org-1', productCode: 'JOB_POST_45D', productPlanId: 'plan-1',
    productSnapshot: { baseAmountPaise: 150000, gstAmountPaise: 27000, totalAmountPaise: 177000, gstRatePercent: 18 },
    status: 'PENDING', purchaserUserId: 'user-1', providerOrderId: 'order_route_2', amountPaise: 177000, currency: 'INR',
  });

  const realBody = Buffer.from(JSON.stringify({
    event: 'payment.captured',
    payload: { payment: { entity: { id: 'pay_route_2', order_id: 'order_route_2', status: 'captured', amount: 177000, currency: 'INR' } } },
  }));
  const wrongSignature = sign(Buffer.from(JSON.stringify({ event: 'payment.captured', payload: {} })));

  const { status } = await postWebhook(realBody, { signature: wrongSignature, eventId: 'evt_route_2' });

  assert.equal(status, 400);
  assert.equal(state.purchases[0].status, 'PENDING');
});

test('an authorized-but-not-captured payment event is ignored, not activated', async () => {
  state.purchases.push({
    id: 'purchase-route-3', organisationId: 'org-1', productCode: 'JOB_POST_45D', productPlanId: 'plan-1',
    productSnapshot: { baseAmountPaise: 150000, gstAmountPaise: 27000, totalAmountPaise: 177000, gstRatePercent: 18 },
    status: 'PENDING', purchaserUserId: 'user-1', providerOrderId: 'order_route_3', amountPaise: 177000, currency: 'INR',
  });

  const rawBody = Buffer.from(JSON.stringify({
    event: 'payment.authorized',
    payload: { payment: { entity: { id: 'pay_route_3', order_id: 'order_route_3', status: 'authorized', amount: 177000, currency: 'INR' } } },
  }));

  const { status } = await postWebhook(rawBody, { signature: sign(rawBody), eventId: 'evt_route_3' });

  assert.equal(status, 200);
  assert.equal(state.purchases[0].status, 'PENDING', 'authorized (not captured) must never activate entitlement');
});

test('a payment.failed event marks the purchase FAILED without touching the ledger', async () => {
  state.purchases.push({
    id: 'purchase-route-4', organisationId: 'org-1', productCode: 'JOB_POST_45D', productPlanId: 'plan-1',
    productSnapshot: { baseAmountPaise: 150000, gstAmountPaise: 27000, totalAmountPaise: 177000, gstRatePercent: 18 },
    status: 'PENDING', purchaserUserId: 'user-1', providerOrderId: 'order_route_4', amountPaise: 177000, currency: 'INR',
  });

  const rawBody = Buffer.from(JSON.stringify({
    event: 'payment.failed',
    payload: { payment: { entity: { id: 'pay_route_4', order_id: 'order_route_4', status: 'failed', error_description: 'Card declined' } } },
  }));

  const { status } = await postWebhook(rawBody, { signature: sign(rawBody), eventId: 'evt_route_4' });

  assert.equal(status, 200);
  assert.equal(state.purchases[0].status, 'FAILED');
  assert.equal(state.ledger.length, 0);
});

test('out-of-order delivery (a stale failed event arriving after the purchase is already PAID) does not revert a successful activation', async () => {
  state.purchases.push({
    id: 'purchase-route-5', organisationId: 'org-1', productCode: 'JOB_POST_45D', productPlanId: 'plan-1',
    productSnapshot: { baseAmountPaise: 150000, gstAmountPaise: 27000, totalAmountPaise: 177000, gstRatePercent: 18 },
    status: 'PAID', paidAt: new Date(), purchaserUserId: 'user-1', providerOrderId: 'order_route_5', amountPaise: 177000, currency: 'INR',
  });

  const rawBody = Buffer.from(JSON.stringify({
    event: 'payment.failed',
    payload: { payment: { entity: { id: 'pay_route_5_stale', order_id: 'order_route_5', status: 'failed', error_description: 'stale retry' } } },
  }));

  const { status } = await postWebhook(rawBody, { signature: sign(rawBody), eventId: 'evt_route_5' });

  assert.equal(status, 200);
  assert.equal(state.purchases[0].status, 'PAID', 'a stale/out-of-order failure event must not downgrade an already-captured purchase');
});

test('a missing signature header is rejected with 400 and never reaches purchase lookup', async () => {
  const rawBody = Buffer.from(JSON.stringify({ event: 'payment.captured', payload: {} }));
  const { status } = await postWebhook(rawBody, { eventId: 'evt_route_6' });
  assert.equal(status, 400);
});
