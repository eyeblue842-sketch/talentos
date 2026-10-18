import 'dotenv/config';
import { prisma } from '../src/config/db.js';

/**
 * Verify the platform super-admin bootstrap.
 *
 * Access to the /platform console is granted by the PLATFORM_SUPER_ADMIN_EMAIL
 * identity (see middleware/platformAdmin.js) - NOT by a UserRole - because the
 * super admin is usually also an ordinary organisation owner/recruiter and must
 * keep that org-scoped role. So this script changes NOTHING: it only confirms
 * the configured owner account exists and is active, which is all the console
 * needs. It never grants PLATFORM_ADMIN (that would strip the owner's recruiter
 * access) and never touches any other account.
 *
 * Usage:
 *   PLATFORM_SUPER_ADMIN_EMAIL='vinoj@xportisglobal.com' npm run seed:platform-admin
 */
function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

async function main() {
  const configured = normalizeEmail(process.env.PLATFORM_SUPER_ADMIN_EMAIL);
  if (!configured) {
    console.error(
      'Missing PLATFORM_SUPER_ADMIN_EMAIL. The /platform console denies everyone (fail closed) until it is set.\n' +
      "Set it in the backend environment, e.g. PLATFORM_SUPER_ADMIN_EMAIL='vinoj@xportisglobal.com'.",
    );
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: configured, mode: 'insensitive' } },
    select: { id: true, email: true, role: true, isActive: true },
  });

  if (!user) {
    console.warn(
      `No account found for ${configured}. The /platform console will remain inaccessible to everyone until\n` +
      'that person registers / signs in once. No other account is granted access.',
    );
    return;
  }

  console.log(JSON.stringify({
    email: user.email,
    accountActive: user.isActive,
    platformConsoleAccess: user.isActive ? 'ENABLED (by email)' : 'BLOCKED (account inactive)',
    note: 'Access is email-based; this script makes no changes.',
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
