import test, { before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// B1 hardening, section 7: the admin manual-verify path must ALWAYS confirm
// with Razorpay server-side before activating - it must never trust an
// admin-entered reference alone. razorpayGateway.fetchRazorpayPayment is
// mocked here (a plain mutable object, same pattern this codebase already
// uses for prisma.model.method) since real Razorpay credentials are never
// available in this test environment and must never be faked; this proves
// the verification LOGIC (status/order/amount/currency checks) is
// correctly wired, not the real Razorpay network call itself.

let prisma;
let razorpayGateway;
let manuallyVerifyPurchase;
let state;

before(async () => {
  ({ prisma } = await import('../config/db.js'));
  ({ razorpayGateway } = await import('../services/razorpayService.js'));
  ({ manuallyVerifyPurchase } = await import('../services/adminBillingService.js'));
});

beforeEach(() => {
  state = { purchases: [] };
  prisma.purchase = {
    findUnique: async ({ where }) => state.purchases.find((p) => p.id === where.id) || null,
    updateMany: async ({ where, data }) => {
      const purchase = state.purchases.find((p) => p.id === where.id && p.status === where.status);
      if (!purchase) return { count: 0 };
      Object.assign(purchase, data);
      return { count: 1 };
    },
  };
  prisma.$transaction = async (callback) => callback(prisma);
  prisma.companySubscription = { findFirst: async () => null, create: async ({ data }) => ({ id: 'sub-1', ...data }) };
  prisma.jobPostingCreditLedger = { create: async ({ data }) => ({ id: 'ledger-1', ...data }) };
  prisma.companyBillingProfile = { findUnique: async () => null };
  prisma.invoice = { count: async () => 0, create: async ({ data }) => ({ id: 'inv-1', invoiceNumber: 'INV-TEST-1', ...data }) };
  prisma.auditLog = { create: async ({ data }) => ({ id: 'audit-1', ...data }) };
  prisma.organisationMembership = { findMany: async () => [] };
  prisma.user = { findUnique: async () => null };
  prisma.paymentWebhookEvent = { findUnique: async () => null };
});

function actor() {
  return { id: 'platform-admin-1', role: 'ADMIN' };
}

test('refuses to activate when Razorpay reports the payment as not captured', async () => {
  state.purchases.push({
    id: 'purchase-1', organisationId: 'org-1', status: 'PENDING', amountPaise: 177000, currency: 'INR',
    providerOrderId: 'order_1', productCode: 'JOB_POST_45D',
  });
  razorpayGateway.fetchRazorpayPayment = async () => ({ id: 'pay_1', status: 'authorized', order_id: 'order_1', amount: 177000, currency: 'INR' });

  await assert.rejects(
    () => manuallyVerifyPurchase(actor(), 'purchase-1', 'pay_1', 'reconciling missed webhook'),
    (error) => error.code === 'PAYMENT_NOT_CAPTURED',
  );
  assert.equal(state.purchases[0].status, 'PENDING');
});

test('refuses to activate when the payment belongs to a different order', async () => {
  state.purchases.push({
    id: 'purchase-2', organisationId: 'org-1', status: 'PENDING', amountPaise: 177000, currency: 'INR',
    providerOrderId: 'order_expected', productCode: 'JOB_POST_45D',
  });
  razorpayGateway.fetchRazorpayPayment = async () => ({ id: 'pay_2', status: 'captured', order_id: 'order_DIFFERENT', amount: 177000, currency: 'INR' });

  await assert.rejects(
    () => manuallyVerifyPurchase(actor(), 'purchase-2', 'pay_2', 'reconciling missed webhook'),
    (error) => error.code === 'ORDER_MISMATCH',
  );
});

test('refuses to activate when the captured amount does not match the purchase snapshot', async () => {
  state.purchases.push({
    id: 'purchase-3', organisationId: 'org-1', status: 'PENDING', amountPaise: 177000, currency: 'INR',
    providerOrderId: 'order_3', productCode: 'JOB_POST_45D',
  });
  razorpayGateway.fetchRazorpayPayment = async () => ({ id: 'pay_3', status: 'captured', order_id: 'order_3', amount: 100, currency: 'INR' });

  await assert.rejects(
    () => manuallyVerifyPurchase(actor(), 'purchase-3', 'pay_3', 'reconciling missed webhook'),
    (error) => error.code === 'AMOUNT_MISMATCH',
  );
});

test('activates only once Razorpay confirms captured status, matching order, and matching amount/currency', async () => {
  state.purchases.push({
    id: 'purchase-4', organisationId: 'org-1', status: 'PENDING', amountPaise: 177000, currency: 'INR',
    providerOrderId: 'order_4', productCode: 'JOB_POST_45D', productPlanId: 'plan-1',
    productSnapshot: { baseAmountPaise: 150000, gstAmountPaise: 27000, totalAmountPaise: 177000, gstRatePercent: 18 },
    purchaserUserId: 'user-1',
  });
  prisma.purchase.findUnique = async ({ where }) => {
    const purchase = state.purchases.find((p) => p.id === where.id);
    if (!purchase) return null;
    return { ...purchase, productPlan: { id: 'plan-1', durationMonths: null, includedJobCredits: 1 } };
  };
  razorpayGateway.fetchRazorpayPayment = async () => ({ id: 'pay_4', status: 'captured', order_id: 'order_4', amount: 177000, currency: 'INR' });

  const result = await manuallyVerifyPurchase(actor(), 'purchase-4', 'pay_4', 'reconciling missed webhook');
  assert.equal(result.status, 'PAID');
});
