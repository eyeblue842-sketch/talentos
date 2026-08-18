// CAREERIZ PRODUCT INTEGRATION - Phase F: fictional account seeding for
// the Playwright browser-acceptance run. Prints JSON to stdout only -
// fictional data only, never touches the protected batch or shared DB.
import { prisma, closePrisma } from '../src/config/db.js';

const suffix = Date.now();
const PASSWORD = 'FictionalPlaywrightPass123!';

async function main() {
  const bcrypt = (await import('bcryptjs')).default;
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // Reuse the already-verified, already-subscribed, already-indexed
  // organisation from Phase E (stable email) so the resume-search chip
  // and result-card checks have real searchable data ("Kubernetes" etc.)
  // without re-seeding/re-indexing.
  const verifiedUser = await prisma.user.findUnique({ where: { email: 'owner-phase-e@fictionalparsingco.example' } });
  if (!verifiedUser) throw new Error('Phase E fictional org not found - run pi-phase-e-parsing-indexing.mjs first.');
  await prisma.user.update({ where: { id: verifiedUser.id }, data: { passwordHash, emailVerifiedAt: new Date() } });

  // A stable (non-suffixed, idempotent - same pattern as the Phase E
  // verified org above) PENDING company org with no subscription, for the
  // pending-verification-restrictions browser check. Stable so its
  // organisation id can be looked up once and allowlisted for Resume
  // Search V2 rollout in an isolated harness, exercising the real
  // entitlement/verification gate instead of the unrelated legacy
  // AI-search fallback (which requires intelligence infra out of scope
  // here).
  const PENDING_OWNER_EMAIL = 'pending-owner-phase-f@fictionalpendingco.example';
  let pendingSignupUser = await prisma.user.findUnique({ where: { email: PENDING_OWNER_EMAIL } });
  let pendingOrg;
  if (pendingSignupUser) {
    await prisma.user.update({ where: { id: pendingSignupUser.id }, data: { passwordHash } });
    const membership = await prisma.organisationMembership.findFirst({ where: { userId: pendingSignupUser.id } });
    pendingOrg = await prisma.organisation.findUnique({ where: { id: membership.organisationId } });
  } else {
    pendingSignupUser = await prisma.user.create({
      data: { email: PENDING_OWNER_EMAIL, passwordHash, role: 'RECRUITER', emailVerifiedAt: new Date() },
    });
    pendingOrg = await prisma.organisation.create({
      data: { name: 'Fictional Pending Co', slug: 'fictional-pending-co', type: 'COMPANY', verifiedDomain: 'fictionalpendingco.example', domainVerificationStatus: 'PENDING' },
    });
    await prisma.organisationMembership.create({ data: { userId: pendingSignupUser.id, organisationId: pendingOrg.id, role: 'OWNER', status: 'ACTIVE' } });
  }

  console.log(JSON.stringify({
    password: PASSWORD,
    verified: { email: 'owner-phase-e@fictionalparsingco.example', organisationId: verifiedUser.id },
    pending: { email: PENDING_OWNER_EMAIL, organisationId: pendingOrg.id },
    consultancyRegisterEmailDomain: `fictionalconsultancy${suffix}.example`,
    consultancyRegisterEmailGmail: `fictional-consultancy-gmail-${suffix}@gmail.com`,
    companyRegisterEmailPublic: `fictional-company-public-${suffix}@gmail.com`,
    suffix,
  }));
}

main()
  .catch((error) => { console.error(JSON.stringify({ event: 'phase-f-seed.crashed', message: error?.message })); process.exitCode = 1; })
  .finally(async () => { await closePrisma().catch(() => {}); });
