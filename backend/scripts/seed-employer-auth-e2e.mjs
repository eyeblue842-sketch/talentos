// CAREERIZ EMPLOYER-LOGIN-FLOW-VERIFIED - fictional/local-only account
// seeding for the employer-login Playwright coverage. Prints JSON to
// stdout only. Never touches a real user, a real password, or any
// protected/production data.
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(currentDir, '../.env.test') });
dotenv.config({ path: path.resolve(currentDir, '../.env') });
process.env.DATABASE_URL ||= process.env.TEST_DATABASE_URL;
process.env.DIRECT_URL ||= process.env.TEST_DIRECT_URL || process.env.TEST_DATABASE_URL;

const prisma = new PrismaClient();

const PASSWORD = 'FictionalE2EPass123!';
const ORG_SLUG = 'e2e-employer-auth-lab';

async function upsertUser(email, role, name, passwordHash, extra = {}) {
  return prisma.user.upsert({
    where: { email },
    update: { role, name, passwordHash, emailVerifiedAt: new Date(), isActive: true, sessionVersion: 0, ...extra },
    create: { email, role, name, passwordHash, emailVerifiedAt: new Date(), isActive: true, sessionVersion: 0, ...extra },
  });
}

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const organisation = await prisma.organisation.upsert({
    where: { slug: ORG_SLUG },
    update: { name: 'E2E Employer Auth Lab', status: 'ACTIVE', headquarters: 'Bengaluru' },
    create: { name: 'E2E Employer Auth Lab', slug: ORG_SLUG, status: 'ACTIVE', headquarters: 'Bengaluru' },
  });

  const recruiter = await upsertUser(
    'e2e.employer-auth.recruiter@careeriz.demo',
    'RECRUITER',
    'E2E Employer Auth Recruiter',
    passwordHash,
    { mustChangePassword: false },
  );

  const recruiterMustChange = await upsertUser(
    'e2e.employer-auth.recruiter.mustchange@careeriz.demo',
    'RECRUITER',
    'E2E Employer Auth Recruiter (Forced Password Change)',
    passwordHash,
    { mustChangePassword: true },
  );

  const candidate = await upsertUser(
    'e2e.employer-auth.candidate@careeriz.demo',
    'CANDIDATE',
    'E2E Employer Auth Candidate',
    passwordHash,
    { mustChangePassword: false },
  );

  for (const user of [recruiter, recruiterMustChange]) {
    await prisma.recruiterProfile.upsert({
      where: { userId: user.id },
      update: { organisationId: organisation.id, companyEmailDomain: 'careeriz.demo', companyName: 'E2E Employer Auth Lab', profileCompleted: true },
      create: { userId: user.id, organisationId: organisation.id, companyEmailDomain: 'careeriz.demo', companyName: 'E2E Employer Auth Lab', profileCompleted: true },
    });

    await prisma.organisationMembership.upsert({
      where: { organisationId_userId: { organisationId: organisation.id, userId: user.id } },
      update: { role: 'OWNER', status: 'ACTIVE' },
      create: { organisationId: organisation.id, userId: user.id, role: 'OWNER', status: 'ACTIVE' },
    });
  }

  await prisma.candidateProfile.upsert({
    where: { userId: candidate.id },
    update: { fullName: 'E2E Employer Auth Candidate', profileVisibility: 'PUBLIC' },
    create: { userId: candidate.id, fullName: 'E2E Employer Auth Candidate', profileVisibility: 'PUBLIC' },
  });

  console.log(JSON.stringify({
    password: PASSWORD,
    recruiter: { email: recruiter.email, userId: recruiter.id },
    recruiterMustChange: { email: recruiterMustChange.email, userId: recruiterMustChange.id },
    candidate: { email: candidate.email, userId: candidate.id },
    organisation: { id: organisation.id, slug: organisation.slug },
  }));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ event: 'employer-auth-seed.crashed', message: error.message }));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
