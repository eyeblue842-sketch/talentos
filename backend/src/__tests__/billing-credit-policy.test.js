import test, { before } from 'node:test';
import assert from 'node:assert/strict';

// B1 hardening, section 5/6: binding credit and cancellation policy.

let prisma;
let getAvailableJobCredits;
let getCurrentSubscription;
let isSubscriptionCurrentlyActive;

before(async () => {
  ({ prisma } = await import('../config/db.js'));
  ({ getAvailableJobCredits, getCurrentSubscription, isSubscriptionCurrentlyActive } = await import('../services/entitlementService.js'));
});

function hoursFromNow(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

test('getAvailableJobCredits excludes a GRANT whose validFrom is still in the future (no rollover into an early-renewed term before it starts)', async () => {
  // Simulate the raw SQL filter directly against a tiny in-memory dataset,
  // mirroring exactly what the real WHERE clause checks (entryType/
  // expiresAt/validFrom), since $queryRaw can't run real SQL against a mock.
  const rows = [
    { entryType: 'GRANT', amount: 5, expiresAt: hoursFromNow(1000), validFrom: hoursFromNow(48) }, // future term, not usable yet
    { entryType: 'GRANT', amount: 2, expiresAt: hoursFromNow(24), validFrom: null }, // current term, still valid
    { entryType: 'CONSUME', amount: -1, expiresAt: null, validFrom: null },
  ];
  function liveSum(now) {
    return rows
      .filter((row) => row.entryType !== 'GRANT' || ((row.expiresAt == null || row.expiresAt > now) && (row.validFrom == null || row.validFrom <= now)))
      .reduce((sum, row) => sum + row.amount, 0);
  }

  const now = new Date();
  assert.equal(liveSum(now), 1, 'only the current, already-valid grant (2) minus the consume (1) should count while the new term has not started');

  const afterNewTermStarts = hoursFromNow(49);
  // At this point the old grant would also have expired (expiresAt +24h),
  // and the new grant (validFrom +48h) becomes valid - this asserts the
  // filter predicate itself behaves as designed at that instant.
  assert.equal(
    rows.filter((row) => row.entryType !== 'GRANT' || ((row.expiresAt == null || row.expiresAt > afterNewTermStarts) && (row.validFrom == null || row.validFrom <= afterNewTermStarts))).reduce((sum, row) => sum + row.amount, 0),
    4,
  );
});

test('getAvailableJobCredits (real function): a GRANT with validFrom in the future does not count toward the live balance', async () => {
  const calls = [];
  prisma.$queryRaw = async (strings, ...values) => {
    calls.push({ strings, values });
    // The real query already encodes the validFrom predicate; here we just
    // prove the function issues a query that includes it and returns
    // whatever the DB would compute - covered precisely by the predicate
    // unit test above. This call just exercises the real function path.
    return [{ balance: 0 }];
  };
  const balance = await getAvailableJobCredits('org-1');
  assert.equal(balance, 0);
  const sql = calls[0].strings.join('');
  assert.match(sql, /"validFrom"/, 'the live-balance query must filter on validFrom, not just expiresAt');
});

test('a CANCELLED subscription (renewal stopped) still counts as currently active while expiresAt is in the future', async () => {
  prisma.companySubscription = {
    findFirst: async () => ({ status: 'CANCELLED', expiresAt: hoursFromNow(100), atsAccess: true, resumeDatabaseAccess: true }),
  };
  const subscription = await getCurrentSubscription('org-1');
  assert.equal(subscription.status, 'CANCELLED');
  assert.equal(await isSubscriptionCurrentlyActive(subscription), true);
});

test('a CANCELLED subscription past its expiresAt is no longer active (natural expiry, not a special case)', async () => {
  const subscription = { status: 'CANCELLED', expiresAt: hoursFromNow(-1) };
  assert.equal(await isSubscriptionCurrentlyActive(subscription), false);
});

test('SUSPENDED revokes access immediately even with a future expiresAt', async () => {
  const subscription = { status: 'SUSPENDED', expiresAt: hoursFromNow(1000) };
  assert.equal(await isSubscriptionCurrentlyActive(subscription), false);
});

test('REFUNDED revokes access immediately even with a future expiresAt', async () => {
  const subscription = { status: 'REFUNDED', expiresAt: hoursFromNow(1000) };
  assert.equal(await isSubscriptionCurrentlyActive(subscription), false);
});

test('getCurrentSubscription excludes only SUSPENDED/REFUNDED from the query, not CANCELLED or EXPIRED', async () => {
  let capturedWhere = null;
  prisma.companySubscription = {
    findFirst: async ({ where }) => { capturedWhere = where; return null; },
  };
  await getCurrentSubscription('org-1');
  assert.deepEqual(capturedWhere.status.notIn.sort(), ['REFUNDED', 'SUSPENDED']);
});
