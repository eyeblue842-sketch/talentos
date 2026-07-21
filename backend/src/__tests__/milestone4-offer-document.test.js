import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOfferDocumentModel, generateOfferPdfBuffer } from '../services/offerDocumentService.js';

function sampleOffer() {
  return {
    referenceNumber: 'OFR-20260721-1-TEST',
    version: 1,
    currency: 'INR',
    annualCompensation: 1800000,
    fixedCompensation: 1400000,
    variableCompensation: 200000,
    joiningBonus: 100000,
    otherCompensation: 50000,
    totalCompensation: 1750000,
    proposedJoiningDate: new Date('2026-08-15T00:00:00.000Z'),
    expiryAt: new Date('2026-07-28T00:00:00.000Z'),
    benefitsSummary: 'Health insurance and hybrid work support.',
    compensationNotes: 'Performance bonus aligned to company policy.',
    noticeOrBuyoutNote: 'Candidate buyout support available.',
    termsAndConditions: 'Standard employment terms apply.',
    organisation: { name: 'Acme Labs' },
    candidate: { fullName: 'Aarav Sharma', user: { email: 'aarav@example.com' } },
    job: { title: 'Senior Java Engineer', department: 'Engineering', location: 'Bangalore', employmentType: 'FULL_TIME', recruiter: { email: 'recruiter@acme.com' } },
    components: [
      { label: 'Joining bonus', type: 'BONUS', frequency: 'ONE_TIME', taxable: true, amount: 100000 },
    ],
  };
}

test('buildOfferDocumentModel maps recruiter offer fields into a printable shape', () => {
  const model = buildOfferDocumentModel(sampleOffer());
  assert.equal(model.organisationName, 'Acme Labs');
  assert.equal(model.candidateName, 'Aarav Sharma');
  assert.equal(model.jobTitle, 'Senior Java Engineer');
  assert.match(model.totalCompensation, /INR/);
  assert.equal(model.components.length, 1);
});

test('generateOfferPdfBuffer returns a PDF buffer for a released offer version', async () => {
  const buffer = await generateOfferPdfBuffer(sampleOffer());
  assert.ok(Buffer.isBuffer(buffer));
  assert.ok(buffer.length > 1000);
  assert.equal(buffer.subarray(0, 4).toString(), '%PDF');
});
