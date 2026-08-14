import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verifyPaymentSignature, verifyWebhookSignature, hashRawBody } from '../services/razorpayService.js';
import { env } from '../config/env.js';

// backend/.env.test provides deterministic dummy RAZORPAY_KEY_SECRET /
// RAZORPAY_WEBHOOK_SECRET values for exactly this test file - no live
// Razorpay account or Test Mode credentials are needed to verify the HMAC
// math itself is correct (section 6/17: "signature verification",
// "webhook signature").
test('verifyPaymentSignature accepts a correctly-computed order_id|payment_id HMAC and rejects everything else', () => {
  const orderId = 'order_TestOrder123';
  const paymentId = 'pay_TestPayment456';
  const validSignature = crypto.createHmac('sha256', env.razorpayKeySecret).update(`${orderId}|${paymentId}`).digest('hex');

  assert.equal(verifyPaymentSignature({ orderId, paymentId, signature: validSignature }), true);
  assert.equal(verifyPaymentSignature({ orderId, paymentId, signature: 'a'.repeat(64) }), false);
  assert.equal(verifyPaymentSignature({ orderId: 'order_Different', paymentId, signature: validSignature }), false);
  assert.equal(verifyPaymentSignature({ orderId, paymentId: 'pay_Different', signature: validSignature }), false);
  assert.equal(verifyPaymentSignature({ orderId, paymentId, signature: null }), false);
});

test('verifyWebhookSignature verifies over the raw body bytes and rejects a tampered body or wrong signature', () => {
  const rawBody = Buffer.from(JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_1' } } } }));
  const validSignature = crypto.createHmac('sha256', env.razorpayWebhookSecret).update(rawBody).digest('hex');

  assert.equal(verifyWebhookSignature({ rawBody, signature: validSignature }), true);

  const tamperedBody = Buffer.from(JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_ATTACKER_MODIFIED' } } } }));
  assert.equal(verifyWebhookSignature({ rawBody: tamperedBody, signature: validSignature }), false);
  assert.equal(verifyWebhookSignature({ rawBody, signature: 'deadbeef' }), false);
  assert.equal(verifyWebhookSignature({ rawBody, signature: null }), false);
});

test('hashRawBody is a stable, deterministic dedupe-key fallback for webhooks with no event-id header', () => {
  const rawBody = Buffer.from('{"event":"payment.captured"}');
  assert.equal(hashRawBody(rawBody), hashRawBody(Buffer.from('{"event":"payment.captured"}')));
  assert.notEqual(hashRawBody(rawBody), hashRawBody(Buffer.from('{"event":"payment.failed"}')));
  assert.match(hashRawBody(rawBody), /^sha256:[0-9a-f]{64}$/);
});
