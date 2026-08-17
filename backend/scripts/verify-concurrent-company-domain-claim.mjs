// CAREERIZ EMPLOYER ACCESS, domain-ownership closure section 8: proves the
// database-level partial unique index on Organisation.verifiedDomain (see
// migration 20260817150000_employer_domain_uniqueness) is what actually
// makes "at most one COMPANY organisation per domain" true under GENUINE
// concurrent Postgres connections - not a mocked/sequential simulation.
//
// Requires a real, DISPOSABLE, E:-backed PostgreSQL instance (never the
// shared Supabase test database). To run:
//
//   docker run -d --name careeriz-employer-domain-claim-test ^
//     -e POSTGRES_PASSWORD=test_local_only -e POSTGRES_USER=careeriz ^
//     -e POSTGRES_DB=careeriz_domain_claim_test -p 15435:5432 ^
//     -v E:/Careeriz-Temp/EmployerAuth/postgres-domain-claim-test-data:/var/lib/postgresql/data ^
//     postgres:16-alpine
//
//   (from backend/, with DATABASE_URL/DIRECT_URL pointed at that instance)
//   npx prisma migrate deploy --schema prisma/schema.prisma
//   node scripts/verify-concurrent-company-domain-claim.mjs
//
// Then tear the container and its E: volume down - it is disposable.
//
// What this proves:
//   - exactly one of N concurrent COMPANY registrations for the SAME
//     domain succeeds
//   - every other attempt is rejected with the stable
//     EMAIL_DOMAIN_ALREADY_CLAIMED code (never a raw/opaque DB error)
//   - exactly one Organisation row exists for the domain, with exactly one
//     OWNER OrganisationMembership row
//   - no partial/orphan User, RecruiterProfile, Organisation, or
//     OrganisationMembership rows exist for any losing attempt (the
//     transaction rolled back completely)
//   - a pre-existing legacy (type=null) organisation is completely
//     unaffected by the race

import { prisma, closePrisma } from '../src/config/db.js';
import { registerUser } from '../src/services/authService.js';

const CONCURRENCY = 8;
const RACE_DOMAIN = `racecorp${Date.now()}.com`;

function actorEmail(i) {
  return `recruiter${i}@${RACE_DOMAIN}`;
}

async function seedInitialSetupCompleted() {
  // authService.registerUser requires assertInitialSetupCompleted() to
  // pass first - on a bare disposable database with nothing seeded yet,
  // mark platform setup complete directly so the race below is racing on
  // domain-claim logic, not blocked on an unrelated setup-wizard gate.
  await prisma.platformSetupState.upsert({
    where: { id: 'platform-setup' },
    create: { id: 'platform-setup', setupCompleted: true, setupCompletedAt: new Date() },
    update: { setupCompleted: true, setupCompletedAt: new Date() },
  });
}

async function seedLegacyOrganisation() {
  return prisma.organisation.create({
    data: {
      name: 'Pre-Existing Legacy Org',
      slug: `legacy-org-${Date.now()}`,
      // type intentionally omitted -> null, simulating a pre-feature row.
    },
  });
}

async function attemptRegister(i) {
  try {
    const result = await registerUser({
      email: actorEmail(i),
      password: 'Password123!',
      role: 'RECRUITER',
      employerType: 'COMPANY',
    });
    return { outcome: 'created', index: i, organisationId: result.user.recruiterProfile.organisationId };
  } catch (error) {
    return { outcome: 'rejected', index: i, statusCode: error.statusCode || null, code: error.code || null, message: error.message };
  }
}

function fail(message) {
  console.error(JSON.stringify({ level: 'error', event: 'domain-claim.verify.failed', message }));
  process.exitCode = 1;
}

async function main() {
  console.log(JSON.stringify({ level: 'info', event: 'domain-claim.verify.seeding', concurrency: CONCURRENCY, domain: RACE_DOMAIN }));
  await seedInitialSetupCompleted();
  const legacyOrg = await seedLegacyOrganisation();

  console.log(JSON.stringify({ level: 'info', event: 'domain-claim.verify.racing' }));
  const results = await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => attemptRegister(i)));

  const created = results.filter((r) => r.outcome === 'created');
  const rejected = results.filter((r) => r.outcome === 'rejected');
  // Final publication-bypass closure section 3: EVERY losing attempt in a
  // same-domain race must report the IDENTICAL, stable
  // EMAIL_DOMAIN_ALREADY_CLAIMED result - not a mix of that and
  // ORGANISATION_SLUG_CONFLICT depending on which unique constraint
  // Postgres happened to report first for a given losing transaction (that
  // ordering is not guaranteed under real concurrency, which is exactly
  // why this must be proven against a real database, not just mocked).
  const unsafeRejections = rejected.filter((r) => r.code !== 'EMAIL_DOMAIN_ALREADY_CLAIMED');

  console.log(JSON.stringify({ level: 'info', event: 'domain-claim.verify.results', created: created.length, rejected: rejected.length, results }, null, 2));

  let ok = true;
  if (created.length !== 1) { fail(`Expected exactly 1 organisation created, got ${created.length}`); ok = false; }
  if (rejected.length !== CONCURRENCY - 1) { fail(`Expected exactly ${CONCURRENCY - 1} rejections, got ${rejected.length}`); ok = false; }
  if (unsafeRejections.length > 0) { fail(`Found rejection(s) with an unexpected/unsafe error code: ${JSON.stringify(unsafeRejections)}`); ok = false; }
  if (rejected.some((r) => r.statusCode !== 409)) { fail('Every rejection must be a clean 409, not a raw database error.'); ok = false; }

  const orgsForDomain = await prisma.organisation.findMany({ where: { type: 'COMPANY', verifiedDomain: RACE_DOMAIN } });
  if (orgsForDomain.length !== 1) { fail(`Expected exactly 1 Organisation row for the domain, found ${orgsForDomain.length}`); ok = false; }

  const winningOrgId = created[0]?.organisationId;
  const memberships = winningOrgId
    ? await prisma.organisationMembership.findMany({ where: { organisationId: winningOrgId } })
    : [];
  if (memberships.length !== 1 || memberships[0]?.role !== 'OWNER') {
    fail(`Expected exactly 1 OWNER membership on the winning organisation, found ${JSON.stringify(memberships)}`);
    ok = false;
  }

  // No orphan users for the LOSING attempts - their transactions must have
  // rolled back completely (organisation.create threw before user.create
  // ever ran).
  const allRaceUsers = await prisma.user.findMany({
    where: { email: { in: results.map((r) => actorEmail(r.index)) } },
  });
  if (allRaceUsers.length !== 1) {
    fail(`Expected exactly 1 User row to exist from this race (the winner's), found ${allRaceUsers.length}`);
    ok = false;
  }

  // The pre-existing legacy organisation must be completely untouched.
  const refreshedLegacyOrg = await prisma.organisation.findUnique({ where: { id: legacyOrg.id } });
  if (refreshedLegacyOrg.type !== null || refreshedLegacyOrg.verifiedDomain !== null) {
    fail(`Legacy organisation was unexpectedly modified: ${JSON.stringify(refreshedLegacyOrg)}`);
    ok = false;
  }

  // Cleanup - disposable seed data on a disposable database, but clean up
  // regardless so re-running the script twice against the same container
  // stays tidy.
  await prisma.organisation.delete({ where: { id: legacyOrg.id } }).catch(() => {});
  if (winningOrgId) {
    await prisma.organisationMembership.deleteMany({ where: { organisationId: winningOrgId } }).catch(() => {});
    await prisma.recruiterProfile.deleteMany({ where: { organisationId: winningOrgId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { in: results.map((r) => actorEmail(r.index)) } } }).catch(() => {});
    await prisma.organisation.delete({ where: { id: winningOrgId } }).catch(() => {});
  }

  if (ok) {
    console.log(JSON.stringify({ level: 'info', event: 'domain-claim.verify.ALL_CHECKS_PASSED' }));
  } else {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ level: 'error', event: 'domain-claim.verify.crashed', message: error?.message, stack: error?.stack }));
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePrisma().catch(() => {});
  });
