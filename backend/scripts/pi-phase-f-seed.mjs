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

  // A fresh PENDING company org (no subscription), for the
  // pending-verification-restrictions browser check.
  const pendingEmail = `pending-owner-${suffix}@fictionalpendingco${suffix}.example`;
  const pendingSignupUser = await prisma.user.create({
    data: { email: pendingEmail, passwordHash, role: 'RECRUITER', emailVerifiedAt: new Date() },
  });
  const pendingOrg = await prisma.organisation.create({
    data: { name: `Fictional Pending Co ${suffix}`, slug: `fictional-pending-co-${suffix}`, type: 'COMPANY', verifiedDomain: `fictionalpendingco${suffix}.example`, domainVerificationStatus: 'PENDING' },
  });
  await prisma.organisationMembership.create({ data: { userId: pendingSignupUser.id, organisationId: pendingOrg.id, role: 'OWNER', status: 'ACTIVE' } });

  console.log(JSON.stringify({
    password: PASSWORD,
    verified: { email: 'owner-phase-e@fictionalparsingco.example', organisationId: verifiedUser.id },
    pending: { email: pendingEmail },
    consultancyRegisterEmailDomain: `fictionalconsultancy${suffix}.example`,
    consultancyRegisterEmailGmail: `fictional-consultancy-gmail-${suffix}@gmail.com`,
    companyRegisterEmailPublic: `fictional-company-public-${suffix}@gmail.com`,
    suffix,
  }));
}

main()
  .catch((error) => { console.error(JSON.stringify({ event: 'phase-f-seed.crashed', message: error?.message })); process.exitCode = 1; })
  .finally(async () => { await closePrisma().catch(() => {}); });
