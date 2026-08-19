import test, { before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { companyBillingProfileSchema } from '@careeriz/shared';

// B1 hardening, section 9: GST/invoice safety - never assume intra-state
// when jurisdiction data is missing; total tax/payable always reconcile
// exactly in paise; GSTIN format and state-code consistency validated.

let prisma;
let env;
let activatePurchase;
let state;
let originalSellerStateCode;

before(async () => {
  ({ prisma } = await import('../config/db.js'));
  ({ env } = await import('../config/env.js'));
  ({ activatePurchase } = await import('../services/billingService.js'));
  originalSellerStateCode = env.billingSellerStateCode;
});

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
        return result;
      },
    },
    companySubscription: { findFirst: async () => null, create: async ({ data }) => ({ id: 'sub-1', ...data }) },
    jobPostingCreditLedger: { create: async ({ data }) => ({ id: 'ledger-1', ...data }) },
    companyBillingProfile: { findUnique: async () => state.billingProfile },
    invoice: {
      count: async () => state.invoices.length,
      create: async ({ data }) => { const invoice = { id: `inv-${state.invoices.length + 1}`, ...data }; state.invoices.push(invoice); return invoice; },
    },
    auditLog: { create: async () => ({}) },
  };
}

beforeEach(() => {
  state = { purchases: [], productPlans: [{ id: 'plan-ats-6m', code: 'ATS_DB_6M', durationMonths: 6, includedJobCredits: 3 }], invoices: [], billingProfile: null };
  prisma.$transaction = async (fn) => fn(buildFakeTx());
  prisma.purchase = { findUnique: async ({ where }) => state.purchases.find((p) => p.id === where.id) || null };
  env.billingSellerStateCode = '27'; // default: seller in Maharashtra for these tests
});

function pushPurchase(id) {
  state.purchases.push({
    id, organisationId: 'org-1', productCode: 'ATS_DB_6M', productPlanId: 'plan-ats-6m', purchaserUserId: 'user-1',
    productSnapshot: { baseAmountPaise: 5000000, gstAmountPaise: 900000, totalAmountPaise: 5900000, gstRatePercent: 18 },
    status: 'PENDING',
  });
}

test('intra-state (customer state code matches seller): splits GST into equal CGST+SGST, invoice is FINAL', async () => {
  state.billingProfile = { stateCode: '27' };
  pushPurchase('p1');
  await activatePurchase('p1');

  const invoice = state.invoices[0];
  assert.equal(invoice.status, 'FINAL');
  assert.equal(invoice.supplyType, 'INTRA_STATE');
  assert.equal(invoice.cgstPaise, 450000);
  assert.equal(invoice.sgstPaise, 450000);
  assert.equal(invoice.igstPaise, 0);
  assert.equal(invoice.cgstPaise + invoice.sgstPaise, invoice.totalTaxPaise);
});

test('inter-state (different customer state code): full amount as IGST, invoice is FINAL', async () => {
  state.billingProfile = { stateCode: '07' }; // Delhi customer, Maharashtra seller
  pushPurchase('p2');
  await activatePurchase('p2');

  const invoice = state.invoices[0];
  assert.equal(invoice.status, 'FINAL');
  assert.equal(invoice.supplyType, 'INTER_STATE');
  assert.equal(invoice.igstPaise, 900000);
  assert.equal(invoice.cgstPaise, 0);
  assert.equal(invoice.sgstPaise, 0);
});

test('missing seller state code: invoice is UNKNOWN/REVIEW_REQUIRED with zeroed split, but total tax stays correct', async () => {
  env.billingSellerStateCode = null;
  state.billingProfile = { stateCode: '27' };
  pushPurchase('p3');
  await activatePurchase('p3');

  const invoice = state.invoices[0];
  assert.equal(invoice.status, 'REVIEW_REQUIRED');
  assert.equal(invoice.supplyType, 'UNKNOWN');
  assert.equal(invoice.cgstPaise, 0);
  assert.equal(invoice.sgstPaise, 0);
  assert.equal(invoice.igstPaise, 0);
  assert.equal(invoice.totalTaxPaise, 900000, 'total GST must still be correct even when the split is withheld');
  assert.equal(invoice.totalPayablePaise, 5900000);
});

test('missing customer state code (no billing profile at all): invoice is UNKNOWN/REVIEW_REQUIRED', async () => {
  state.billingProfile = null;
  pushPurchase('p4');
  await activatePurchase('p4');

  const invoice = state.invoices[0];
  assert.equal(invoice.status, 'REVIEW_REQUIRED');
  assert.equal(invoice.supplyType, 'UNKNOWN');
  assert.equal(invoice.totalTaxPaise, 900000);
});

test('taxable value + total tax reconciles exactly with total payable, in paise, for every product in the catalogue', async () => {
  const { CATALOGUE_DEFINITIONS } = await import('../services/productCatalogueService.js');
  for (const product of CATALOGUE_DEFINITIONS) {
    assert.equal(product.baseAmountPaise + product.gstAmountPaise, product.totalAmountPaise, `${product.code}: taxable + tax must equal total`);
  }
});

test('odd GST amounts still split into a CGST+SGST pair that sums exactly to the total tax (no rounding leak)', async () => {
  state.billingProfile = { stateCode: '27' };
  state.purchases.push({
    id: 'p5', organisationId: 'org-1', productCode: 'ATS_DB_6M', productPlanId: 'plan-ats-6m', purchaserUserId: 'user-1',
    productSnapshot: { baseAmountPaise: 333333, gstAmountPaise: 60001, totalAmountPaise: 393334, gstRatePercent: 18 }, // deliberately odd
    status: 'PENDING',
  });
  await activatePurchase('p5');

  const invoice = state.invoices[0];
  assert.equal(invoice.cgstPaise + invoice.sgstPaise, invoice.totalTaxPaise);
  assert.equal(invoice.cgstPaise, 30000);
  assert.equal(invoice.sgstPaise, 30001);
});

test('companyBillingProfileSchema: valid GSTIN with matching state code passes', () => {
  const parsed = companyBillingProfileSchema.parse({
    legalCompanyName: 'Acme Hiring Pvt Ltd', billingEmail: 'billing@acme.com', addressLine1: '1 MG Road',
    city: 'Mumbai', state: 'Maharashtra', stateCode: '27', postalCode: '400001', gstin: '27AAAAA0000A1Z5',
  });
  assert.equal(parsed.gstin, '27AAAAA0000A1Z5');
});

test('companyBillingProfileSchema: GSTIN whose state-code prefix does not match stateCode is rejected', () => {
  assert.throws(() => companyBillingProfileSchema.parse({
    legalCompanyName: 'Acme Hiring Pvt Ltd', billingEmail: 'billing@acme.com', addressLine1: '1 MG Road',
    city: 'Mumbai', state: 'Maharashtra', stateCode: '27', postalCode: '400001', gstin: '07AAAAA0000A1Z5',
  }));
});

test('companyBillingProfileSchema: malformed GSTIN is rejected', () => {
  assert.throws(() => companyBillingProfileSchema.parse({
    legalCompanyName: 'Acme Hiring Pvt Ltd', billingEmail: 'billing@acme.com', addressLine1: '1 MG Road',
    city: 'Mumbai', state: 'Maharashtra', stateCode: '27', postalCode: '400001', gstin: 'not-a-gstin',
  }));
});

test('companyBillingProfileSchema: an invalid (non-2-digit) state code is rejected', () => {
  assert.throws(() => companyBillingProfileSchema.parse({
    legalCompanyName: 'Acme Hiring Pvt Ltd', billingEmail: 'billing@acme.com', addressLine1: '1 MG Road',
    city: 'Mumbai', state: 'Maharashtra', stateCode: 'MH', postalCode: '400001',
  }));
});

test('companyBillingProfileSchema: GSTIN is optional and absent is valid', () => {
  const parsed = companyBillingProfileSchema.parse({
    legalCompanyName: 'Acme Hiring Pvt Ltd', billingEmail: 'billing@acme.com', addressLine1: '1 MG Road',
    city: 'Mumbai', state: 'Maharashtra', stateCode: '27', postalCode: '400001',
  });
  assert.equal(parsed.gstin, undefined);
});

after(() => {
  env.billingSellerStateCode = originalSellerStateCode;
});
