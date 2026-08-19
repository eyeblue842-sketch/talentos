import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOGUE_DEFINITIONS, isSubscriptionProduct, buildProductSnapshot } from '../services/productCatalogueService.js';

// Section 17: "each price and GST calculation" - these are the exact
// figures from the billing spec (section 2), asserted directly so any
// accidental edit to the catalogue is caught immediately.
const EXPECTED = {
  JOB_POST_45D: { baseAmountPaise: 150000, gstAmountPaise: 27000, totalAmountPaise: 177000, durationMonths: null, includedJobCredits: 1 },
  ATS_DB_1M: { baseAmountPaise: 1000000, gstAmountPaise: 180000, totalAmountPaise: 1180000, durationMonths: 1, includedJobCredits: 0 },
  ATS_DB_6M: { baseAmountPaise: 5000000, gstAmountPaise: 900000, totalAmountPaise: 5900000, durationMonths: 6, includedJobCredits: 3 },
  ATS_DB_12M: { baseAmountPaise: 10000000, gstAmountPaise: 1800000, totalAmountPaise: 11800000, durationMonths: 12, includedJobCredits: 5 },
};

test('catalogue matches the exact spec pricing and GST for every product', () => {
  assert.equal(CATALOGUE_DEFINITIONS.length, 4);
  for (const definition of CATALOGUE_DEFINITIONS) {
    const expected = EXPECTED[definition.code];
    assert.ok(expected, `unexpected product code ${definition.code}`);
    assert.equal(definition.baseAmountPaise, expected.baseAmountPaise, `${definition.code} baseAmountPaise`);
    assert.equal(definition.gstAmountPaise, expected.gstAmountPaise, `${definition.code} gstAmountPaise`);
    assert.equal(definition.totalAmountPaise, expected.totalAmountPaise, `${definition.code} totalAmountPaise`);
    assert.equal(definition.durationMonths, expected.durationMonths, `${definition.code} durationMonths`);
    assert.equal(definition.includedJobCredits, expected.includedJobCredits, `${definition.code} includedJobCredits`);
    assert.equal(definition.jobActiveDays, 45, `${definition.code} jobActiveDays`);
    assert.equal(definition.gstRatePercent, 18, `${definition.code} gstRatePercent`);
  }
});

test('GST is always exactly 18% of the base amount, and total is base + GST', () => {
  for (const definition of CATALOGUE_DEFINITIONS) {
    assert.equal(definition.gstAmountPaise, Math.round((definition.baseAmountPaise * 18) / 100));
    assert.equal(definition.totalAmountPaise, definition.baseAmountPaise + definition.gstAmountPaise);
  }
});

test('isSubscriptionProduct distinguishes the job-credit product from ATS+DB plans', () => {
  assert.equal(isSubscriptionProduct('JOB_POST_45D'), false);
  assert.equal(isSubscriptionProduct('ATS_DB_1M'), true);
  assert.equal(isSubscriptionProduct('ATS_DB_6M'), true);
  assert.equal(isSubscriptionProduct('ATS_DB_12M'), true);
});

test('buildProductSnapshot copies every field a Purchase needs to stay immutable even if the catalogue changes later', () => {
  const plan = {
    id: 'plan_1', code: 'ATS_DB_6M', version: 1, name: 'ATS + Resume Database - 6 Months', description: 'desc',
    currency: 'INR', baseAmountPaise: 5000000, gstRatePercent: 18, gstAmountPaise: 900000, totalAmountPaise: 5900000,
    durationMonths: 6, includedJobCredits: 3, jobActiveDays: 45,
  };
  const snapshot = buildProductSnapshot(plan);
  assert.deepEqual(snapshot, {
    productPlanId: 'plan_1', code: 'ATS_DB_6M', version: 1, name: 'ATS + Resume Database - 6 Months', description: 'desc',
    currency: 'INR', baseAmountPaise: 5000000, gstRatePercent: 18, gstAmountPaise: 900000, totalAmountPaise: 5900000,
    durationMonths: 6, includedJobCredits: 3, jobActiveDays: 45,
  });
});
