import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/config/db.js';
import { bootstrapCandidateAdminAccount, bootstrapRecruiterAdminAccount } from '../src/services/testAccountBootstrapService.js';

/**
 * Idempotent local QA bootstrap for the two portal-scoped admin test
 * accounts. Never deletes anything, never touches an unrelated user, and is
 * safe to rerun. The temporary password is read from an env var and is never
 * logged, printed, or written to any file by this script.
 *
 * Usage:
 *   TEST_ADMIN_TEMP_PASSWORD='<temp password>' npm run seed:test-admin
 *
 * Optional overrides:
 *   TEST_CANDIDATE_ADMIN_EMAIL   (default: vinu842@gmail.com)
 *   TEST_RECRUITER_ADMIN_EMAIL   (default: support@sivantatechnologies.com)
 */
async function main() {
  const tempPassword = process.env.TEST_ADMIN_TEMP_PASSWORD;
  if (!tempPassword) {
    console.error(
      'Missing TEST_ADMIN_TEMP_PASSWORD. Set it in your shell for this command only, e.g.:\n' +
      "  TEST_ADMIN_TEMP_PASSWORD='...' npm run seed:test-admin\n" +
      'This script never reads the password from a tracked file.'
    );
    process.exitCode = 1;
    return;
  }
  if (tempPassword.length < 8 || tempPassword.length > 72) {
    console.error('TEST_ADMIN_TEMP_PASSWORD must be 8-72 characters (the canonical Careeriz password policy).');
    process.exitCode = 1;
    return;
  }

  const candidateAdminEmail = process.env.TEST_CANDIDATE_ADMIN_EMAIL || 'vinu842@gmail.com';
  const recruiterAdminEmail = process.env.TEST_RECRUITER_ADMIN_EMAIL || 'support@sivantatechnologies.com';

  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const candidateAdmin = await bootstrapCandidateAdminAccount({ email: candidateAdminEmail, passwordHash });
  const recruiterAdmin = await bootstrapRecruiterAdminAccount({ email: recruiterAdminEmail, passwordHash });

  console.log(JSON.stringify({ candidateAdmin, recruiterAdmin }, null, 2));
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
