// B2 hardening, section 2: proves the SERIALIZABLE job-publish transaction
// (jobService.updateJob -> entitlementService.consumeJobCredit) is safe
// under GENUINE concurrent Postgres connections racing for the last
// available job-posting credit - not a mocked/sequential simulation.
//
// Requires a real, DISPOSABLE, E:-backed PostgreSQL instance (never the
// shared Supabase test database). To run:
//
//   docker run -d --name careeriz-billing-concurrency-test ^
//     -e POSTGRES_PASSWORD=test_local_only -e POSTGRES_USER=careeriz ^
//     -e POSTGRES_DB=careeriz_concurrency_test -p 15433:5432 ^
//     -v E:/Careeriz-Temp/Billing/postgres-concurrency-test-data:/var/lib/postgresql/data ^
//     postgres:16-alpine
//
//   (from backend/, with DATABASE_URL/DIRECT_URL pointed at that instance)
//   npx prisma migrate deploy --schema prisma/schema.prisma
//   npx cross-env BILLING_ENTITLEMENT_ENFORCEMENT_ENABLED=true node scripts/verify-concurrent-job-credit-consumption.mjs
//
// Then tear the container and its E: volume down - it is disposable.
//
// What this proves:
//   - exactly one of N concurrent publish attempts consumes the single
//     available credit and activates its job
//   - every other attempt is rejected (JOB_POSTING_QUOTA_EXCEEDED, or a
//     genuine Postgres serialization failure if retries were exhausted -
//     both are "safe" outcomes; a hang or a duplicate debit is not)
//   - the ledger balance is never negative and sums to exactly zero after
//     the race (1 GRANT + 1 CONSUME)
//   - every losing job is byte-for-byte unchanged (no partial update)

import { prisma, closePrisma } from '../src/config/db.js';
import { updateJob, createJob } from '../src/services/jobService.js';

const CONCURRENCY = 8;

function actor(id) {
  return { id, role: 'RECRUITER' };
}

async function seed() {
  const org = await prisma.organisation.create({ data: { name: 'Concurrency Test Co', slug: `concurrency-test-${Date.now()}` } });
  const user = await prisma.user.create({ data: { email: `concurrency-${Date.now()}@example.com`, passwordHash: 'x', role: 'RECRUITER' } });
  await prisma.organisationMembership.create({ data: { organisationId: org.id, userId: user.id, role: 'OWNER', status: 'ACTIVE' } });

  const jobs = [];
  for (let i = 0; i < CONCURRENCY; i += 1) {
    const job = await createJob(actor(user.id), {
      title: `Concurrency Test Role ${i}`,
      description: 'Seeded for the concurrent job-credit consumption proof.',
      skillsRequired: ['Testing'],
      experienceMin: 1,
      experienceMax: 3,
      location: 'Remote',
      recruiterId: user.id,
    }, org.id);
    jobs.push(job);
  }

  await prisma.jobPostingCreditLedger.create({
    data: {
      organisationId: org.id,
      entryType: 'GRANT',
      source: 'PURCHASED_CREDIT',
      amount: 1,
      idempotencyKey: `concurrency-seed-grant-${Date.now()}`,
    },
  });

  return { org, user, jobs };
}

async function attemptPublish(user, orgId, jobId) {
  try {
    const published = await updateJob(jobId, actor(user.id), {
      title: 'updated during publish attempt',
      description: 'Seeded for the concurrent job-credit consumption proof.',
      skillsRequired: ['Testing'],
      experienceMin: 1,
      experienceMax: 3,
      location: 'Remote',
      recruiterId: user.id,
      status: 'OPEN',
    }, orgId);
    return { outcome: 'activated', jobId, status: published.status };
  } catch (error) {
    return { outcome: 'rejected', jobId, code: error.code || null, message: error.message };
  }
}

function fail(message) {
  console.error(JSON.stringify({ level: 'error', event: 'concurrency.verify.failed', message }));
  process.exitCode = 1;
}

async function main() {
  console.log(JSON.stringify({ level: 'info', event: 'concurrency.verify.seeding', concurrency: CONCURRENCY }));
  const { org, user, jobs } = await seed();

  console.log(JSON.stringify({ level: 'info', event: 'concurrency.verify.racing' }));
  const results = await Promise.all(jobs.map((job) => attemptPublish(user, org.id, job.id)));

  const activated = results.filter((r) => r.outcome === 'activated');
  const rejected = results.filter((r) => r.outcome === 'rejected');
  const unsafeRejections = rejected.filter((r) => r.code !== 'JOB_POSTING_QUOTA_EXCEEDED' && r.code !== 'P2034');

  console.log(JSON.stringify({ level: 'info', event: 'concurrency.verify.results', activated: activated.length, rejected: rejected.length, results }, null, 2));

  let ok = true;
  if (activated.length !== 1) {
    fail(`Expected exactly 1 activation, got ${activated.length}`);
    ok = false;
  }
  if (rejected.length !== CONCURRENCY - 1) {
    fail(`Expected exactly ${CONCURRENCY - 1} rejections, got ${rejected.length}`);
    ok = false;
  }
  if (unsafeRejections.length > 0) {
    fail(`Found rejection(s) with an unexpected/unsafe error code: ${JSON.stringify(unsafeRejections)}`);
    ok = false;
  }

  const ledgerRows = await prisma.jobPostingCreditLedger.findMany({ where: { organisationId: org.id } });
  const grantRows = ledgerRows.filter((r) => r.entryType === 'GRANT');
  const consumeRows = ledgerRows.filter((r) => r.entryType === 'CONSUME');
  const ledgerSum = ledgerRows.reduce((sum, r) => sum + r.amount, 0);

  if (grantRows.length !== 1) { fail(`Expected exactly 1 GRANT row, found ${grantRows.length}`); ok = false; }
  if (consumeRows.length !== 1) { fail(`Expected exactly 1 CONSUME row (no duplicate debit), found ${consumeRows.length}`); ok = false; }
  if (ledgerSum !== 0) { fail(`Expected ledger sum 0 (1 GRANT + 1 CONSUME), got ${ledgerSum}`); ok = false; }

  const balanceRows = await prisma.$queryRaw`
    SELECT COALESCE(SUM("amount"), 0)::int AS balance FROM "JobPostingCreditLedger"
    WHERE "organisationId" = ${org.id}
      AND ("entryType" != 'GRANT' OR "expiresAt" IS NULL OR "expiresAt" > NOW())
      AND ("entryType" != 'GRANT' OR "validFrom" IS NULL OR "validFrom" <= NOW())
  `;
  const liveBalance = balanceRows[0].balance;
  if (liveBalance !== 0) { fail(`Expected live balance 0, got ${liveBalance}`); ok = false; }
  if (liveBalance < 0) { fail('Live balance went negative - this must never happen'); ok = false; }

  const dbJobs = await prisma.job.findMany({ where: { organisationId: org.id } });
  const openJobs = dbJobs.filter((j) => j.status === 'OPEN');
  const draftJobs = dbJobs.filter((j) => j.status === 'DRAFT');
  if (openJobs.length !== 1) { fail(`Expected exactly 1 OPEN job, found ${openJobs.length}`); ok = false; }
  if (draftJobs.length !== CONCURRENCY - 1) { fail(`Expected ${CONCURRENCY - 1} jobs to remain DRAFT (untouched), found ${draftJobs.length}`); ok = false; }
  for (const job of draftJobs) {
    if (job.title !== `Concurrency Test Role ${jobs.findIndex((j) => j.id === job.id)}` || job.activatedAt || job.activeUntil) {
      fail(`Losing job ${job.id} was partially updated (title="${job.title}", activatedAt=${job.activatedAt})`);
      ok = false;
    }
  }
  const consumedJobId = consumeRows[0]?.jobId;
  const activatedResult = activated[0];
  if (activatedResult && consumedJobId !== activatedResult.jobId) {
    fail(`The CONSUME ledger row references job ${consumedJobId}, but the activated job was ${activatedResult.jobId}`);
    ok = false;
  }

  // Cleanup - this is disposable seed data on a disposable database, but
  // clean up regardless so re-running the script twice against the same
  // container stays tidy.
  await prisma.organisation.delete({ where: { id: org.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});

  if (ok) {
    console.log(JSON.stringify({ level: 'info', event: 'concurrency.verify.ALL_CHECKS_PASSED' }));
  } else {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ level: 'error', event: 'concurrency.verify.crashed', message: error?.message, stack: error?.stack }));
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePrisma().catch(() => {});
  });
