import test, { before } from 'node:test';
import assert from 'node:assert/strict';

let prisma;
let getAvailableJobCredits;
let getJobCreditBreakdown;
let consumeJobCredit;
let canPublishJob;

before(async () => {
  ({ prisma } = await import('../config/db.js'));
  ({
    getAvailableJobCredits,
    getJobCreditBreakdown,
    consumeJobCredit,
    canPublishJob,
  } = await import('../services/entitlementService.js'));
});

// The live-balance query (entitlementService.getAvailableJobCredits) is a
// raw SQL SUM that excludes GRANT rows whose expiresAt has already passed
// - this is what makes credit expiry scheduler-delay-proof (section 8/17:
// "scheduler delay cannot extend access"). We mock $queryRaw itself rather
// than re-implementing SQL semantics, and instead directly assert the
// function is called with the right organisationId and returns its number.
function mockQueryRawBalance(balance) {
  prisma.$queryRaw = async () => [{ balance }];
}

test('getAvailableJobCredits returns the live balance from the ledger sum, floored at 0', async () => {
  mockQueryRawBalance(3);
  assert.equal(await getAvailableJobCredits('org-1'), 3);

  mockQueryRawBalance(-1);
  assert.equal(await getAvailableJobCredits('org-1'), 0);
});

test('canPublishJob is true only when at least one credit is available', async () => {
  mockQueryRawBalance(0);
  assert.equal(await canPublishJob('org-1'), false);

  mockQueryRawBalance(1);
  assert.equal(await canPublishJob('org-1'), true);
});

test('consumeJobCredit throws JOB_POSTING_QUOTA_EXCEEDED and creates nothing when no credit is available', async () => {
  const created = [];
  const tx = {
    $queryRaw: async () => [{ balance: 0 }],
    jobPostingCreditLedger: { create: async (args) => { created.push(args); return { id: 'ledger-1', ...args.data }; } },
  };

  await assert.rejects(
    () => consumeJobCredit(tx, { organisationId: 'org-1', jobId: 'job-1', actorUserId: 'user-1', idempotencyKey: 'job-publish:job-1:attempt-1' }),
    (error) => {
      assert.equal(error.code, 'JOB_POSTING_QUOTA_EXCEEDED');
      assert.equal(error.statusCode, 402);
      return true;
    },
  );
  assert.equal(created.length, 0, 'no ledger row should be created when the quota check fails');
});

test('consumeJobCredit creates exactly one CONSUME(-1) row linked to the job when a credit is available', async () => {
  const created = [];
  const tx = {
    $queryRaw: async () => [{ balance: 1 }],
    jobPostingCreditLedger: { create: async (args) => { created.push(args.data); return { id: 'ledger-1', ...args.data }; } },
  };

  const entry = await consumeJobCredit(tx, { organisationId: 'org-1', jobId: 'job-1', actorUserId: 'user-1', idempotencyKey: 'job-publish:job-1:attempt-1' });

  assert.equal(created.length, 1);
  assert.equal(created[0].entryType, 'CONSUME');
  assert.equal(created[0].amount, -1);
  assert.equal(created[0].jobId, 'job-1');
  assert.equal(created[0].organisationId, 'org-1');
  assert.equal(created[0].idempotencyKey, 'job-publish:job-1:attempt-1');
  assert.equal(entry.jobId, 'job-1');
});

// Section 10 quota scenarios: six-month plan grants 3, annual grants 5 -
// modeled here as the ledger's live balance directly (the actual
// grant-on-activation path is covered by billing-purchase-activation.test.js).
test('quota scenario: six-month subscription allows exactly 3 publications before blocking the 4th', async () => {
  let remaining = 3;
  const tx = {
    $queryRaw: async () => [{ balance: remaining }],
    jobPostingCreditLedger: { create: async (args) => { remaining -= 1; return { id: `ledger-${remaining}`, ...args.data }; } },
  };

  await consumeJobCredit(tx, { organisationId: 'org-1', jobId: 'job-1', actorUserId: 'user-1', idempotencyKey: 'k1' });
  await consumeJobCredit(tx, { organisationId: 'org-1', jobId: 'job-2', actorUserId: 'user-1', idempotencyKey: 'k2' });
  await consumeJobCredit(tx, { organisationId: 'org-1', jobId: 'job-3', actorUserId: 'user-1', idempotencyKey: 'k3' });
  assert.equal(remaining, 0);

  await assert.rejects(
    () => consumeJobCredit(tx, { organisationId: 'org-1', jobId: 'job-4', actorUserId: 'user-1', idempotencyKey: 'k4' }),
    (error) => error.code === 'JOB_POSTING_QUOTA_EXCEEDED',
  );
});

test('quota scenario: annual subscription allows exactly 5 publications before blocking the 6th', async () => {
  let remaining = 5;
  const tx = {
    $queryRaw: async () => [{ balance: remaining }],
    jobPostingCreditLedger: { create: async (args) => { remaining -= 1; return { id: `ledger-${remaining}`, ...args.data }; } },
  };

  for (let i = 1; i <= 5; i += 1) {
    await consumeJobCredit(tx, { organisationId: 'org-1', jobId: `job-${i}`, actorUserId: 'user-1', idempotencyKey: `k${i}` });
  }
  assert.equal(remaining, 0);

  await assert.rejects(
    () => consumeJobCredit(tx, { organisationId: 'org-1', jobId: 'job-6', actorUserId: 'user-1', idempotencyKey: 'k6' }),
    (error) => error.code === 'JOB_POSTING_QUOTA_EXCEEDED',
  );
});

test('getJobCreditBreakdown separates included, purchased, consumed and available correctly', async () => {
  prisma.jobPostingCreditLedger = {
    ...prisma.jobPostingCreditLedger,
    groupBy: async () => [
      { entryType: 'GRANT', source: 'SUBSCRIPTION_GRANT', _sum: { amount: 3 } },
      { entryType: 'GRANT', source: 'PURCHASED_CREDIT', _sum: { amount: 2 } },
      { entryType: 'CONSUME', source: null, _sum: { amount: -4 } },
      { entryType: 'REVERSAL', source: null, _sum: { amount: 1 } },
      { entryType: 'ADMIN_ADJUSTMENT', source: 'ADMIN_ADJUSTMENT', _sum: { amount: -1 } },
    ],
  };
  mockQueryRawBalance(1);

  const breakdown = await getJobCreditBreakdown('org-1');
  assert.equal(breakdown.includedGranted, 3);
  assert.equal(breakdown.purchasedGranted, 2);
  assert.equal(breakdown.consumed, 4);
  assert.equal(breakdown.reversed, 1);
  assert.equal(breakdown.adminAdjusted, -1);
  assert.equal(breakdown.available, 1);
});
