import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import { env } from '../config/env.js';

let cachedClient = null;

function buildProviderDisabledError() {
  const error = new Error('Razorpay is not enabled. Set RAZORPAY_ENABLED=true and configure RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET.');
  error.statusCode = 503;
  error.code = 'PAYMENT_PROVIDER_DISABLED';
  return error;
}

function getClient() {
  if (!env.razorpayEnabled) {
    throw buildProviderDisabledError();
  }
  if (!cachedClient) {
    cachedClient = new Razorpay({ key_id: env.razorpayKeyId, key_secret: env.razorpayKeySecret });
  }
  return cachedClient;
}

export function isRazorpayEnabled() {
  return env.razorpayEnabled;
}

export function getPublicKeyId() {
  return env.razorpayKeyId || null;
}

export function getConfiguredButtonIds() {
  return { ...env.razorpayButtonIds };
}

// Server-side Order creation (section 5/6). `amountPaise` and `notes` must
// always be resolved from the server-authoritative ProductPlan + the
// authenticated request context - never accepted from the client - so the
// Order (and everything downstream: signature verification, webhook
// correlation) is bound to a real internal Purchase/company/user from the
// moment it is created, which is exactly the property static Payment
// Buttons cannot provide.
export async function createRazorpayOrder({ amountPaise, currency = 'INR', receipt, notes = {} }) {
  const client = getClient();
  return client.orders.create({
    amount: amountPaise,
    currency,
    receipt,
    notes,
    payment_capture: 1,
  });
}

export async function fetchRazorpayPayment(paymentId) {
  const client = getClient();
  return client.payments.fetch(paymentId);
}

export async function fetchRazorpayOrder(orderId) {
  const client = getClient();
  return client.orders.fetch(orderId);
}

function timingSafeEqualHex(expectedHex, actualHex) {
  if (typeof expectedHex !== 'string' || typeof actualHex !== 'string') return false;
  if (expectedHex.length !== actualHex.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expectedHex, 'hex'), Buffer.from(actualHex, 'hex'));
  } catch {
    return false;
  }
}

// Standard Checkout payment-signature verification, per Razorpay's
// documented algorithm: hmac_sha256(order_id + "|" + payment_id, key_secret).
// This alone is NOT sufficient to grant entitlement (a client could forge a
// plausible-looking signature only if it had the secret, which it never
// does client-side, but this check still only proves "Razorpay produced
// this pairing" - not "the payment is captured/paid"). Callers must also
// fetch the payment server-side and check its `status` before activating.
export function verifyPaymentSignature({ orderId, paymentId, signature }) {
  if (!env.razorpayKeySecret || !orderId || !paymentId || !signature) return false;
  const expected = crypto.createHmac('sha256', env.razorpayKeySecret).update(`${orderId}|${paymentId}`).digest('hex');
  return timingSafeEqualHex(expected, signature);
}

// Webhook signature verification MUST run over the unmodified raw request
// body bytes (section 6) - the caller is responsible for mounting this
// route with express.raw() ahead of the global JSON body parser.
export function verifyWebhookSignature({ rawBody, signature }) {
  if (!env.razorpayWebhookSecret || !signature || !rawBody) return false;
  const expected = crypto.createHmac('sha256', env.razorpayWebhookSecret).update(rawBody).digest('hex');
  return timingSafeEqualHex(expected, signature);
}

export function hashRawBody(rawBody) {
  return `sha256:${crypto.createHash('sha256').update(rawBody).digest('hex')}`;
}

// Mutable-object re-export of the functions above, for test-time mocking.
// Named ESM exports are live but non-reassignable bindings (`export
// function foo(){}` cannot be monkeypatched from another module, unlike
// this codebase's usual `prisma.model.method = fn` mock pattern, since
// `prisma` is a real mutable object). Security-critical call sites that
// need to be unit-testable without real Razorpay credentials (e.g.
// adminBillingService.manuallyVerifyPurchase) should call through this
// object instead of importing the bare function directly.
export const razorpayGateway = {
  isRazorpayEnabled,
  getPublicKeyId,
  getConfiguredButtonIds,
  createRazorpayOrder,
  fetchRazorpayPayment,
  fetchRazorpayOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
  hashRawBody,
};
